import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { getAsyncStorage, getFirebaseAuth, getFirebaseFirestore } from "../lib/nativeDeps";

const LAST_EMAIL_KEY = "lastEmail";
const authLogo = require("../assets/brand/review-budz-logo.png");

// Visual constants (keeps auth screen immune to "wash" overlays)
const BG = "#0B1220";
const GLASS_BG = "rgba(15,18,24,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.22)";
const INPUT_BG = "rgba(0,0,0,0.22)";
const SUBTLE = "rgba(255,255,255,0.70)";
const SUBTLE_2 = "rgba(255,255,255,0.55)";
const BTN_BG = "rgba(255,255,255,0.14)";
const BTN_BORDER = "rgba(255,255,255,0.18)";

function sendVerificationEmailCompat(user: any) {
  try {
    // RN Firebase modular API (preferred)
    const mod = require("@react-native-firebase/auth");
    if (typeof mod?.sendEmailVerification === "function") {
      return mod.sendEmailVerification(user);
    }
  } catch {
    // fall back to namespaced method
  }
  return user.sendEmailVerification();
}

function sendPasswordResetEmailCompat(auth: any, email: string) {
  try {
    // RN Firebase modular API (preferred)
    const mod = require("@react-native-firebase/auth");
    if (typeof mod?.sendPasswordResetEmail === "function") {
      return mod.sendPasswordResetEmail(auth(), email);
    }
  } catch {
    // fall back to namespaced method
  }
  return auth().sendPasswordResetEmail(email);
}

function signOutCompat(auth: any) {
  try {
    // RN Firebase modular API (preferred)
    const mod = require("@react-native-firebase/auth");
    if (typeof mod?.signOut === "function") {
      return mod.signOut(auth());
    }
  } catch {
    // fall back to namespaced method
  }
  return auth().signOut();
}

function Glass({ children }: { children: React.ReactNode }) {
  return <View style={styles.glass}>{children}</View>;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function getFriendlyAuthError(error: any, mode: "signIn" | "create" | "reset" | "verify") {
  const code = typeof error?.code === "string" ? error.code : "";

  if (code.includes("network-request-failed")) {
    return "No internet connection. Check your signal and try again.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (mode === "signIn") {
    if (
      code.includes("invalid-credential") ||
      code.includes("invalid-login-credentials") ||
      code.includes("wrong-password") ||
      code.includes("user-not-found")
    ) {
      return "Email or password is incorrect.";
    }
    if (code.includes("invalid-email")) {
      return "Please enter a valid email address.";
    }
  }
  if (mode === "create") {
    if (code.includes("email-already-in-use")) {
      return "That email is already in use. Try signing in instead.";
    }
    if (code.includes("weak-password")) {
      return "Password is too weak. Use at least 6 characters.";
    }
    if (code.includes("invalid-email")) {
      return "Please enter a valid email address.";
    }
  }
  if (mode === "reset") {
    if (code.includes("user-not-found")) {
      return "No account was found with that email.";
    }
    if (code.includes("invalid-email")) {
      return "Please enter a valid email address.";
    }
  }

  if (mode === "verify") {
    if (code.includes("too-many-requests")) {
      return "We have sent too many emails recently. Please wait a few minutes and try again.";
    }
    if (code.includes("quota-exceeded")) {
      return "Email sending is temporarily at capacity. Please try again shortly.";
    }
    if (code.includes("invalid-email")) {
      return "The email address format is invalid.";
    }
  }

  return safeStr(error?.message) || "Something went wrong. Please try again.";
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

function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, "_");
}

