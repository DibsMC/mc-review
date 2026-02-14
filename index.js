/**
 * Install a global JS exception guard before Expo Router initializes.
 * This keeps startup exceptions from immediately aborting release builds.
 */
(function configureReactNativeScreensEarly() {
  try {
    const screens = require("react-native-screens");
    if (screens && typeof screens.enableScreens === "function") {
      const originalEnableScreens = screens.enableScreens.bind(screens);
      screens.enableScreens = () => originalEnableScreens(false);
      screens.enableScreens(false);
    }
    if (screens && typeof screens.enableFreeze === "function") {
      screens.enableFreeze(false);
    }
  } catch (error) {
    console.error("Failed to configure react-native-screens early", error);
  }
})();

(function patchNativeExceptionsManagerEarly() {
  try {
    const { NativeModules } = require("react-native");
    const manager = NativeModules?.ExceptionsManager;
    if (!manager) return;

    const getMessage = (payload, args) => {
      if (payload && typeof payload === "object" && typeof payload.message === "string") {
        return payload.message;
      }
      if (typeof args?.[0] === "string") return args[0];
      return "A native exception was reported during startup.";
    };

    const remember = (message, payload) => {
      global.__MC_STARTUP_ERROR__ = message;
      console.error("Native ExceptionsManager payload", payload);
    };

    if (typeof manager.reportException === "function") {
      const original = manager.reportException.bind(manager);
      manager.reportException = (...args) => {
        const payload = args[0];
        remember(getMessage(payload, args), payload);
        if (__DEV__) return original(...args);
        return undefined;
      };
    }

    if (typeof manager.reportFatalException === "function") {
      const original = manager.reportFatalException.bind(manager);
      manager.reportFatalException = (...args) => {
        remember(getMessage(undefined, args), args);
        if (__DEV__) return original(...args);
        return undefined;
      };
    }
  } catch (error) {
    console.error("Failed to patch ExceptionsManager early", error);
  }
})();

(function installEarlyJsErrorGuard() {
  const errorUtils = global.ErrorUtils;
  if (!errorUtils || typeof errorUtils.setGlobalHandler !== "function") {
    return;
  }

  const previousHandler =
    typeof errorUtils.getGlobalHandler === "function" ? errorUtils.getGlobalHandler() : null;

  errorUtils.setGlobalHandler((error, isFatal) => {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message || error)
        : String(error);

    // Expose the most recent startup error so RootLayout can display it.
    global.__MC_STARTUP_ERROR__ = message;

    console.error("Global JS error", error);

    // Keep RedBox + default behavior in development only.
    if (__DEV__ && typeof previousHandler === "function") {
      previousHandler(error, isFatal);
    }
  });
})();

require("expo-router/entry");
