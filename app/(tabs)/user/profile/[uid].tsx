import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import BrandedScreenBackground from "../../../../components/BrandedScreenBackground";
import ProfileAvatar from "../../../../components/user/ProfileAvatar";
import { summarizeReviewsForIdentity } from "../../../../lib/reviewOwnership";
import { theme } from "../../../../lib/theme";
import { ensureUserProfileDoc } from "../../../../lib/userProfileDoc";

const userBg = require("../../../../assets/images/user-bg.png");

type ProfileDoc = {
  displayName: string;
  avatarId: string | null;
  photoURL: string | null;
  email: string | null;
  helpfulCount: number;
  helpfulGivenCount: number;
  followerCount: number;
  followingCount: number;
  isAdmin: boolean;
  isModerator: boolean;
  joinYear: number | null;
};

type ProfileReview = {
  id: string;
  productId: string;
  helpfulCount: number;
  rating: number;
  score: number | null;
  text: string | null;
  createdAtMs: number;
  daytime: number | null;
  sleepy: number | null;
  calm: number | null;
  clarity: number | null;
  painRelief: number | null;
};

type ProductMeta = {
  name: string;
  maker: string;
  variant: string | null;
};

function toMillis(value: any) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function avgNumbers(vals: Array<number | null | undefined>) {
  const xs = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((sum, value) => sum + value, 0) / xs.length;
}

