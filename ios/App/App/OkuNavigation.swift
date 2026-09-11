import UIKit
import Capacitor
import StoreKit
import WebKit

/// Keep the system's text-selection loupe off game/menu surfaces, but preserve
/// caret movement, selection and paste while editing a real text field.
private final class OkuTextInteractionHandler: NSObject, WKScriptMessageHandler {
    weak var owner: OkuBridgeViewController?

    init(owner: OkuBridgeViewController) { self.owner = owner }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let enabled = message.body as? Bool else { return }
        owner?.webView?.configuration.preferences.isTextInteractionEnabled = enabled
    }
}

/// One permanently mounted Capacitor bridge beneath independent native navigation.
/// No extra WebViews, JavaScript runtimes, polling, or custom glass rendering.
final class OkuBridgeViewController: CAPBridgeViewController {
    weak var navigationShell: OkuTabBarController?
    let navigationPlugin = OkuNavigationPlugin()
    let reviewPlugin = OkuAppReviewPlugin()

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        // CSS user-select:none alone does not suppress WebKit's tap-and-hold loupe.
        // This public preference is available before our iOS 15 deployment target.
        configuration.preferences.isTextInteractionEnabled = false
        configuration.userContentController.add(OkuTextInteractionHandler(owner: self), name: "okuTextInteraction")
        let textInteractionScript = """
        (() => {
            const updateTextInteraction = () => {
                const element = document.activeElement;
                const editable = element instanceof HTMLElement && (
                    element.isContentEditable ||
                    element.matches('input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
                );
                window.webkit.messageHandlers.okuTextInteraction.postMessage(editable);
            };
            document.addEventListener('focusin', updateTextInteraction, true);
            // Focus can move straight to another field; inspect the settled target.
            document.addEventListener('focusout', () => queueMicrotask(updateTextInteraction), true);
            document.addEventListener('DOMContentLoaded', updateTextInteraction, { once: true });
        })();
        """
        configuration.userContentController.addUserScript(WKUserScript(source: textInteractionScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        return configuration
    }

    override func capacitorDidLoad() {
        navigationPlugin.navigationShell = navigationShell
        bridge?.registerPluginInstance(navigationPlugin)
        bridge?.registerPluginInstance(reviewPlugin)
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}

/// Only the bar receives touches; the rest passes through to the permanent WebView.
final class OkuNavigationOverlayView: UIView {
    weak var tabBar: UITabBar?
    var navigationVisible = false

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        guard navigationVisible, let tabBar, !tabBar.isHidden else { return false }
        return tabBar.point(inside: convert(point, to: tabBar), with: event)
    }
}

/// Sibling containers keep UIKit's empty-tab transitions separate from web rendering.
final class OkuRootViewController: UIViewController {
    private let appBridge: OkuBridgeViewController
    private let navigationShell: OkuTabBarController
    private let navigationOverlay = OkuNavigationOverlayView()

    init(appBridge: OkuBridgeViewController) {
        self.appBridge = appBridge
        self.navigationShell = OkuTabBarController(appBridge: appBridge)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(appBridge:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.965, green: 0.953, blue: 0.922, alpha: 1)
        addChild(appBridge)
        appBridge.view.frame = view.bounds
        appBridge.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(appBridge.view)
        appBridge.didMove(toParent: self)

        navigationOverlay.frame = view.bounds
        navigationOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        navigationOverlay.backgroundColor = .clear
        view.addSubview(navigationOverlay)
        addChild(navigationShell)
        navigationShell.view.frame = navigationOverlay.bounds
        navigationShell.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        navigationOverlay.addSubview(navigationShell.view)
        navigationOverlay.tabBar = navigationShell.tabBar
        navigationShell.didMove(toParent: self)
    }

    override var childForStatusBarStyle: UIViewController? { appBridge }
    override var childForStatusBarHidden: UIViewController? { appBridge }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { appBridge.supportedInterfaceOrientations }
}

final class OkuTabHost: UIViewController {
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        (tabBarController as? OkuTabBarController)?.reportLayout()
    }
}

final class OkuTabBarController: UITabBarController, UITabBarControllerDelegate {
    private let appBridge: OkuBridgeViewController
    private let identifiers = ["difficulty", "store", "diamondShop", "stats", "profile"]
    private var navigationVisible = false
    private var navigationEnabled = false
    private var lastBottomInset: CGFloat = -1
    private(set) var selectionId = 0
    private var appliedDarkMode: Bool?
    private var appliedVisibility: Bool?

    init(appBridge: OkuBridgeViewController) {
        self.appBridge = appBridge
        super.init(nibName: nil, bundle: nil)
        appBridge.navigationShell = self
        appBridge.navigationPlugin.navigationShell = self
    }

