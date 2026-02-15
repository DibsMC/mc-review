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

const STARTUP_ERROR_KEY = "__MC_STARTUP_ERROR__";
const STARTUP_GUARD_KEY = "__MC_ERROR_GUARD_INSTALLED__";

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

function setStartupError(error) {
  global[STARTUP_ERROR_KEY] = formatStartupError(error);
}

function registerBootstrapShell() {
  try {
    const React = require("react");
    const { registerRootComponent } = require("expo");
    const { ActivityIndicator, View } = require("react-native");

    function BootstrapShell() {
      return React.createElement(
        View,
        {
          style: {
            flex: 1,
            backgroundColor: "#0A0B0F",
            justifyContent: "center",
            alignItems: "center",
          },
        },
        React.createElement(ActivityIndicator, { size: "small", color: "#FFFFFF" })
      );
    }

    registerRootComponent(BootstrapShell);
  } catch {
    // Keep bootstrap resilient if shell registration fails.
  }
}

function installGlobalJsErrorGuard() {
  if (global[STARTUP_GUARD_KEY]) return;

  const errorUtils = global.ErrorUtils;
  if (!errorUtils || typeof errorUtils.setGlobalHandler !== "function") {
    return;
  }

  const originalSetGlobalHandler = errorUtils.setGlobalHandler.bind(errorUtils);
  const currentHandler =
    typeof errorUtils.getGlobalHandler === "function" ? errorUtils.getGlobalHandler() : null;

  const guardHandler = (error, isFatal) => {
    setStartupError(error);

    if (__DEV__) {
      // Preserve rich diagnostics while we harden release startup.
      console.error("Startup/global error captured", error, "isFatal:", isFatal);
    }
  };

  const wrapHandler = (nextHandler) => (error, isFatal) => {
    guardHandler(error, isFatal);

    if (__DEV__ && typeof nextHandler === "function") {
      try {
        nextHandler(error, isFatal);
      } catch (handlerError) {
        console.error("Error inside global error handler", handlerError);
      }
    }
  };

  // Install once immediately.
  originalSetGlobalHandler(wrapHandler(currentHandler));

  // Some libraries overwrite ErrorUtils during bootstrap.
  // Ensure our guard stays first and suppresses release abort loops.
  errorUtils.setGlobalHandler = (nextHandler) => {
    originalSetGlobalHandler(wrapHandler(nextHandler));
  };

  global[STARTUP_GUARD_KEY] = true;
}

function registerBootstrapFallback(error) {
  const React = require("react");
  const { registerRootComponent } = require("expo");
  const { View, Text } = require("react-native");
  const message = formatStartupError(error);

  setStartupError(message);

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

registerBootstrapShell();
installGlobalJsErrorGuard();

try {
  require("expo-router/entry");
} catch (error) {
  registerBootstrapFallback(error);
}
