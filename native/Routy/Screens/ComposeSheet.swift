import SwiftUI

/// A new message: recipient with suggestions from the address book, then the text.
struct ComposeSheet: View {
	@Environment(RouterStore.self) private var store
	@Environment(\.dismiss) private var dismiss
	@State private var recipient = ""
	@State private var contact: ContactBook.Entry?
	@State private var text = ""
	@State private var isSending = false
	@State private var alert: AlertItem?
	@FocusState private var isRecipientFocused: Bool

	/// While a contact is chosen the field holds only this invisible character, so a backspace
	/// (which empties it) can remove the contact, as in the Expo app.
	private static let placeholder = "\u{200B}"

	private var suggestions: [ContactBook.Entry] {
		contact == nil ? store.contacts.suggestions(for: recipient) : []
	}

	var body: some View {
		NavigationStack {
			VStack(spacing: 0) {
				recipientField
				if !suggestions.isEmpty {
					List(suggestions, id: \.self) { entry in
						Button { choose(entry) } label: {
							VStack(alignment: .leading, spacing: Spacing.xxs) {
								Text(entry.name).font(Typography.rowTitle).foregroundStyle(Palette.textPrimary)
								Text(entry.number).font(Typography.metadata).foregroundStyle(Palette.textSecondary)
							}
						}
					}
					.listStyle(.plain)
					.scrollContentBackground(.hidden)
				}
				Spacer(minLength: 0)
			}
			.safeAreaBar(edge: .bottom) {
				MessageComposer(text: $text, isSending: isSending, isDisabled: recipient.isEmpty, send: send)
			}
			.navigationTitle(L("messages.new"))
			.navigationBarTitleDisplayMode(.inline)
			.toolbar {
				ToolbarItem(placement: .topBarTrailing) {
					Button(role: .close) { dismiss() }
				}
			}
			.alert($alert)
		}
		.onAppear { isRecipientFocused = true }
	}

	private var recipientField: some View {
		HStack(spacing: Spacing.sm) {
			Text(L("messages.to")).foregroundStyle(Palette.textSecondary)
			if let contact {
				Group {
					Text(contact.name).fontWeight(.semibold)
					Text(contact.number).foregroundStyle(Palette.textSecondary)
				}
				.layoutPriority(1)
			}
			TextField(contact == nil ? L("messages.recipient_placeholder") : "", text: fieldText)
				.focused($isRecipientFocused)
		}
		.lineLimit(1)
		.padding(.horizontal, Spacing.lg)
		.frame(minHeight: 50)
		.glassEffect(.regular.interactive(), in: .capsule)
		.padding(.horizontal, Spacing.xl)
		.padding(.vertical, Spacing.md)
		.contentShape(.rect)
		.onTapGesture { isRecipientFocused = true }
	}

	/// The typed recipient, or the placeholder while a contact is chosen.
	private var fieldText: Binding<String> {
		Binding {
			contact == nil ? recipient : Self.placeholder
		} set: { value in
			if contact != nil {
				// A backspace removes the contact; typing replaces it.
				contact = nil
			}
			recipient = value.replacingOccurrences(of: Self.placeholder, with: "")
		}
	}

	private func choose(_ entry: ContactBook.Entry) {
		contact = entry
		recipient = entry.number
	}

	private func send() {
		let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
		let number = Formatting.recipient(recipient)
		guard !number.isEmpty, !message.isEmpty, !isSending else { return }
		isSending = true
		Task {
			defer { isSending = false }
			do {
				try await store.sendSms(to: number, text: message)
				dismiss()
			} catch {
				alert = .error(L("messages.error_send"))
			}
		}
	}
}
