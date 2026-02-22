import { Redirect, Stack, useSegments } from "expo-router";
import React, { Component, ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import AppBackground from "../components/AppBackground";
import { theme } from "../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../lib/nativeDeps";

function getStartupErrorMessage() {
  const raw = (globalThis as { __MC_STARTUP_ERROR__?: unknown }).__MC_STARTUP_ERROR__;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function requiresEmailVerification(user: any) {
  const providerIds = Array.isArray(user?.providerData)
    ? user.providerData
        .map((p: any) => (typeof p?.providerId === "string" ? p.providerId : ""))
        .filter(Boolean)
    : [];

  const passwordOnly =
    providerIds.length === 0 ||
    (providerIds.length === 1 && providerIds[0] === "password");

  return passwordOnly && !user?.emailVerified;
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
  const [initialising, setInitialising] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [hasSignedInUser, setHasSignedInUser] = useState(false);
  const segments = useSegments();
  const startupErrorMessage = getStartupErrorMessage();

  useEffect(() => {
    (globalThis as { __MC_ROUTER_READY__?: boolean }).__MC_ROUTER_READY__ = true;

    try {
      const splash = require("expo-splash-screen") as { hideAsync?: () => Promise<void> };
      if (typeof splash.hideAsync === "function") {
        splash.hideAsync().catch(() => {
          // Ignore splash hide races while startup diagnostics are active.
        });
      }
    } catch {
      // Splash module might not be available in all runtimes.
    }

    const id = requestAnimationFrame(() => {
      setInitialising(false);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setHasSignedInUser(false);
      setAuthResolved(true);
      return;
    }

    let unsub: undefined | (() => void);

    try {
      unsub = auth().onAuthStateChanged((user) => {
        if (user?.isAnonymous) {
          // Enforce explicit sign-in/create-account flow for all testers/users.
          auth()
            .signOut()
            .catch(() => {
              // Ignore sign-out races; gate still treats anonymous as signed out.
            });
          setHasSignedInUser(false);
        } else if (user && requiresEmailVerification(user)) {
          auth()
            .signOut()
            .catch(() => {
              // Ignore sign-out races; user remains gated at auth screen.
            });
          setHasSignedInUser(false);
        } else if (user) {
          const firestore = getFirebaseFirestore();
          if (!firestore) {
            setHasSignedInUser(true);
            setAuthResolved(true);
            return;
          }

          firestore()
            .collection("users")
            .doc(user.uid)
            .get()
            .then((doc) => {
              if (doc.exists() && doc.data()?.accountDisabled) {
                auth()
                  .signOut()
                  .catch(() => {
                    // Ignore sign-out races; user stays gated.
                  });
                setHasSignedInUser(false);
              } else {
                setHasSignedInUser(true);
              }
            })
            .catch(() => {
              // If the profile doc cannot be read, keep user signed in to avoid false lockout.
              setHasSignedInUser(true);
            })
            .finally(() => {
              setAuthResolved(true);
            });
          return;
        } else {
          setHasSignedInUser(false);
        }
        setAuthResolved(true);
      });
    } catch (error) {
      console.error("Auth state listener failed", error);
      setHasSignedInUser(false);
      setAuthResolved(true);
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();
    if (!auth || !firestore) return;

    const user = auth().currentUser;
    if (!user || user.isAnonymous) return;

    const unsub = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists() && doc.data()?.accountDisabled) {
            auth()
              .signOut()
              .catch(() => {
                // Ignore sign-out races; auth gate still forces sign-in screen.
              });
            setHasSignedInUser(false);
          }
        },
        () => {
          // Ignore profile listener errors and keep current auth state.
        }
      );

    return () => unsub();
  }, [hasSignedInUser]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();
    if (!auth || !firestore) return;

    const user = auth().currentUser;
    if (!user || user.isAnonymous || !user.email) return;

    firestore()
      .collection("users")
      .doc(user.uid)
      .set(
        {
          email: String(user.email).toLowerCase(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {
        // Best-effort backfill for legacy users missing email in profile doc.
      });
  }, [hasSignedInUser]);

  const navTheme = useMemo(() => {
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: theme.colors.appBgSolid,
        card: theme.colors.appBgSolid,
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

  if (!authResolved) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </AppBackground>
    );
  }

  const inAuthRoute = segments[0] === "auth";
  if (!hasSignedInUser && !inAuthRoute) {
    return <Redirect href="/auth" />;
  }
  if (hasSignedInUser && inAuthRoute) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <AppBackground>
      <ThemeProvider value={navTheme}>
        <RootErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.appBgSolid },
            }}
          />
        </RootErrorBoundary>
      </ThemeProvider>
    </AppBackground>
  );
}
