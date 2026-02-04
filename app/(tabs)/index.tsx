import React, { useMemo } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AmbientBackground } from "../../components/home/AmbientBackground";
import { HomeCard } from "../../components/home/HomeCard";
import { SkeletonCard } from "../../components/home/SkeletonCard";
import { buildHomeCards } from "../../components/home/homeFeed";
import { theme } from "../../lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Replace these with your real computed values if you already have them.
  const input = useMemo(
    () => ({
      now: Date.now(),
      lastSeenMs: undefined as number | undefined,

      hasNewReviews: true,
      hasNewFlowers: true,
      hasUpdatedReviews: true,

      trendingTitle: "Northern Lights",
      trendingProductId: "", // set to a real id to deep-link
      trendingRating: null as number | null,
      trendingRatingCount: null as number | null,

      topRatedTitle: undefined as string | undefined,
      topRatedProductId: undefined as string | undefined,
      topRatedRating: null as number | null,
      topRatedRatingCount: null as number | null,

      badgeTitle: "Consistent Reviewer",
      badgeOwnerName: "Alex",

      // legacy fields ignored by the new homeFeed, kept for safety
      newsHeadline: undefined as string | undefined,
      newsSource: undefined as string | undefined,

      seedKey: "home",
    }),
    []
  );

  const handlers = useMemo(
    () => ({
      goToNewReviews: () => router.push("/reviews"),
      goToNewFlowers: () => router.push("/reviews"),
      goToUpdatedReviews: () => router.push("/reviews"),

      goToFlower: (productId: string) => router.push(`/reviews/${productId}`),

      goToBadges: () => router.push("/user"),

      openMcStock: () => {
        const url = "https://medbud.wiki/";
        Alert.alert(
          "Leaving the app",
          "This link will open an external website in your browser.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open",
              onPress: async () => {
                try {
                  await Linking.openURL(url);
                } catch {
                  Alert.alert("Could not open link");
                }
              },
            },
          ]
        );
      },
    }),
    [router]
  );

  const feed = useMemo(() => buildHomeCards(input, handlers), [input, handlers]);

  const loading = false;

  return (
    <View style={styles.screen}>
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Centered header like screenshot */}
          <View style={[styles.header, { paddingTop: Math.max(8, insets.top + 10) }]}>
            <Text style={styles.headerTitle}>What’s happening ✨</Text>
          </View>

          {/* Primary cards */}
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

          {/* Updates label + bottom card */}
          {feed.news ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.updatesLabel}>UPDATES</Text>

              <View style={{ marginTop: 12 }}>
                <HomeCard card={feed.news} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    gap: 14,
  },

  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 0.2,
  },

  stack: {
    gap: 14,
  },

  updatesLabel: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.55)",
  },
});
