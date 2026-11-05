import Foundation

/// Icons the user can choose for a device. Stored by id, not by symbol name, so renames stay in this one place.
enum DeviceIcon: String, CaseIterable, Identifiable, Sendable {
	case iphone, ipad, watch, computer, macbook, tv, speaker, console, drive, printer, camera, light, doorbell, plug, wifi

	var id: String { rawValue }

	var symbol: String {
		switch self {
		case .iphone: "iphone"
		case .ipad: "ipad"
		case .watch: "applewatch"
		case .computer: "desktopcomputer"
		case .macbook: "macbook"
		case .tv: "tv"
		case .speaker: "homepod.and.homepod.mini"
		case .console: "gamecontroller"
		case .drive: "externaldrive"
		case .printer: "printer"
		case .camera: "web.camera"
		case .light: "lightbulb"
		case .doorbell: "video.doorbell"
		case .plug: "poweroutlet.type.b"
		case .wifi: "wifi"
		}
	}

	var name: String { L("devices.icons.\(rawValue)") }

	/// First match wins; add rows to recognize more names.
	private static let nameRules: [(fragments: [String], icon: DeviceIcon)] = [
		(["iphone"], .iphone),
		(["ipad"], .ipad),
		(["macbook"], .macbook),
		(["tv"], .tv),
		(["nas", "drive"], .drive),
	]

	static func inferred(fromName hostname: String) -> DeviceIcon? {
		nameRules.first { rule in rule.fragments.contains { hostname.localizedCaseInsensitiveContains($0) } }?.icon
	}

	/// The manual choice, then the name, then the connection.
	static func symbol(for device: Device, manual: DeviceIcon?) -> String {
		if let icon = manual ?? inferred(fromName: device.hostname) { return icon.symbol }
		if device.isDisconnected { return "wifi.slash" }
		return device.type == .cable ? "desktopcomputer" : "wifi"
	}
}
