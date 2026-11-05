import Foundation
import Testing
@testable import Routy

/// The native app must return what the Expo app returns for the same input.
/// `golden.json` comes from running the Expo app's TypeScript: `node native/scripts/golden.mjs`.
struct ParityTests {
	private final class BundleToken {}

	nonisolated(unsafe) private static let golden: [String: Any] = {
		let url = Bundle(for: BundleToken.self).url(forResource: "golden", withExtension: "json")!
		return try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
	}()

	private func cases(_ key: String) -> [[String: Any]] {
		Self.golden[key] as! [[String: Any]]
	}

	/// The wall-clock time of `date`, in the phone's time zone or in the given one.
	private func local(_ date: Date, in timeZone: TimeZone = .current) -> String {
		var calendar = Calendar(identifier: .gregorian)
		calendar.timeZone = timeZone
		let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
		return String(format: "%04d-%02d-%02d %02d:%02d:%02d", c.year!, c.month!, c.day!, c.hour!, c.minute!, c.second!)
	}

	private func pairs(_ value: Any?) -> [(String, String)] {
		(value as! [[String]]).map { ($0[0], $0[1]) }
	}

	// MARK: - Hashes

	@Test func loginHash() {
		for entry in cases("hashes") {
			let password = entry["password"] as! String, ld = entry["ld"] as! String
			#expect(ZTEClient.sha256(ZTEClient.sha256(password) + ld) == entry["hash"] as! String)
		}
	}

	@Test func adToken() {
		let entry = Self.golden["adToken"] as! [String: String]
		let token = ZTEClient.md5(ZTEClient.md5(entry["innerVersion"]! + entry["crVersion"]!) + entry["rd"]!)
		#expect(token == entry["token"])
	}

	// MARK: - Text and dates

	@Test func ucs2() {
		for entry in cases("ucs2") {
			#expect(ZTE.encodeUCS2(entry["text"] as! String) == entry["hex"] as! String)
			#expect(ZTE.decodeUCS2(entry["hex"] as! String) == entry["text"] as! String)
		}
		for entry in cases("ucs2Decode") {
			#expect(ZTE.decodeUCS2(entry["hex"] as! String) == entry["text"] as! String)
		}
	}

	@Test func dates() {
		for entry in cases("dates") {
			#expect(local(ZTE.parseDate(entry["value"] as! String)) == entry["local"] as! String)
		}
	}

	@Test func conversations() {
		let input = Self.golden["conversations"] as! [String: Any]
		let raw = (input["raw"] as! [[String: String]]).map {
			RawSms(id: $0["id"]!, number: $0["number"]!, content: $0["content"]!, date: $0["date"]!, tag: $0["tag"]!)
		}
		let result = ZTE.conversations(raw, readIDs: Set(input["readIds"] as! [String]))
		// The Expo app shows the time as the router wrote it; the native app reads it in the offset it was
		// written in. Seen from that same offset, the two must match.
		let zones = Dictionary(uniqueKeysWithValues: raw.map { sms in
			(sms.id, TimeZone(secondsFromGMT: ZTE.utcOffset(of: sms.date, unit: ZTE.ZoneUnit(tag: sms.tag))!)!)
		})
		let expected = input["result"] as! [[String: Any]]
		#expect(result.count == expected.count)
		for (conversation, expected) in zip(result, expected) {
			#expect(conversation.number == expected["number"] as! String)
			#expect(conversation.unreadCount == expected["unreadCount"] as! Int)
			#expect(conversation.lastMessage.id == expected["lastMessageId"] as! String)
			let messages = expected["messages"] as! [[String: Any]]
			#expect(conversation.messages.map(\.id) == messages.map { $0["id"] as! String })
			for (message, expected) in zip(conversation.messages, messages) {
				#expect(message.number == expected["number"] as! String)
				#expect(message.content == expected["content"] as! String)
				#expect(local(message.date, in: zones[message.id]!) == expected["date"] as! String)
				#expect(message.isSent == expected["isSent"] as! Bool)
			}
		}
	}

	// MARK: - Router data

