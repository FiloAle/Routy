import SwiftUI

extension View {
	/// The rounded box every dashboard element sits in.
	func card() -> some View {
		background(Palette.card, in: .rect(cornerRadius: Radius.card))
	}
}

/// Opens a group of dashboard cards.
struct SectionTitle: View {
	let title: String

	var body: some View {
		Text(title)
			.font(Typography.sectionTitle)
			.foregroundStyle(Palette.textSecondary)
			.frame(maxWidth: .infinity, alignment: .leading)
	}
}

/// A dashboard value with its label, optionally pointing to another screen.
struct InfoCard<Content: View>: View {
	let label: String
	var showsChevron = false
	@ViewBuilder let content: Content

	var body: some View {
		VStack(alignment: .leading, spacing: Spacing.sm) {
			HStack {
				Text(label)
					.font(Typography.cardLabel)
					.foregroundStyle(Palette.textSecondary)
				Spacer(minLength: 0)
				if showsChevron {
					Image(systemName: "chevron.right")
						.font(.caption2.bold())
						.foregroundStyle(Palette.textSecondary)
				}
			}
			content
				.font(Typography.cardValue)
				.foregroundStyle(Palette.textPrimary)
				.lineLimit(1)
				.minimumScaleFactor(0.7)
		}
		.padding(.horizontal, Spacing.lg)
		.padding(.top, 13)
		.padding(.bottom, Spacing.lg)
		.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
		.card()
		.contentShape(.rect(cornerRadius: Radius.card))
	}
}

extension InfoCard where Content == Text {
	init(label: String, value: String, showsChevron: Bool = false) {
		self.init(label: label, showsChevron: showsChevron) { Text(value) }
	}
}

/// Two cards side by side, as tall as the taller one.
struct CardRow<Content: View>: View {
	@ViewBuilder let content: Content

	var body: some View {
		HStack(spacing: Spacing.sm) { content }
			.fixedSize(horizontal: false, vertical: true)
	}
}

/// The monthly usage against the user's reference, filling up when it appears.
struct UsageRing: View {
	let progress: Double
	let value: String
	let caption: String
	@State private var shown = 0.0

	var body: some View {
		ZStack {
			Circle()
				.stroke(Palette.accent.opacity(0.2), lineWidth: Metrics.usageRingStroke)
			Circle()
				.trim(from: 0, to: shown)
				.stroke(Palette.accent, style: StrokeStyle(lineWidth: Metrics.usageRingStroke, lineCap: .round))
				.rotationEffect(.degrees(-90))
			VStack(spacing: 0) {
				Text(value)
					.font(Typography.ringValue)
					.foregroundStyle(Palette.textPrimary)
				Text(caption)
					.font(Typography.ringCaption)
					.foregroundStyle(Palette.textSecondary)
			}
		}
		.padding(Metrics.usageRingStroke / 2)
		.frame(width: Metrics.usageRing, height: Metrics.usageRing)
		.task(id: progress) {
			withAnimation(Motion.ring) { shown = progress }
		}
	}
}
