import SwiftUI

/// The text field and send button at the bottom of a chat and of a new message.
struct MessageComposer: View {
	@Binding var text: String
	var isSending = false
	/// For a new message without a recipient yet.
	var isDisabled = false
	let send: () -> Void

	/// The Expo app's limit, unchanged.
	private static let maxLength = 160

	private var isReady: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

	var body: some View {
		HStack(alignment: .bottom, spacing: Spacing.sm) {
			TextField(L("messages.input_placeholder"), text: $text, axis: .vertical)
				.lineLimit(1...5)
				.padding(.horizontal, Spacing.lg)
				.padding(.vertical, 10)
				.frame(minHeight: 40)
				.glassEffect(.regular.interactive(), in: .rect(cornerRadius: 20))
				.onChange(of: text) { if text.count > Self.maxLength { text = String(text.prefix(Self.maxLength)) } }
			if isReady {
				Button(action: send) {
					Image(systemName: "arrow.up")
						.font(.body.weight(.semibold))
						.frame(width: Metrics.sendButton, height: Metrics.sendButton)
				}
				.buttonStyle(.glassProminent)
				.buttonBorderShape(.circle)
				.disabled(isSending || isDisabled)
				.accessibilityLabel(L("messages.send"))
				.transition(.scale(scale: 0.1).combined(with: .opacity))
			}
		}
		.animation(Motion.standard, value: isReady)
		.padding(.horizontal, Spacing.lg)
		.padding(.vertical, Spacing.sm)
	}
}
