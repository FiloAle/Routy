import SwiftUI

struct ChatScreen: View {
	let number: String
	@Environment(RouterStore.self) private var store
	@State private var text = ""
	@State private var isSending = false
	@State private var alert: AlertItem?

	private var conversation: Conversation? { store.conversations.first { $0.number == number } }

	var body: some View {
		let messages = conversation?.messages ?? []
		ScrollView {
			LazyVStack(spacing: 0) {
				ForEach(messages.indices, id: \.self) { index in
					let message = messages[index]
					let previous = index > 0 ? messages[index - 1] : nil
					let startsDay = previous.map { !Calendar.current.isDate($0.date, inSameDayAs: message.date) } ?? true
					if startsDay {
						Text(Formatting.dayLabel(message.date))
							.font(Typography.caption)
							.foregroundStyle(Palette.textSecondary)
							.padding(.vertical, Spacing.md)
					}
					// Extra space when the sender changes; consecutive messages stay tight.
					MessageBubble(message: message)
						.padding(.top, !startsDay && previous?.isSent != message.isSent ? Spacing.sm : Spacing.xxs)
						.id(message.id)
				}
			}
			.padding(.horizontal, Spacing.lg)
			.padding(.bottom, Spacing.sm)
		}
		// Opens on the latest message, and stays there as the keyboard or new messages arrive.
		.defaultScrollAnchor(.bottom)
		.defaultScrollAnchor(.bottom, for: .sizeChanges)
		.scrollDismissesKeyboard(.interactively)
		.scrollIndicators(.hidden)
		.safeAreaBar(edge: .bottom) {
			MessageComposer(text: $text, isSending: isSending, send: send)
		}
		.navigationTitle(store.displayName(for: number))
		.navigationBarTitleDisplayMode(.inline)
		.detailScreen()
		// Also marks messages that arrive while the chat is open.
		.task(id: conversation?.unreadCount) { await store.markRead(number) }
		.alert($alert)
	}

	private func send() {
		let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
		guard !trimmed.isEmpty, !isSending else { return }
		text = ""
		isSending = true
		Task {
			defer { isSending = false }
			do {
				try await store.sendSms(to: number, text: trimmed)
			} catch {
				alert = .error(L("messages.error_send"))
			}
		}
	}
}

private struct MessageBubble: View {
	let message: SmsMessage

	var body: some View {
		let alignment: Alignment = message.isSent ? .trailing : .leading
		Text(message.content)
			.font(Typography.body)
			.foregroundStyle(message.isSent ? Palette.onAccent : Palette.textPrimary)
			.padding(.horizontal, 14)
			.padding(.top, Spacing.sm)
			.padding(.bottom, 10)
			.background(message.isSent ? Palette.accent : Palette.bubbleReceived, in: .rect(cornerRadius: Radius.bubble))
			.containerRelativeFrame(.horizontal, alignment: alignment) { width, _ in width * 0.75 }
			.frame(maxWidth: .infinity, alignment: alignment)
	}
}
