import React, { useEffect, useMemo, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import auth from "@react-native-firebase/auth";
import { useLocalSearchParams, useRouter } from "expo-router";

const LAST_EMAIL_KEY = "lastEmail";

// Visual constants (keeps auth screen immune to "wash" overlays)
const BG = "#0B1220";
const GLASS_BG = "rgba(15,18,24,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.22)";
const INPUT_BG = "rgba(0,0,0,0.22)";
const SUBTLE = "rgba(255,255,255,0.70)";
const SUBTLE_2 = "rgba(255,255,255,0.55)";
const BTN_BG = "rgba(255,255,255,0.14)";
const BTN_BORDER = "rgba(255,255,255,0.18)";

function Glass({ children }: { children: React.ReactNode }) {
  return <View style={styles.glass}>{children}</View>;
}

export default function AuthScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LAST_EMAIL_KEY);
        if (saved) setEmail(saved);
      } catch {
        // ignore
      }
    })();
  }, []);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && password.length > 0 && !loading;
  }, [email, password, loading]);

  async function handleSignIn() {
    try {
      setLoading(true);

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        Alert.alert("Missing details", "Enter email and password.");
        return;
      }

      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
      await auth().signInWithEmailAndPassword(trimmedEmail, password);

      setPassword("");

      if (returnTo) {
        router.replace(String(returnTo));
      }
    } catch (e: any) {
      Alert.alert("Sign in failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount() {
    try {
      setLoading(true);

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        Alert.alert("Missing details", "Enter email and password.");
        return;
      }

      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
      await auth().createUserWithEmailAndPassword(trimmedEmail, password);

      setPassword("");

      if (returnTo) {
        router.replace(String(returnTo));
      }
    } catch (e: any) {
      Alert.alert("Create account failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ImageBackground
        source={require("../assets/images/signin-bg.png")}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.scrim} pointerEvents="none" />
        {/* Solid background prevents the dim "overlay wash" */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <View style={styles.center}>
            {router.canGoBack() ? (
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.backBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
            ) : null}

            <Glass>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>
                Sign in to write reviews and save favourites.
              </Text>

              <View style={{ height: 16 }} />

              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={SUBTLE_2}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
                editable={!loading}
                returnKeyType="next"
              />

              <View style={{ height: 12 }} />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={SUBTLE_2}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                style={styles.input}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (canSubmit) handleSignIn();
                }}
              />

              <View style={{ height: 16 }} />

              <Pressable
                onPress={handleSignIn}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? "Signing in..." : "Sign in"}
                </Text>
              </Pressable>

              <View style={{ height: 12 }} />

              <Pressable
                onPress={handleCreateAccount}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.secondaryBtnText}>Create account</Text>
              </Pressable>

              <View style={{ height: 10 }} />
              <Text style={styles.hint}>Tip: we’ll remember your email next time.</Text>
            </Glass>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  screen: {
    flex: 1,
    backgroundColor: BG,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },

  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backBtnText: {
    fontWeight: "900",
    color: "white",
  },

  glass: {
    backgroundColor: GLASS_BG,
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },


  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "white",
  },

  subtitle: {
    marginTop: 6,
    color: SUBTLE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },

  label: {
    color: "white",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 8,
  },

  input: {
    backgroundColor: INPUT_BG,
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },

  primaryBtn: {
    backgroundColor: BTN_BG,
    borderColor: BTN_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  primaryBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  secondaryBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
  },

  hint: {
    color: SUBTLE_2,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
});
