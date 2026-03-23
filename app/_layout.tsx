import { Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, AppState, Pressable, Text } from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import AppBackground from "../components/AppBackground";
import { recordAppOpen, recordAppPresence, recordUserSessionStart } from "../lib/analytics";
import { ensureUserProfileDoc } from "../lib/userProfileDoc";

import { ThemeProvider, DefaultTheme } from "@react-navigation/native";

export default function RootLayout() {
  const [initialising, setInitialising] = useState(true);
  const [authUser, setAuthUser] = useState(() => auth().currentUser);
  const [accountStateResolved, setAccountStateResolved] = useState(false);
  const [banState, setBanState] = useState<{ banned: boolean; reason: string | null }>({
    banned: false,
    reason: null,
  });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setAuthUser(user);
      if (user?.uid) {
        void ensureUserProfileDoc({
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          touchLastActive: true,
          touchLastOpened: true,
        });
      }
      void recordUserSessionStart();
      void recordAppPresence("auth_ready");
      setInitialising(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authUser?.uid) {
      setBanState({ banned: false, reason: null });
      setAccountStateResolved(true);
      return;
    }

    setAccountStateResolved(false);
    const unsubscribe = firestore()
      .collection("users")
      .doc(authUser.uid)
      .onSnapshot(
        (doc) => {
          const data = (doc.data() as Record<string, unknown> | undefined) ?? {};
          const reason =
            typeof data.banReason === "string" && data.banReason.trim() ? data.banReason.trim() : null;

          setBanState({
            banned: !!data.accountBanned,
            reason,
          });
          setAccountStateResolved(true);
        },
        () => {
          setBanState({ banned: false, reason: null });
          setAccountStateResolved(true);
        }
      );

    return () => unsubscribe();
  }, [authUser?.uid]);

  useEffect(() => {
    void recordAppOpen();
  }, []);

  useEffect(() => {
    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      void recordUserSessionStart();
      void recordAppPresence("foreground");
      heartbeatRef.current = setInterval(() => {
        void recordAppPresence("heartbeat");
      }, 60_000);
    };

    startHeartbeat();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    });

    return () => {
      stopHeartbeat();
      subscription.remove();
    };
  }, []);

  if (initialising || !accountStateResolved) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </AppBackground>
    );
  }

  if (banState.banned) {
    return (
      <AppBackground>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "rgba(233,126,126,0.24)",
              backgroundColor: "rgba(12,14,20,0.84)",
              padding: 22,
            }}
          >
            <Text
              style={{
                color: "rgba(255,246,246,0.98)",
                fontSize: 28,
                fontWeight: "900",
                textAlign: "center",
              }}
            >
              Account banned
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 16,
                lineHeight: 24,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              This account has been banned and can no longer use Review Budz.
            </Text>
            {banState.reason ? (
              <Text
                style={{
                  color: "rgba(255,221,221,0.92)",
                  fontSize: 15,
                  lineHeight: 22,
                  textAlign: "center",
                  marginTop: 12,
                }}
              >
                Reason: {banState.reason}
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                void auth().signOut();
              }}
              style={({ pressed }) => ({
                marginTop: 18,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.14)",
                backgroundColor: "rgba(255,255,255,0.08)",
                paddingVertical: 14,
                alignItems: "center",
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ color: "rgba(255,255,255,0.96)", fontWeight: "900", fontSize: 15 }}>
                Sign out
              </Text>
            </Pressable>
          </View>
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
