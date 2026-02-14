import { Redirect, Stack, useSegments } from "expo-router";
import React, { Component, ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import AppBackground from "../components/AppBackground";
import { enableFreeze, enableScreens } from "react-native-screens";

// Keep iOS startup stable; enabling native screens has repeatedly triggered launch crashes.
enableScreens(false);
enableFreeze(false);

function getStartupErrorMessage() {
  const raw = (globalThis as { __MC_STARTUP_ERROR__?: unknown }).__MC_STARTUP_ERROR__;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Root render error", error);
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{ color: "white", fontSize: 19, fontWeight: "700", textAlign: "center" }}>
          App startup failed
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: "rgba(255,255,255,0.75)",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Try again. If it keeps happening, reinstall from TestFlight.
        </Text>
        <Pressable
          onPress={this.handleTryAgain}
          style={{
            marginTop: 18,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

export default function RootLayout() {
  const segments = useSegments();

  const [initialising, setInitialising] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const startupErrorMessage = getStartupErrorMessage();

  useEffect(() => {
    try {
      const unsubscribe = auth().onAuthStateChanged((u) => {
        setUser(u);
        setInitialising(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error("Auth init failed at startup", error);
      setUser(null);
      setInitialising(false);
      return () => {};
    }
  }, []);

  const navTheme = useMemo(() => {
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: "transparent",
        card: "transparent",
      },
    };
  }, []);

  if (startupErrorMessage) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ color: "white", fontSize: 19, fontWeight: "700", textAlign: "center" }}>
            Startup error detected
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: "rgba(255,255,255,0.75)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            The app hit a startup exception and recovered. Please reopen once.
          </Text>
          <Text
            style={{
              marginTop: 10,
              color: "rgba(255,255,255,0.65)",
              fontSize: 12,
              textAlign: "center",
            }}
            numberOfLines={5}
          >
            {startupErrorMessage}
          </Text>
        </View>
      </AppBackground>
    );
  }

  if (initialising) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </AppBackground>
    );
  }

  const inAuth = segments[0] === "auth";
  if (!user && !inAuth) return <Redirect href="/auth" />;
  if (user && inAuth) return <Redirect href="/(tabs)" />;

  return (
    <AppBackground>
      <ThemeProvider value={navTheme}>
        <RootErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
        </RootErrorBoundary>
      </ThemeProvider>
    </AppBackground>
  );
}
