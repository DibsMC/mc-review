import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

export default function WriteReviewScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState<string>("");

  const [initialRating, setInitialRating] = useState<number>(0);
  const [initialText, setInitialText] = useState<string>("");

  // Load existing review (global reviews collection) so edit works
  useEffect(() => {
    const run = async () => {
      const id = typeof productId === "string" ? productId : "";
      const user = auth().currentUser;

      if (!id || !user) {
        setLoading(false);
        return;
      }

      try {
        const snap = await firestore()
          .collection("reviews")
          .where("productId", "==", id)
          .where("userId", "==", user.uid)
          .limit(1)
          .get();

        const existing = snap.docs[0]?.data() as any;

        if (existing) {
          const r = typeof existing.rating === "number" ? existing.rating : 0;
          const t = typeof existing.text === "string" ? existing.text : "";

          setRating(r);
          setText(t);

          setInitialRating(r);
          setInitialText(t);
        }
      } catch (e: any) {
        console.log("Failed to load existing review:", e?.message || e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [productId]);

  async function maybeAwardFirstReviewBadge(uid: string) {
    // One-time award per user
    // badgeAwards doc shape used by Home:
    // { badgeKey, badgeTitle, userId, createdAt }
    try {
      const awardsRef = firestore().collection("badgeAwards");

      const alreadyAwardedSnap = await awardsRef
        .where("userId", "==", uid)
        .where("badgeKey", "==", "first_review")
        .limit(1)
        .get();

      if (!alreadyAwardedSnap.empty) return;

      // If they can save a review, they have at least one review.
      await awardsRef.add({
        badgeKey: "first_review",
        badgeTitle: "First Review",
        userId: uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (e: any) {
      console.log("Badge award write failed:", e?.message || e);
    }
  }

  async function handleSave() {
    const id = typeof productId === "string" ? productId : "";
    const user = auth().currentUser;

    if (!user) {
      Alert.alert("Not signed in", "Please sign in to write a review.");
      return;
    }

    if (!id) {
      Alert.alert("Missing product", "No product ID was provided.");
      return;
    }

    const trimmed = text.trim();

    if (!trimmed) {
      Alert.alert("Add some text", "Please write a short review before saving.");
      return;
    }

    if (!rating || rating < 0) {
      Alert.alert("Add a rating", "Please set a rating before saving.");
      return;
    }

    const uid = user.uid;
    const reviewId = `${id}_${uid}`;
    const ref = firestore().collection("reviews").doc(reviewId);

    try {
      setSaving(true);

      await ref.set(
        {
          productId: id,
          userId: uid,
          rating,
          text: trimmed,
          updatedAt: firestore.FieldValue.serverTimestamp(),

          // Keep createdAt stable on first create, but allow merge to preserve it
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Award badge after successful save (doesn't block navigation if it fails)
      await maybeAwardFirstReviewBadge(uid);

      setInitialRating(rating);
      setInitialText(trimmed);

      Alert.alert("Saved", "Your review has been posted.");

      // Go back to canonical product detail screen
      router.replace(`/(tabs)/reviews/${encodeURIComponent(id)}`);
    } catch (e: any) {
      console.log("Failed to save review:", e?.message || e);
      Alert.alert("Save failed", e?.message || "Something went wrong saving your review.");
    } finally {
      setSaving(false);
    }
  }

  function hasChanges() {
    return rating !== initialRating || text.trim() !== initialText.trim();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const id = typeof productId === "string" ? productId : "";

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Write a review</Text>

      {!id ? <Text style={{ opacity: 0.8 }}>Missing product ID.</Text> : null}

      <View style={{ marginTop: 12 }}>
        <Text style={{ marginBottom: 8, opacity: 0.85 }}>Rating</Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: rating === n ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              }}
            >
              <Text>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={{ marginBottom: 8, opacity: 0.85 }}>Your review</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What did you think?"
          placeholderTextColor="rgba(255,255,255,0.35)"
          multiline
          style={{
            minHeight: 140,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            backgroundColor: "rgba(255,255,255,0.06)",
            textAlignVertical: "top",
          }}
        />
      </View>

      <View style={{ marginTop: 18, flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasChanges()}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            opacity: saving || !hasChanges() ? 0.55 : 1,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            backgroundColor: "rgba(255,255,255,0.10)",
          }}
        >
          <Text style={{ fontWeight: "600" }}>{saving ? "Saving..." : "Save"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
