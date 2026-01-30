import React, { useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

export default function WriteReviewScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const pid = useMemo(() => String(productId ?? ""), [productId]);
  const uid = auth().currentUser?.uid ?? null;

  const [rating, setRating] = useState<number>(5);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const [initialRating, setInitialRating] = useState<number>(5);
  const [initialText, setInitialText] = useState<string>("");

  // Skip discard prompt when we intentionally navigate away after saving
  const skipDiscardPromptRef = useRef(false);

  const canSubmit =
    !!uid &&
    pid.length > 0 &&
    rating >= 1 &&
    rating <= 5 &&
    text.trim().length > 0 &&
    !saving;

  const isDirty =
    !saving &&
    (rating !== initialRating || text.trim() !== initialText.trim());

  usePreventRemove(isDirty && !skipDiscardPromptRef.current, ({ data }) => {
    Alert.alert(
      "Discard changes?",
      "You have unsaved changes. If you leave, they will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            skipDiscardPromptRef.current = true;
            navigation.dispatch(data.action);
          },
        },
      ]
    );
  });

  async function handleGoLogin() {
    const returnTo = `/(tabs)/reviews/product/${pid}/write-review`;
    router.push(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function handleSave() {
    if (!uid) {
      Alert.alert("Sign in required", "Please sign in to write a review.");
      handleGoLogin();
      return;
    }

    if (!pid) {
      Alert.alert("Error", "Missing product id.");
      return;
    }

    try {
      setSaving(true);

      // Store reviews in: flowers/{productId}/reviews/{uid}
      const ref = firestore()
        .collection("flowers")
        .doc(pid)
        .collection("reviews")
        .doc(uid);

      await ref.set(
        {
          productId: pid,
          userId: uid,
          rating,
          text: text.trim(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      setInitialRating(rating);
      setInitialText(text.trim());

      Alert.alert("Saved", "Your review has been posted.");

      skipDiscardPromptRef.current = true;
      router.replace(`/(tabs)/reviews/product/${pid}`);
    } catch (e: any) {
      console.log("Save review error:", e);
      Alert.alert("Error", e?.message ?? "Could not save review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
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

      <Text style={{ fontSize: 24, fontWeight: "900" }}>Write review</Text>

      <View style={{ gap: 6 }}>
        <Text style={{ opacity: 0.7 }}>Product</Text>
        <Text style={{ fontWeight: "800" }}>{pid || "Unknown"}</Text>
      </View>

      {!uid && (
        <View
          style={{
            padding: 12,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: "800" }}>Sign in required</Text>
          <Text style={{ opacity: 0.7 }}>
            You need an account to post reviews.
          </Text>

          <Pressable
            onPress={handleGoLogin}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: "#000",
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Go to login</Text>
          </Pressable>
        </View>
      )}

      <Text style={{ fontSize: 16, fontWeight: "800" }}>Rating</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n === rating;
          return (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? "#000" : "#ccc",
                backgroundColor: active ? "#000" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: active ? "#fff" : "#000", fontWeight: "800" }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 16, fontWeight: "800", marginTop: 8 }}>
        Your review
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What did you think?"
        multiline
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 12,
          minHeight: 120,
          textAlignVertical: "top",
        }}
      />

      <Pressable
        onPress={handleSave}
        disabled={!canSubmit}
        style={{
          marginTop: 8,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: "#000",
          opacity: !canSubmit ? 0.4 : 1,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "900" }}>
          {saving ? "Saving..." : "Save review"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
