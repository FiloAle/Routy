import CryptoKit
import Foundation

/// The router's `goform` API over the local network.
actor ZTEClient: RouterClient {
	nonisolated let isDemo = false

	/// Sends a request; RoutyTests replaces it to record what the client sends.
	typealias Transport = @Sendable (URLRequest) async throws -> (Data, URLResponse)

	private let baseURL: String
	private let transport: Transport
	/// The session cookie, sent by hand like the Expo app does, so nothing depends on cookie storage rules for IP hosts.
	private var cookie = ""
	/// Kept after a successful login, to renew the session when the router drops it.
	private var password: String?
	/// One login shared by every request that finds the session expired at the same time.
	private var renewal: Task<Void, any Error>?
	/// The constant half of the AD token. It only changes with the firmware, which needs a reboot and a new login.
	private var versionHash: String?

	init(address: String, timeout: TimeInterval, transport: Transport? = nil) {
		baseURL = address.hasSuffix("/") ? address : address + "/"
		let configuration = URLSessionConfiguration.ephemeral
		configuration.timeoutIntervalForRequest = timeout
		configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
		configuration.urlCache = nil
		configuration.httpCookieStorage = nil
		configuration.httpShouldSetCookies = false
		configuration.httpAdditionalHeaders = [
			"Referer": "\(baseURL)index.html#management/software_update.html",
			"X-Requested-With": "XMLHttpRequest",
		]
		let session = URLSession(configuration: configuration)
		self.transport = transport ?? { try await session.data(for: $0) }
	}

	// MARK: - Auth

	func login(password: String) async throws {
		let salt = try await get(["cmd": "LD"])
		guard let ld = ZTE.nonEmpty(salt, "LD") else { throw RouterError.missingSalt }
		let hashed = Self.sha256(Self.sha256(password) + ld)
		let response = try await post([("goformId", "LOGIN"), ("password", hashed)])
		// "0" or "success": logged in. "1": already logged in. "3": wrong password.
		switch ZTE.string(response, "result") {
		case "0", "1", "success":
			self.password = password
			versionHash = nil
		case "3":
			throw RouterError.wrongPassword
		case let code:
			throw RouterError.loginFailed(code ?? "")
		}
	}

	/// Runs a protected read; if the router dropped the session (on its own, or because someone
	/// logged into its dashboard), logs in again and retries once.
	private func withSession<T>(_ read: () async throws -> T) async throws -> T {
		do {
			return try await read()
		} catch RouterError.sessionExpired {
			try await renewSession()
			return try await read()
		}
	}

	private func renewSession() async throws {
		if let renewal { return try await renewal.value }
		guard let password else { throw RouterError.sessionExpired }
		let task = Task { try await self.login(password: password) }
		renewal = task
		defer { renewal = nil }
		try await task.value
	}

	/// Required by every write: MD5(MD5(wa_inner_version + cr_version) + RD).
	private func adToken() async throws -> String {
		if versionHash == nil {
			let versions = try await get(["cmd": "cr_version,wa_inner_version", "multi_data": "1"])
			versionHash = Self.md5((ZTE.string(versions, "wa_inner_version") ?? "") + (ZTE.string(versions, "cr_version") ?? ""))
		}
		let rd = try await get(["cmd": "RD"])
		return Self.md5(versionHash! + (ZTE.string(rd, "RD") ?? ""))
	}

	/// A write with the AD token; the router answers "success" or "0".
	@discardableResult
	private func command(_ goformID: String, _ parameters: [(String, String)] = [], throwing: Bool = true) async throws -> String? {
		let token = try await adToken()
		let response = try await post([("goformId", goformID)] + parameters + [("AD", token)])
		let result = ZTE.string(response, "result")
		if throwing, result != "success", result != "0" { throw RouterError.commandFailed(result ?? "") }
		return result
	}

	// MARK: - Reads

	func dataUsage() async throws -> DataUsage {
		try await withSession {
			try ZTE.dataUsage(try await get(["cmd": ZTE.dataUsageCommands.joined(separator: ","), "multi_data": "1"]))
		}
	}

	func smsList() async throws -> [RawSms] {
		try await withSession {
			let list = try ZTE.smsList(try await get([
				"cmd": "sms_data_total", "page": "0", "data_per_page": "500", "mem_store": "1", "tags": "10",
				"order_by": "order by id desc",
			]))
			// An empty list while the router still counts messages means its SMS module was busy.
			if list.isEmpty, try ZTE.storedSmsCount(try await get(["cmd": "sms_capacity_info"])) > 0 {
				throw RouterError.smsListUnavailable
			}
			return list
		}
	}

	func softwareInfo() async throws -> SoftwareInfo {
		ZTE.softwareInfo(try await get(["cmd": "cr_version", "multi_data": "1"]))
	}

	func nightMode() async throws -> NightMode {
		ZTE.nightMode(try await get([
			"cmd": "night_mode_switch,night_mode_start_time,night_mode_end_time,night_mode_close_all_led", "multi_data": "1",
		]))
	}

	/// Throws instead of returning an empty list, so the app keeps the last good one.
	func devices() async throws -> [Device] {
		try await withSession {
			let hostNames = try await get(["cmd": "hostNameList"])
			let stations = try await get(["cmd": "station_list"])
			return try ZTE.devices(hostNames: hostNames, stations: stations)
		}
	}

	func ownMac() async throws -> String? {
		try await withSession {
			ZTE.nonEmpty(try await get(["cmd": "get_user_mac_addr"]), "get_user_mac_addr")?.uppercased()
		}
	}

	func blockedDevices() async throws -> [BlockedDevice] {
		try await withSession { try await accessControl().blocked }
	}

	private func accessControl() async throws -> (aclMode: String, blocked: [BlockedDevice]) {
		try ZTE.accessControl(try await get(["cmd": "queryDeviceAccessControlList"]))
	}

	// MARK: - Writes

	func sendSms(to number: String, text: String) async throws {
		try await command("SEND_SMS", [
			("Number", number), ("sms_time", ZTE.smsTime()), ("MessageBody", ZTE.encodeUCS2(text)),
			("ID", "-1"), ("encode_type", "UNICODE"),
		])
	}

	/// Best effort: the app also remembers what was read.
	func markRead(_ ids: [String]) async {
		guard !ids.isEmpty else { return }
		_ = try? await command("SET_MSG_READ", [("msg_id", ids.joined(separator: ";") + ";"), ("tag", "0")], throwing: false)
	}

	func deleteSms(_ ids: [String]) async throws {
		guard !ids.isEmpty else { return }
		try await command("DELETE_SMS", [("msg_id", ids.joined(separator: ";"))])
	}

	func setDataConnection(_ connected: Bool) async throws {
		try await command(connected ? "CONNECT_NETWORK" : "DISCONNECT_NETWORK")
	}

	func reboot() async throws {
		try await command("REBOOT_DEVICE")
	}

	func setNightMode(_ nightMode: NightMode) async throws {
		try await command("SET_DEVICE_LED", [
			("night_mode_switch", nightMode.enabled ? "1" : "0"),
			("night_mode_start_time", nightMode.start), ("night_mode_end_time", nightMode.end),
		])
	}

	func setDNS(mode: SettingMode, primary: String, secondary: String) async throws {
		try await command("ROUTER_DNS_SETTING", [
			("dns_mode", mode.rawValue), ("prefer_dns_manual", primary), ("standby_dns_manual", secondary),
		])
	}

	func setBands(mode: SettingMode, bands: [String]) async throws {
		let lock = mode == .auto ? ZTE.automaticBandLock : ZTE.bandLock(bands)
		try await command("SET_LTE_BAND_LOCK", [("lte_band_lock", lock)])
	}

	func renameDevice(mac: String, hostname: String) async throws {
		try await command("EDIT_HOSTNAME", [("mac", mac), ("hostname", hostname)])
	}

	func blockDevice(mac: String, hostname: String) async throws {
		let blocked = try await editableBlacklist()
		if blocked.contains(where: { $0.mac.caseInsensitiveCompare(mac) == .orderedSame }) { return }
		guard blocked.count < ZTE.maxBlockedDevices else { throw RouterError.blacklistFull }
		try await setBlacklist(blocked + [BlockedDevice(hostname: hostname, mac: mac)])
	}

	func unblockDevice(mac: String) async throws {
		let blocked = try await editableBlacklist()
		try await setBlacklist(blocked.filter { $0.mac.caseInsensitiveCompare(mac) != .orderedSame })
	}

	/// Writing the blacklist switches the router to blacklist mode. With a whitelist in use ("1")
	/// that would open the network to everyone, so refuse instead.
	private func editableBlacklist() async throws -> [BlockedDevice] {
		let (aclMode, blocked) = try await withSession { try await accessControl() }
		if aclMode == "1" { throw RouterError.whitelistActive }
		return blocked
	}

	/// The same payload as the router's dashboard: blacklist mode, no whitelist.
	private func setBlacklist(_ blocked: [BlockedDevice]) async throws {
		try await command("setDeviceAccessControlList", [
			("AclMode", "2"), ("WhiteMacList", ""), ("WhiteNameList", ""),
			("BlackMacList", blocked.map(\.mac).joined(separator: ";")),
			("BlackNameList", blocked.map(\.hostname).joined(separator: ";")),
		])
	}

	// MARK: - HTTP

	private func get(_ parameters: KeyValuePairs<String, String>) async throws -> [String: Any] {
		let query = FormEncoding.query([("isTest", "false")] + parameters.map { ($0.key, $0.value) })
		return try await send(URLRequest(url: try url("goform/goform_get_cmd_process?\(query)")))
	}

	private func post(_ parameters: [(String, String)]) async throws -> [String: Any] {
		var request = URLRequest(url: try url("goform/goform_set_cmd_process"))
		request.httpMethod = "POST"
		request.setValue("application/x-www-form-urlencoded; charset=UTF-8", forHTTPHeaderField: "Content-Type")
		request.httpBody = Data(FormEncoding.body([("isTest", "false")] + parameters).utf8)
		return try await send(request)
	}

	private func url(_ path: String) throws -> URL {
		guard let url = URL(string: baseURL + path) else { throw RouterError.network(L("settings.error_conn")) }
		return url
	}

	private func send(_ request: URLRequest) async throws -> [String: Any] {
		var request = request
		if !cookie.isEmpty { request.setValue(cookie, forHTTPHeaderField: "Cookie") }
		let data: Data
		let response: URLResponse
		do {
			(data, response) = try await transport(request)
		} catch let error as URLError where error.code == .timedOut {
			throw RouterError.timedOut
		} catch {
			throw RouterError.network(error.localizedDescription)
		}
		guard let http = response as? HTTPURLResponse else { return [:] }
		guard (200..<300).contains(http.statusCode) else { throw RouterError.network("HTTP \(http.statusCode)") }
		storeCookies(from: http)
		// A body that isn't a JSON object reads as no fields, as it did with axios.
		return (try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)) as? [String: Any] ?? [:]
	}

	/// Like the Expo app: every response that sets cookies replaces the ones sent from then on.
	private func storeCookies(from response: HTTPURLResponse) {
		guard let header = response.value(forHTTPHeaderField: "Set-Cookie"), let url = response.url else { return }
		let fields = response.allHeaderFields.reduce(into: [String: String]()) { fields, entry in
			if let key = entry.key as? String, let value = entry.value as? String { fields[key] = value }
		}
		let cookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: url)
		cookie = cookies.isEmpty
			? String(header.prefix { $0 != ";" })
			: cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
	}

	// MARK: - Hashes

	/// Upper-case hex, as the router's login page computes it.
	static func sha256(_ text: String) -> String {
		SHA256.hash(data: Data(text.utf8)).map { String(format: "%02X", $0) }.joined()
	}

	/// Lower-case hex.
	static func md5(_ text: String) -> String {
		Insecure.MD5.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
	}
}
