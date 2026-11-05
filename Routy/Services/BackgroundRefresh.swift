import BackgroundTasks
import Foundation

/// Checks for new SMS while the app is in the background. iOS decides when it runs; it asks for every 15 minutes.
enum BackgroundRefresh {
	static let identifier = "com.filippoalessandrini.routy.refresh"

	/// Must run before the app finishes launching.
	static func register() {
		BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: .main) { task in
			nonisolated(unsafe) let task = task
			schedule()
			let work = Task { await run() }
			task.expirationHandler = { work.cancel() }
			Task {
				let succeeded = await work.value
				task.setTaskCompleted(success: succeeded)
			}
		}
	}

	static func schedule() {
		let request = BGAppRefreshTaskRequest(identifier: identifier)
		request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
		try? BGTaskScheduler.shared.submit(request)
	}

	/// Logs in, reads the SMS list and notifies what's new. Short timeouts: the budget is about 30 seconds.
	private static func run() async -> Bool {
		guard let address = Preferences.routerAddress else { return true }
		let password = Keychain.password
		guard !password.isEmpty, !RouterClients.isDemo(address: address, password: password) else { return true }
		do {
			let client = ZTEClient(address: address, timeout: 4)
			try await client.login(password: password)
			let list = try await client.smsList()
			let messages = ZTE.conversations(list, readIDs: []).flatMap(\.messages)
			let contacts = await ContactBook.load()
			await SMSNotifier.shared.process(messages, router: address) { contacts.name(for: $0) ?? $0 }
			return true
		} catch {
			return false
		}
	}
}
