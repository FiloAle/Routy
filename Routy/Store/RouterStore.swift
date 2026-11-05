import Foundation
import Observation
import UIKit

enum AuthState: Equatable {
	case idle, loading, loggedIn
	case failed(RouterError)
}

/// The app's state: what the router last said, plus what the user did on the phone since.
@MainActor
@Observable
final class RouterStore {
	// MARK: Settings

	private(set) var address: String
	private(set) var password: String
	private(set) var client: any RouterClient
	private(set) var auth = AuthState.idle
	var isDemo: Bool { client.isDemo }

	private(set) var dataLimitValue: String
	private(set) var dataLimitUnit: DataLimitUnit

	// MARK: Router data

	/// Set only when it changes, so the screens reading it don't update at every poll.
	private(set) var dataUsage: DataUsage?
	/// The live speed, apart from `dataUsage`: it changes at every poll, and only its card reads it.
	/// Published only while that card is on display; `latestThroughput` keeps it meanwhile.
	private(set) var throughput = Throughput.zero
	@ObservationIgnored private var latestThroughput = Throughput.zero
	private(set) var softwareInfo: SoftwareInfo?
	private(set) var nightMode: NightMode?
	private(set) var devices: [Device] = []
	private(set) var blockedDevices: [BlockedDevice] = []
	private(set) var ownMac: String?
	/// The data connection being switched, until the router confirms.
	private(set) var pendingDataConnection: Bool?

	// MARK: SMS

	/// The router's SMS list with the phone's own changes on top. Rebuilt whenever either changes.
	private(set) var conversations: [Conversation] = []
	/// The last complete list from the router, `nil` until the first one arrives.
	private(set) var smsList: [RawSms]?
	/// Sent from the app and not in the router's list yet.
	private var outbox: [(message: SmsMessage, sentAt: Date?)] = []
	/// Deleted from the app; hidden until the router stops listing them, or shown again if deleting fails.
	private var deletedIDs: Set<String> = []
	private var readIDs: Set<String> = []
	private var isFirstListAfterLogin = true

	// MARK: Phone-only state

	private(set) var contacts = ContactBook()
	private(set) var hiddenDevices: Set<String> = []
	private(set) var deviceIcons: [String: DeviceIcon] = [:]

	// MARK: Polling

	private var pollTask: Task<Void, Never>?
	private var isActive = true
	/// The launch login has run; until then, becoming active must not start a second one.
	private var didStart = false
	/// Changes with the client, so answers from the previous router are dropped.
	private var generation = 0
	/// The Mac doesn't suspend apps and has no background refresh: there polling goes on in the background,
	/// slower, to notify new SMS.
	#if targetEnvironment(macCatalyst)
	private static let pollsInBackground = true
	#else
	private static let pollsInBackground = false
	#endif
	private var pollInterval: Duration { isActive ? .seconds(3) : .seconds(30) }
	/// How many views on display show each kind of live data (see `View.shows(_:)`).
	@ObservationIgnored private var viewers: [LiveData: Int] = [:]

	init() {
		LegacyStorage.migrateIfNeeded()
		// Before reading anything: the Expo app's data becomes the preferences read below.
		dataLimitValue = Preferences.dataLimitValue
		dataLimitUnit = Preferences.dataLimitUnit
		let address = Preferences.routerAddress ?? Address.standard
		let password = Keychain.password
		self.address = address
		self.password = password
		client = RouterClients.make(address: address, password: password)
		loadLocalState()
	}

	// MARK: - Lifecycle

	/// Permissions, then the automatic login, as the Expo app did at launch.
	func start() async {
		await SMSNotifier.requestAuthorization()
		if await ContactBook.requestAccess() { await reloadContacts() }
		if !password.isEmpty { await login() }
		didStart = true
	}

	func appDidBecomeActive() {
		isActive = true
		switch auth {
		case .idle, .failed: if didStart, !password.isEmpty { Task { await login() } }
		case .loggedIn:
			// Restarted, so a poll sleeping at the background pace runs at once.
			stopPolling()
			startPolling()
		case .loading: break
		}
	}

	func appDidEnterBackground() {
		isActive = false
		guard !Self.pollsInBackground else { return }
		stopPolling()
		BackgroundRefresh.schedule()
	}

	func reloadContacts() async {
		contacts = await ContactBook.load()
		rebuildConversations()
	}

	// MARK: - Auth

