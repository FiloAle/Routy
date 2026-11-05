import Foundation

/// Pure functions that turn the router's `goform` JSON into models, and back. Covered by RoutyTests.
enum ZTE {
	// MARK: - JSON values

	/// A field as a string, whether the router sent it as a string or a number. `nil` when missing.
	static func string(_ json: [String: Any], _ key: String) -> String? {
		switch json[key] {
		case let value as String: value
		case let value as NSNumber: value.stringValue
		default: nil
		}
	}

	/// Like JavaScript's `value || fallback`: an empty string counts as missing.
	static func nonEmpty(_ json: [String: Any], _ key: String) -> String? {
		guard let value = string(json, key), !value.isEmpty else { return nil }
		return value
	}

	/// With no session the router maps protected commands to "" instead of failing.
	static func assertSession(_ json: [String: Any], _ key: String) throws {
		if string(json, key) == "" { throw RouterError.sessionExpired }
	}

	/// JavaScript's `parseInt`: leading whitespace, an optional sign, then as many digits as there are.
	static func parseInt(_ value: String?, radix: Int = 10) -> Int? {
		guard let value else { return nil }
		var rest = Substring(value.drop(while: \.isWhitespace))
		var negative = false
		if let sign = rest.first, sign == "+" || sign == "-" {
			negative = sign == "-"
			rest = rest.dropFirst()
		}
		if radix == 16, rest.lowercased().hasPrefix("0x") { rest = rest.dropFirst(2) }
		let digits = rest.prefix { Int(String($0), radix: radix) != nil }
		guard let number = Int(digits, radix: radix) else { return nil }
		return negative ? -number : number
	}

	// MARK: - Text encoding

	/// UCS2 hex, four digits per UTF-16 unit, as the router stores SMS text.
	static func decodeUCS2(_ hex: String) -> String {
		let characters = Array(hex)
		var units: [UInt16] = []
		units.reserveCapacity(characters.count / 4)
		for start in stride(from: 0, to: characters.count, by: 4) {
			let chunk = String(characters[start..<min(start + 4, characters.count)])
			if let code = parseInt(chunk, radix: 16) { units.append(UInt16(truncatingIfNeeded: code)) }
		}
		return String(decoding: units, as: UTF16.self)
	}

	static func encodeUCS2(_ text: String) -> String {
		text.utf16.map { String(format: "%04X", $0) }.joined()
	}

	/// Numbers in the SMS list are UCS2 hex too, but a plain one ("+39…") must not be decoded into garbage.
	static func decodeNumber(_ value: String) -> String {
		guard !value.isEmpty, value.count.isMultiple(of: 4), value.allSatisfy(\.isHexDigit) else { return value }
		let decoded = decodeUCS2(value)
		// Phone numbers and sender names are Latin-1 text; anything else means the value was plain.
		let isText = decoded.unicodeScalars.allSatisfy { (0x20...0x7E).contains($0.value) || (0xA0...0xFF).contains($0.value) }
		return isText ? decoded : value
	}

	// MARK: - Dates

	/// "yy,mm,dd,hh,mi,ss,tz" in the router's local time.
	static func parseDate(_ value: String) -> Date {
		guard !value.isEmpty else { return Date(timeIntervalSince1970: 0) }
		let parts = value.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
		func part(_ index: Int, _ fallback: Int) -> Int? {
			index < parts.count ? parseInt(parts[index]) : fallback
		}
		guard let year = part(0, 0), let month = part(1, 1), let day = part(2, 1),
			let hour = part(3, 0), let minute = part(4, 0), let second = part(5, 0)
		else { return Date(timeIntervalSince1970: 0) }
		let components = DateComponents(year: 2000 + year, month: month, day: day, hour: hour, minute: minute, second: second)
		return Calendar(identifier: .gregorian).date(from: components) ?? Date(timeIntervalSince1970: 0)
	}

