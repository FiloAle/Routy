import Foundation
import UserNotifications

/// Notifies SMS the app hasn't seen yet. Shared by the foreground polling and the background
/// refresh, so the two never notify the same message twice.
actor SMSNotifier {
	static let shared = SMSNotifier()

	/// Call with every message of a complete SMS list from `router`. `silently` marks them as seen
	/// without notifying, for the first list the app shows after logging in: the user is looking at it.
	func process(_ messages: [SmsMessage], router: String, silently: Bool = false, displayName: @Sendable (String) -> String) async {
		let current = Set(messages.map(\.id))
		let known = Preferences.knownSmsIDs(router: router)
		// Only what the router still has: a deleted message's id may come back on a new one.
		// Written only when it changes, not at every poll.
		if known != current { Preferences.setKnownSmsIDs(current, router: router) }
		// The first list of a router is the baseline: notifying it would repeat every old message.
		guard !silently, let known else { return }

		let center = UNUserNotificationCenter.current()
		for message in messages where !message.isSent && !known.contains(message.id) {
			let content = UNMutableNotificationContent()
			content.title = displayName(message.number)
			content.body = message.content
			content.sound = .default
			content.userInfo = ["number": message.number]
			try? await center.add(UNNotificationRequest(identifier: "sms-\(message.id)", content: content, trigger: nil))
		}
	}

	static func requestAuthorization() async {
		_ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
	}
}
