import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

import { HomeCard } from "../../components/home/HomeCard";
import { buildHomeCards } from "../../components/home/homeFeed";
import { AmbientBackground } from "../../components/home/AmbientBackground";
import { SkeletonCard } from "../../components/home/SkeletonCard";

type LatestBadge = {
  badgeTitle: string;
  badgeOwnerName: string;
  badgeOwnerUid?: string;
};

export default function HomeScreen() {
  const router = useRouter();

  const [latestBadge, setLatestBadge] = useState<LatestBadge | null>(null);
  const [badgeLoading, setBadgeLoading] = useState(true);

  useEffect(() => {
    const unsub = firestore()
      .collection("badgeAwards")
      .orderBy("createdAt", "desc")
      .limit(1)
      .onSnapshot(
        async (snap) => {
          try {
            const doc = snap.docs[0];
            if (!doc) {
              setLatestBadge(null);
              setBadgeLoading(false);
              return;
            }

            const data = doc.data() as any;

            const badgeTitle =
              typeof data.badgeTitle === "string" && data.badgeTitle.trim()
                ? data.badgeTitle
                : "Badge earned";

            const uid = typeof data.userId === "string" ? data.userId : "";

            if (!uid) {
              setLatestBadge({ badgeTitle, badgeOwnerName: "Someone" });
              setBadgeLoading(false);
              return;
            }

            const userDoc = await firestore().collection("users").doc(uid).get();

            const existsValue = (userDoc as any).exists;
            const exists = typeof existsValue === "function" ? existsValue.call(userDoc) : !!existsValue;

            const displayName = exists ? (userDoc.data() as any)?.displayName : null;


            setLatestBadge({
              badgeTitle,
              badgeOwnerUid: uid,
              badgeOwnerName:
                typeof displayName === "string" && displayName.trim() ? displayName : "Someone",
            });

            setBadgeLoading(false);
          } catch (e) {
            console.log("Failed resolving latest badge award:", e);
            setLatestBadge(null);
            setBadgeLoading(false);
          }
        },
        (err) => {
          console.log("badgeAwards listener error:", err?.message || err);
          setLatestBadge(null);
          setBadgeLoading(false);
        }
      );

    return () => unsub();
  }, []);

  const input = useMemo(
    () => ({
      now: Date.now(),
      lastSeenMs: undefined,

      hasNewReviews: true,
      hasNewFlowers: true,
      hasUpdatedReviews: true,

      trendingTitle: "Northern Lights",
      trendingProductId: "demo_product_id",
      trendingRating: 4.2,
      trendingRatingCount: 12,

      topRatedTitle: undefined,
      topRatedProductId: undefined,
      topRatedRating: null,
      topRatedRatingCount: null,

      badgeTitle: latestBadge?.badgeTitle ?? "No badges yet",
      badgeOwnerName: latestBadge?.badgeOwnerName ?? "",

      seedKey: "home-feed",
    }),
    [latestBadge]
  );

  const handlers = useMemo(
    () => ({
      goToNewReviews: () => router.push("/reviews"),
      goToNewFlowers: () => router.push("/reviews"),
      goToUpdatedReviews: () => router.push("/reviews"),

      goToFlower: (productId: string) => router.push(`/reviews/${productId}`),

      goToBadgeOwner: () => {
        if (latestBadge?.badgeOwnerUid) {
          router.push(`/(tabs)/user/profile/${encodeURIComponent(latestBadge.badgeOwnerUid)}`);
          return;
        }
        router.push("/user");
      },

      openMcStock: async () => {
        const url = "https://medbud.wiki/";
        try {
          const supported = await Linking.canOpenURL(url);
          if (!supported) {
            Alert.alert("Cannot open link", "Your device cannot open this link.");
            return;
          }
          await Linking.openURL(url);
        } catch (e) {
          Alert.alert("Cannot open link", "Something went wrong opening the website.");
        }
      },
    }),
    [router, latestBadge?.badgeOwnerUid]
  );

  const feed = useMemo(() => buildHomeCards(input, handlers), [input, handlers]);

  const loading = false;

  return (
    <View style={styles.screen}>
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>What&apos;s happening ✨</Text>
          </View>

          <View style={styles.stack}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                {feed.primary.map((c, index) => (
                  <HomeCard key={c.id} card={c} hero={index === 0} />
                ))}
              </>
            )}
          </View>

          <Text style={styles.section}>UPDATES</Text>

          <View style={styles.stack}>
            {feed.news ? <HomeCard card={feed.news} /> : null}
            {badgeLoading ? <Text style={styles.hint}>Updating badges…</Text> : null}
          </View>

          <View style={{ height: 10 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  safe: { flex: 1 },
  content: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "rgba(255,255,255,0.94)",
    letterSpacing: -0.6,
  },
  section: {
    marginTop: 16,
    marginBottom: 10,
    textAlign: "center",
    fontSize: 14,
    letterSpacing: 2.2,
    fontWeight: "800",
    color: "rgba(255,255,255,0.45)",
  },
  stack: {
    gap: 14,
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
});