	/// "yy;MM;dd;HH;mm;ss;+1" for a sent SMS, with the phone's UTC offset in hours as the router's dashboard sends it.
	static func smsTime(_ date: Date = .now, timeZone: TimeZone = .current) -> String {
		var calendar = Calendar(identifier: .gregorian)
		calendar.timeZone = timeZone
		let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
		let two = { (value: Int?) in String(format: "%02d", value ?? 0) }
		let hours = Double(timeZone.secondsFromGMT(for: date)) / 3600
		let offset = hours.rounded() == hours ? String(Int(hours)) : String(hours)
		return [two(c.year.map { $0 % 100 }), two(c.month), two(c.day), two(c.hour), two(c.minute), two(c.second),
			(hours >= 0 ? "+" : "") + offset].joined(separator: ";")
	}

	// MARK: - SMS

	static func smsList(_ json: [String: Any]) throws -> [RawSms] {
		try assertSession(json, "sms_data_total")
		let messages = json["messages"] as? [[String: Any]] ?? []
		return messages.map {
			RawSms(
				id: string($0, "id") ?? "",
				number: string($0, "number") ?? "",
				content: string($0, "content") ?? "",
				date: string($0, "date") ?? "",
				tag: string($0, "tag") ?? ""
			)
		}
	}

	/// Messages stored on the router (received, sent and drafts), as its dashboard counts them.
	static func storedSmsCount(_ json: [String: Any]) throws -> Int {
		try assertSession(json, "sms_capacity_info")
		return ["sms_nv_rev_total", "sms_nv_send_total", "sms_nv_draftbox_total"]
			.reduce(0) { $0 + (parseInt(string(json, $1)) ?? 0) }
	}

	/// Groups by number, oldest message first; the most recent conversation comes first.
	/// `readIDs` are received messages read in the app, which the router may not know yet.
	static func conversations(_ raw: [RawSms], readIDs: Set<String>) -> [Conversation] {
		var order: [String] = []
		var byNumber: [String: (messages: [SmsMessage], unread: Int)] = [:]
		for sms in raw {
			let number = decodeNumber(sms.number)
			let message = SmsMessage(
				id: sms.id,
				number: number,
				content: decodeUCS2(sms.content).trimmingCharacters(in: .whitespacesAndNewlines),
				date: parseDate(sms.date),
				isSent: sms.tag == "2"
			)
			if byNumber[number] == nil { order.append(number) }
			byNumber[number, default: ([], 0)].messages.append(message)
			if sms.tag == "1", !readIDs.contains(sms.id) { byNumber[number]!.unread += 1 }
		}
		let conversations = order.map { number in
			let entry = byNumber[number]!
			return Conversation(
				number: number,
				displayName: number,
				messages: entry.messages.stableSorted { $0.date < $1.date },
				unreadCount: entry.unread
			)
		}
		return conversations.stableSorted { $0.lastMessage.date > $1.lastMessage.date }
	}

	// MARK: - Dashboard

	static let dataUsageCommands = [
		"ppp_status", "wan_ipaddr", "monthly_rx_bytes", "monthly_tx_bytes", "spn_name_data", "network_provider",
		"network_type", "wan_lte_ca", "lte_ca_pcell_band", "lte_ca_scell_info", "lte_rsrp", "sinr",
		"realtime_rx_thrpt", "realtime_tx_thrpt", "wifi_chip1_ssid1_ssid", "wifi_chip2_ssid1_ssid", "mcc", "mnc",
		"Z_eNB_id", "dns_mode", "prefer_dns_manual", "standby_dns_manual", "lte_band_lock",
	]

