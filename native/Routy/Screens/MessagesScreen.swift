import SwiftUI

struct MessagesScreen: View {
	@Environment(RouterStore.self) private var store
	@State private var isComposing = false
	@State private var alert: AlertItem?

	var body: some View {
		content
			.navigationTitle(L("messages.title"))
			.toolbar {
				ToolbarItem(placement: .topBarTrailing) {
					Button(L("messages.new"), systemImage: "square.and.pencil") { isComposing = true }
				}
			}
			.sheet(isPresented: $isComposing) { ComposeSheet() }
			.alert($alert)
	}

	@ViewBuilder private var content: some View {
		switch store.auth {
		case .failed(let error):
			ContentUnavailableView {
				Label(error.message, systemImage: "exclamationmark.triangle")
			} description: {
				Text(L("settings.error_hint"))
			} actions: {
				Button(L("settings.retry")) { Task { await store.login() } }
					.buttonStyle(.borderedProminent)
			}
		case .loading where store.smsList == nil:
			ProgressView(L("settings.status_connecting"))
		default:
			list
		}
	}

	private var list: some View {
		List(store.conversations) { conversation in
			NavigationLink(value: Route.chat(number: conversation.number)) {
				ConversationRow(conversation: conversation)
			}
			// No line between the title and the first conversation.
			.listRowSeparator(conversation.id == store.conversations.first?.id ? .hidden : .automatic, edges: .top)
			.swipeActions(edge: .trailing) {
				// No destructive role: SwiftUI would remove the row before the confirmation.
				Button(L("messages.delete"), systemImage: "trash") { confirmDelete(conversation) }
					.labelStyle(.iconOnly)
					.tint(Palette.red)
			}
		}
		.listStyle(.plain)
		.scrollIndicators(.hidden)
		.refreshable { await store.refreshSms() }
		.overlay {
			if store.conversations.isEmpty {
				if store.smsList == nil, store.auth == .loggedIn {
					ProgressView(L("messages.loading"))
				} else if store.smsList != nil || store.auth == .idle {
					ContentUnavailableView(L("messages.empty"), systemImage: "bubble.left.and.bubble.right")
				}
			}
		}
	}

	private func confirmDelete(_ conversation: Conversation) {
		alert = AlertItem(
			title: L("messages.delete_title"),
			message: L("messages.delete_confirm", conversation.displayName),
			confirmation: .init(
				label: L("messages.delete"),
				action: { try await store.deleteConversation(conversation.number) },
				failure: L("messages.delete_failed")
			)
		)
	}
}

private struct ConversationRow: View {
	let conversation: Conversation

	private var isUnread: Bool { conversation.unreadCount > 0 }

	var body: some View {
		let last = conversation.lastMessage
		HStack(spacing: Spacing.md) {
			Avatar(name: conversation.displayName)
			VStack(alignment: .leading, spacing: Spacing.xxs) {
				HStack(spacing: Spacing.sm) {
					Text(conversation.displayName)
						.font(Typography.rowTitle)
						.foregroundStyle(Palette.textPrimary)
						.lineLimit(1)
					Spacer(minLength: 0)
					Text(Formatting.listDate(last.date))
						.font(Typography.metadata)
						.foregroundStyle(Palette.textSecondary)
						.layoutPriority(1)
				}
				HStack(spacing: Spacing.sm) {
					Text(last.isSent ? L("messages.you") + last.content : last.content)
						.font(isUnread ? Typography.secondary.weight(.semibold) : Typography.secondary)
						.foregroundStyle(isUnread ? Palette.textPrimary : Palette.textSecondary)
						.lineLimit(1)
					Spacer(minLength: 0)
					if isUnread {
						Circle()
							.fill(Palette.accent)
							.frame(width: Metrics.unreadDot, height: Metrics.unreadDot)
					}
				}
			}
		}
		.padding(.vertical, Spacing.xs)
	}
}
