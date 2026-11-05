import CryptoKit
import Foundation

/// Moves what the Expo app kept in AsyncStorage into `Preferences` and the Keychain, once.
/// The native app has the Expo app's bundle ID, so it finds the files where the Expo app left them.
enum LegacyStorage {
	/// "@routy/…" keys of the Expo app, as written by router-context.tsx.
	private enum Key {
		static let url = "@routy/router_url"
		static let password = "@routy/password"
		static let knownIDs = "@routy/known_sms_ids"
		static let readIDs = "@routy/read_ids"
		static let dataLimitValue = "@routy/data_limit_value"
		static let dataLimitUnit = "@routy/data_limit_unit"
		static let hiddenDevices = "@routy/hidden_devices"
		static let deviceIcons = "@routy/device_icons"
	}

	/// Demo data never left memory in the native app, so it isn't carried over either.
	private static let demoMacs: Set<String> = [
		"A4:83:E7:12:34:56", "F0:18:98:AB:CD:EF", "70:2A:D5:11:22:33", "DC:A9:04:44:55:66",
		"00:11:32:77:88:99", "5C:CB:99:AA:10:20", "8C:86:1E:30:40:50", "BC:33:29:60:70:80",
	]

	/// "Application Support/<bundle ID>/RCTAsyncLocalStorage_V1", as AsyncStorage 2.x stores it.
	static var directory: URL? {
		guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first,
			let bundleID = Bundle.main.bundleIdentifier else { return nil }
		return support.appending(path: bundleID).appending(path: "RCTAsyncLocalStorage_V1")
	}

	static func migrateIfNeeded() {
		guard !Preferences.legacyMigrated else { return }
		defer { Preferences.legacyMigrated = true }
		guard let directory, let values = read(directory) else { return }

		if let url = values[Key.url] { Preferences.routerAddress = url }
		if let password = values[Key.password] { Keychain.password = password }
		if let value = values[Key.dataLimitValue] { Preferences.dataLimitValue = value }
		if let unit = values[Key.dataLimitUnit].flatMap(DataLimitUnit.init(rawValue:)) { Preferences.dataLimitUnit = unit }

		let isReal = { (id: String) in !id.hasPrefix("demo-") }
		if let known = stringArray(values[Key.knownIDs]), let url = values[Key.url] {
			Preferences.setKnownSmsIDs(Set(known.filter(isReal)), router: url)
		}
		if let read = stringArray(values[Key.readIDs]) { Preferences.readSmsIDs = Set(read.filter(isReal)) }
		if let hidden = stringArray(values[Key.hiddenDevices]) {
			Preferences.hiddenDevices = Set(hidden.map { $0.uppercased() }).subtracting(demoMacs)
		}
		if let data = values[Key.deviceIcons]?.data(using: .utf8),
			let icons = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
			Preferences.deviceIcons = icons
				.filter { !demoMacs.contains($0.key.uppercased()) }
				.reduce(into: [:]) { result, entry in
					if let icon = DeviceIcon(rawValue: entry.value) { result[entry.key.uppercased()] = icon }
				}
		}
		// The password is now in the Keychain: don't leave it in plain text on disk.
		try? FileManager.default.removeItem(at: directory)
	}

	/// Small values sit in manifest.json; values longer than 1024 characters are `null` there and
	/// live in a file named after the MD5 of their key (RNCAsyncStorage.mm).
	static func read(_ directory: URL) -> [String: String]? {
		guard let data = try? Data(contentsOf: directory.appending(path: "manifest.json")),
			let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
		var values: [String: String] = [:]
		for (key, value) in manifest {
			if let value = value as? String {
				values[key] = value
			} else if let contents = try? String(contentsOf: directory.appending(path: md5(key)), encoding: .utf8) {
				values[key] = contents
			}
		}
		return values
	}

	private static func stringArray(_ json: String?) -> [String]? {
		guard let data = json?.data(using: .utf8) else { return nil }
		return try? JSONSerialization.jsonObject(with: data) as? [String]
	}

	private static func md5(_ text: String) -> String {
		Insecure.MD5.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
	}
}
