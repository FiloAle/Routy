import Foundation
import Security

/// What the app keeps on the phone, outside demo mode. The router keeps everything else.
enum Preferences {
	private static var defaults: UserDefaults { .standard }

	private enum Key {
		static let routerAddress = "routerAddress"
		static let dataLimitValue = "dataLimitValue"
		static let dataLimitUnit = "dataLimitUnit"
		/// SMS already notified or seen, and the router they belong to.
		static let knownSmsIDs = "knownSmsIDs"
		static let knownSmsRouter = "knownSmsRouter"
		/// Received SMS read in the app, which the router may not know yet.
		static let readSmsIDs = "readSmsIDs"
		/// Upper-case MACs of disconnected devices the user chose to forget.
		static let hiddenDevices = "hiddenDevices"
		/// Icons chosen by the user, by upper-case MAC.
		static let deviceIcons = "deviceIcons"
		static let legacyMigrated = "legacyMigrated"
	}

	static var routerAddress: String? {
		get { defaults.string(forKey: Key.routerAddress) }
		set { defaults.set(newValue, forKey: Key.routerAddress) }
	}

	static var dataLimitValue: String {
		get { defaults.string(forKey: Key.dataLimitValue) ?? "1" }
		set { defaults.set(newValue, forKey: Key.dataLimitValue) }
	}

	static var dataLimitUnit: DataLimitUnit {
		get { defaults.string(forKey: Key.dataLimitUnit).flatMap(DataLimitUnit.init(rawValue:)) ?? .tb }
		set { defaults.set(newValue.rawValue, forKey: Key.dataLimitUnit) }
	}

	/// `nil` until the app has seen the SMS list of `router` once.
	static func knownSmsIDs(router: String) -> Set<String>? {
		guard defaults.string(forKey: Key.knownSmsRouter) == router,
			let ids = defaults.stringArray(forKey: Key.knownSmsIDs) else { return nil }
		return Set(ids)
	}

	static func setKnownSmsIDs(_ ids: Set<String>, router: String) {
		defaults.set(Array(ids), forKey: Key.knownSmsIDs)
		defaults.set(router, forKey: Key.knownSmsRouter)
	}

	static var readSmsIDs: Set<String> {
		get { Set(defaults.stringArray(forKey: Key.readSmsIDs) ?? []) }
		set { defaults.set(Array(newValue), forKey: Key.readSmsIDs) }
	}

	static var hiddenDevices: Set<String> {
		get { Set(defaults.stringArray(forKey: Key.hiddenDevices) ?? []) }
		set { defaults.set(Array(newValue), forKey: Key.hiddenDevices) }
	}

	/// Icons removed from the catalog are dropped: those devices get their automatic icon.
	static var deviceIcons: [String: DeviceIcon] {
		get {
			let stored = defaults.dictionary(forKey: Key.deviceIcons) as? [String: String] ?? [:]
			return stored.compactMapValues(DeviceIcon.init(rawValue:))
		}
		set { defaults.set(newValue.mapValues(\.rawValue), forKey: Key.deviceIcons) }
	}

	static var legacyMigrated: Bool {
		get { defaults.bool(forKey: Key.legacyMigrated) }
		set { defaults.set(newValue, forKey: Key.legacyMigrated) }
	}

	static func removeRouterAddress() {
		defaults.removeObject(forKey: Key.routerAddress)
	}
}

enum DataLimitUnit: String, CaseIterable, Sendable {
	case gb = "GB"
	case tb = "TB"

	var label: String { L("settings.\(rawValue.lowercased())") }
}

/// The router password, readable by the background refresh while the phone is locked.
enum Keychain {
	private static var query: [String: Any] { [
		kSecClass as String: kSecClassGenericPassword,
		kSecAttrService as String: "com.filippoalessandrini.routy",
		kSecAttrAccount as String: "router-password",
	] }

	static var password: String {
		get {
			var item: CFTypeRef?
			var search = query
			search[kSecReturnData as String] = true
			guard SecItemCopyMatching(search as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return "" }
			return String(decoding: data, as: UTF8.self)
		}
		set {
			SecItemDelete(query as CFDictionary)
			guard !newValue.isEmpty else { return }
			var item = query
			item[kSecValueData as String] = Data(newValue.utf8)
			item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
			SecItemAdd(item as CFDictionary, nil)
		}
	}
}
