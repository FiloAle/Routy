import SwiftUI

/// A contact's initials, or a person for a bare number, on a gray gradient.
struct Avatar: View {
	let name: String
	var size: CGFloat = Metrics.avatar

	var body: some View {
		ZStack {
			Circle().fill(Palette.avatarGradient)
			if Formatting.isNumber(name) {
				Image(systemName: "person.fill")
					.font(.system(size: size * 0.88))
					// Pushed down so the circle crops the shoulders.
					.offset(y: size * 0.12)
			} else {
				Text(Formatting.initials(name))
					.font(Typography.avatarInitials)
			}
		}
		.foregroundStyle(Palette.onAccent)
		.frame(width: size, height: size)
		.clipShape(.circle)
		.accessibilityHidden(true)
	}
}

/// A device's symbol in a rounded well.
struct DeviceIconWell: View {
	let symbol: String
	let color: Color

	var body: some View {
		Image(systemName: symbol)
			.font(.system(size: 18))
			.symbolRenderingMode(.monochrome)
			.foregroundStyle(color)
			.frame(width: Metrics.iconWell, height: Metrics.iconWell)
			.background(Palette.fill, in: .rect(cornerRadius: Radius.iconWell))
	}
}

extension Image {
	/// Swipe actions draw symbols in their `.fill` variant; an image made from a UIImage keeps the outline.
	static func outlined(_ systemName: String) -> Image {
		UIImage(systemName: systemName).map { Image(uiImage: $0.withRenderingMode(.alwaysTemplate)) } ?? Image(systemName: systemName)
	}
}
