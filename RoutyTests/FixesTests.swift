import Foundation
import Testing
@testable import Routy

/// Behavior that differs from the Expo app on purpose: bugs fixed in the native app.
struct FixesTests {
	@Test func smsTimeUsesThePhoneTimeZone() {
		let date = Date(timeIntervalSince1970: 1_767_225_600) // 2026-01-01 00:00 UTC
		#expect(ZTE.smsTime(date, timeZone: TimeZone(identifier: "Europe/Rome")!) == "26;01;01;01;00;00;+1")
		#expect(ZTE.smsTime(date, timeZone: TimeZone(identifier: "America/New_York")!) == "25;12;31;19;00;00;-5")
		#expect(ZTE.smsTime(date, timeZone: TimeZone(identifier: "Asia/Kolkata")!) == "26;01;01;05;30;00;+5.5")
		let summer = Date(timeIntervalSince1970: 1_782_864_000) // 2026-07-01 00:00 UTC
		#expect(ZTE.smsTime(summer, timeZone: TimeZone(identifier: "Europe/Rome")!) == "26;07;01;02;00;00;+2")
	}

	/// Dates as a real MF289F listed them, in UTC: received ones carry quarters of an hour, sent ones hours.
	@Test func datesUseTheOffsetTheyWereWrittenIn() {
		let utc = { (value: String, tag: String) in
			ZTE.parseDate(value, unit: ZTE.ZoneUnit(tag: tag)).formatted(.iso8601.year().month().day().time(includingFractionalSeconds: false))
		}
		#expect(utc("26,10,24,11,30,28,8", "0") == "2026-10-24T09:30:28")
		#expect(utc("26,10,26,13,19,37,4", "0") == "2026-10-26T12:19:37")
		#expect(utc("26,05,16,15,01,05,+2", "2") == "2026-05-16T13:01:05")
		#expect(utc("26,01,10,09,00,00,-20", "1") == "2026-01-10T14:00:00")
		#expect(utc("26,01,10,09,00,00,+5.5", "2") == "2026-01-10T03:30:00")
		// No offset, or one that isn't: the phone's local time.
		#expect(ZTE.parseDate("26,01,10,09,00,00", unit: .hours) == ZTE.parseDate("26,01,10,09,00,00"))
		#expect(ZTE.parseDate("26,01,10,09,00,00,99", unit: .hours) == ZTE.parseDate("26,01,10,09,00,00"))
		// What the demo and the app write reads back as the same moment.
		let now = Date(timeIntervalSince1970: 1_782_864_000)
		let rome = TimeZone(identifier: "Europe/Rome")!
		#expect(ZTE.zoneField(now, unit: .quarterHours, timeZone: rome) == "8")
		#expect(ZTE.zoneField(now, unit: .hours, timeZone: rome) == "+2")
		#expect(ZTE.zoneField(now, unit: .quarterHours, timeZone: TimeZone(identifier: "America/New_York")!) == "-16")
	}

	@Test func plainNumbersStayAsTheyAre() {
		#expect(ZTE.decodeNumber("+393331234567") == "+393331234567")
		#expect(ZTE.decodeNumber("3933312345") == "3933312345")
		#expect(ZTE.decodeNumber("39333123") == "39333123")
		#expect(ZTE.decodeNumber(ZTE.encodeUCS2("+393331234567")) == "+393331234567")
		#expect(ZTE.decodeNumber(ZTE.encodeUCS2("OPERATORE")) == "OPERATORE")
		#expect(ZTE.decodeNumber("") == "")
	}

	@Test func emptyCarrierAggregationBandsAreSkipped() throws {
		let usage = try ZTE.dataUsage(["monthly_rx_bytes": "1", "lte_ca_pcell_band": "3", "lte_ca_scell_info": "1,2, ,4;5,6,7,8"])
		#expect(usage.bands == "B3, B7")
	}

	@Test func networkTypeIsNotInvented() throws {
		let usage = try ZTE.dataUsage(["monthly_rx_bytes": "1"])
		#expect(usage.networkType == "-")
		#expect(usage.networkProvider == "-")
		#expect(usage.bands == "-")
	}

	@Test func carrierAggregationAddsOnePlus() throws {
		let lteA = try ZTE.dataUsage(["monthly_rx_bytes": "1", "network_type": "LTE_A", "wan_lte_ca": "active"])
		#expect(lteA.networkLabel == "4G+")
		let lte = try ZTE.dataUsage(["monthly_rx_bytes": "1", "network_type": "LTE", "wan_lte_ca": "ca_activated"])
		#expect(lte.networkLabel == "4G+")
	}

