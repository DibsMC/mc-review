import Expo
import FirebaseCore
import React
import ReactAppDependencyProvider

private let startupFatalDefaultsKey = "MCNativeStartupFatal"

private func persistStartupFatal(_ message: String) {
  let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else { return }
  UserDefaults.standard.set(trimmed, forKey: startupFatalDefaultsKey)
  NSLog("[MC][StartupFatal] %@", trimmed)
}

private func installReactNativeFatalHandlers() {
  RCTSetFatalHandler { error in
    let message = "RCTFatal: \(error?.localizedDescription ?? "Unknown error")"
    persistStartupFatal(message)
  }

  RCTSetFatalExceptionHandler { exception in
    guard let exception else {
      persistStartupFatal("RCTFatalException: Unknown exception")
      return
    }
    let reason = exception.reason ?? "Unknown reason"
    let stack = exception.callStackSymbols.prefix(8).joined(separator: "\n")
    let message = """
    RCTFatalException: \(exception.name.rawValue)
    \(reason)
    \(stack)
    """
    persistStartupFatal(message)
  }
}

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    NSLog("[MC][Launch] didFinishLaunching begin")
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    installReactNativeFatalHandlers()
    let hasMainBundle = Bundle.main.url(forResource: "main", withExtension: "jsbundle") != nil
    NSLog("[MC][Launch] main.jsbundle present: %@", hasMainBundle ? "yes" : "no")

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.backgroundColor = .black
// @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions - expo prebuild (DO NOT MODIFY) sync-10e8520570672fd76b2403b7e1e27f5198a6349a
FirebaseApp.configure()
// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
    NSLog("[MC][Launch] Firebase configured")
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    NSLog("[MC][Launch] startReactNative called")
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      let isHidden = self?.window?.isHidden ?? true
      let hasRoot = self?.window?.rootViewController != nil
      NSLog("[MC][Launch] +1s window hidden: %@ rootVC: %@",
            isHidden ? "yes" : "no",
            hasRoot ? "yes" : "no")
    }
#endif

    NSLog("[MC][Launch] didFinishLaunching end")
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    NSLog("[MC][Lifecycle] applicationDidBecomeActive")
    super.applicationDidBecomeActive(application)
  }

  public override func applicationWillResignActive(_ application: UIApplication) {
    NSLog("[MC][Lifecycle] applicationWillResignActive")
    super.applicationWillResignActive(application)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
// @generated begin @react-native-firebase/auth-openURL - expo prebuild (DO NOT MODIFY)
    if url.host?.lowercased() == "firebaseauth" {
      // invocations for Firebase Auth are handled elsewhere and should not be forwarded to Expo Router
      return false
    }
// @generated end @react-native-firebase/auth-openURL
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
