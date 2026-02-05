import React, { useMemo } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { HomeCard } from "../../components/home/HomeCard";
import { buildHomeCards } from "../../components/home/homeFeed";
import { AmbientBackground } from "../../components/home/AmbientBackground";
import { SkeletonCard } from "../../components/home/SkeletonCard";

// If you already have real data wiring for these inputs, keep it.
// This file is focused on layout + handlers correctness.
export default function HomeScreen() {
  const router = useRouter();

  // TODO: replace these with your real derived values
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

      badgeTitle: "Consistent Reviewer",
      badgeOwnerName: "Alex",

      seedKey: "home-feed",
    }),
    []
  );

  const handlers = useMemo(
    () => ({
      goToNewReviews: () => router.push("/reviews"),
      goToNewFlowers: () => router.push("/reviews"),
      goToUpdatedReviews: () => router.push("/reviews"),

      goToFlower: (productId: string) => router.push(`/reviews/${productId}`),

      goToBadgeOwner: (ownerName?: string) => {
        // If you have a better mapping (ownerName -> uid), swap this later.
        // For now, send them to User tab/profile area.
        router.push("/user");
      },

      openMcStock: async () => {
        // MedBud Wiki - you can swap to the exact URL you want.
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
    [router]
  );

  const feed = useMemo(() => buildHomeCards(input, handlers), [input, handlers]);

  // If you have a real loading state, wire it in. Kept simple here.
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
          </View>

          {/* tiny bottom spacer so it breathes above tab bar */}
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
    gap: 14, // tighter so MC stock fits without scroll
  },
});