    required init?(coder: NSCoder) { fatalError("Use init(appBridge:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
        view.backgroundColor = .clear
        tabBar.tintColor = UIColor(red: 41 / 255, green: 37 / 255, blue: 36 / 255, alpha: 1)
        // Use a small solid glyph, not UIKit's large red pill with a white bullet.
        // Copy existing appearances so the system's native glass stays intact.
        let standardAppearance = tabBar.standardAppearance.copy() as! UITabBarAppearance
        styleRewardDots(in: standardAppearance)
        tabBar.standardAppearance = standardAppearance
        let scrollEdgeAppearance = (tabBar.scrollEdgeAppearance ?? standardAppearance).copy() as! UITabBarAppearance
        styleRewardDots(in: scrollEdgeAppearance)
        tabBar.scrollEdgeAppearance = scrollEdgeAppearance
        let labels = ["Play", "Market", "Oku Shop", "Stats", "Profile"]
        let symbols = ["square.grid.3x3", "bag", "star", "chart.bar", "person.crop.circle"]
        let selectedSymbols = ["square.grid.3x3.fill", "bag.fill", "star.fill", "chart.bar.fill", "person.crop.circle.fill"]
        viewControllers = identifiers.indices.map { index in
            let host = OkuTabHost()
            host.view.backgroundColor = .clear
            host.edgesForExtendedLayout = .all
            host.extendedLayoutIncludesOpaqueBars = true
            host.tabBarItem = UITabBarItem(title: labels[index], image: UIImage(systemName: symbols[index]), selectedImage: UIImage(systemName: selectedSymbols[index]))
            host.tabBarItem.accessibilityIdentifier = "oku-tab-\(identifiers[index])"
            return host
        }
        customizableViewControllers = []
        if #available(iOS 26.0, *) { tabBarMinimizeBehavior = .never }
        // Preserve the five bottom destinations on iPad as well as iPhone.
        if #available(iOS 18.0, *) { traitOverrides.horizontalSizeClass = .compact }
        setNavigationVisible(false)
    }

    func configure(selected: String, selectionId acknowledgedSelectionId: Int, visible: Bool, enabled: Bool, dark: Bool, shopBadge: Bool, profileBadge: Bool) {
        loadViewIfNeeded()
        // An acknowledgement for an earlier tap must not undo a newer native selection.
        guard acknowledgedSelectionId >= selectionId else { return }
        if let index = identifiers.firstIndex(of: selected), index != selectedIndex {
            // Only programmatic navigation or a rejected tap needs reconciliation.
            // A normal tap is already selected by UIKit and never enters this branch.
            selectedIndex = index
        }
        if appliedDarkMode != dark {
            appliedDarkMode = dark
            overrideUserInterfaceStyle = dark ? .dark : .light
            parent?.overrideUserInterfaceStyle = dark ? .dark : .light
            parent?.view.backgroundColor = dark ? UIColor(white: 0.09, alpha: 1) : UIColor(red: 0.965, green: 0.953, blue: 0.922, alpha: 1)
            tabBar.tintColor = dark
                ? UIColor(red: 245 / 255, green: 245 / 255, blue: 244 / 255, alpha: 1)
                : UIColor(red: 41 / 255, green: 37 / 255, blue: 36 / 255, alpha: 1)
        }
        navigationEnabled = enabled
        if tabBar.isUserInteractionEnabled != enabled { tabBar.isUserInteractionEnabled = enabled }
        let shopBadgeValue: String? = shopBadge ? "●" : nil
        let profileBadgeValue: String? = profileBadge ? "●" : nil
        if viewControllers?[2].tabBarItem.badgeValue != shopBadgeValue { viewControllers?[2].tabBarItem.badgeValue = shopBadgeValue }
        if viewControllers?[4].tabBarItem.badgeValue != profileBadgeValue { viewControllers?[4].tabBarItem.badgeValue = profileBadgeValue }
        setNavigationVisible(visible)
        reportLayout()
    }

    private func styleRewardDots(in appearance: UITabBarAppearance) {
        for layout in [appearance.stackedLayoutAppearance, appearance.inlineLayoutAppearance, appearance.compactInlineLayoutAppearance] {
            for state in [layout.normal, layout.selected, layout.disabled, layout.focused] {
                state.badgeBackgroundColor = .clear
                state.badgeTextAttributes = [
                    .foregroundColor: UIColor.systemRed,
                    .font: UIFont.systemFont(ofSize: 10, weight: .regular)
                ]
                state.badgePositionAdjustment = UIOffset(horizontal: -4, vertical: 3)
            }
        }
    }

    private func setNavigationVisible(_ visible: Bool) {
        guard appliedVisibility != visible else { return }
        appliedVisibility = visible
        navigationVisible = visible
        (view.superview as? OkuNavigationOverlayView)?.navigationVisible = visible
        if #available(iOS 18.0, *) {
            setTabBarHidden(!visible, animated: false)
        } else {
            tabBar.isHidden = !visible
        }
        tabBar.accessibilityElementsHidden = !visible
    }

