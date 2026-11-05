import Foundation

/// Everything the app asks the router. Protected reads renew an expired session on their own.
protocol RouterClient: Sendable {
	var isDemo: Bool { get }

	func login(password: String) async throws
	func dataUsage() async throws -> DataUsage
	/// Every stored SMS, newest first, as the router lists them.
	func smsList() async throws -> [RawSms]
	func sendSms(to number: String, text: String) async throws
	func markRead(_ ids: [String]) async
	func deleteSms(_ ids: [String]) async throws
	func setDataConnection(_ connected: Bool) async throws
	func reboot() async throws
	func softwareInfo() async throws -> SoftwareInfo
	func nightMode() async throws -> NightMode
	func setNightMode(_ nightMode: NightMode) async throws
	func setDNS(mode: SettingMode, primary: String, secondary: String) async throws
	/// The bands are ignored in automatic mode.
	func setBands(mode: SettingMode, bands: [String]) async throws
	func devices() async throws -> [Device]
	func renameDevice(mac: String, hostname: String) async throws
	/// The MAC of the client making the request, i.e. the phone running Routy.
	func ownMac() async throws -> String?
	func blockedDevices() async throws -> [BlockedDevice]
	func blockDevice(mac: String, hostname: String) async throws
	func unblockDevice(mac: String) async throws
}

enum RouterClients {
	/// Entering these credentials in Settings switches the app to demo mode.
	static func isDemo(address: String, password: String) -> Bool {
		Address.host(of: address) == "demo" && password == "demo"
	}

	static func make(address: String, password: String, timeout: TimeInterval = 10) -> any RouterClient {
		isDemo(address: address, password: password) ? DemoClient() : ZTEClient(address: address, timeout: timeout)
	}
}

/// The router's address as typed in Settings ("192.168.0.1") and as stored ("http://192.168.0.1").
enum Address {
	static let standard = "http://192.168.0.1"

	static func host(of address: String) -> String {
		var host = address
		if let scheme = host.range(of: "^https?://", options: [.regularExpression, .caseInsensitive]) { host.removeSubrange(scheme) }
		if host.hasSuffix("/") { host.removeLast() }
		return host
	}

	/// An empty field means the standard address; a missing scheme means HTTP.
	static func normalized(_ input: String) -> String {
		let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
		let address = trimmed.isEmpty ? "192.168.0.1" : trimmed
		return address.hasPrefix("http://") || address.hasPrefix("https://") ? address : "http://\(address)"
	}
}
