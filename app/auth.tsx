import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import auth from "@react-native-firebase/auth";
import { useLocalSearchParams, useRouter } from "expo-router";

const LAST_EMAIL_KEY = "lastEmail";

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
      } catch { }
    })();
  }, []);

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
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 10 }}>
      {router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderRadius: 12,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontWeight: "800" }}>Back</Text>
        </Pressable>
      ) : null}

      <Text style={{ fontSize: 24, fontWeight: "800" }}>Sign in</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      <Pressable
        onPress={handleSignIn}
        disabled={loading}
        style={{
          borderWidth: 1,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "800" }}>
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleCreateAccount}
        disabled={loading}
        style={{
          paddingVertical: 8,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "700" }}>Create account</Text>
      </Pressable>
    </View>
  );
}
