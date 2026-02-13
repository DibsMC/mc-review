import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import AppBackground from "../components/AppBackground";
import { enableFreeze, enableScreens } from "react-native-screens";

// Defensive: avoid a known class of production crashes caused by screen lifecycle events
// firing while the bridge is redirecting on startup/auth changes.
enableScreens(false);
enableFreeze(false);

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();

  const [initialising, setInitialising] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

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

  useEffect(() => {
    // Avoid dispatching navigation actions before the root navigator is ready.
    if (!navState?.key) return;
    if (initialising) return;

    const inAuth = segments[0] === "auth";
    if (!user && !inAuth) router.replace("/auth");
    if (user && inAuth) router.replace("/(tabs)");
  }, [user, initialising, router, segments, navState?.key]);

  if (initialising) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </ThemeProvider>
    </AppBackground>
  );
}
