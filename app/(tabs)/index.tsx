import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

import { HomeCard } from "../../components/home/HomeCard";
import { buildHomeCards } from "../../components/home/homeFeed";
import { AmbientBackground } from "../../components/home/AmbientBackground";
import { SkeletonCard } from "../../components/home/SkeletonCard";

type LatestBadge =
  | { badgeTitle: string; badgeOwnerName: string; badgeOwnerUid?: string }
  | null;

type Trending =
  | {
    productId: string;
    title: string;
    rating: number;
    ratingCount: number;
  }
  | null;

type Updated =
  | {
    productId: string;
    title: string;
    snippet: string;
  }
  | null;

function safeStr(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function clampSnippet(s: string, maxLen = 110) {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
}

export default function HomeScreen() {
  const router = useRouter();

  const [latestBadge, setLatestBadge] = useState<LatestBadge>(null);
  const [badgeLoading, setBadgeLoading] = useState(true);

  const [trending, setTrending] = useState<Trending>(null);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const [updated, setUpdated] = useState<Updated>(null);
  const [updatedLoading, setUpdatedLoading] = useState(true);

  // ----------------------------
  // Badge earned
  // ----------------------------
  useEffect(() => {
    const unsub = firestore()
      .collection("badgeAwards")
      .orderBy("createdAt", "desc")
      .limit(1)
      .onSnapshot(async (snap) => {
        try {
          const doc = snap.docs[0];
          if (!doc) {
            setLatestBadge(null);
            setBadgeLoading(false);
            return;
          }

          const data = doc.data() as any;
          const badgeTitle = safeStr(data?.badgeTitle) || "Badge earned";
          const uid = safeStr(data?.userId);

          let displayName = "Someone";
          if (uid) {
            try {
              const userSnap = await firestore().collection("users").doc(uid).get();
              if (userSnap.exists()) {
                displayName = safeStr(userSnap.data()?.displayName) || displayName;
              }
            } catch { }
          }

          setLatestBadge({
            badgeTitle,
            badgeOwnerName: displayName,
            badgeOwnerUid: uid || undefined,
          });
          setBadgeLoading(false);
        } catch {
          setLatestBadge(null);
          setBadgeLoading(false);
        }
      });

    return () => unsub();
  }, []);

  // ----------------------------
  // Updated reviews
  // ----------------------------
  useEffect(() => {
    const unsub = firestore()
      .collection("reviews")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .onSnapshot(async (snap) => {
        try {
          const doc = snap.docs[0];
          if (!doc) {
            setUpdated(null);
            setUpdatedLoading(false);
            return;
          }

          const data = doc.data() as any;
          const productId = safeStr(data?.productId);
          if (!productId) {
            setUpdated(null);
            setUpdatedLoading(false);
            return;
          }

          let title = "Updated review";
          try {
            const prodSnap = await firestore().collection("products").doc(productId).get();
            if (prodSnap.exists()) {
              title = safeStr(prodSnap.data()?.name) || title;
            }
          } catch { }

          setUpdated({
            productId,
            title,
            snippet: clampSnippet(safeStr(data?.text)) || "Fresh notes have been added",
          });
          setUpdatedLoading(false);
        } catch {
          setUpdated(null);
          setUpdatedLoading(false);
        }
      });

    return () => unsub();
  }, []);

  // ----------------------------
  // Trending (last 7 days)
  // ----------------------------
  useEffect(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const unsub = firestore()
      .collection("reviews")
      .where("createdAt", ">=", new Date(weekAgo))
      .orderBy("createdAt", "desc")
      .limit(250)
      .onSnapshot(async (snap) => {
        try {
          if (snap.empty) {
            setTrending(null);
            setTrendingLoading(false);
            return;
          }

          const counts = new Map<string, number>();
          const sums = new Map<string, number>();
          const ns = new Map<string, number>();

          snap.docs.forEach((d) => {
            const data = d.data() as any;
            const pid = safeStr(data?.productId);
            if (!pid) return;

            counts.set(pid, (counts.get(pid) ?? 0) + 1);

            if (typeof data?.rating === "number") {
              sums.set(pid, (sums.get(pid) ?? 0) + data.rating);
              ns.set(pid, (ns.get(pid) ?? 0) + 1);
            }
          });

          let topProductId = "";
          let topCount = -1;
          counts.forEach((c, pid) => {
            if (c > topCount) {
              topCount = c;
              topProductId = pid;
            }
          });

          if (!topProductId) {
            setTrending(null);
            setTrendingLoading(false);
            return;
          }

          let title = "Trending";
          try {
            const prodSnap = await firestore().collection("products").doc(topProductId).get();
            if (prodSnap.exists()) {
              title = safeStr(prodSnap.data()?.name) || title;
            }
          } catch { }

          const n = ns.get(topProductId) ?? 0;
          const rating = n
            ? Math.round(((sums.get(topProductId) ?? 0) / n) * 10) / 10
            : 0;

          setTrending({
            productId: topProductId,
            title,
            rating,
            ratingCount: topCount,
          });
          setTrendingLoading(false);
        } catch {
          setTrending(null);
          setTrendingLoading(false);
        }
      });

    return () => unsub();
  }, []);

  // ----------------------------
  // Feed wiring
  // ----------------------------
  const input = useMemo(
    () => ({
      now: Date.now(),
      hasUpdatedReviews: !!updated,
      trendingTitle: trending?.title ?? "Trending",
      trendingProductId: trending?.productId ?? "",
      trendingRating: trending?.rating ?? 0,
      trendingRatingCount: trending?.ratingCount ?? 0,
      badgeTitle: latestBadge?.badgeTitle ?? "No badges yet",
      badgeOwnerName: latestBadge?.badgeOwnerName ?? "",
      badgeOwnerUid: latestBadge?.badgeOwnerUid ?? undefined, // ✅ pass through for correct navigation
      updatedTitle: updated?.title ?? "Updated reviews",
      updatedSubtitle: updated?.snippet ?? "Fresh notes have been added",
      updatedProductId: updated?.productId ?? "",
      seedKey: "home-feed",
    }),
    [latestBadge, trending, updated]
  );

  const handlers = useMemo(
    () => ({
      goToNewReviews: () => router.push("/reviews"),
      goToNewFlowers: () => router.push("/reviews"),
      goToUpdatedReviews: () =>
        input.updatedProductId
          ? router.push(`/(tabs)/reviews/${encodeURIComponent(input.updatedProductId)}`)
          : router.push("/reviews"),
      goToFlower: (productId: string) =>
        router.push(`/(tabs)/reviews/${encodeURIComponent(productId)}`),
      goToBadgeOwner: (uid?: string) => {
        if (!uid) return;
        router.push(`/(tabs)/user/profile/${uid}`);
      },
      openMcStock: async () => {
        const url = "https://medbud.wiki/";
        try {
          if (await Linking.canOpenURL(url)) await Linking.openURL(url);
          else Alert.alert("Cannot open link", "Your device cannot open this link.");
        } catch {
          Alert.alert("Cannot open link", "Something went wrong opening the website.");
        }
      },
    }),
    [input.updatedProductId, router]
  );

  const feed = useMemo(() => buildHomeCards(input as any, handlers as any), [input, handlers]);
  const loading = badgeLoading || trendingLoading || updatedLoading;

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
              feed.primary.map((c, index) => (
                <HomeCard key={c.id} card={c} hero={index === 0} />
              ))
            )}
          </View>

          <Text style={styles.section}>UPDATES</Text>

          <View style={styles.stack}>{feed.news && <HomeCard card={feed.news} />}</View>

          <View style={{ height: 10 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  safe: { flex: 1 },
  content: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  header: { marginBottom: 12 },
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
  stack: { gap: 14 },
});