	static func dataUsage(_ json: [String: Any]) throws -> DataUsage {
		// A protected field that is always a number with a valid session.
		try assertSession(json, "monthly_rx_bytes")
		let int64 = { (key: String) in Int64(parseInt(string(json, key)) ?? 0) }

		let pcell = nonEmpty(json, "lte_ca_pcell_band").map(bandName)
		// "pci,index,band,earfcn,bandwidth;..."
		let scells = (string(json, "lte_ca_scell_info") ?? "")
			.split(separator: ";", omittingEmptySubsequences: false)
			.compactMap { cell -> String? in
				let fields = cell.split(separator: ",", omittingEmptySubsequences: false)
				guard fields.count >= 3 else { return nil }
				let band = fields[2].trimmingCharacters(in: .whitespaces)
				return band.isEmpty ? nil : bandName(band)
			}
		let bands = ([pcell].compactMap { $0 } + scells).joined(separator: ", ")

		let rawType = nonEmpty(json, "network_type") ?? ""
		let networkType = switch rawType.uppercased() {
		case "LTE": "4G"
		case "LTE_A": "4G+"
		default: rawType.isEmpty ? "-" : rawType
		}

		let ca = string(json, "wan_lte_ca")
		return DataUsage(
			monthlyRxBytes: int64("monthly_rx_bytes"),
			monthlyTxBytes: int64("monthly_tx_bytes"),
			networkProvider: nonEmpty(json, "spn_name_data").map(decodeUCS2).flatMap { $0.isEmpty ? nil : $0 }
				?? nonEmpty(json, "network_provider") ?? "-",
			networkType: networkType,
			isCA: ca == "active" || ca == "1" || ca == "ca_activated",
			bands: bands.isEmpty ? "-" : bands,
			rsrp: nonEmpty(json, "lte_rsrp") ?? "-",
			sinr: nonEmpty(json, "sinr") ?? "-",
			realtimeRx: Double(parseInt(string(json, "realtime_rx_thrpt")) ?? 0),
			realtimeTx: Double(parseInt(string(json, "realtime_tx_thrpt")) ?? 0),
			pppStatus: string(json, "ppp_status") ?? "",
			wanIP: string(json, "wan_ipaddr") ?? "",
			ssid24: (string(json, "wifi_chip1_ssid1_ssid") ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
			ssid5: (string(json, "wifi_chip2_ssid1_ssid") ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
			cellID: nonEmpty(json, "Z_eNB_id") ?? "-",
			mcc: nonEmpty(json, "mcc") ?? "",
			mnc: nonEmpty(json, "mnc") ?? "",
			dnsMode: string(json, "dns_mode") == "manual" ? .manual : .auto,
			preferDNS: string(json, "prefer_dns_manual") ?? "",
			standbyDNS: string(json, "standby_dns_manual") ?? "",
			lteBandLock: string(json, "lte_band_lock") ?? ""
		)
	}

	private static func bandName(_ band: String) -> String {
		band.hasPrefix("B") ? band : "B" + band
	}

	/// The eNodeB of the serving cell: the cell id without its last byte.
	static func enbID(cellID: String) -> String? {
		guard cellID != "-", let value = parseInt(cellID) else { return nil }
		return String(value / 256)
	}

	/// The cell on lteitaly.it's map, whose PLMN codes differ from the network's for a few operators.
	static func lteItalyURL(mcc: String, mnc: String, cellID: String) -> URL? {
		guard !mcc.isEmpty, !mnc.isEmpty, let enb = enbID(cellID: cellID) else { return nil }
		var plmn = mcc + mnc
		if plmn == "22201" {
			plmn = "2221"
		} else if plmn == "22299" {
			plmn = "22288"
		} else if plmn == "22250", enb.count == 6 {
			plmn = "22288"
		}
		return URL(string: "https://lteitaly.it/internal/map.php#bts=\(plmn).\(enb)")
	}

	// MARK: - Router info

	/// "…M…V…" → model "ZTE M…" and version "…" after the last V.
	static func softwareInfo(_ json: [String: Any]) -> SoftwareInfo {
		guard let raw = nonEmpty(json, "cr_version") else { return SoftwareInfo(model: "ZTE Router", version: "Unknown") }
		guard let v = raw.lastIndex(of: "V") else { return SoftwareInfo(model: "ZTE Router", version: raw) }
		let version = String(raw[raw.index(after: v)...])
		guard let m = raw[...v].lastIndex(of: "M") else { return SoftwareInfo(model: "ZTE Router", version: version) }
		return SoftwareInfo(model: "ZTE \(raw[m..<v])", version: version)
	}

	static func nightMode(_ json: [String: Any]) -> NightMode {
		NightMode(
			enabled: string(json, "night_mode_switch") == "1",
			start: nonEmpty(json, "night_mode_start_time") ?? "22:00",
			end: nonEmpty(json, "night_mode_end_time") ?? "07:00"
		)
	}

	// MARK: - Devices

	/// Connected stations first, then devices the router only remembers, merged by MAC.
	static func devices(hostNames: [String: Any], stations: [String: Any]) throws -> [Device] {
		try assertSession(hostNames, "hostNameList")
		try assertSession(stations, "station_list")
		var order: [String] = []
		var byMac: [String: Device] = [:]
		for station in stations["station_list"] as? [[String: Any]] ?? [] {
			let mac = (nonEmpty(station, "mac_addr") ?? nonEmpty(station, "mac") ?? "").uppercased()
			guard !mac.isEmpty else { continue }
			if byMac[mac] == nil { order.append(mac) }
			byMac[mac] = Device(
				hostname: nonEmpty(station, "hostname") ?? mac,
				ip: nonEmpty(station, "ip_addr") ?? nonEmpty(station, "ip") ?? "-",
				mac: mac,
				type: string(station, "connect_type") == "wired" ? .cable : .wireless
			)
		}
		for host in hostNames["devices"] as? [[String: Any]] ?? [] {
			let mac = (nonEmpty(host, "mac") ?? nonEmpty(host, "mac_addr") ?? "").uppercased()
			guard !mac.isEmpty else { continue }
			let hostname = nonEmpty(host, "hostname")
			if var device = byMac[mac] {
				if let hostname, hostname != device.mac { device.hostname = hostname }
				byMac[mac] = device
			} else {
				order.append(mac)
				byMac[mac] = Device(hostname: hostname ?? mac, ip: "-", mac: mac, type: .wireless)
			}
		}
		return order.map { byMac[$0]! }
	}

	/// The Wi-Fi MAC filter: MACs and names are two parallel `;`-separated lists.
	static func accessControl(_ json: [String: Any]) throws -> (aclMode: String, blocked: [BlockedDevice]) {
		try assertSession(json, "queryDeviceAccessControlList")
		let list = { (key: String) in nonEmpty(json, key)?.split(separator: ";", omittingEmptySubsequences: false).map(String.init) ?? [] }
		let names = list("BlackNameList")
		let blocked = list("BlackMacList").enumerated().map { index, mac in
			BlockedDevice(hostname: index < names.count && !names[index].isEmpty ? names[index] : mac, mac: mac)
		}
		return (string(json, "AclMode") ?? "", blocked)
	}

	/// The router refuses more entries than this (wifi/station_info.js).
	static let maxBlockedDevices = 32

	// MARK: - LTE bands

	static let selectableBands = ["B1", "B3", "B7", "B8", "B20", "B28", "B32", "B38"]
	/// What the router uses when no band is locked: B1, B3, B7, B8, B20, B28, B38.
	static let automaticBandLock = "0x20080800C5"

	/// One bit per band, band N at bit N - 1.
	static func bandLock(_ bands: [String]) -> String {
		let mask = bands.reduce(UInt64(0)) { mask, band in
			guard let number = parseInt(String(band.drop { $0 == "B" })), (1...64).contains(number) else { return mask }
			return mask | (1 << UInt64(number - 1))
		}
		return "0x" + String(mask, radix: 16, uppercase: true)
	}

	/// The automatic setting shows every selectable band; a lock with none of them reads as automatic too.
	static func decodeBandLock(_ value: String) -> (mode: SettingMode, bands: Set<String>) {
		let automatic = (SettingMode.auto, Set(selectableBands))
		guard !value.isEmpty, value.uppercased() != automaticBandLock.uppercased() else { return automatic }
		let lower = value.lowercased()
		// Bands above 64 don't fit a UInt64 but don't matter here: only the low 64 bits hold selectable bands.
		let mask = lower.hasPrefix("0x") ? UInt64(lower.dropFirst(2).suffix(16), radix: 16) : UInt64(lower)
		guard let mask else { return automatic }
		let selected = selectableBands.filter { band in
			guard let number = parseInt(String(band.dropFirst())) else { return false }
			return mask & (1 << UInt64(number - 1)) != 0
		}
		return selected.isEmpty ? automatic : (.manual, Set(selected))
	}
}

extension Array {
	/// `sorted(by:)` keeping equal elements in their order, like JavaScript's `sort`.
	func stableSorted(by areInIncreasingOrder: (Element, Element) -> Bool) -> [Element] {
		enumerated()
			.sorted { areInIncreasingOrder($0.element, $1.element) || (!areInIncreasingOrder($1.element, $0.element) && $0.offset < $1.offset) }
			.map(\.element)
	}
}
