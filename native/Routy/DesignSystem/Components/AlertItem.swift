import SwiftUI

/// Every alert in the app: a message, or a confirmation that runs an action and reports its failure.
struct AlertItem: Identifiable {
	struct Confirmation {
		var label = L("common.confirm")
		/// A destructive action is red; any other is the alert's primary, bold button.
		var isDestructive = true
		var action: @MainActor () async throws -> Void
		/// Shown if the action throws.
		var failure: String
		/// Shown if the action succeeds.
		var success: (title: String, message: String)? = nil
	}

	let id = UUID()
	var title: String
	var message: String?
	var confirmation: Confirmation?

	static func error(_ message: String) -> AlertItem {
		AlertItem(title: L("common.error"), message: message)
	}
}

extension View {
	func alert(_ item: Binding<AlertItem?>) -> some View {
		let isPresented = Binding(get: { item.wrappedValue != nil }, set: { if !$0 { item.wrappedValue = nil } })
		return alert(item.wrappedValue?.title ?? "", isPresented: isPresented, presenting: item.wrappedValue) { alert in
			if let confirmation = alert.confirmation {
				Button(L("common.cancel"), role: .cancel) {}
				Button(confirmation.label, role: confirmation.isDestructive ? .destructive : nil) {
					Task {
						do {
							try await confirmation.action()
							if let success = confirmation.success {
								item.wrappedValue = AlertItem(title: success.title, message: success.message)
							}
						} catch {
							item.wrappedValue = .error(confirmation.failure)
						}
					}
				}
				.keyboardShortcut(confirmation.isDestructive ? nil : .defaultAction)
			}
		} message: { alert in
			if let message = alert.message { Text(message) }
		}
	}
}
