import SwiftUI

enum AppTab: Hashable {
	case home, messages, settings
}

enum Route: Hashable {
	case chat(number: String)
	case devices
	case bands
	case dns
}

/// Tabs and navigation, so a notification can open a chat from anywhere.
@MainActor
@Observable
final class AppRouter {
	var tab = AppTab.home
	var homePath: [Route] = []
	var messagesPath: [Route] = []
	var settingsPath: [Route] = []

	/// The screen pushed on top of the current tab, if any.
	var topRoute: Route? {
		switch tab {
		case .home: homePath.last
		case .messages: messagesPath.last
		case .settings: settingsPath.last
		}
	}

	func openChat(_ number: String) {
		tab = .messages
		messagesPath = [.chat(number: number)]
	}
}

extension View {
	/// The root screen of a tab: the tab bar shows only while nothing is pushed above it.
	/// The change runs in an animation, so the bar moves instead of vanishing at once.
	func tabRoot(path: [Route]) -> some View {
		toolbarVisibility(path.isEmpty ? .visible : .hidden, for: .tabBar)
			.animation(Motion.standard, value: path.isEmpty)
	}

	func routeDestinations() -> some View {
		navigationDestination(for: Route.self) { route in
			switch route {
			case .chat(let number): ChatScreen(number: number)
			case .devices: DevicesScreen()
			case .bands: BandsScreen()
			case .dns: DNSScreen()
			}
		}
	}

	/// The view shows live data, so the store keeps it fresh while the view is on display.
	func shows(_ data: RouterStore.LiveData) -> some View {
		modifier(LiveDataViewer(data: data))
	}
}

private struct LiveDataViewer: ViewModifier {
	let data: RouterStore.LiveData
	@Environment(RouterStore.self) private var store

	func body(content: Content) -> some View {
		content
			.onAppear { store.setShows(data, true) }
			.onDisappear { store.setShows(data, false) }
	}
}
