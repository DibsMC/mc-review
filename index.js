/**
 * Install a global JS exception guard before Expo Router initializes.
 * This keeps startup exceptions from immediately aborting release builds.
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
