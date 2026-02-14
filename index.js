/**
 * Configure navigation screens early, but do not suppress fatal errors.
 * We want real crashes to surface so they can be diagnosed and fixed.
 */
(function configureReactNativeScreensEarly() {
  try {
    const screens = require("react-native-screens");
    if (screens && typeof screens.enableScreens === "function") {
      screens.enableScreens(false);
    }
    if (screens && typeof screens.enableFreeze === "function") {
      screens.enableFreeze(false);
    }
  } catch (error) {
    console.error("Failed to configure react-native-screens early", error);
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
    global.__MC_STARTUP_ERROR__ = message;
    console.error("Global JS error", error);

    // Always forward to RN default handling so fatal crashes are not swallowed.
    if (typeof previousHandler === "function") {
      previousHandler(error, isFatal);
    }
  });
})();

require("expo-router/entry");
