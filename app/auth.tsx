import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trackEvent } from "../lib/analytics";
import { theme } from "../lib/theme";
import { guessDisplayName, upsertOwnUserDocFields } from "../lib/userProfileDoc";
import BrandedScreenBackground from "../components/BrandedScreenBackground";

const LAST_EMAIL_KEY = "lastEmail";
const signInBg = require("../assets/images/signin-bg.png");

const CARD_BG = "rgba(18,22,30,0.88)";
const CARD_BORDER = "rgba(255,255,255,0.14)";
const INPUT_BG = "rgba(255,255,255,0.07)";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const INPUT_TEXT = "rgba(244,245,247,0.94)";
const PLACEHOLDER = "rgba(185,188,197,0.60)";
const BODY = "rgba(212,216,224,0.78)";
const EYEBROW = "rgba(223,198,130,0.92)";

export default function AuthScreen() {
  const router = useRouter();
  const { returnTo, mode } = useLocalSearchParams<{ returnTo?: string; mode?: string }>();
  const createMode = mode === "create";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LAST_EMAIL_KEY);
        if (saved) setEmail(saved);
      } catch {
        // ignore storage failures here
      }
    })();
  }, []);

  const finishAuth = () => {
    if (returnTo) {
      router.replace(String(returnTo));
      return;
    }
    router.replace("/(tabs)");
  };

  async function syncUserProfileDoc(trimmedEmail: string, isNewAccount: boolean) {
    const currentUser = auth().currentUser;
    if (!currentUser?.uid) return;

    await upsertOwnUserDocFields({
      uid: currentUser.uid,
      email: trimmedEmail,
      displayName: isNewAccount
        ? guessDisplayName(trimmedEmail, currentUser.displayName)
        : currentUser.displayName?.trim() ?? null,
      emailVerified: currentUser.emailVerified ?? false,
      fields: {},
    });
  }

  async function sendVerificationEmailForUser(user: FirebaseAuthTypes.User | null | undefined) {
    if (!user) {
      return { sent: false, alreadyVerified: false };
    }

    await user.reload();
    const freshUser = auth().currentUser ?? user;
    if (freshUser.emailVerified) {
      return { sent: false, alreadyVerified: true };
    }

    await freshUser.sendEmailVerification();
    return { sent: true, alreadyVerified: false };
  }

  async function handleSignIn() {
    try {
      setLoading(true);

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        Alert.alert("Missing details", "Enter email and password.");
        return;
      }

      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
      const credentials = await auth().signInWithEmailAndPassword(trimmedEmail, password);
      try {
        await syncUserProfileDoc(trimmedEmail, false);
      } catch (error) {
        console.error("Profile sync after sign-in failed", error);
      }
      await trackEvent("sign_in_complete", { method: "email" });

      setPassword("");
      try {
        const verification = await sendVerificationEmailForUser(credentials.user);
        if (verification.sent) {
          Alert.alert(
            "Signed in",
            `Your email is not verified yet, so we sent another verification email to ${trimmedEmail}.`,
            [{ text: "OK", onPress: finishAuth }]
          );
          return;
        }
      } catch (error) {
        console.error("Verification email resend after sign-in failed", error);
      }
      finishAuth();
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
      const credentials = await auth().createUserWithEmailAndPassword(trimmedEmail, password);
      try {
        await syncUserProfileDoc(trimmedEmail, true);
      } catch (error) {
        console.error("Profile sync after sign-up failed", error);
      }
      let verificationSent = false;
      try {
        const verification = await sendVerificationEmailForUser(credentials.user);
        verificationSent = verification.sent;
      } catch (error) {
        console.error("Email verification send failed", error);
      }
      await trackEvent("sign_up_complete", { method: "email" });

      setPassword("");
      Alert.alert(
        "Account created",
        verificationSent
          ? `We sent a verification email to ${trimmedEmail}.`
          : "Your account was created, but the verification email could not be confirmed from the app."
      );
      finishAuth();
    } catch (e: any) {
      Alert.alert("Create account failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        Alert.alert("Enter your email", "Add your email address first, then tap forgot password.");
        return;
      }

      setLoading(true);
      await auth().sendPasswordResetEmail(trimmedEmail);
      Alert.alert(
        "Check your inbox",
        `If ${trimmedEmail} is linked to an account, we sent a password reset email.`
      );
    } catch (e: any) {
      Alert.alert("Reset failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BrandedScreenBackground
      source={signInBg}
      gradientColors={[
        "rgba(18,12,6,0.10)",
        "rgba(10,12,18,0.42)",
        "rgba(6,8,13,0.94)",
      ]}
      scrimColor="rgba(5,7,11,0.16)"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
        >
          <View
            style={{
              flex: 1,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 24,
            }}
          >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {router.canGoBack() ? (
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  minHeight: 42,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Ionicons name="chevron-back-outline" size={16} color={theme.colors.textOnDark} />
                <Text style={{ color: theme.colors.textOnDark, fontWeight: "800", fontSize: 13 }}>
                  Back
                </Text>
              </Pressable>
            ) : (
              <View />
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.07)",
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Ionicons name="leaf-outline" size={14} color="rgba(223,198,130,0.92)" />
              <Text style={{ color: theme.colors.textOnDark, fontWeight: "800", fontSize: 12 }}>
                Review Budz
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 34, marginBottom: 18 }}>
            <Text
              style={{
                color: EYEBROW,
                fontSize: 11,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 1.1,
              }}
            >
              Account access
            </Text>
            <Text
              style={{
                marginTop: 10,
                color: theme.colors.textOnDark,
                fontSize: 28,
                lineHeight: 32,
                fontWeight: "800",
                letterSpacing: -0.3,
              }}
            >
              {createMode ? "Create your account." : "Sign in or create your account."}
            </Text>
            <Text
              style={{
                marginTop: 10,
                color: BODY,
                fontSize: 14,
                lineHeight: 21,
                maxWidth: 360,
              }}
            >
              {createMode
                ? "Create your account to unlock the full review catalog, private notes, and profile tools. Shared flower pages still open cleanly from links."
                : "Members unlock the full review catalog, private notes, and profile tools. Shared flower pages still open cleanly from links."}
            </Text>
          </View>

          <LinearGradient
            colors={[CARD_BG, "rgba(12,15,22,0.92)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              borderWidth: 1,
              borderColor: CARD_BORDER,
              overflow: "hidden",
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: -50,
                top: -34,
                width: 180,
                height: 180,
                borderRadius: 999,
                backgroundColor: "rgba(120,190,140,0.10)",
              }}
            />

            <View style={{ padding: 18 }}>
                <View style={{ gap: 12 }}>
                <View>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.56)",
                      fontSize: 11,
                      fontWeight: "900",
                      letterSpacing: 0.9,
                      textTransform: "uppercase",
                    }}
                  >
                    Email
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@email.com"
                    placeholderTextColor={PLACEHOLDER}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    style={{
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: INPUT_BORDER,
                      borderRadius: 18,
                      backgroundColor: INPUT_BG,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      color: INPUT_TEXT,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  />
                </View>

                <View>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.56)",
                      fontSize: 11,
                      fontWeight: "900",
                      letterSpacing: 0.9,
                      textTransform: "uppercase",
                    }}
                  >
                    Password
                  </Text>

                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={PLACEHOLDER}
                    secureTextEntry
                    autoComplete="password"
                    style={{
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: INPUT_BORDER,
                      borderRadius: 18,
                      backgroundColor: INPUT_BG,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      color: INPUT_TEXT,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  />
                </View>
                </View>

                {!createMode ? (
                  <Pressable
                    onPress={handleForgotPassword}
                    disabled={loading}
                    style={({ pressed }) => ({
                      alignSelf: "flex-start",
                      marginTop: 12,
                      paddingVertical: 6,
                      paddingHorizontal: 2,
                      opacity: loading ? 0.62 : pressed ? 0.72 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: "rgba(223,198,130,0.96)",
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      Forgot password?
                    </Text>
                  </Pressable>
                ) : null}

              <View style={{ marginTop: 18, gap: 10 }}>
                {createMode ? (
                  <>
                    <Pressable
                      onPress={handleCreateAccount}
                      disabled={loading}
                      style={({ pressed }) => ({
                        minHeight: 50,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(244,245,247,0.94)",
                        opacity: loading ? 0.62 : pressed ? 0.86 : 1,
                      })}
                    >
                      <Text style={{ color: "#11161E", fontWeight: "900", fontSize: 15 }}>
                        {loading ? "Creating account..." : "Create account"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleSignIn}
                      disabled={loading}
                      style={({ pressed }) => ({
                        minHeight: 50,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(212,175,55,0.30)",
                        backgroundColor: "rgba(212,175,55,0.10)",
                        opacity: loading ? 0.62 : pressed ? 0.86 : 1,
                      })}
                    >
                      <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 15 }}>
                        Sign in instead
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={handleSignIn}
                      disabled={loading}
                      style={({ pressed }) => ({
                        minHeight: 50,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(244,245,247,0.94)",
                        opacity: loading ? 0.62 : pressed ? 0.86 : 1,
                      })}
                    >
                      <Text style={{ color: "#11161E", fontWeight: "900", fontSize: 15 }}>
                        {loading ? "Signing in..." : "Sign in"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleCreateAccount}
                      disabled={loading}
                      style={({ pressed }) => ({
                        minHeight: 50,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(212,175,55,0.30)",
                        backgroundColor: "rgba(212,175,55,0.10)",
                        opacity: loading ? 0.62 : pressed ? 0.86 : 1,
                      })}
                    >
                      <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 15 }}>
                        Create account
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>

              <Text
                style={{
                  marginTop: 14,
                  color: "rgba(185,188,197,0.74)",
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                We’ll remember your email on this device to make the next sign-in quicker.
              </Text>
            </View>
          </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BrandedScreenBackground>
  );
}
