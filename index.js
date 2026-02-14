/**
 * Configure navigation screens early and capture startup errors.
 * In production we keep the app alive long enough to render fallback UI.
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
  } catch {
    // Keep startup resilient even if screen config fails.
  }
})();

function formatStartupError(error) {
  if (!error) return "Unknown startup error";
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message.trim();
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function installGlobalJsErrorGuard() {
  const errorUtils = global.ErrorUtils;
  if (!errorUtils || typeof errorUtils.setGlobalHandler !== "function") {
    return;
  }

  const previousHandler =
    typeof errorUtils.getGlobalHandler === "function" ? errorUtils.getGlobalHandler() : null;

  errorUtils.setGlobalHandler((error, isFatal) => {
    global.__MC_STARTUP_ERROR__ = formatStartupError(error);

    // Keep dev error overlay behaviour unchanged.
    if (__DEV__ && typeof previousHandler === "function") {
      previousHandler(error, isFatal);
    }
  });
}

function registerBootstrapFallback(error) {
  const React = require("react");
  const { registerRootComponent } = require("expo");
  const { View, Text } = require("react-native");
  const message = formatStartupError(error);

  global.__MC_STARTUP_ERROR__ = message;

  function BootstrapFallback() {
    return React.createElement(
      View,
      {
        style: {
          flex: 1,
          backgroundColor: "#0A0B0F",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        },
      },
      React.createElement(
        Text,
        {
          style: {
            color: "white",
            fontSize: 20,
            fontWeight: "700",
            textAlign: "center",
          },
        },
        "App failed to start"
      ),
      React.createElement(
        Text,
        {
          style: {
            marginTop: 10,
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            textAlign: "center",
          },
        },
        message
      )
    );
  }

  registerRootComponent(BootstrapFallback);
}

installGlobalJsErrorGuard();

try {
  require("expo-router/entry");
} catch (error) {
  registerBootstrapFallback(error);
}
