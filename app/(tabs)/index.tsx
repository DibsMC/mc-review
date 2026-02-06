import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

import { HomeCard } from "../../components/home/HomeCard";
import { BrandLogo } from "../../components/ui/BrandLogo";
import { buildHomeCards } from "../../components/home/homeFeed";
import { AmbientBackground } from "../../components/home/AmbientBackground";
import { SkeletonCard } from "../../components/home/SkeletonCard";

type LatestBadge = { badgeTitle: string; badgeOwnerName: string; badgeOwnerUid?: string } | null;

type Trending = {
  productId: string;
  title: string;
  rating: number;
  ratingCount: number; // number of reviews in the last 7 days
} | null;

type Updated = {
  productId: string;
  title: string;
  snippet: string;
} | null;

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
  <BrandLogo size={72} top={6} right={14} opacity={0.95} />


  // ----------------------------
  // Badge earned (badgeAwards)
  // ----------------------------
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
            const badgeTitle = safeStr(data?.badgeTitle) || "Badge earned";
            const uid = safeStr(data?.userId);

            if (!uid) {
              setLatestBadge({ badgeTitle, badgeOwnerName: "Someone" });
              setBadgeLoading(false);
              return;
            }

            // Resolve displayName (best-effort)
            let displayName = "";
            try {
              const userSnap = await firestore().collection("users").doc(uid).get();
              if (userSnap.exists()) {
                const u = userSnap.data() as any;
                displayName = safeStr(u?.displayName);
              }
            } catch { }

            setLatestBadge({
              badgeTitle,
              badgeOwnerUid: uid,
              badgeOwnerName: displayName || "Someone",
            });
            setBadgeLoading(false);
          } catch (e: any) {
            console.log("Failed resolving latest badge award:", e?.message || e);
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

  // ----------------------------
  // Updated reviews (latest updatedAt)
  // ----------------------------
  useEffect(() => {
    const unsub = firestore()
      .collection("reviews")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .onSnapshot(
        async (snap) => {
          try {
            const doc = snap.docs[0];
            if (!doc) {
              setUpdated(null);
              setUpdatedLoading(false);
              return;
            }

            const data = doc.data() as any;
            const productId = safeStr(data?.productId);
            const reviewText = safeStr(data?.text);

            if (!productId) {
              setUpdated(null);
              setUpdatedLoading(false);
              return;
            }

            // Resolve product title
            let title = "Updated review";
            try {
              const prodSnap = await firestore().collection("products").doc(productId).get();
              if (prodSnap.exists()) {
                const pData = prodSnap.data() as any;
                title = safeStr(pData?.name) || title;
              }
            } catch { }

            const snippet = clampSnippet(reviewText) || "Fresh notes have been added";

            setUpdated({ productId, title, snippet });
            setUpdatedLoading(false);
          } catch (e: any) {
            console.log("Updated compute failed:", e?.message || e);
            setUpdated(null);
            setUpdatedLoading(false);
          }
        },
        (err) => {
          console.log("Updated listener error:", err?.message || err);
          setUpdated(null);
          setUpdatedLoading(false);
        }
      );

    return () => unsub();
  }, []);

  // ----------------------------
  // Trending = most reviewed in last 7 days
  // ----------------------------
  useEffect(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Uses createdAt timestamp (already in your review create block)
    const q = firestore()
      .collection("reviews")
      .where("createdAt", ">=", new Date(weekAgo))
      .orderBy("createdAt", "desc")
      .limit(250);

    const unsub = q.onSnapshot(
      async (snap) => {
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

            const r = data?.rating;
            if (typeof r === "number" && Number.isFinite(r)) {
              sums.set(pid, (sums.get(pid) ?? 0) + r);
              ns.set(pid, (ns.get(pid) ?? 0) + 1);
            }
          });

          if (counts.size == 0) {
            setTrending(null);
            setTrendingLoading(false);
            return;
          }

          // Pick the product with the most reviews in the last 7 days
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

          // Resolve product title
          let title = "Trending";
          try {
            const prodSnap = await firestore().collection("products").doc(topProductId).get();
            if (prodSnap.exists()) {
              const pData = prodSnap.data() as any;
              title = safeStr(pData?.name) || title;
            }
          } catch { }

          const n = ns.get(topProductId) ?? 0;
          const sum = sums.get(topProductId) ?? 0;
          const rating = n > 0 ? Math.round((sum / n) * 10) / 10 : 0;

          setTrending({
            productId: topProductId,
            title,
            rating,
            ratingCount: topCount,
          });
          setTrendingLoading(false);
        } catch (e: any) {
          console.log("Trending compute failed:", e?.message || e);
          setTrending(null);
          setTrendingLoading(false);
        }
      },
      (err) => {
        console.log("Trending listener error:", err?.message || err);
        setTrending(null);
        setTrendingLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // ----------------------------
  // Feed wiring
  // ----------------------------
  const input = useMemo(
    () => ({
      now: Date.now(),
      lastSeenMs: undefined,

      hasNewReviews: true,
      hasNewFlowers: true,
      hasUpdatedReviews: !!updated,

      trendingTitle: trending?.title ?? "Trending",
      trendingProductId: trending?.productId ?? "",
      trendingRating: trending?.rating ?? 0,
      trendingRatingCount: trending?.ratingCount ?? 0,

      topRatedTitle: undefined,
      topRatedProductId: undefined,
      topRatedRating: null,
      topRatedRatingCount: null,

      badgeTitle: latestBadge?.badgeTitle ?? "No badges yet",
      badgeOwnerName: latestBadge?.badgeOwnerName ?? "",

      // Optional fields (homeFeed may ignore these if it doesn't use them)
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
      goToUpdatedReviews: () => {
        if (input.updatedProductId) {
          router.push(`/(tabs)/reviews/product/${encodeURIComponent(input.updatedProductId)}`);
        } else {
          router.push("/reviews");
        }
      },

      goToFlower: (productId: string) =>
        router.push(`/(tabs)/reviews/product/${encodeURIComponent(productId)}`),

      goToBadgeOwner: () => router.push("/user"),

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
    [input.updatedProductId, router]
  );

  const feed = useMemo(() => buildHomeCards(input as any, handlers as any), [input, handlers]);

  const loading = badgeLoading || trendingLoading || updatedLoading;

  return (
    <View style={styles.screen}>
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
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

          <View style={styles.stack}>{feed.news ? <HomeCard card={feed.news} /> : null}</View>

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
