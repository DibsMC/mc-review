import React, { useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AmbientBackground } from "../../components/home/AmbientBackground";
import { HomeCard } from "../../components/home/HomeCard";
import { SkeletonCard } from "../../components/home/SkeletonCard";
import { buildHomeCards } from "../../components/home/homeFeed";

export default function HomeScreen() {
  const router = useRouter();

  // Replace these with real data later
  const [loading] = useState(false);

  const input = useMemo(() => {
    const now = Date.now();

    return {
      now,
      seedKey: new Date().toISOString().slice(0, 10), // daily rotation
      lastSeenMs: undefined,

      hasNewReviews: true,
      hasNewFlowers: true,
      hasUpdatedReviews: false,

      trendingTitle: "Northern Lights",
      topRatedTitle: "Strawberry OG",

      badgeTitle: "Consistent Reviewer",
      badgeOwnerName: "Alex",

      newsHeadline: "UK prescribing guidance review proposed",
      newsSource: "BBC News",
    };
  }, []);

  const handlers = useMemo(() => {
    return {
      goToNewReviews: () => router.push("/reviews"),
      goToNewFlowers: () => router.push("/reviews"),
      goToUpdatedReviews: () => router.push("/reviews"),
      goToTrending: () => router.push("/reviews"),
      goToTopRated: () => router.push("/reviews"),
      goToBadges: () => router.push("/user"),
      openNews: () => {
        const url = "https://www.bbc.co.uk";
        Alert.alert(
          "Leaving the app",
          "This link will open an external website in your browser.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              onPress: async () => {
                const supported = await Linking.canOpenURL(url);
                if (supported) Linking.openURL(url);
              },
            },
          ]
        );
      },
    };
  }, [router]);

  const feed = useMemo(() => buildHomeCards(input, handlers), [input, handlers]);

  return (
    <View style={styles.screen}>
      <AmbientBackground />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Little “glam” glow behind the title */}
          <View pointerEvents="none" style={styles.titleGlow} />
          <Text style={styles.subtitle}>What’s happening ✨</Text>
        </View>

        {/* Cards */}
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

        {/* News */}
        {feed.news ? (
          <View style={styles.newsBlock}>
            <Text style={styles.sectionLabel}>Updates</Text>
            <HomeCard card={feed.news} />
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B1220",
  },

  // Key change: centre vertically + keep nice padding
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },

  header: {
    alignItems: "center",
    marginBottom: 16,
  },

  // Subtle glow blob behind header text
  titleGlow: {
    position: "absolute",
    width: 240,
    height: 80,
    borderRadius: 999,
    backgroundColor: "rgba(130,255,210,0.10)",
    top: -18,
  },

  subtitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.90)",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 16,
  },

  stack: {
    gap: 12,
  },

  newsBlock: {
    marginTop: 18,
    gap: 10,
  },

  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
    textAlign: "center",
  },
});
