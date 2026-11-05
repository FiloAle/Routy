import Foundation

struct DataUsage: Equatable, Sendable {
	var monthlyRxBytes: Int64
	var monthlyTxBytes: Int64
	var networkProvider: String
	/// "4G", "4G+" or what the router says; "-" if it says nothing.
	var networkType: String
	/// Carrier aggregation.
	var isCA: Bool
	/// "B3, B7, B20", or "-".
	var bands: String
	var rsrp: String
	var sinr: String
	/// Raw throughput values; see `ThroughputUnit`.
	var realtimeRx: Double
	var realtimeTx: Double
	var pppStatus: String
	var wanIP: String
	var ssid24: String
	var ssid5: String
	/// `Z_eNB_id`, or "-".
	var cellID: String
	var mcc: String
	var mnc: String
	var dnsMode: SettingMode
	var preferDNS: String
	var standbyDNS: String
	var lteBandLock: String

	var monthlyTotalBytes: Int64 { monthlyRxBytes + monthlyTxBytes }
	var isConnected: Bool { pppStatus == "ppp_connected" || pppStatus == "connected" }
	/// "4G" plus the carrier aggregation "+", unless the type already says so.
	var networkLabel: String { isCA && !networkType.hasSuffix("+") ? networkType + "+" : networkType }
}

enum SettingMode: String, Sendable {
	case auto, manual
}

enum ConnectionType: Sendable {
	case cable, wireless
}

struct Device: Identifiable, Hashable, Sendable {
	var hostname: String
	/// "-" when the router only remembers the device.
	var ip: String
	/// Upper case.
	var mac: String
	var type: ConnectionType

	var id: String { mac }
	var isDisconnected: Bool { ip.isEmpty || ip == "-" }
}

/// An entry of the router's Wi-Fi MAC blacklist.
struct BlockedDevice: Hashable, Sendable {
	var hostname: String
	/// The router's own spelling, so rewriting the list never alters it.
	var mac: String
}

struct SmsMessage: Identifiable, Hashable, Sendable {
	var id: String
	var number: String
	var content: String
	var date: Date
	var isSent: Bool
}

/// A message as the router lists it, before grouping.
struct RawSms: Sendable {
	var id: String
	var number: String
	var content: String
	var date: String
	/// "0" received and read, "1" received and unread, "2" sent.
	var tag: String
}

struct Conversation: Identifiable, Hashable, Sendable {
	var number: String
	var displayName: String
	/// Oldest first.
	var messages: [SmsMessage]
	var unreadCount: Int

	var id: String { number }
	var lastMessage: SmsMessage { messages[messages.count - 1] }
}

struct NightMode: Equatable, Sendable {
	var enabled: Bool
	/// "HH:mm".
	var start: String
	var end: String
}

struct SoftwareInfo: Equatable, Sendable {
	var model: String
	var version: String
}

enum RouterError: Error, Equatable, Sendable {
	/// Without a session the router doesn't fail: protected reads come back as "".
	case sessionExpired
	/// The SMS list came back empty while the router still counts messages.
	case smsListUnavailable
	case missingSalt
	case wrongPassword
	case loginFailed(String)
	case commandFailed(String)
	/// Writing the blacklist would turn a whitelist into a blacklist and open the network.
	case whitelistActive
	case blacklistFull
	case timedOut
	case network(String)

	var message: String {
		switch self {
		case .wrongPassword: L("settings.wrong_password")
		case .loginFailed(let code): "\(L("settings.login_failed")) (code: \(code))"
		case .missingSalt: L("settings.error_ld")
		case .timedOut: L("settings.error_timeout")
		case .network(let description): description
		default: L("settings.error_conn")
		}
	}
}
