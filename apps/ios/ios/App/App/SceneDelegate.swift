import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var universalLinkObserver: NSObjectProtocol?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let bridgeViewController = CAPBridgeViewController()
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = bridgeViewController
        window?.makeKeyAndVisible()
        openUniversalLinks(of: scene, in: bridgeViewController)

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// Capacitor only announces a universal link (for its App plugin, which this app does not ship); the game opens its
    /// page. On a cold start Capacitor announces it once the web view has appeared, so the link replaces the first load.
    private func openUniversalLinks(of scene: UIScene, in bridgeViewController: CAPBridgeViewController) {
        universalLinkObserver = NotificationCenter.default.addObserver(
            forName: .capacitorSceneOpenUniversalLink, object: scene, queue: .main
        ) { [weak bridgeViewController] notification in
            guard let url = notification.userInfo?["url"] as? URL else { return }
            bridgeViewController?.webView?.load(URLRequest(url: url))
        }
    }
}