	@discardableResult
	func login() async -> Bool {
		guard !password.isEmpty else {
			auth = .failed(.network(L("settings.error_pw")))
			return false
		}
		let generation = generation
		auth = .loading
		do {
			try await client.login(password: password)
			guard generation == self.generation else { return false }
			isFirstListAfterLogin = true
			auth = .loggedIn
			startPolling()
			return true
		} catch {
			guard generation == self.generation else { return false }
			auth = .failed(error as? RouterError ?? .network(error.localizedDescription))
			return false
		}
	}

	/// Points the app at another router (or the demo) and forgets everything about the previous one.
	func saveSettings(address: String, password: String) {
		Preferences.routerAddress = address
		Keychain.password = password
		switchClient(address: address, password: password)
	}

	func exitDemo() {
		Preferences.removeRouterAddress()
		Keychain.password = ""
		switchClient(address: Address.standard, password: "")
	}

	private func switchClient(address: String, password: String) {
		stopPolling()
		generation += 1
		self.address = address
		self.password = password
		client = RouterClients.make(address: address, password: password)
		auth = .idle
		dataUsage = nil
		throughput = .zero
		latestThroughput = .zero
		softwareInfo = nil
		nightMode = nil
		devices = []
		blockedDevices = []
		ownMac = nil
		pendingDataConnection = nil
		smsList = nil
		outbox = []
		deletedIDs = []
		loadLocalState()
	}

	/// Demo mode keeps its choices in memory only, so it never mixes them with the real router's.
	private func loadLocalState() {
		readIDs = isDemo ? [] : Preferences.readSmsIDs
		hiddenDevices = isDemo ? [] : Preferences.hiddenDevices
		deviceIcons = isDemo ? [:] : Preferences.deviceIcons
		rebuildConversations()
	}

	// MARK: - Polling

	private func startPolling() {
		guard pollTask == nil, isActive || Self.pollsInBackground, auth == .loggedIn else { return }
		pollTask = Task { [weak self] in
			while !Task.isCancelled {
				await self?.refresh()
				guard let interval = self?.pollInterval else { return }
				try? await Task.sleep(for: interval)
			}
		}
	}

	private func stopPolling() {
		pollTask?.cancel()
		pollTask = nil
	}

	/// One poll: each read stands on its own, and one that fails leaves its piece of state as it was.
	func refresh() async {
		guard auth == .loggedIn else { return }
		let client = client, generation = generation
		let wantsDevices = isShown(.devices)
		async let sms = Self.attempt { try await client.smsList() }
		async let usage = Self.attempt { try await client.dataUsage() }
		async let devices = Self.attempt(if: wantsDevices) { try await client.devices() }
		let (smsResult, usageResult, devicesResult) = await (sms, usage, devices)
		guard generation == self.generation else { return }
		if case .success(let value) = usageResult { apply(dataUsage: value) }
		if case .success(let value)? = devicesResult { apply(devices: value) }
		if case .success(let value) = smsResult { await apply(smsList: value) }
	}

	private nonisolated static func attempt<T: Sendable>(_ operation: @Sendable () async throws -> T) async -> Result<T, any Error> {
		do { return .success(try await operation()) } catch { return .failure(error) }
	}

	private nonisolated static func attempt<T: Sendable>(if condition: Bool, _ operation: @Sendable () async throws -> T) async -> Result<T, any Error>? {
		condition ? await attempt(operation) : nil
	}

	/// Data that changes at every poll, kept fresh only while a view on display shows it.
	enum LiveData {
		/// The device list: polling reads it from the router only while it's shown.
		case devices
		/// The live speed: read anyway with the dashboard data, published only while it's shown.
		case throughput
	}

	private func isShown(_ data: LiveData) -> Bool {
		viewers[data, default: 0] > 0
	}

	/// Called as views showing `data` appear and disappear. The first to appear gets it at once.
	func setShows(_ data: LiveData, _ shows: Bool) {
		viewers[data, default: 0] += shows ? 1 : -1
		guard shows, viewers[data] == 1 else { return }
		switch data {
		case .throughput:
			if latestThroughput != throughput { throughput = latestThroughput }
		case .devices:
			guard auth == .loggedIn else { return }
			let client = client, generation = generation
			Task {
				if let devices = try? await client.devices(), generation == self.generation { apply(devices: devices) }
			}
		}
	}

	// MARK: - SMS

	var hasUnread: Bool { conversations.contains { $0.unreadCount > 0 } }