	@Test func expiredSessionIsDetected() {
		#expect(throws: RouterError.sessionExpired) { try ZTE.dataUsage(["monthly_rx_bytes": ""]) }
		#expect(throws: RouterError.sessionExpired) { try ZTE.smsList(["sms_data_total": ""]) }
	}

	@Test func bandLockRoundTrip() {
		#expect(ZTE.decodeBandLock("0x20080800C5").mode == .auto)
		#expect(ZTE.decodeBandLock("").mode == .auto)
		#expect(ZTE.decodeBandLock("0x0").mode == .auto)
		#expect(ZTE.decodeBandLock("garbage").mode == .auto)
		let manual = ZTE.decodeBandLock(ZTE.bandLock(["B3", "B20"]))
		#expect(manual.mode == .manual)
		#expect(manual.bands == ["B3", "B20"])
		#expect(ZTE.decodeBandLock("0x1" + "0000000000000004").bands == ["B3"])
		#expect(ZTE.decodeBandLock(ZTE.bandLock(ZTE.selectableBands)).bands == Set(ZTE.selectableBands))
	}

	@Test func lteItalyLinks() {
		#expect(ZTE.lteItalyURL(mcc: "222", mnc: "50", cellID: "25600513")?.absoluteString == "https://lteitaly.it/internal/map.php#bts=22288.100002")
		#expect(ZTE.lteItalyURL(mcc: "222", mnc: "01", cellID: "2560051")?.absoluteString == "https://lteitaly.it/internal/map.php#bts=2221.10000")
		#expect(ZTE.lteItalyURL(mcc: "222", mnc: "99", cellID: "256")?.absoluteString == "https://lteitaly.it/internal/map.php#bts=22288.1")
		#expect(ZTE.lteItalyURL(mcc: "222", mnc: "10", cellID: "256")?.absoluteString == "https://lteitaly.it/internal/map.php#bts=22210.1")
		#expect(ZTE.lteItalyURL(mcc: "222", mnc: "10", cellID: "-") == nil)
		#expect(ZTE.lteItalyURL(mcc: "", mnc: "10", cellID: "256") == nil)
	}

	@Test func hostnameRules() {
		#expect(Formatting.hostnameError("") != nil)
		#expect(Formatting.hostnameError(" a") != nil)
		#expect(Formatting.hostnameError("a ") != nil)
		for character in ["+", ";", "\"", "\\"] { #expect(Formatting.hostnameError("a\(character)b") != nil) }
		#expect(Formatting.hostnameError("iPhone di Filippo") == nil)
	}

	@Test func recipients() {
		#expect(Formatting.recipient(" 333 123 4567 ") == "+393331234567")
		#expect(Formatting.recipient("0044 (20) 7946-0958") == "+442079460958")
		#expect(Formatting.recipient("+39 333.123.4567") == "+393331234567")
		#expect(Formatting.recipient("40916") == "40916")
	}

	@Test func contactKeysIgnoreTheInternationalPrefix() {
		#expect(Formatting.contactKey("0039 333 123 4567") == "3331234567")
		#expect(Formatting.contactKey("+39 333 123 4567") == Formatting.contactKey("3331234567"))
	}

	@Test func initials() {
		#expect(Formatting.initials("Alessandra Maria Costantini De Santis") == "AS")
		#expect(Formatting.initials("luca") == "L")
		#expect(Formatting.initials("  ") == "")
		#expect(Formatting.isNumber("+393331234567"))
		#expect(Formatting.isNumber("40916"))
		#expect(!Formatting.isNumber("OPERATORE"))
	}

	@Test func dayDifference() {
		var calendar = Calendar(identifier: .gregorian)
		calendar.timeZone = TimeZone(identifier: "Europe/Rome")!
		let now = Date(timeIntervalSince1970: 1_774_749_600) // 2026-03-29 04:40 in Rome, hours after the clocks changed
		#expect(Formatting.dayDifference(now.addingTimeInterval(-3_600), now: now, calendar: calendar) == 0)
		#expect(Formatting.dayDifference(now.addingTimeInterval(-86_400), now: now, calendar: calendar) == 1)
		#expect(Formatting.dayDifference(now.addingTimeInterval(-6 * 86_400), now: now, calendar: calendar) == 6)
	}
}
