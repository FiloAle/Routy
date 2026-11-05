import Foundation

/// Text shown on screen, derived from router data. Pure, so RoutyTests can cover it.
enum Formatting {
	// MARK: - Dates

	/// Conversation list: the time today, "yesterday", the weekday this week, else a short date.
	static func listDate(_ date: Date, now: Date = .now, calendar: Calendar = .current) -> String {
		switch dayDifference(date, now: now, calendar: calendar) {
		case 0: date.formatted(.dateTime.hour().minute())
		case 1: L("common.yesterday")
		case 2..<7: date.formatted(.dateTime.weekday(.wide))
		default: date.formatted(.dateTime.day(.twoDigits).month(.twoDigits).year(.twoDigits))
		}
	}

	/// Chat separator: "today", "yesterday", the weekday this week, else "7 May".
	static func dayLabel(_ date: Date, now: Date = .now, calendar: Calendar = .current) -> String {
		switch dayDifference(date, now: now, calendar: calendar) {
		case 0: L("common.today")
		case 1: L("common.yesterday")
		case 2..<7: date.formatted(.dateTime.weekday(.wide))
		default: date.formatted(.dateTime.day().month(.wide))
		}
	}

	/// Calendar days between the two dates; negative for a date in the future.
	static func dayDifference(_ date: Date, now: Date, calendar: Calendar) -> Int {
		calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 0
	}

	// MARK: - Data

	static func gigabytes(_ bytes: Int64) -> Double {
		Double(bytes) / 1_073_741_824
	}

	/// The dashboard's throughput, from the router's raw value, in the unit the user picked.
	static func speed(_ raw: Double, unit: SpeedUnit) -> String {
		let kilo = raw / 1024
		return switch unit {
		case .kbps: String(Int(kilo.rounded()))
		case .mbps: String(format: "%.1f", kilo / 1024)
		}
	}

	enum SpeedUnit: String {
		case kbps = "Kbps"
		case mbps = "Mbps"

		var toggled: SpeedUnit { self == .kbps ? .mbps : .kbps }
	}

	// MARK: - Wi-Fi

	/// Two rows only when the bands have different, non-empty SSIDs; with one SSID for all bands one value is empty.
	static func ssidEntries(ssid24: String, ssid5: String) -> [(label: String, value: String)] {
		let a = ssid24.trimmingCharacters(in: .whitespacesAndNewlines)
		let b = ssid5.trimmingCharacters(in: .whitespacesAndNewlines)
		if !a.isEmpty, !b.isEmpty, a != b { return [("SSID 2.4GHz", a), ("SSID 5GHz", b)] }
		let single = a.isEmpty ? b : a
		return single.isEmpty ? [] : [("SSID", single)]
	}

	// MARK: - Names and numbers

	/// The router's dashboard rules (wifi/station_info.js).
	static func hostnameError(_ hostname: String) -> String? {
		if hostname.isEmpty { return L("devices.rename_required") }
		if hostname.hasPrefix(" ") || hostname.hasSuffix(" ") || hostname.contains(where: { "+;\"\\".contains($0) }) {
			return L("devices.rename_invalid")
		}
		return nil
	}

	/// A typed recipient as the router expects it: no spacing, "00" as "+", and Italian mobiles with "+39".
	static func recipient(_ input: String) -> String {
		var number = input.trimmingCharacters(in: .whitespacesAndNewlines).filter { !" ()-.".contains($0) && !$0.isWhitespace }
		if number.hasPrefix("00") {
			number = "+" + number.dropFirst(2)
		} else if !number.hasPrefix("+"), number.count == 10, number.hasPrefix("3") {
			number = "+39" + number
		}
		return number
	}

	/// The key contacts are matched on: digits only, without the Italian prefix.
	static func contactKey(_ phone: String) -> String {
		var digits = phone.filter(\.isASCII).filter(\.isNumber)
		if digits.hasPrefix("00") { digits.removeFirst(2) }
		if digits.hasPrefix("39"), digits.count > 10 { digits.removeFirst(2) }
		return digits
	}

	/// A phone number or short code, as opposed to a name.
	static func isNumber(_ name: String) -> Bool {
		let digits = name.hasPrefix("+") ? name.dropFirst() : Substring(name)
		return !digits.isEmpty && digits.allSatisfy { $0.isASCII && $0.isNumber }
	}

	/// The first letters of the first and last word.
	static func initials(_ name: String) -> String {
		let words = name.split(whereSeparator: \.isWhitespace)
		guard let first = words.first?.first else { return "" }
		let last = words.count >= 2 ? words.last?.first.map(String.init) ?? "" : ""
		return (String(first) + last).uppercased()
	}
}
