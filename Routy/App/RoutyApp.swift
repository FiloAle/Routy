import Contacts
import SwiftUI
import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
	private var mainWindow: UIWindow?
	private lazy var store = RouterStore()
	private let router = AppRouter()

	func application(_ application: UIApplication, willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
		// Before anything reads the preferences, including a background refresh at a background launch.
		LegacyStorage.migrateIfNeeded()
		// Set before launch ends, so tapping a notification also works when it starts the app.
		UNUserNotificationCenter.current().delegate = self
		BackgroundRefresh.register()
		return true
	}

	func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
		// Not from the scene delegate: iOS keeps the scene sessions of the installed version, and an update
		// over the Expo app (whose sessions name EXExpoAppSceneDelegate) would never call this one, leaving a
		// black screen. The scene may have connected already, which is why both cases are here.
		NotificationCenter.default.addObserver(forName: UIScene.willConnectNotification, object: nil, queue: .main) { [weak self] notification in
			let scene = notification.object as? UIScene
			MainActor.assumeIsolated { self?.showWindow(in: scene) }
		}
		// The selected segment in Routy's blue: SwiftUI's tint doesn't reach segmented pickers.
		let segments = UISegmentedControl.appearance()
		segments.selectedSegmentTintColor = UIColor(named: "AccentColor")
		segments.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .selected)
		showWindow(in: application.connectedScenes.first)

		let center = NotificationCenter.default
		center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
			MainActor.assumeIsolated { self?.store.appDidBecomeActive() }
		}
		center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
			MainActor.assumeIsolated { self?.store.appDidEnterBackground() }
		}
		// Names follow the address book while the app runs.
		center.addObserver(forName: .CNContactStoreDidChange, object: nil, queue: .main) { [weak self] _ in
			MainActor.assumeIsolated {
				guard let store = self?.store else { return }
				Task { await store.reloadContacts() }
			}
		}
		Task { await store.start() }
		return true
	}

	/// iOS 27 refuses to launch an app that doesn't adopt scenes, whatever does the work of showing the window.
	func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
		let configuration = UISceneConfiguration(name: nil, sessionRole: session.role)
		configuration.delegateClass = SceneDelegate.self
		return configuration
	}

	private func showWindow(in scene: UIScene?) {
		guard mainWindow == nil, let scene = scene as? UIWindowScene else { return }
		let window = UIWindow(windowScene: scene)
		window.rootViewController = UIHostingController(rootView: RootView().environment(store).environment(router))
		window.makeKeyAndVisible()
		mainWindow = window
	}

	// MARK: - Notifications

	nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
		[.banner, .list, .sound, .badge]
	}

	nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
		guard let number = response.notification.request.content.userInfo["number"] as? String else { return }
		await MainActor.run { router.openChat(number) }
	}
}

final class SceneDelegate: NSObject, UIWindowSceneDelegate {}
