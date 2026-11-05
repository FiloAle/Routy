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

	func openChat(_ number: String) {
		tab = .messages
		messagesPath = [.chat(number: number)]
	}
}

extension View {
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

	/// Detail screens cover the tab bar, as they did in the Expo app.
	func detailScreen() -> some View {
		toolbar(.hidden, for: .tabBar)
	}
}