	/// Whether there's something to show: the router's first answer arrived, it can't answer (the login
	/// failed), or there's no router to ask yet.
	var hasFirstResponse: Bool {
		if password.isEmpty { return true }
		if case .failed = auth { return true }
		return dataUsage != nil || smsList != nil
	}

	func displayName(for number: String) -> String {
		contacts.name(for: number) ?? (isDemo ? DemoClient.contacts[number] : nil) ?? number
	}

	func refreshSms() async {
		guard auth == .loggedIn, let list = try? await client.smsList() else { return }
		await apply(smsList: list)
	}

	private func apply(smsList list: [RawSms]) async {
		// The same list as last time changes nothing, unless a sent message waits to leave the outbox.
		if list == smsList, outbox.isEmpty {
			isFirstListAfterLogin = false
			return
		}
		smsList = list
		let ids = Set(list.map(\.id))
		let messages = ZTE.conversations(list, readIDs: []).flatMap(\.messages)

		// A sent message leaves the outbox once the router lists it, or some time after a send it
		// confirmed (in case the router stores it under another spelling of the number).
		var matched = Set<String>()
		outbox.removeAll { entry in
			if let twin = messages.first(where: {
				$0.isSent && !matched.contains($0.id) && $0.number == entry.message.number && $0.content == entry.message.content
					&& abs($0.date.timeIntervalSince(entry.message.date)) < 300
			}) {
				matched.insert(twin.id)
				return true
			}
			return entry.sentAt.map { Date.now.timeIntervalSince($0) > 30 } ?? false
		}
		deletedIDs.formIntersection(ids)
		let readIDs = readIDs.intersection(ids)
		if readIDs != self.readIDs { setReadIDs(readIDs) }
		rebuildConversations()

		guard !isDemo else { return }
		let silently = isFirstListAfterLogin
		isFirstListAfterLogin = false
		let contacts = contacts
		await SMSNotifier.shared.process(messages, router: address, silently: silently) { contacts.name(for: $0) ?? $0 }
	}

	private func rebuildConversations() {
		let list = (smsList ?? []).filter { !deletedIDs.contains($0.id) }
		var conversations = ZTE.conversations(list, readIDs: readIDs)
		for (message, _) in outbox {
			if let index = conversations.firstIndex(where: { $0.number == message.number }) {
				conversations[index].messages.append(message)
			} else {
				conversations.append(Conversation(number: message.number, displayName: message.number, messages: [message], unreadCount: 0))
			}
		}
		for index in conversations.indices {
			conversations[index].displayName = displayName(for: conversations[index].number)
		}
		self.conversations = conversations.stableSorted { $0.lastMessage.date > $1.lastMessage.date }
	}

	private func setReadIDs(_ ids: Set<String>) {
		readIDs = ids
		if !isDemo { Preferences.readSmsIDs = ids }
	}

	/// Shows the message at once, and takes it back if the router refuses it.
	func sendSms(to number: String, text: String) async throws {
		let message = SmsMessage(id: "outbox-\(UUID().uuidString)", number: number, content: text, date: .now, isSent: true)
		outbox.append((message, nil))
		rebuildConversations()
		do {
			try await client.sendSms(to: number, text: text)
			if let index = outbox.firstIndex(where: { $0.message.id == message.id }) { outbox[index].sentAt = .now }
		} catch {
			outbox.removeAll { $0.message.id == message.id }
			rebuildConversations()
			throw error
		}
	}

	func markRead(_ number: String) async {
		guard let conversation = conversations.first(where: { $0.number == number }), conversation.unreadCount > 0 else { return }
		let ids = conversation.messages.filter { !$0.isSent && !$0.id.hasPrefix("outbox-") }.map(\.id)
		setReadIDs(readIDs.union(ids))
		rebuildConversations()
		await client.markRead(ids)
	}

	/// Hides the chat at once, and brings it back if the router refuses to delete it.
	func deleteConversation(_ number: String) async throws {
		guard let conversation = conversations.first(where: { $0.number == number }) else { return }
		let ids = conversation.messages.map(\.id).filter { !$0.hasPrefix("outbox-") }
		outbox.removeAll { $0.message.number == number }
		deletedIDs.formUnion(ids)
		rebuildConversations()
		do {
			try await client.deleteSms(ids)
		} catch {
			deletedIDs.subtract(ids)
			rebuildConversations()
			throw error
		}
	}