    var bottomInset: CGFloat {
        guard navigationVisible, let webView = appBridge.webView else { return 0 }
        let barFrame = tabBar.convert(tabBar.bounds, to: webView)
        return max(0, min(webView.bounds.height, webView.bounds.maxY - barFrame.minY))
    }

    func reportLayout() {
        guard isViewLoaded else { return }
        let inset = bottomInset.rounded(.up)
        guard inset != lastBottomInset else { return }
        lastBottomInset = inset
        appBridge.navigationPlugin.notifyListeners("layoutChanged", data: ["bottomInset": inset])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        reportLayout()
    }

    func tabBarController(_ tabBarController: UITabBarController, shouldSelect viewController: UIViewController) -> Bool {
        // Let UIKit start its own selection animation directly from the touch.
        return navigationVisible && navigationEnabled && viewControllers?.contains(viewController) == true
    }

    func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
        guard let index = viewControllers?.firstIndex(of: viewController) else { return }
        selectionId += 1
        appBridge.navigationPlugin.notifyListeners("tabSelected", data: ["tab": identifiers[index], "selectionId": selectionId])
    }

    override var childForStatusBarStyle: UIViewController? { appBridge }
    override var childForStatusBarHidden: UIViewController? { appBridge }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { appBridge.supportedInterfaceOrientations }
}

// Review eligibility is installation-level, not part of resettable game saves.
@objc(OkuAppReviewPlugin)
public final class OkuAppReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OkuAppReviewPlugin"
    public let jsName = "OkuAppReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recordCompletion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestIfEligible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openReviewPage", returnType: CAPPluginReturnPromise)
    ]
    private let completedKey = "oku.review.completedPuzzles.v1"
    private let lastRequestKey = "oku.review.lastRequestAt.v1"
    private let cooldown: TimeInterval = 120 * 24 * 60 * 60

    @objc func recordCompletion(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard let puzzleId = call.getString("puzzleId"), !puzzleId.isEmpty else {
                call.reject("A completed puzzle identifier is required")
                return
            }
            let defaults = UserDefaults.standard
            var completed = defaults.stringArray(forKey: completedKey) ?? []
            // Only two unique identifiers are needed; do not retain a play history.
            if completed.count < 2 && !completed.contains(puzzleId) {
                completed.append(puzzleId)
                defaults.set(completed, forKey: completedKey)
            }
            call.resolve()
        }
    }

    @objc func requestIfEligible(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            let defaults = UserDefaults.standard
            let now = Date().timeIntervalSince1970
            let lastRequest = defaults.double(forKey: lastRequestKey)
            guard (defaults.stringArray(forKey: completedKey) ?? []).count >= 2,
                  lastRequest == 0 || now - lastRequest >= cooldown,
                  let controller = bridge?.viewController,
                  controller.presentedViewController == nil,
                  let scene = controller.view.window?.windowScene,
                  scene.activationState == .foregroundActive else {
                call.resolve(["requested": false])
                return
            }
            // Store an attempt, not a rating: StoreKit never reports whether the
            // sheet appeared or whether the player submitted a review.
            defaults.set(now, forKey: lastRequestKey)
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve(["requested": true])
        }
    }

    @objc func openReviewPage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let url = URL(string: "https://apps.apple.com/app/id6757077544?action=write-review")!
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() }
                else { call.reject("The App Store review page could not be opened") }
            }
        }
    }
}

@objc(OkuNavigationPlugin)
public final class OkuNavigationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OkuNavigationPlugin"
    public let jsName = "OkuNavigation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise)
    ]
    weak var navigationShell: OkuTabBarController?

    @objc func configure(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let shell = self?.navigationShell else {
                call.reject("Native navigation shell is unavailable")
                return
            }
            shell.configure(selected: call.getString("selected") ?? "difficulty",
                            selectionId: call.getInt("selectionId") ?? 0,
                            visible: call.getBool("visible") ?? false,
                            enabled: call.getBool("enabled") ?? true,
                            dark: call.getBool("dark") ?? false,
                            shopBadge: call.getBool("shopBadge") ?? false,
                            profileBadge: call.getBool("profileBadge") ?? false)
            call.resolve(["bottomInset": shell.bottomInset, "selectionId": shell.selectionId])
        }
    }
}