function computeProfileReviewScore(review: ProfileReview) {
  const rating = Number.isFinite(review.rating) ? review.rating : 0;
  const effectsMean = avgNumbers([
    review.daytime,
    review.sleepy,
    review.calm,
    review.clarity,
    review.painRelief,
  ]);

  if (effectsMean === null) return round1(rating);
  return round1(rating * 0.75 + effectsMean * 0.25);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexBasis: "47%",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(11,15,22,0.78)",
        overflow: "hidden",
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.12)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ padding: 14 }}>
        <Text style={{ color: theme.colors.textOnDark, fontSize: 18, fontWeight: "800" }}>{value}</Text>
        <Text
          style={{
            marginTop: 4,
            color: "rgba(255,255,255,0.68)",
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid?: string }>();
  const profileUid = typeof uid === "string" ? uid : "";
  const currentUid = auth().currentUser?.uid ?? "";
  const isOwnProfile = !!profileUid && profileUid === currentUid;

  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [productMap, setProductMap] = useState<Record<string, ProductMeta>>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [helpfulGivenLive, setHelpfulGivenLive] = useState(0);
  const [helpfulReceivedLive, setHelpfulReceivedLive] = useState(0);

  useEffect(() => {
    if (isOwnProfile) {
      router.replace("/(tabs)/user");
    }
  }, [isOwnProfile, router]);

  useEffect(() => {
    if (!profileUid) {
      setProfileLoading(false);
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    const unsub = firestore()
      .collection("users")
      .doc(profileUid)
      .onSnapshot(
        (doc) => {
          const data = (doc.data() as Record<string, any> | undefined) ?? {};
          const createdAt = data?.createdAt ?? data?.created_at ?? null;
          const createdAtMs = toMillis(createdAt);

          setProfile({
            displayName: typeof data?.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : "Member",
            avatarId: typeof data?.avatarId === "string" ? data.avatarId : null,
            photoURL: typeof data?.photoURL === "string" ? data.photoURL : null,
            email: typeof data?.email === "string" && data.email.trim() ? data.email.trim().toLowerCase() : null,
            helpfulCount:
              typeof data?.helpfulCount === "number"
                ? Math.max(0, data.helpfulCount)
                : typeof data?.helpfulReceivedCount === "number"
                  ? Math.max(0, data.helpfulReceivedCount)
                  : 0,
            helpfulGivenCount:
              typeof data?.helpfulGiven === "number"
                ? Math.max(0, data.helpfulGiven)
                : typeof data?.helpfulGivenCount === "number"
                  ? Math.max(0, data.helpfulGivenCount)
                  : 0,
            followerCount:
              typeof data?.followerCount === "number"
                ? Math.max(0, data.followerCount)
                : typeof data?.followersCount === "number"
                  ? Math.max(0, data.followersCount)
                  : 0,
            followingCount:
              typeof data?.followingCount === "number" ? Math.max(0, data.followingCount) : 0,
            isAdmin: !!data?.isAdmin,
            isModerator: !!data?.isModerator,
            joinYear: createdAtMs ? new Date(createdAtMs).getFullYear() : null,
          });
          setProfileLoading(false);
        },
        () => {
          setProfile(null);
          setProfileLoading(false);
        }
      );

    return () => unsub();
  }, [profileUid]);

  useEffect(() => {
    if (!profileUid) {
      setReviews([]);
      setReviewsLoading(false);
      setHelpfulReceivedLive(0);
      return;
    }

    setReviewsLoading(true);
    const unsub = firestore()
      .collection("reviews")
      .onSnapshot(
        (snapshot) => {
          const allReviews = snapshot.docs.map((doc) => {
            const data = (doc.data() as Record<string, any> | undefined) ?? {};
            const rating = typeof data?.rating === "number" ? data.rating : 0;
            const score = typeof data?.score === "number" ? data.score : rating;

            return {
              id: doc.id,
              userId: typeof data?.userId === "string" ? data.userId : "",
              uid: typeof data?.uid === "string" ? data.uid : "",
              authorUid: typeof data?.authorUid === "string" ? data.authorUid : "",
              displayName: typeof data?.displayName === "string" ? data.displayName : "",
              authorName: typeof data?.authorName === "string" ? data.authorName : "",
              userName: typeof data?.userName === "string" ? data.userName : "",
              email: typeof data?.email === "string" ? data.email : "",
              authorEmail: typeof data?.authorEmail === "string" ? data.authorEmail : "",
              userEmail: typeof data?.userEmail === "string" ? data.userEmail : "",
              productId: typeof data?.productId === "string" ? data.productId : "",
              helpfulCount: typeof data?.helpfulCount === "number" ? Math.max(0, data.helpfulCount) : 0,
              rating,
              score,
              text: typeof data?.text === "string" ? data.text.trim() : null,
              createdAtMs: toMillis(data?.createdAt),
              daytime: typeof data?.daytime === "number" ? data.daytime : null,
              sleepy: typeof data?.sleepy === "number" ? data.sleepy : null,
              calm: typeof data?.calm === "number" ? data.calm : null,
              clarity: typeof data?.clarity === "number" ? data.clarity : null,
              painRelief: typeof data?.painRelief === "number" ? data.painRelief : null,
            };
          });

          const summary = summarizeReviewsForIdentity(allReviews, {
            uid: profileUid,
            displayName: profile?.displayName ?? null,
            email: profile?.email ?? null,
          });

          const next = summary.matched
            .map((review) => ({
              id: review.id,
              productId: review.productId,
              helpfulCount: review.helpfulCount,
              rating: review.rating,
              score: review.score,
              text: review.text,
              createdAtMs: review.createdAtMs,
              daytime: review.daytime,
              sleepy: review.sleepy,
              calm: review.calm,
              clarity: review.clarity,
              painRelief: review.painRelief,
            }))
            .sort((a, b) => b.createdAtMs - a.createdAtMs);

          setHelpfulReceivedLive(summary.helpfulTotal);
          setReviews(next);
          setReviewsLoading(false);
        },
        () => {
          setReviews([]);
          setReviewsLoading(false);
          setHelpfulReceivedLive(0);
        }
      );

    return () => unsub();
  }, [profile?.displayName, profile?.email, profileUid]);

  useEffect(() => {
    const productIds = Array.from(new Set(reviews.map((review) => review.productId).filter(Boolean)));
    if (productIds.length === 0) {
      setProductMap({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const next: Record<string, ProductMeta> = {};
        for (let index = 0; index < productIds.length; index += 10) {
          const chunk = productIds.slice(index, index + 10);
          const snapshot = await firestore()
            .collection("products")
            .where(firestore.FieldPath.documentId(), "in", chunk)
            .get();

          snapshot.docs.forEach((doc) => {
            const data = (doc.data() as Record<string, any> | undefined) ?? {};
            next[doc.id] = {
              name: typeof data?.name === "string" ? data.name : "Flower",
              maker: typeof data?.maker === "string" ? data.maker : "Unknown maker",
              variant: typeof data?.variant === "string" ? data.variant : null,
            };
          });
        }

        if (!cancelled) setProductMap(next);
      } catch {
        if (!cancelled) setProductMap({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reviews]);

  useEffect(() => {
    if (!currentUid || !profileUid || isOwnProfile) {
      setIsFollowing(false);
      return;
    }

    const unsub = firestore()
      .collection("users")
      .doc(currentUid)
      .collection("following")
      .doc(profileUid)
      .onSnapshot(
        (doc) => {
          setIsFollowing(doc.exists);
        },
        () => {
          setIsFollowing(false);
        }
      );

    return () => unsub();
  }, [currentUid, isOwnProfile, profileUid]);

  useEffect(() => {
    if (!profileUid) {
      setHelpfulGivenLive(0);
      return;
    }

    const unsub = firestore()
      .collection("users")
      .doc(profileUid)
      .collection("helpful")
      .onSnapshot(
        (snapshot) => {
          setHelpfulGivenLive(snapshot.size);
        },
        () => {
          setHelpfulGivenLive(0);
        }
      );

    return () => unsub();
  }, [profileUid]);

  const productCount = useMemo(() => new Set(reviews.map((review) => review.productId).filter(Boolean)).size, [reviews]);
  const helpfulReceived = useMemo(
    () => Math.max(profile?.helpfulCount ?? 0, helpfulReceivedLive),
    [profile?.helpfulCount, helpfulReceivedLive]
  );

  const roleLabel = profile?.isAdmin ? "Admin" : profile?.isModerator ? "Moderator" : null;

  const toggleFollow = async () => {
    if (!profileUid || isOwnProfile) return;
    if (!currentUid) {
      router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/user/profile/${profileUid}`)}`);
      return;
    }

    try {
      setFollowBusy(true);
      await ensureUserProfileDoc({
        uid: currentUid,
        email: auth().currentUser?.email ?? null,
        displayName: auth().currentUser?.displayName ?? null,
        touchLastActive: true,
      });
      const currentUserRef = firestore().collection("users").doc(currentUid);
      const targetUserRef = firestore().collection("users").doc(profileUid);
      const followingRef = currentUserRef.collection("following").doc(profileUid);
      const batch = firestore().batch();

      if (isFollowing) {
        batch.delete(followingRef);
        batch.set(currentUserRef, { followingCount: firestore.FieldValue.increment(-1) }, { merge: true });
        batch.set(targetUserRef, { followerCount: firestore.FieldValue.increment(-1) }, { merge: true });
      } else {
        batch.set(followingRef, { uid: profileUid, createdAt: firestore.FieldValue.serverTimestamp() });
        batch.set(currentUserRef, { followingCount: firestore.FieldValue.increment(1) }, { merge: true });
        batch.set(targetUserRef, { followerCount: firestore.FieldValue.increment(1) }, { merge: true });
      }

      await batch.commit();
      setIsFollowing((prev) => !prev);
    } finally {
      setFollowBusy(false);
    }
  };

  if (!profileUid) {
    return (
      <BrandedScreenBackground
        source={userBg}
        gradientColors={["rgba(20,12,6,0.16)", "rgba(9,12,18,0.52)", "rgba(6,8,12,0.94)"]}
        scrimColor="rgba(5,7,11,0.24)"
      >
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: theme.colors.textOnDark, fontSize: 18, fontWeight: "900" }}>Profile not found</Text>
        </SafeAreaView>
      </BrandedScreenBackground>
    );
  }

  return (
    <BrandedScreenBackground
      source={userBg}
      gradientColors={["rgba(20,12,6,0.16)", "rgba(9,12,18,0.52)", "rgba(6,8,12,0.94)"]}
      scrimColor="rgba(5,7,11,0.24)"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 28,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: theme.colors.goldGlassBorder,
              marginBottom: 14,
            }}
          >
            <LinearGradient
              colors={["rgba(212,175,55,0.18)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.10)"]}
              start={{ x: 0.05, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={{
                padding: 16,
                backgroundColor: "rgba(24,18,10,0.82)",
              }}
            >
              {profileLoading ? (
                <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
              ) : profile ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ marginRight: 14 }}>
                    <ProfileAvatar avatarId={profile.avatarId} photoURL={profile.photoURL} size={68} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "900",
                        letterSpacing: -0.3,
                        color: theme.colors.textOnDark,
                      }}
                    >
                      {profile.displayName}
                    </Text>

                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 14,
                        lineHeight: 20,
                        color: "rgba(244,245,247,0.82)",
                      }}
                    >
                      {profile.joinYear ? `Part of the community since ${profile.joinYear}` : "Sharing community reviews"}
                    </Text>

                    <Text
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.76)",
                        fontWeight: "700",
                      }}
                    >
                      {`${reviews.length} reviews · ${productCount} flowers`}
                    </Text>

                    {roleLabel ? (
                      <View
                        style={{
                          alignSelf: "flex-start",
                          marginTop: 10,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: "rgba(255,219,136,0.26)",
                          backgroundColor: "rgba(255,219,136,0.12)",
                        }}
                      >
                        <Text style={{ color: theme.colors.textOnDark, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
                          {roleLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textOnDarkSecondary }}>This member could not be loaded.</Text>
              )}
            </LinearGradient>
          </View>

          {!profileLoading && profile ? (
            <>
              {!isOwnProfile ? (
                <Pressable
                  onPress={() => {
                    void toggleFollow();
                  }}
                  disabled={followBusy}
                  style={({ pressed }) => ({
                    marginBottom: 14,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: isFollowing ? "rgba(120,190,140,0.24)" : "rgba(255,255,255,0.14)",
                    backgroundColor: isFollowing ? "rgba(27,68,48,0.70)" : "rgba(11,15,22,0.78)",
                    paddingVertical: 14,
                    alignItems: "center",
                    opacity: followBusy ? 0.7 : pressed ? 0.82 : 1,
                  })}
                >
                  <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 15 }}>
                    {followBusy ? "Updating..." : isFollowing ? "Following" : "Follow this member"}
                  </Text>
                </Pressable>
              ) : null}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                <StatCard label="Reviews" value={String(reviews.length)} />
                <StatCard label="Flowers" value={String(productCount)} />
                <StatCard label="Helpfuls received" value={String(helpfulReceived)} />
                <StatCard label="Followers" value={String(profile.followerCount)} />
              </View>

              <View
                style={{
                  borderRadius: 22,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.14)",
                  backgroundColor: "rgba(11,15,22,0.80)",
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.60)",
                    fontSize: 12,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 10,
                  }}
                >
                  Community stats
                </Text>

                <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                  Helpfuls given: {Math.max(profile.helpfulGivenCount, helpfulGivenLive)} · Following: {profile.followingCount}
                </Text>
              </View>
            </>
          ) : null}

          <View
            style={{
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              backgroundColor: "rgba(11,15,22,0.80)",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.60)",
                fontSize: 12,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 10,
              }}
            >
              Review history
            </Text>

            {reviewsLoading ? (
              <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
            ) : reviews.length === 0 ? (
              <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                No reviews shared yet.
              </Text>
            ) : (
              reviews.map((review, index) => {
                const product = productMap[review.productId];
                const score = computeProfileReviewScore(review);
                const metricChips = [
                  review.daytime !== null ? `Day ${review.daytime}` : null,
                  review.sleepy !== null ? `Sleep ${review.sleepy}` : null,
                  review.calm !== null ? `Calm ${review.calm}` : null,
                  review.clarity !== null ? `Clear ${review.clarity}` : null,
                  review.painRelief !== null ? `Pain ${review.painRelief}` : null,
                ].filter((label): label is string => !!label);
                return (
                  <Pressable
                    key={review.id}
                    onPress={() => {
                      router.push(`/(tabs)/reviews/${encodeURIComponent(review.productId)}`);
                    }}
                    style={({ pressed }) => ({
                      marginTop: index === 0 ? 0 : 12,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.10)",
                      backgroundColor: "rgba(255,255,255,0.03)",
                      padding: 14,
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 17 }}>
                      {product ? `${product.name}${product.variant ? ` (${product.variant})` : ""}` : "Flower"}
                    </Text>
                    <Text style={{ marginTop: 5, color: theme.colors.textOnDarkSecondary, lineHeight: 19 }}>
                      {product ? `${product.maker} · ` : ""}
                      {review.createdAtMs ? new Date(review.createdAtMs).toLocaleDateString() : "Undated"}
                    </Text>

                    <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                        {round1(score).toFixed(1)}
                      </Text>
                    </View>

                    {metricChips.length > 0 ? (
                    <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {metricChips.map((label) => (
                        <View
                          key={`${review.id}-${label}`}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.12)",
                          }}
                        >
                          <Text style={{ color: theme.colors.textOnDark, fontSize: 11, fontWeight: "900" }}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    ) : null}

                    {review.text ? (
                      <Text
                        style={{
                          marginTop: 10,
                          fontSize: 14,
                          lineHeight: 21,
                          color: theme.colors.textOnDarkSecondary,
                        }}
                        numberOfLines={4}
                      >
                        {review.text}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </BrandedScreenBackground>
  );
}
