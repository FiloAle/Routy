import SwiftUI

/// The only source of colors in the app. See DESIGN.md.
enum Palette {
	static let accent = Color.accentColor
	static let onAccent = Color.white
	static let background = Color(uiColor: .systemBackground)
	/// Boxes on top of `background`: dashboard cards, the received bubble's dark variant.
	static let card = Color(uiColor: .secondarySystemBackground)
	static let textPrimary = Color(uiColor: .label)
	/// Darker than the system's in light mode, which is too close to the gray cards.
	static let textSecondary = dynamic(light: 0x6C6C70, dark: 0x8E8E93)
	static let separator = Color(uiColor: .opaqueSeparator)
	static let bubbleReceived = dynamic(light: 0xE9E9EB, dark: 0x1C1C1E)
	/// Icon wells; readable on the gray cards in light mode.
	static let fill = dynamic(light: 0xD8D8DD, dark: 0x3A3A3C)
	/// Unselected cells of the device icon picker, which stand out on the light sheet.
	static let pickerFill = dynamic(light: 0xFFFFFF, dark: 0x3A3A3C)
	static let faintFill = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? .white.withAlphaComponent(0.1) : .black.withAlphaComponent(0.08) })
	/// Sent data; #A7FF00 is unreadable on white.
	static let lime = dynamic(light: 0x4C9A00, dark: 0xA7FF00)
	/// Received data.
	static let rose = dynamic(light: 0xEB2951, dark: 0xFF2D55)
	static let green = Color(uiColor: .systemGreen)
	static let orange = Color(uiColor: .systemOrange)
	static let red = Color(uiColor: .systemRed)
	static let avatarGradient = LinearGradient(
		colors: [dynamic(light: 0xA5ABB8, dark: 0x3A3A3C), dynamic(light: 0x858994, dark: 0x1C1C1E)],
		startPoint: .top,
		endPoint: .bottom
	)

	static func dynamic(light: UInt32, dark: UInt32) -> Color {
		Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(rgb: dark) : UIColor(rgb: light) })
	}
}

extension UIColor {
	convenience init(rgb: UInt32) {
		self.init(
			red: CGFloat((rgb >> 16) & 0xFF) / 255,
			green: CGFloat((rgb >> 8) & 0xFF) / 255,
			blue: CGFloat(rgb & 0xFF) / 255,
			alpha: 1
		)
	}
}

/// Built on Dynamic Type styles. Numbers use the rounded design, as on the dashboard of iOS.
enum Typography {
	static let sectionTitle = Font.headline
	static let rowTitle = Font.body.weight(.semibold)
	static let body = Font.body
	static let secondary = Font.subheadline
	static let metadata = Font.footnote
	static let caption = Font.caption
	static let cardLabel = Font.footnote.weight(.medium)
	static let cardValue = Font.system(.headline, design: .rounded)
	static let statValue = Font.system(.title, design: .rounded).bold()
	static let statUnit = Font.system(.subheadline, design: .rounded).weight(.heavy)
	static let ringValue = Font.system(.title2, design: .rounded).weight(.heavy)
	static let ringCaption = Font.caption2.weight(.semibold)
	static let avatarInitials = Font.system(.title3, design: .rounded).bold()
}

enum Spacing {
	static let xxs: CGFloat = 2
	static let xs: CGFloat = 4
	static let sm: CGFloat = 8
	static let md: CGFloat = 12
	static let lg: CGFloat = 16
	static let xl: CGFloat = 20
	static let xxl: CGFloat = 28
}

enum Radius {
	static let card: CGFloat = 24
	static let bubble: CGFloat = 20
	static let iconWell: CGFloat = 10
	static let field: CGFloat = 12
}

enum Metrics {
	static let avatar: CGFloat = 50
	static let iconWell: CGFloat = 40
	/// Height of the message field on one line, and of the send button beside it.
	static let composer: CGFloat = 40
	static let usageRing: CGFloat = 120
	static let usageRingStroke: CGFloat = 12
	static let unreadDot: CGFloat = 10
	static let statusDot: CGFloat = 8
	static let disabledOpacity = 0.5
}

enum Motion {
	static let standard = Animation.smooth(duration: 0.25)
	static let ring = Animation.easeOut(duration: 1)
}

/// A translated string from the String Catalog, with `%1$@`-style arguments.
func L(_ key: String, _ arguments: any CVarArg...) -> String {
	let format = Bundle.main.localizedString(forKey: key, value: nil, table: nil)
	return arguments.isEmpty ? format : String(format: format, arguments: arguments)
}
