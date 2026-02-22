/**
 * Configure navigation screens early and capture startup errors.
 * In production we keep the app alive long enough to render fallback UI.
 */
(function configureReactNativeScreensEarly() {
  try {
    const screens = require("react-native-screens");
    if (screens && typeof screens.enableScreens === "function") {
      screens.enableScreens(true);
    }
    if (screens && typeof screens.enableFreeze === "function") {
      screens.enableFreeze(true);
    }
  } catch {
    // Keep startup resilient even if screen config fails.
  }
})();

const STARTUP_ERROR_KEY = "__MC_STARTUP_ERROR__";
const STARTUP_GUARD_KEY = "__MC_ERROR_GUARD_INSTALLED__";
const SPLASH_HIDDEN_KEY = "__MC_SPLASH_HIDDEN__";
const BOOTSTRAP_TIMEOUT_MS = 12000;

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

function hideNativeSplashOnce() {
  if (global[SPLASH_HIDDEN_KEY]) return;
  global[SPLASH_HIDDEN_KEY] = true;

  try {
    const splashScreen = require("expo-splash-screen");
    if (splashScreen && typeof splashScreen.hideAsync === "function") {
      splashScreen.hideAsync().catch(() => {
        // Ignore splash hide errors during startup hardening.
      });
    }
  } catch {
    // Splash module may not be ready in all startup modes.
  }
}

function registerBootstrapShell() {
  try {
    const React = require("react");
    const { registerRootComponent } = require("expo");
    const { ActivityIndicator, Text, View } = require("react-native");

    function BootstrapShell() {
      const [isTimedOut, setIsTimedOut] = React.useState(false);

      React.useEffect(() => {
        hideNativeSplashOnce();
        const timer = setTimeout(() => {
          setIsTimedOut(true);
        }, BOOTSTRAP_TIMEOUT_MS);

        return () => {
          clearTimeout(timer);
        };
      }, []);

      const startupMessage =
        typeof global[STARTUP_ERROR_KEY] === "string" ? global[STARTUP_ERROR_KEY] : null;

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
        React.createElement(ActivityIndicator, { size: "small", color: "#FFFFFF" }),
        React.createElement(
          Text,
          {
            style: {
              marginTop: 12,
              color: "rgba(255,255,255,0.82)",
              textAlign: "center",
            },
          },
          isTimedOut ? "Still starting..." : "Starting app..."
        ),
        startupMessage
          ? React.createElement(
              Text,
              {
                style: {
                  marginTop: 10,
                  color: "rgba(255,170,170,0.95)",
                  fontSize: 12,
                  textAlign: "center",
                },
                numberOfLines: 5,
              },
              startupMessage
            )
          : null
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
    React.useEffect(() => {
      hideNativeSplashOnce();
    }, []);

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
