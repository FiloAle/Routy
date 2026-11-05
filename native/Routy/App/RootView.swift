import SwiftUI

struct RootView: View {
	@Environment(RouterStore.self) private var store
	@Environment(AppRouter.self) private var router
	@Environment(\.colorScheme) private var colorScheme

	/// A copy of the launch screen, kept until the router's first answer: iOS removes its own launch screen
	/// at the first frame, before any data arrives.
	@State private var showsSplash = true
	@State private var isHidingSplash = false
	/// The first screen with data is drawn under the opaque splash during this time, so the fade
	/// runs over a finished screen instead of competing with its first layout.
	private static let splashSettle = Duration.milliseconds(150)
	/// The longest the splash stays, settle included.
	private static let splashTimeout = Duration.seconds(2) - splashSettle

	var body: some View {
		tabs
			.overlay {
				if showsSplash {
					SplashView().transition(.opacity)
				}
			}
			.onChange(of: store.hasFirstResponse, initial: true) {
				if store.hasFirstResponse { hideSplash() }
			}
			.task {
				try? await Task.sleep(for: Self.splashTimeout)
				hideSplash()
			}
	}

	private func hideSplash() {
		guard showsSplash, !isHidingSplash else { return }
		isHidingSplash = true
		Task {
			try? await Task.sleep(for: Self.splashSettle)
			withAnimation(.easeInOut(duration: 0.35)) { showsSplash = false }
		}
	}

	private var tabs: some View {
		@Bindable var router = router
		return TabView(selection: $router.tab) {
			Tab(value: .home) {
				NavigationStack(path: $router.homePath) {
					HomeScreen().routeDestinations().tabRoot(path: router.homePath)
				}
			} label: {
				Label { Text(L("tabs.home")) } icon: { Image(uiImage: HomeIcon.image) }
			}
			Tab(value: .messages) {
				NavigationStack(path: $router.messagesPath) {
					MessagesScreen().routeDestinations().tabRoot(path: router.messagesPath)
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
					SettingsScreen().routeDestinations().tabRoot(path: router.settingsPath)
				}
			}
		}
	}
}

/// The launch screen as Info.plist describes it (UILaunchScreen): the icon at its own size, centered on the blue.
private struct SplashView: View {
	var body: some View {
		Image(.splashIcon)
			.frame(maxWidth: .infinity, maxHeight: .infinity)
			.background(Color(.launchBackground))
			.ignoresSafeArea()
			.accessibilityHidden(true)
	}
}

/// The Home tab icon: Apple's private "home.fill" (the Home app's house), as in the Expo app.
/// Loaded through UIKit's private lookup, so it may not pass App Store review; `house.fill` if it's missing.
enum HomeIcon {
	static let image: UIImage = {
		let lookup = NSSelectorFromString("_systemImageNamed:")
		if (UIImage.self as AnyObject).responds(to: lookup),
			let image = (UIImage.self as AnyObject).perform(lookup, with: "home.fill")?.takeUnretainedValue() as? UIImage {
			return image
		}
		return UIImage(systemName: "house.fill") ?? UIImage()
	}()
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
