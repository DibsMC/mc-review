import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import AppBackground from "../components/AppBackground";

export default function RootLayout() {
  const router = useRouter();

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
    const unsubscribe = auth().onAuthStateChanged((u) => {
      setUser(u);
      setInitialising(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initialising) return;

    if (!user) router.replace("/auth");
    else router.replace("/(tabs)");
  }, [user, initialising, router]);

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
