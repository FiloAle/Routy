import SwiftUI

/// The text field and send button at the bottom of a chat and of a new message.
/// The button is exactly as tall as the field on one line, and stays at its bottom as it grows.
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
				.padding(.vertical, Spacing.sm)
				.frame(minHeight: Metrics.composer)
				.glassEffect(.regular.interactive(), in: .rect(cornerRadius: Metrics.composer / 2))
				.onChange(of: text) { if text.count > Self.maxLength { text = String(text.prefix(Self.maxLength)) } }
			if isReady {
				// A plain button with its own glass: a glass button style would add padding around the circle.
				Button(action: send) {
					Image(systemName: "arrow.up")
						.font(.body.weight(.semibold))
						.foregroundStyle(Palette.onAccent)
						.frame(width: Metrics.composer, height: Metrics.composer)
						.contentShape(.circle)
				}
				.buttonStyle(.plain)
				.glassEffect(.regular.tint(Palette.accent).interactive(), in: .circle)
				.opacity(isSending || isDisabled ? Metrics.disabledOpacity : 1)
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
