import SwiftUI

struct RootView: View {
	@Environment(RouterStore.self) private var store
	@Environment(AppRouter.self) private var router
	@Environment(\.colorScheme) private var colorScheme

	var body: some View {
		@Bindable var router = router
		TabView(selection: $router.tab) {
			Tab(L("tabs.home"), systemImage: "house.fill", value: .home) {
				NavigationStack(path: $router.homePath) {
					HomeScreen().routeDestinations()
				}
			}
			Tab(value: .messages) {
				NavigationStack(path: $router.messagesPath) {
					MessagesScreen().routeDestinations()
				}
			} label: {
				Label {
					Text(L("tabs.messages"))
				} icon: {
					if store.hasUnread {
						Image(uiImage: UnreadIcon.image(selected: router.tab == .messages, colorScheme: colorScheme))
					} else {
						Image(systemName: "message.fill")
					}
				}
			}
			Tab(L("tabs.settings"), systemImage: "gear", value: .settings) {
				NavigationStack(path: $router.settingsPath) {
					SettingsScreen().routeDestinations()
				}
			}
		}
	}
}

/// The Messages tab icon with a blue dot. Drawn once into a bitmap: the tab bar would otherwise
/// apply its own symbol rendering and lose the two colors.
enum UnreadIcon {
	static func image(selected: Bool, colorScheme: ColorScheme) -> UIImage {
		let text: UIColor = colorScheme == .dark ? .white : .black
		let accent = UIColor(rgb: 0x208AEF)
		// The dot first, then the bubble: blue dot when idle, blue bubble when selected.
		let colors = selected ? [text, accent] : [accent, text]
		let configuration = UIImage.SymbolConfiguration(pointSize: 17, weight: .regular, scale: .large)
			.applying(UIImage.SymbolConfiguration(paletteColors: colors))
		guard let symbol = UIImage(systemName: "message.badge.filled.fill", withConfiguration: configuration) else { return UIImage() }
		let flattened = UIGraphicsImageRenderer(size: symbol.size).image { _ in
			symbol.draw(in: CGRect(origin: .zero, size: symbol.size))
		}
		var image = flattened.withAlignmentRectInsets(symbol.alignmentRectInsets)
		if let baseline = symbol.baselineOffsetFromBottom { image = image.withBaselineOffset(fromBottom: baseline) }
		return image.withRenderingMode(.alwaysOriginal)
	}
}
