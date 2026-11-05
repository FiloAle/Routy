import SwiftUI

/// The two actions at the bottom of a sheet: the main one filled in the app blue, the other on a faint fill.
/// Disabled, the main one stays blue and dims: the system's disabled gray reads as a hole on a dark sheet.
struct SheetButtonStyle: ButtonStyle {
	let isProminent: Bool
	@Environment(\.isEnabled) private var isEnabled

	func makeBody(configuration: Configuration) -> some View {
		configuration.label
			.font(isProminent ? Typography.body.weight(.semibold) : Typography.body)
			.foregroundStyle(isProminent ? Palette.onAccent : Palette.accent)
			.tint(isProminent ? Palette.onAccent : Palette.accent)
			.frame(maxWidth: .infinity, minHeight: Metrics.sheetButton)
			.background(isProminent ? Palette.accent : Palette.faintFill, in: .capsule)
			.contentShape(.capsule)
			.opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : Metrics.disabledOpacity)
			.animation(Motion.standard, value: isEnabled)
	}
}

extension ButtonStyle where Self == SheetButtonStyle {
	static var sheetPrimary: SheetButtonStyle { SheetButtonStyle(isProminent: true) }
	static var sheetSecondary: SheetButtonStyle { SheetButtonStyle(isProminent: false) }
}