	@Test func dataUsage() throws {
		for entry in cases("dataUsage") {
			let json = entry["json"] as! [String: Any]
			let usage = try ZTE.dataUsage(json)
			guard let expected = entry["usage"] as? [String: Any] else {
				// The Expo app throws on an empty spn_name_data; the native one falls back to network_provider.
				#expect(usage.networkProvider == json["network_provider"] as! String)
				#expect(usage.networkType == "4G+")
				continue
			}
			#expect(usage.monthlyRxBytes == (expected["monthlyRxBytes"] as! NSNumber).int64Value)
			#expect(usage.monthlyTxBytes == (expected["monthlyTxBytes"] as! NSNumber).int64Value)
			#expect(usage.monthlyTotalBytes == (expected["monthlyTotalBytes"] as! NSNumber).int64Value)
			#expect(usage.networkProvider == expected["networkProvider"] as! String)
			#expect(usage.networkType == expected["networkType"] as! String)
			#expect(usage.isCA == expected["isCA"] as! Bool)
			#expect(usage.bands == expected["bands"] as! String)
			#expect(usage.rsrp == expected["rsrp"] as! String)
			#expect(usage.sinr == expected["sinr"] as! String)
			#expect(String(format: "%.1f", usage.realtimeRx / 1024) == expected["realtimeRxThrpt"] as! String)
			#expect(String(format: "%.1f", usage.realtimeTx / 1024) == expected["realtimeTxThrpt"] as! String)
			#expect(usage.pppStatus == expected["pppStatus"] as! String)
			#expect(usage.wanIP == expected["wanIp"] as! String)
			#expect(usage.ssid24 == expected["ssid24"] as! String)
			#expect(usage.ssid5 == expected["ssid5"] as! String)
			#expect(usage.cellID == expected["cellId"] as! String)
			#expect(ZTE.enbID(cellID: usage.cellID) ?? "-" == expected["enbId"] as! String)
			#expect(usage.mcc == expected["mcc"] as! String)
			#expect(usage.mnc == expected["mnc"] as! String)
			#expect(usage.dnsMode.rawValue == expected["dnsMode"] as! String)
			#expect(usage.preferDNS == expected["preferDns"] as! String)
			#expect(usage.standbyDNS == expected["standbyDns"] as! String)
			#expect(usage.lteBandLock == expected["lteBandLock"] as! String)
		}
	}

	@Test func devices() throws {
		let entry = Self.golden["devices"] as! [String: Any]
		let devices = try ZTE.devices(
			hostNames: entry["hostNameList"] as! [String: Any],
			stations: entry["stationList"] as! [String: Any]
		)
		let expected = entry["result"] as! [[String: String]]
		#expect(devices.count == expected.count)
		for (device, expected) in zip(devices, expected) {
			#expect(device.hostname == expected["hostname"])
			#expect(device.ip == expected["ip"])
			#expect(device.mac == expected["mac"])
			#expect((device.type == .cable ? "cable" : "wireless") == expected["type"])
		}
	}

	@Test func accessControl() throws {
		for entry in cases("accessControl") {
			let result = try ZTE.accessControl(entry["json"] as! [String: Any])
			let expected = entry["result"] as! [String: Any]
			#expect(result.aclMode == expected["aclMode"] as! String)
			let blocked = expected["blocked"] as! [[String: String]]
			#expect(result.blocked.map(\.mac) == blocked.map { $0["mac"]! })
			#expect(result.blocked.map(\.hostname) == blocked.map { $0["hostname"]! })
		}
	}

	@Test func softwareInfo() {
		for entry in cases("softwareInfo") {
			let info = ZTE.softwareInfo(["cr_version": entry["crVersion"] as! String])
			let expected = entry["result"] as! [String: String]
			#expect(info.model == expected["model"])
			#expect(info.version == expected["version"])
		}
	}

	@Test func bandLocks() {
		for entry in cases("bandLocks") {
			let bands = entry["bands"] as! [String]
			#expect(ZTE.bandLock(bands) == entry["lock"] as! String)
		}
	}

	// MARK: - Requests

	@Test func queries() {
		for entry in cases("queries") {
			#expect(FormEncoding.query(pairs(entry["pairs"])) == entry["query"] as! String)
		}
	}

	@Test func bodies() {
		for entry in cases("bodies") {
			#expect(FormEncoding.body(pairs(entry["pairs"])) == entry["body"] as! String)
		}
	}

	/// The fields each write command sends, through a client that records them instead of calling a router.
	@Test func commands() async throws {
		let expected = Dictionary(uniqueKeysWithValues: cases("commands").map { ($0["name"] as! String, pairs($0["body"])) })
		let recorded = try await RecordedCommands.run()
		for (name, body) in recorded {
			let want = try #require(expected[name], "\(name) missing from golden.json")
			#expect(body.map(\.0) == want.map(\.0), "\(name)")
			#expect(body.map(\.1) == want.map(\.1), "\(name)")
		}
		#expect(Set(recorded.map(\.0)) == Set(expected.keys))
	}

	// MARK: - Screens

	@Test func ssidEntries() {
		for entry in cases("ssid") {
			let result = Formatting.ssidEntries(ssid24: entry["ssid24"] as! String, ssid5: entry["ssid5"] as! String)
			let expected = entry["entries"] as! [[String: String]]
			#expect(result.map(\.label) == expected.map { $0["label"]! })
			#expect(result.map(\.value) == expected.map { $0["value"]! })
		}
	}

	@Test func deviceSymbols() {
		for entry in cases("deviceSymbols") {
			let fields = entry["device"] as! [String: String]
			let device = Device(hostname: fields["hostname"]!, ip: fields["ip"]!, mac: "00", type: fields["type"] == "cable" ? .cable : .wireless)
			let manual = (entry["manual"] as? String).flatMap(DeviceIcon.init(rawValue:))
			#expect(DeviceIcon.symbol(for: device, manual: manual) == entry["symbol"] as! String)
		}
	}

	@Test func contactKeys() {
		for entry in cases("contactKeys") {
			#expect(Formatting.contactKey(entry["phone"] as! String) == entry["key"] as! String)
		}
	}
}
