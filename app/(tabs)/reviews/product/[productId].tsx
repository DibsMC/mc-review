import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

type Review = {
  id: string;
  rating?: number;
  text?: string;
  userId?: string;
};

export default function ProductDetail() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const user = auth().currentUser;

  useEffect(() => {
    if (!productId) return;

    setLoading(true);

    const unsub = firestore()
      .collection("flowers")
      .doc(String(productId))
      .collection("reviews")
      .onSnapshot(
        (snap) => {
          const list: Review[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              rating: typeof data.rating === "number" ? data.rating : undefined,
              text: typeof data.text === "string" ? data.text : undefined,
              userId: typeof data.userId === "string" ? data.userId : undefined,
            };
          });

          setReviews(list);
          setLoading(false);
        },
        (err) => {
          console.log("Reviews snapshot error:", err);
          setReviews([]);
          setLoading(false);
        }
      );

    return unsub;
  }, [productId]);

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

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 36, fontWeight: "900" }}>
          {String(productId)}
        </Text>
        <Text style={{ opacity: 0.7 }}>flower</Text>
      </View>

      <Pressable
        onPress={() =>
          router.push(`/(tabs)/reviews/product/${productId}/write-review`)
        }
        disabled={!user}
        style={{
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: "#111",
          opacity: user ? 1 : 0.35,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
          Write a review
        </Text>
      </Pressable>

      {!user ? (
        <Text style={{ opacity: 0.7 }}>Sign in to write a review</Text>
      ) : null}

      <Text style={{ fontSize: 24, fontWeight: "900", marginTop: 8 }}>
        Reviews
      </Text>

      {loading ? (
        <Text>Loading…</Text>
      ) : reviews.length === 0 ? (
        <Text style={{ opacity: 0.7 }}>No reviews yet.</Text>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View
              style={{
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: "900" }}>
                Rating: {item.rating ?? "-"} / 5
              </Text>
              {item.text ? <Text>{item.text}</Text> : null}
              <Text style={{ opacity: 0.7 }}>
                by: {item.userId ? item.userId.slice(0, 6) + "…" : "unknown"}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
