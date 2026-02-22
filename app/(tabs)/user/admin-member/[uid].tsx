import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../../lib/nativeDeps";
import { theme } from "../../../../lib/theme";

type UserDoc = {
  displayName?: string | null;
  email?: string | null;
  isAdmin?: boolean | null;
  accountDisabled?: boolean | null;
  reviewRestrictionLevel?: number | null;
  reviewRestrictionUntilMs?: number | null;
  reviewRestrictionManual?: boolean | null;
  createdAt?: any;
  created_at?: any;
};

type ReviewRow = {
  id: string;
  text: string;
  productId: string;
  rating: number;
  helpfulCount: number;
  reportCount: number;
  moderationStatus: string;
  createdAtMs: number;
};

function toMs(value: any): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function formatDateTime(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms)) return "n/a";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "n/a";
  }
}

function prettyLock(level: number, untilMs: number | null, manual: boolean) {
  if (manual || level >= 3) return "Manual lock (admin unlock required)";
  if (typeof untilMs === "number" && untilMs > Date.now()) return `Locked until ${formatDateTime(untilMs)}`;
  return "Posting open";
}

export default function AdminMemberDetailScreen() {
  const auth = getFirebaseAuth();
  const firestore = getFirebaseFirestore();
  const { uid } = useLocalSearchParams<{ uid?: string }>();

  const [gateResolved, setGateResolved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [helpfulGiven, setHelpfulGiven] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  const safeUid = typeof uid === "string" ? uid : "";

  useEffect(() => {
    if (!auth || !firestore) return;
    const currentUid = auth().currentUser?.uid ?? "";
    if (!currentUid) {
      setIsAdmin(false);
      setGateResolved(true);
      return;
    }

    const unsub = firestore()
      .collection("users")
      .doc(currentUid)
      .onSnapshot(
        (doc) => {
          setIsAdmin(!!doc.data()?.isAdmin);
          setGateResolved(true);
        },
        () => {
          setIsAdmin(false);
          setGateResolved(true);
        }
      );

    return () => unsub();
  }, [auth, firestore]);

  useEffect(() => {
    if (!firestore || !isAdmin || !safeUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubUser = firestore()
      .collection("users")
      .doc(safeUid)
      .onSnapshot(
        (doc) => {
          setUserDoc((doc.data() as UserDoc) ?? null);
        },
        () => setUserDoc(null)
      );

    const unsubReviews = firestore()
      .collection("reviews")
      .where("userId", "==", safeUid)
      .onSnapshot(
        (snap) => {
          const next: ReviewRow[] = snap.docs.map((doc) => {
            const data = (doc.data() as any) ?? {};
            return {
              id: doc.id,
              text: typeof data.text === "string" ? data.text : "",
              productId: typeof data.productId === "string" ? data.productId : "",
              rating: typeof data.rating === "number" ? data.rating : 0,
              helpfulCount: typeof data.helpfulCount === "number" ? data.helpfulCount : 0,
              reportCount: typeof data.reportCount === "number" ? data.reportCount : 0,
              moderationStatus:
                typeof data.moderationStatus === "string" ? data.moderationStatus : "active",
              createdAtMs: toMs(data.createdAt),
            };
          });
          next.sort((a, b) => b.createdAtMs - a.createdAtMs);
          setReviews(next);
          setLoading(false);
        },
        () => setLoading(false)
      );

    const unsubHelpful = firestore()
      .collection("users")
      .doc(safeUid)
      .collection("helpful")
      .onSnapshot(
        (snap) => setHelpfulGiven(snap.size),
        () => setHelpfulGiven(0)
      );

    const unsubFavs = firestore()
      .collection("users")
      .doc(safeUid)
      .collection("favorites")
      .onSnapshot(
        (snap) => setFavoritesCount(snap.size),
        () => setFavoritesCount(0)
      );

    return () => {
      unsubUser();
      unsubReviews();
      unsubHelpful();
      unsubFavs();
    };
  }, [firestore, isAdmin, safeUid]);

  const stats = useMemo(() => {
    const reviewsCount = reviews.length;
    const helpfulReceived = reviews.reduce(
      (sum, review) => sum + (Number.isFinite(review.helpfulCount) ? Math.max(0, review.helpfulCount) : 0),
      0
    );
    return {
      reviewsCount,
      helpfulReceived,
      helpfulGiven,
      favoritesCount,
    };
  }, [favoritesCount, helpfulGiven, reviews]);

  if (!auth || !firestore) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.title}>Unavailable</Text>
          <Text style={styles.subtle}>Required modules did not load.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!gateResolved) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.title}>Admin only</Text>
          <Text style={styles.subtle}>This screen is restricted to admin accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Member details" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{userDoc?.displayName?.trim() || "New Member"}</Text>
          <Text style={styles.subtle}>{userDoc?.email?.trim().toLowerCase() || "Email missing in profile"}</Text>
          <Text style={styles.subtle}>UID: {safeUid || "n/a"}</Text>
          <Text style={styles.subtle}>
            Joined: {formatDateTime(toMs(userDoc?.createdAt ?? userDoc?.created_at))}
          </Text>
          <Text style={styles.subtle}>Role: {userDoc?.isAdmin ? "Admin" : "Member"}</Text>
          <Text style={styles.subtle}>
            Account: {userDoc?.accountDisabled ? "Disabled/Banned" : "Active"}
          </Text>
          <Text style={styles.subtle}>
            Posting:{" "}
            {prettyLock(
              typeof userDoc?.reviewRestrictionLevel === "number" ? userDoc.reviewRestrictionLevel : 0,
              typeof userDoc?.reviewRestrictionUntilMs === "number" ? userDoc.reviewRestrictionUntilMs : null,
              !!userDoc?.reviewRestrictionManual
            )}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stats</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 10 }} />
          ) : (
            <>
              <Text style={styles.subtle}>Reviews: {stats.reviewsCount}</Text>
              <Text style={styles.subtle}>Favourites: {stats.favoritesCount}</Text>
              <Text style={styles.subtle}>Helpful given: {stats.helpfulGiven}</Text>
              <Text style={styles.subtle}>Helpful received: {stats.helpfulReceived}</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reviews by this member</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 10 }} />
          ) : reviews.length === 0 ? (
            <Text style={styles.subtle}>No reviews found for this member.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>Review {review.id.slice(0, 8)}</Text>
                <Text style={styles.subtle}>Product: {review.productId || "Unknown"}</Text>
                <Text style={styles.subtle}>
                  Rating: {review.rating} | Helpful: {review.helpfulCount} | Reports: {review.reportCount}
                </Text>
                <Text style={styles.subtle}>
                  Status: {review.moderationStatus} | Created: {formatDateTime(review.createdAtMs)}
                </Text>
                {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.appBgSolid,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 58,
    paddingBottom: 24,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 14,
    gap: 6,
  },
  title: {
    color: theme.colors.textOnDark,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionTitle: {
    color: theme.colors.textOnDark,
    fontSize: 18,
    fontWeight: "900",
  },
  subtle: {
    color: theme.colors.textOnDarkSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  rowCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 5,
  },
  rowTitle: {
    color: theme.colors.textOnDark,
    fontWeight: "900",
    fontSize: 15,
  },
  reviewText: {
    color: theme.colors.textOnDark,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