export default function AuthScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const firestore = getFirebaseFirestore();
  const auth = getFirebaseAuth();
  const AsyncStorage = getAsyncStorage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signIn" | "create">("signIn");
  const [loading, setLoading] = useState(false);
  const nativeDepsReady = !!firestore && !!auth && !!AsyncStorage;

  const passwordsMatch = authMode !== "create" || password === confirmPassword;

  useEffect(() => {
    if (!AsyncStorage) return;
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
    if (authMode === "create") {
      return e.length > 3 && password.length >= 6 && confirmPassword.length >= 6 && passwordsMatch && !loading;
    }
    return e.length > 3 && password.length > 0 && !loading;
  }, [authMode, email, password, confirmPassword, passwordsMatch, loading]);

  async function handleSignIn() {
    if (!auth || !AsyncStorage) {
      Alert.alert("Startup issue", "Authentication is not available yet. Please reopen the app.");
      return;
    }

    try {
      setLoading(true);

      const trimmedEmail = email.trim();
      const normalizedEmail = trimmedEmail.toLowerCase();
      if (!trimmedEmail || !password) {
        Alert.alert("Missing details", "Enter email and password.");
        return;
      }

      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
      const cred = await auth().signInWithEmailAndPassword(trimmedEmail, password);

      const signedInUser = cred.user ?? auth().currentUser;
      if (signedInUser) {
        try {
          await signedInUser.reload();
        } catch {
          // ignore reload races
        }

        const freshUser = auth().currentUser ?? signedInUser;
        if (requiresEmailVerification(freshUser)) {
          setPassword("");
          Alert.alert(
            "Verify your email",
            "This account is not verified yet. If you have not received a verification email, tap Resend email below.",
            [
              {
                text: "Reset password",
                onPress: async () => {
                  try {
                    await sendPasswordResetEmailCompat(auth, trimmedEmail);
                    Alert.alert(
                      "Reset email sent",
                      "If the account exists, we sent a password reset email. Check inbox and spam."
                    );
                  } catch (e: any) {
                    Alert.alert("Password reset failed", getFriendlyAuthError(e, "reset"));
                  } finally {
                    await signOutCompat(auth).catch(() => {
                      // ignore sign-out races
                    });
                  }
                },
              },
              {
                text: "Resend email",
                onPress: async () => {
                  try {
                    const resendCred = await auth().signInWithEmailAndPassword(trimmedEmail, password);
                    const resendUser = resendCred.user ?? auth().currentUser;
                    if (!resendUser) {
                      throw new Error("No authenticated user session available for resend.");
                    }
                    await sendVerificationEmailCompat(resendUser);
                    Alert.alert(
                      "Verification email sent",
                      "We sent a new verification email. Check inbox and spam, then sign in."
                    );
                  } catch (e: any) {
                    Alert.alert("Could not resend verification", getFriendlyAuthError(e, "verify"));
                  } finally {
                    await signOutCompat(auth).catch(() => {
                      // ignore sign-out races
                    });
                  }
                },
              },
              {
                text: "OK",
                style: "cancel",
                onPress: async () => {
                  await signOutCompat(auth).catch(() => {
                    // ignore sign-out races
                  });
                },
              },
            ]
          );
          return;
        }

        if (firestore) {
          const userRef = firestore().collection("users").doc(freshUser.uid);
          const userSnap = await userRef.get();
          const existingData = userSnap.data() ?? null;
          if (userSnap.exists() && userSnap.data()?.accountDisabled) {
            await signOutCompat(auth).catch(() => {
              // ignore sign-out races
            });
            setPassword("");
            Alert.alert(
              "Account unavailable",
              "This account is currently disabled. Contact support if you believe this is a mistake."
            );
            return;
          }

          const emailBanSnap = await firestore()
            .collection("bannedEmails")
            .doc(normalizeEmailKey(normalizedEmail))
            .get();
          if (emailBanSnap.exists() && emailBanSnap.data()?.active) {
            await signOutCompat(auth).catch(() => {
              // ignore sign-out races
            });
            setPassword("");
            Alert.alert(
              "Account unavailable",
              "This email is currently blocked from using the app. Contact support if you believe this is a mistake."
            );
            return;
          }

          const effectiveDisplayName =
            safeStr(existingData?.displayName) ||
            safeStr(freshUser?.displayName) ||
            "New Member";

          const profilePatch = userSnap.exists()
            ? {
                email: normalizedEmail,
                emailVerified: true,
                updatedAt: firestore.FieldValue.serverTimestamp(),
              }
            : {
                displayName: effectiveDisplayName,
                email: normalizedEmail,
                emailVerified: true,
                isAdmin: false,
                accountDisabled: false,
                favoriteProductIds: [],
                reviewRestrictionLevel: 0,
                reviewRestrictionUntilMs: null,
                reviewRestrictionManual: false,
                moderationStrikeCount: 0,
                lastEscalationRemovedTotal: 0,
                createdAt: firestore.FieldValue.serverTimestamp(),
                updatedAt: firestore.FieldValue.serverTimestamp(),
              };

          await userRef.set(profilePatch, { merge: true }).catch(() => {
            // profile sync is best-effort
          });
        }
      }

      setPassword("");

      if (returnTo) {
        router.replace(String(returnTo));
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      Alert.alert("Sign in failed", getFriendlyAuthError(e, "signIn"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!auth || !AsyncStorage) {
      Alert.alert("Startup issue", "Authentication is not available yet. Please reopen the app.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(
        "Missing details",
        "Enter your email and current password first, then tap Resend verification email."
      );
      return;
    }

    try {
      setLoading(true);
      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);

      const cred = await auth().signInWithEmailAndPassword(trimmedEmail, password);
      const signedInUser = cred.user ?? auth().currentUser;
      if (!signedInUser) {
        Alert.alert("Unable to resend", "Please try signing in again.");
        return;
      }

      try {
        await signedInUser.reload();
      } catch {
        // ignore reload races
      }

      const freshUser = auth().currentUser ?? signedInUser;
      if (!requiresEmailVerification(freshUser)) {
        setPassword("");
        if (returnTo) {
          router.replace(String(returnTo));
        } else {
          router.replace("/(tabs)");
        }
        return;
      }

      await sendVerificationEmailCompat(freshUser);
      await signOutCompat(auth).catch(() => {
        // ignore sign-out races
      });
      setPassword("");

      Alert.alert(
        "Verification email sent",
        "We sent a new verification email. Check inbox and spam, verify your email, then sign in."
      );
    } catch (e: any) {
      Alert.alert("Could not resend verification", getFriendlyAuthError(e, "verify"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount() {
    if (!auth || !firestore || !AsyncStorage) {
      Alert.alert("Startup issue", "Authentication is not available yet. Please reopen the app.");
      return;
    }

    try {
      setLoading(true);

      const trimmedEmail = email.trim();
      const normalizedEmail = trimmedEmail.toLowerCase();
      if (!trimmedEmail || !password) {
        Alert.alert("Missing details", "Enter email and password.");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Passwords do not match", "Please make sure both password fields are the same.");
        return;
      }

      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);

      // Create auth user
      const cred = await auth().createUserWithEmailAndPassword(
        trimmedEmail,
        password
      );

      // Prefer the returned user; fallback to currentUser just in case
      const createdUser = cred.user ?? auth().currentUser;

      if (createdUser) {
        // Default display name (avoid "Info" / placeholder values)
        // We keep it consistent across Auth + Firestore profile
        const defaultName = "New Member";

        // Firebase Auth displayName (some screens read from here)
        await createdUser.updateProfile({ displayName: defaultName });

        let emailBlocked = false;
        try {
          const emailBanSnap = await firestore()
            .collection("bannedEmails")
            .doc(normalizeEmailKey(normalizedEmail))
            .get();
          emailBlocked = !!(emailBanSnap.exists() && emailBanSnap.data()?.active);
        } catch {
          // If this check fails, do not block account creation or verification email.
          // Sign-in checks will still enforce blocking where needed.
        }

        if (emailBlocked) {
          await createdUser.delete().catch(() => {
            // ignore cleanup races; sign-out gate still blocks access
          });
          await signOutCompat(auth).catch(() => {
            // ignore sign-out races
          });
          setPassword("");
          Alert.alert(
            "Account blocked",
            "This email is currently blocked from creating an account. Contact support if you believe this is a mistake."
          );
          return;
        }

        let verificationSent = false;
        let verificationError = "";
        try {
          await sendVerificationEmailCompat(createdUser);
          verificationSent = true;
        } catch (sendErr: any) {
          verificationError = getFriendlyAuthError(sendErr, "verify");
          // continue; account is created and user can retry from sign-in
        }

        // Firestore profile (source of truth for public profile)
        await firestore()
          .collection("users")
          .doc(createdUser.uid)
          .set(
            {
              displayName: defaultName,
              email: normalizedEmail,
              emailVerified: false,
              isAdmin: false,
              accountDisabled: false,
              favoriteProductIds: [],
              reviewRestrictionLevel: 0,
              reviewRestrictionUntilMs: null,
              reviewRestrictionManual: false,
              moderationStrikeCount: 0,
              createdAt: firestore.FieldValue.serverTimestamp(),
              updatedAt: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        await signOutCompat(auth).catch(() => {
          // ignore sign-out races
        });

        setAuthMode("signIn");
        setPassword("");
        setConfirmPassword("");

        Alert.alert(
          "Verify your email",
          verificationSent
            ? "Account created. We sent a verification email. Please verify your email, then sign in."
            : `Account created, but we could not send a verification email right now.${verificationError ? `\n\nReason: ${verificationError}` : ""}\n\nUse the \"Resend verification email\" button on sign-in.`
        );
        return;
      }
    } catch (e: any) {
      Alert.alert("Create account failed", getFriendlyAuthError(e, "create"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!auth || !AsyncStorage) {
      Alert.alert("Startup issue", "Authentication is not available yet. Please reopen the app.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Forgot password", "Enter your email address first, then tap Forgot password.");
      return;
    }

    try {
      setLoading(true);
      await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
      await sendPasswordResetEmailCompat(auth, trimmedEmail);
      Alert.alert(
        "Reset email sent",
        "If the account exists, we sent a password reset email. Check your inbox and spam folder."
      );
    } catch (e: any) {
      Alert.alert("Password reset failed", getFriendlyAuthError(e, "reset"));
    } finally {
      setLoading(false);
    }
  }

  function switchAuthMode(nextMode: "signIn" | "create") {
    if (loading) return;
    setAuthMode(nextMode);
    setPassword("");
    setConfirmPassword("");
  }

  if (!nativeDepsReady) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.center, { justifyContent: "center", alignItems: "center" }]}>
          <Glass>
            <Text style={styles.title}>Starting up…</Text>
            <Text style={styles.subtitle}>
              We could not load secure sign-in modules. Please fully close and reopen the app.
            </Text>
          </Glass>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ImageBackground
        source={require("../assets/images/signin-bg.png")}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.scrim} pointerEvents="none" />

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
              <Text style={styles.kicker}>Review Budz</Text>
              <View style={styles.modeRow}>
                <Pressable
                  onPress={() => switchAuthMode("signIn")}
                  disabled={loading}
                  style={[
                    styles.modePill,
                    authMode === "signIn" ? styles.modePillOn : null,
                    loading ? { opacity: 0.5 } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.modePillText,
                      authMode === "signIn" ? styles.modePillTextOn : null,
                    ]}
                  >
                    Sign in
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => switchAuthMode("create")}
                  disabled={loading}
                  style={[
                    styles.modePill,
                    authMode === "create" ? styles.modePillOn : null,
                    loading ? { opacity: 0.5 } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.modePillText,
                      authMode === "create" ? styles.modePillTextOn : null,
                    ]}
                  >
                    Create account
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.title}>{authMode === "create" ? "Create your account" : "Sign in"}</Text>
              <Text style={styles.subtitle}>
                {authMode === "create"
                  ? "Create your account. You will need to verify your email before your first sign-in."
                  : "Sign in to write reviews and save favourites."}
              </Text>

              <View style={{ height: 16 }} />

              <Text style={styles.label}>Email address</Text>
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

              <Text style={styles.label}>{authMode === "create" ? "Password (minimum 6 characters)" : "Password"}</Text>
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
                  if (!canSubmit) return;
                  if (authMode === "create") handleCreateAccount();
                  else handleSignIn();
                }}
              />

              {authMode === "create" ? (
                <>
                  <View style={{ height: 12 }} />

                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    placeholderTextColor={SUBTLE_2}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    style={styles.input}
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (canSubmit) handleCreateAccount();
                    }}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch ? (
                    <Text style={styles.inlineError}>Passwords do not match yet.</Text>
                  ) : (
                    <Text style={styles.inlineHint}>Use an email you can access to verify your account.</Text>
                  )}
                </>
              ) : null}

              {authMode === "signIn" ? (
                <>
                  <View style={{ height: 8 }} />

                  <Pressable
                    onPress={handleForgotPassword}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.forgotBtn,
                      { opacity: loading ? 0.45 : pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={styles.forgotBtnText}>Forgot password?</Text>
                  </Pressable>
                </>
              ) : null}

              <View style={{ height: 16 }} />

              <Pressable
                onPress={authMode === "create" ? handleCreateAccount : handleSignIn}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {loading
                    ? authMode === "create"
                      ? "Creating account..."
                      : "Signing in..."
                    : authMode === "create"
                    ? "Create account"
                    : "Sign in"}
                </Text>
              </Pressable>

              <View style={{ height: 12 }} />

              <Pressable
                onPress={() => switchAuthMode(authMode === "create" ? "signIn" : "create")}
                disabled={loading}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { opacity: loading ? 0.45 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.secondaryBtnText}>
                  {authMode === "create" ? "Already have an account? Sign in" : "New here? Create account"}
                </Text>
              </Pressable>
            </Glass>
          </View>
        </KeyboardAvoidingView>

        <View pointerEvents="none" style={styles.logoWrap}>
          <Image source={authLogo} resizeMode="contain" style={styles.logo} />
        </View>
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

  kicker: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 6,
  },

  subtitle: {
    marginTop: 6,
    color: SUBTLE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  modePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    alignItems: "center",
  },

  modePillOn: {
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  modePillText: {
    color: "rgba(255,255,255,0.80)",
    fontWeight: "900",
    fontSize: 13,
  },

  modePillTextOn: {
    color: "white",
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

  forgotBtn: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },

  forgotBtnText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  inlineHint: {
    marginTop: 8,
    color: SUBTLE_2,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },

  inlineError: {
    marginTop: 8,
    color: "rgba(255,120,120,0.98)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },

  logoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 36,
    alignItems: "center",
  },

  logo: {
    width: 262,
    height: 108,
    opacity: 0.96,
  },
});
