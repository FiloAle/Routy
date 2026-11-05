import SwiftUI
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
	private var mainWindow: UIWindow?

	func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
		NotificationCenter.default.addObserver(forName: UIScene.willConnectNotification, object: nil, queue: .main) { [weak self] notification in
			let scene = notification.object as? UIScene
			MainActor.assumeIsolated { self?.showWindow(in: scene) }
		}
		showWindow(in: application.connectedScenes.first)
		return true
	}

	func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
		let configuration = UISceneConfiguration(name: nil, sessionRole: session.role)
		configuration.delegateClass = SceneDelegate.self
		return configuration
	}

	private func showWindow(in scene: UIScene?) {
		guard mainWindow == nil, let scene = scene as? UIWindowScene else { return }
		let window = UIWindow(windowScene: scene)
		window.rootViewController = UIHostingController(rootView: Text("Routy"))
		window.makeKeyAndVisible()
		mainWindow = window
	}
}

final class SceneDelegate: NSObject, UIWindowSceneDelegate {}