	// MARK: - Dashboard and network

	/// The data connection as the switch shows it: the requested state while it's changing.
	var isDataConnected: Bool { pendingDataConnection ?? dataUsage?.isConnected ?? false }

	func refreshDataUsage() async {
		guard auth == .loggedIn else { return }
		let generation = generation
		if let reading = try? await client.dataUsage(), generation == self.generation { apply(dataUsage: reading) }
		if softwareInfo == nil, let info = try? await client.softwareInfo(), generation == self.generation { softwareInfo = info }
	}

	private func apply(dataUsage reading: (usage: DataUsage, throughput: Throughput)) {
		if reading.usage != dataUsage { dataUsage = reading.usage }
		latestThroughput = reading.throughput
		if isShown(.throughput), reading.throughput != throughput { throughput = reading.throughput }
	}

	func setDataConnection(_ connected: Bool) async throws {
		pendingDataConnection = connected
		defer { pendingDataConnection = nil }
		try await client.setDataConnection(connected)
		await refreshDataUsage()
	}

	func reboot() async throws {
		try await client.reboot()
	}

	func loadNightMode() async {
		if let nightMode = try? await client.nightMode() { self.nightMode = nightMode }
	}

	func setNightMode(_ nightMode: NightMode) async throws {
		try await client.setNightMode(nightMode)
		self.nightMode = nightMode
	}

	func setDNS(mode: SettingMode, primary: String, secondary: String) async throws {
		try await client.setDNS(mode: mode, primary: primary, secondary: secondary)
		await refreshDataUsage()
	}

	func setBands(mode: SettingMode, bands: [String]) async throws {
		try await client.setBands(mode: mode, bands: bands)
		await refreshDataUsage()
	}

	func setDataLimit(value: String, unit: DataLimitUnit) {
		dataLimitValue = value
		dataLimitUnit = unit
		Preferences.dataLimitValue = value
		Preferences.dataLimitUnit = unit
	}

	// MARK: - Devices

	/// The devices with an address, as the dashboard counts them.
	var connectedDeviceCount: Int { devices.count(where: { !$0.isDisconnected }) }

	/// Devices, blacklist and the phone's own MAC. The list stays usable if the other two can't be read.
	func loadDevices() async {
		guard auth == .loggedIn else { return }
		let client = client, generation = generation
		async let devices = Self.attempt { try await client.devices() }
		async let blocked = Self.attempt { try await client.blockedDevices() }
		async let own = Self.attempt { try await client.ownMac() }
		let (devicesResult, blockedResult, ownResult) = await (devices, blocked, own)
		guard generation == self.generation else { return }
		if case .success(let value) = devicesResult { apply(devices: value) }
		if case .success(let value) = blockedResult, value != blockedDevices { blockedDevices = value }
		if case .success(let value?) = ownResult, value != ownMac { ownMac = value }
	}

	/// A forgotten device is known again once it reconnects.
	private func apply(devices: [Device]) {
		guard devices != self.devices else { return }
		self.devices = devices
		let reconnected = Set(devices.filter { !$0.isDisconnected }.map(\.mac)).intersection(hiddenDevices)
		if !reconnected.isEmpty { setHiddenDevices(hiddenDevices.subtracting(reconnected)) }
	}

	func renameDevice(mac: String, hostname: String) async throws {
		try await client.renameDevice(mac: mac, hostname: hostname)
		await loadDevices()
	}

	func blockDevice(_ device: Device) async throws {
		try await client.blockDevice(mac: device.mac, hostname: device.hostname)
		await loadDevices()
	}

	func unblockDevice(_ device: Device) async throws {
		try await client.unblockDevice(mac: device.mac)
		await loadDevices()
	}

	func hideDevice(_ device: Device) {
		setHiddenDevices(hiddenDevices.union([device.mac.uppercased()]))
	}

	private func setHiddenDevices(_ macs: Set<String>) {
		hiddenDevices = macs
		if !isDemo { Preferences.hiddenDevices = macs }
	}

	func icon(for device: Device) -> DeviceIcon? {
		deviceIcons[device.mac.uppercased()]
	}

	func setIcon(_ icon: DeviceIcon?, for device: Device) {
		deviceIcons[device.mac.uppercased()] = icon
		if !isDemo { Preferences.deviceIcons = deviceIcons }
	}

	func isOwn(_ device: Device) -> Bool {
		ownMac == device.mac.uppercased()
	}
}
