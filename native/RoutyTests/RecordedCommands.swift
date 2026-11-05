import Foundation
@testable import Routy

/// Runs every write command through a `ZTEClient` whose transport answers like a router and records
/// the form fields of each POST, decoded as the router decodes them.
enum RecordedCommands {
	private actor Recorder {
		var bodies: [[(String, String)]] = []
		func add(_ body: [(String, String)]) { bodies.append(body) }
		func reset() { bodies = [] }
	}

	static func run() async throws -> [(String, [(String, String)])] {
		let recorder = Recorder()
		let client = ZTEClient(address: "http://192.168.0.1", timeout: 1) { request in
			let fields: [String: Any]
			if request.httpMethod == "POST" {
				await recorder.add(decode(String(decoding: request.httpBody ?? Data(), as: UTF8.self)))
				fields = ["result": "success"]
			} else {
				let query = decode(request.url?.query(percentEncoded: true) ?? "")
				switch query.first(where: { $0.0 == "cmd" })?.1 {
				case "queryDeviceAccessControlList": fields = ["AclMode": "2", "BlackMacList": "aa:bb:cc:dd:ee:ff", "BlackNameList": "TV"]
				case "RD": fields = ["RD": ""]
				default: fields = [:]
				}
			}
			let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
			return (try JSONSerialization.data(withJSONObject: fields), response)
		}

		var results: [(String, [(String, String)])] = []
		func record(_ name: String, _ operation: () async throws -> Void) async throws {
			await recorder.reset()
			try await operation()
			// The AD token depends on the router, the SMS time on the clock (tested on its own).
			let body = await recorder.bodies.last ?? []
			results.append((name, body.filter { $0.0 != "AD" && $0.0 != "sms_time" }))
		}

		try await record("deleteSms") { try await client.deleteSms(["12", "13"]) }
		try await record("markAsRead") { await client.markRead(["12", "13"]) }
		try await record("connect") { try await client.setDataConnection(true) }
		try await record("disconnect") { try await client.setDataConnection(false) }
		try await record("reboot") { try await client.reboot() }
		try await record("nightMode") { try await client.setNightMode(NightMode(enabled: true, start: "22:30", end: "06:45")) }
		try await record("dnsManual") { try await client.setDNS(mode: .manual, primary: "1.1.1.1", secondary: "1.0.0.1") }
		try await record("bandsAuto") { try await client.setBands(mode: .auto, bands: []) }
		try await record("rename") { try await client.renameDevice(mac: "A4:83:E7:12:34:56", hostname: "iPhone di Filippo") }
		try await record("block") { try await client.blockDevice(mac: "11:22:33:44:55:66", hostname: "Camera") }
		try await record("unblock") { try await client.unblockDevice(mac: "AA:BB:CC:DD:EE:FF") }
		try await record("sendSms") { try await client.sendSms(to: "+393331234567", text: "Ciao 🍕") }
		return results
	}

	/// `application/x-www-form-urlencoded`, as a server reads it: `+` is a space, `%2B` a plus.
	private static func decode(_ form: String) -> [(String, String)] {
		form.split(separator: "&").map { pair in
			let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
			let field = { (index: Int) in
				index < parts.count ? (parts[index].replacingOccurrences(of: "+", with: " ").removingPercentEncoding ?? "") : ""
			}
			return (field(0), field(1))
		}
	}
}
