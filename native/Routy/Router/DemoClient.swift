import Foundation

/// In-memory stand-in for the router, used in demo mode. Nothing is sent over the network, and its
/// SMS go through the same UCS2 encoding and parsing as real router data.
actor DemoClient: RouterClient {
	nonisolated let isDemo = true

	/// Fake names, used in place of the address book.
	static let contacts = [
		"+393331234567": "Giulia Rossi",
		"+393479876543": "Marco Bianchi",
		"+393405551212": "Alessandra Maria Costantini De Santis",
		"+393288887766": "Luca",
	]

	private struct Message {
		var id: String
		var number: String
		var content: String
		var date: Date
		var tag: String
	}

	private var messages: [Message]
	private var nextID: Int
	private var pppConnected = true
	private var night = NightMode(enabled: false, start: "22:00", end: "07:00")
	private var dns = (mode: SettingMode.auto, primary: "", secondary: "")
	private var bandLock = ZTE.automaticBandLock
	private var deviceList = [
		Device(hostname: "iPhone di Filippo", ip: "192.168.0.101", mac: "A4:83:E7:12:34:56", type: .wireless),
		Device(hostname: "MacBook-Pro", ip: "192.168.0.102", mac: "F0:18:98:AB:CD:EF", type: .wireless),
		Device(hostname: "Smart-TV", ip: "192.168.0.103", mac: "70:2A:D5:11:22:33", type: .cable),
		Device(hostname: "iPad", ip: "192.168.0.104", mac: "DC:A9:04:44:55:66", type: .wireless),
		Device(hostname: "NAS", ip: "192.168.0.10", mac: "00:11:32:77:88:99", type: .cable),
		// Known but offline, like the router's `hostNameList`-only entries.
		Device(hostname: "Galaxy-S23", ip: "-", mac: "5C:CB:99:AA:10:20", type: .wireless),
		Device(hostname: "Apple-Watch", ip: "-", mac: "8C:86:1E:30:40:50", type: .wireless),
		Device(hostname: "PlayStation-5", ip: "-", mac: "BC:33:29:60:70:80", type: .wireless),
	]
	private var blocked: [BlockedDevice] = []

	init() {
		let now = Date.now
		let minute: TimeInterval = 60
		let day: TimeInterval = 86_400
		let seed: [(String, TimeInterval, String, String)] = [
			// Today, unread, with a long back-and-forth to test the chat screen.
			("+393331234567", 180 * minute, "1", "Ciao! Sei riuscito a sistemare il router?"),
			("+393331234567", 170 * minute, "2", "Quasi, sto provando la nuova app"),
			("+393331234567", 160 * minute, "1", "Che app?"),
			("+393331234567", 150 * minute, "2", "Routy, gestisce SMS, consumi e dispositivi del router"),
			("+393331234567", 140 * minute, "1", "Figo! Funziona anche con il tuo ZTE?"),
			("+393331234567", 130 * minute, "2", "Sì, è fatta apposta per l'MF289F"),
			("+393331234567", 20 * minute, "1", "Allora stasera me la fai vedere 😄"),
			("+393331234567", 12 * minute, "1", "Porto io la pizza 🍕"),
			// Today, read, last message sent by us.
			("+393479876543", 90 * minute, "0", "Ci vediamo alle 18 in ufficio?"),
			("+393479876543", 80 * minute, "2", "Perfetto, a dopo!"),
			// Yesterday, very long name and preview to test truncation.
			("+393405551212", day + 120 * minute, "1",
				"Ti giro il riepilogo della riunione: abbiamo deciso di spostare il rilascio alla prossima settimana per completare i test sul nuovo firmware del router."),
			// A few days ago, unknown number (no contact name).
			("+393201112233", 3 * day, "0", "Buongiorno, il suo pacco è in consegna oggi."),
			("+393201112233", 3 * day - 5 * minute, "2", "Grazie, sono a casa."),
			// Operator-style alphanumeric sender.
			("OPERATORE", 5 * day, "0", "Hai consumato l'80% dei GB inclusi nella tua offerta. Il traffico si rinnova il giorno 1."),
			// Older than a week.
			("+393288887766", 12 * day, "0", "Buon compleanno! 🎉"),
			("+393288887766", 12 * day - 30 * minute, "2", "Grazie mille Luca!"),
			// Numeric short code.
			("40916", 20 * day, "0", "Il tuo codice di verifica è 482913"),
		]
		messages = seed.enumerated().map { index, entry in
			Message(id: "demo-\(index + 1)", number: entry.0, content: entry.3, date: now.addingTimeInterval(-entry.1), tag: entry.2)
		}
		nextID = messages.count + 1
	}

	private func delay(_ milliseconds: UInt64 = 300) async {
		try? await Task.sleep(for: .milliseconds(milliseconds))
	}

	func login(password: String) async throws {
		await delay(600)
	}

	func dataUsage() async throws -> DataUsage {
		await delay()
		// A small jitter, so the live throughput looks alive.
		let jitter = { (base: Double) in (base * Double.random(in: 0.8...1.2) * 10).rounded() / 10 }
		return DataUsage(
			monthlyRxBytes: Int64(312.4 * 1_073_741_824),
			monthlyTxBytes: Int64(41.7 * 1_073_741_824),
			networkProvider: "Demo Mobile",
			networkType: "4G",
			isCA: true,
			bands: "B3, B7, B20",
			rsrp: "-89",
			sinr: "14",
			realtimeRx: pppConnected ? jitter(8200) * 1024 : 0,
			realtimeTx: pppConnected ? jitter(950) * 1024 : 0,
			pppStatus: pppConnected ? "ppp_connected" : "ppp_disconnected",
			wanIP: pppConnected ? "100.64.12.34" : "",
			ssid24: "Routy-Demo",
			ssid5: "Routy-Demo-5G",
			cellID: "25600513",
			mcc: "222",
			mnc: "88",
			dnsMode: dns.mode,
			preferDNS: dns.primary,
			standbyDNS: dns.secondary,
			lteBandLock: bandLock
		)
	}

	func smsList() async throws -> [RawSms] {
		await delay()
		// Newest first, as the router orders them.
		return messages.reversed().map {
			RawSms(
				id: $0.id, number: ZTE.encodeUCS2($0.number), content: ZTE.encodeUCS2($0.content),
				date: Self.zteDate($0.date, unit: ZTE.ZoneUnit(tag: $0.tag)), tag: $0.tag
			)
		}
	}

	/// "yy,MM,dd,HH,mm,ss,tz" as the router lists it, the inverse of `ZTE.parseDate`.
	private static func zteDate(_ date: Date, unit: ZTE.ZoneUnit) -> String {
		let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
		return ([c.year! % 100, c.month!, c.day!, c.hour!, c.minute!, c.second!].map { String(format: "%02d", $0) }
			+ [ZTE.zoneField(date, unit: unit)]).joined(separator: ",")
	}

	func sendSms(to number: String, text: String) async throws {
		await delay()
		messages.append(Message(id: "demo-\(nextID)", number: number, content: text, date: .now, tag: "2"))
		nextID += 1
	}

	func markRead(_ ids: [String]) async {
		let ids = Set(ids)
		for index in messages.indices where ids.contains(messages[index].id) && messages[index].tag == "1" {
			messages[index].tag = "0"
		}
	}

	func deleteSms(_ ids: [String]) async throws {
		await delay()
		let ids = Set(ids)
		messages.removeAll { ids.contains($0.id) }
	}

	func setDataConnection(_ connected: Bool) async throws {
		await delay(800)
		pppConnected = connected
	}

	func reboot() async throws {
		await delay()
	}

	func softwareInfo() async throws -> SoftwareInfo {
		SoftwareInfo(model: "ZTE MF289F (Demo)", version: "DEMO_1.0.0")
	}

	func nightMode() async throws -> NightMode {
		night
	}

	func setNightMode(_ nightMode: NightMode) async throws {
		await delay()
		night = nightMode
	}

	func setDNS(mode: SettingMode, primary: String, secondary: String) async throws {
		await delay()
		dns = (mode, primary, secondary)
	}

	func setBands(mode: SettingMode, bands: [String]) async throws {
		await delay()
		bandLock = mode == .auto ? ZTE.automaticBandLock : ZTE.bandLock(bands)
	}

	func devices() async throws -> [Device] {
		await delay()
		return deviceList
	}

	func renameDevice(mac: String, hostname: String) async throws {
		await delay()
		if let index = deviceList.firstIndex(where: { $0.mac == mac.uppercased() }) { deviceList[index].hostname = hostname }
	}

	/// The demo phone is "iPhone di Filippo".
	func ownMac() async throws -> String? {
		deviceList[0].mac
	}

	func blockedDevices() async throws -> [BlockedDevice] {
		await delay()
		return blocked
	}

	func blockDevice(mac: String, hostname: String) async throws {
		await delay()
		if !blocked.contains(where: { $0.mac == mac }) { blocked.append(BlockedDevice(hostname: hostname, mac: mac)) }
	}

	func unblockDevice(mac: String) async throws {
		await delay()
		blocked.removeAll { $0.mac == mac }
	}
}
