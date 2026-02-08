// app/(tabs)/user/profile/[uid].tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import firestore from "@react-native-firebase/firestore";
import { theme } from "../../../../lib/theme";

const budImg = require("../../../../assets/icons/bud.png");

type PublicUser = {
    displayName?: string | null;
    avatarId?: string | null; // optional if you store it publicly
    photoURL?: string | null; // optional if you store it publicly
    bio?: string | null;

    // Public stats
    reviewsWritten?: number | null;
    helpfulReceived?: number | null;
    helpfulGiven?: number | null;
    favouritesCount?: number | null;

    // Optional - used if you want badges to be computed without extra reads
    createdAt?: any;
};

type RecentReview = {
    id: string;
    productId: string;
    productName?: string | null;
    rating?: number | null;
    createdAt?: any;
};

type Badge = {
    id: string;
    title: string;
    subtitle: string;
    achieved: boolean;
};

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            style={{
                fontSize: 12,
                letterSpacing: 0.9,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                marginBottom: 10,
                fontWeight: "900",
            }}
        >
            {children}
        </Text>
    );
}

function GlassCard({
    children,
    style,
    borderTint,
}: {
    children: React.ReactNode;
    style?: any;
    borderTint?: string;
}) {
    return (
        <View
            style={[
                {
                    backgroundColor: "rgba(246,247,248,0.12)",
                    borderColor: borderTint ?? "rgba(255,255,255,0.16)",
                    borderWidth: 1,
                    borderRadius: 22,
                    overflow: "hidden",
                },
                style,
            ]}
        >
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(255,255,255,0.12)",
                    "rgba(255,255,255,0.06)",
                    "rgba(0,0,0,0.10)",
                ]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View style={{ padding: 16 }}>{children}</View>
        </View>
    );
}

function getDiceBearPngUrl(seed: string, size: number) {
    const safeSeed = encodeURIComponent(seed || "guest");
    const safeSize = Math.min(256, Math.max(32, Math.round(size)));
    return `https://api.dicebear.com/9.x/lorelei/png?seed=${safeSeed}&size=${safeSize}`;
}

function AvatarCircle({
    size = 56,
    seed,
    photoURL,
}: {
    size?: number;
    seed: string;
    photoURL?: string | null;
}) {
    const [dicebearFailed, setDicebearFailed] = useState(false);
    const dicebearUrl = useMemo(() => getDiceBearPngUrl(seed, size), [seed, size]);
    const showDiceBear = !photoURL && !dicebearFailed;

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                backgroundColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(255,255,255,0.10)",
                    "rgba(255,255,255,0.04)",
                    "rgba(0,0,0,0.14)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {photoURL ? (
                <Image source={{ uri: photoURL }} style={{ width: size, height: size }} />
            ) : showDiceBear ? (
                <Image
                    source={{ uri: dicebearUrl }}
                    style={{ width: size, height: size }}
                    onError={() => setDicebearFailed(true)}
                />
            ) : (
                <Image
                    source={budImg}
                    resizeMode="contain"
                    style={{ width: Math.round(size * 0.52), height: Math.round(size * 0.52) }}
                />
            )}
        </View>
    );
}

function toInt(n: any) {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
    return v < 0 ? 0 : v;
}

export default function PublicProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ uid?: string }>();
    const uid = typeof params?.uid === "string" ? params.uid : "";

    const [loading, setLoading] = useState(true);
    const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
    const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);

    useEffect(() => {
        if (!uid) return;

        setLoading(true);

        // ✅ IMPORTANT: this must be a PUBLIC collection
        const unsub = firestore()
            .collection("publicUsers")
            .doc(uid)
            .onSnapshot(
                async (doc) => {
                    const data = (doc.data() as any) ?? null;

                    if (!doc.exists || !data) {
                        setPublicUser(null);
                        setRecentReviews([]);
                        setLoading(false);
                        return;
                    }

                    setPublicUser({
                        displayName: typeof data?.displayName === "string" ? data.displayName : "Anonymous",
                        photoURL: typeof data?.photoURL === "string" ? data.photoURL : null,
                        bio: typeof data?.bio === "string" ? data.bio : null,
                        reviewsWritten: typeof data?.reviewsWritten === "number" ? data.reviewsWritten : 0,
                        helpfulReceived: typeof data?.helpfulReceived === "number" ? data.helpfulReceived : 0,
                        helpfulGiven: typeof data?.helpfulGiven === "number" ? data.helpfulGiven : 0,
                        favouritesCount: Array.isArray(data?.favoriteProductIds) ? data.favoriteProductIds.filter((x: any) => typeof x === "string").length : 0,
                        createdAt: data?.createdAt ?? null,
                    });

                    // Optional: fetch recent reviews summary if you’re storing them publicly
                    // This assumes: publicUsers/{uid}/recentReviews collection
                    try {
                        const snap = await firestore()
                            .collection("publicUsers")
                            .doc(uid)
                            .collection("recentReviews")
                            .orderBy("createdAt", "desc")
                            .limit(5)
                            .get();

                        const rows: RecentReview[] = snap.docs.map((d) => {
                            const r = d.data() as any;
                            return {
                                id: d.id,
                                productId: typeof r?.productId === "string" ? r.productId : "",
                                productName: typeof r?.productName === "string" ? r.productName : null,
                                rating: typeof r?.rating === "number" ? r.rating : null,
                                createdAt: r?.createdAt ?? null,
                            };
                        });

                        setRecentReviews(rows.filter((x) => !!x.productId));
                    } catch {
                        // If you haven’t created this yet, don’t break the page
                        setRecentReviews([]);
                    }

                    setLoading(false);
                },
                (err) => {
                    console.log("public profile snapshot error:", err);
                    setLoading(false);
                }
            );

        return () => unsub();
    }, [uid]);

    const displayName = publicUser?.displayName?.trim() ? publicUser.displayName : "Anonymous";
    const bio = publicUser?.bio?.trim() ? publicUser.bio : "Sharing honest experiences with the community";

    const reviewsWritten = toInt(publicUser?.reviewsWritten);
    const helpfulReceived = toInt(publicUser?.helpfulReceived);
    const helpfulGiven = toInt(publicUser?.helpfulGiven);
    const favourites = toInt(publicUser?.favouritesCount);

    const badges: Badge[] = useMemo(() => {
        return [
            {
                id: "contributor",
                title: "Contributor",
                subtitle: "Posted your first review",
                achieved: reviewsWritten >= 1,
            },
            {
                id: "regular",
                title: "Regular",
                subtitle: "5+ reviews written",
                achieved: reviewsWritten >= 5,
            },
            {
                id: "super",
                title: "Super Reviewer",
                subtitle: "15+ reviews written",
                achieved: reviewsWritten >= 15,
            },
            {
                id: "helpful10",
                title: "Helpful",
                subtitle: "10+ helpful received",
                achieved: helpfulReceived >= 10,
            },
            {
                id: "trusted50",
                title: "Trusted",
                subtitle: "50+ helpful received",
                achieved: helpfulReceived >= 50,
            },
        ];
    }, [reviewsWritten, helpfulReceived]);

    const headerBorder = theme.colors.goldGlassBorder;
    const headerBg = theme.colors.goldGlass;

    if (!uid) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent", padding: 18 }}>
                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                    Profile not found
                </Text>
                <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary }}>
                    Missing user id.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: Math.max(24, insets.bottom + 18),
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Top row (back) */}
                <View style={{ marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => ({
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,255,255,0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.12)",
                            opacity: pressed ? 0.85 : 1,
                        })}
                    >
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Back</Text>
                    </Pressable>
                </View>

                {/* Loading */}
                {loading ? (
                    <View style={{ paddingVertical: 30, alignItems: "center" }}>
                        <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                        <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary }}>
                            Loading profile...
                        </Text>
                    </View>
                ) : null}

                {/* Not found */}
                {!loading && !publicUser ? (
                    <GlassCard>
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                            Profile not found
                        </Text>
                        <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            This user may not have created a public profile yet.
                        </Text>
                    </GlassCard>
                ) : null}

                {/* Profile content */}
                {!loading && publicUser ? (
                    <>
                        {/* Header */}
                        <View
                            style={{
                                borderRadius: 24,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: headerBorder,
                                marginBottom: 14,
                            }}
                        >
                            <LinearGradient
                                colors={["rgba(212,175,55,0.18)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.10)"]}
                                start={{ x: 0.05, y: 0 }}
                                end={{ x: 0.95, y: 1 }}
                                style={{ padding: 16, backgroundColor: headerBg }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <AvatarCircle size={62} seed={uid || displayName} photoURL={publicUser.photoURL ?? null} />

                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                        <Text
                                            style={{
                                                fontSize: 24,
                                                fontWeight: "900",
                                                color: theme.colors.textOnDark,
                                                lineHeight: 28,
                                            }}
                                            numberOfLines={1}
                                        >
                                            {displayName}
                                        </Text>

                                        <Text
                                            style={{
                                                marginTop: 6,
                                                fontSize: 13,
                                                lineHeight: 18,
                                                color: theme.colors.textOnDarkSecondary,
                                                opacity: 0.95,
                                            }}
                                            numberOfLines={2}
                                        >
                                            {bio}
                                        </Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        </View>

                        {/* Stats (public) */}
                        <GlassCard style={{ marginBottom: 14 }}>
                            <SectionLabel>Your stats</SectionLabel>

                            {[
                                { label: "Reviews written", value: reviewsWritten },
                                { label: "Helpful received", value: helpfulReceived },
                                { label: "Helpful given", value: helpfulGiven },
                                { label: "Favourites", value: favourites },
                            ].map((row) => (
                                <View
                                    key={row.label}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingVertical: 10,
                                    }}
                                >
                                    <Text
                                        style={{
                                            flex: 1,
                                            color: theme.colors.textOnDarkSecondary,
                                            fontWeight: "800",
                                            fontSize: 16,
                                        }}
                                    >
                                        {row.label}
                                    </Text>
                                    <Text
                                        style={{
                                            color: theme.colors.textOnDark,
                                            fontWeight: "900",
                                            fontSize: 28,
                                            letterSpacing: 0.2,
                                        }}
                                    >
                                        {row.value}
                                    </Text>
                                </View>
                            ))}

                            <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                Reviews written is the number of reviews this person has posted. Helpful received is the total number of helpful votes across all of their reviews.
                            </Text>
                        </GlassCard>

                        {/* Badges (public) */}
                        <GlassCard style={{ marginBottom: 14 }}>
                            <SectionLabel>Community badges</SectionLabel>

                            {badges.map((b) => (
                                <View
                                    key={b.id}
                                    style={{
                                        borderRadius: 18,
                                        paddingVertical: 14,
                                        paddingHorizontal: 14,
                                        marginBottom: 12,
                                        backgroundColor: b.achieved ? "rgba(212,175,55,0.10)" : "rgba(255,255,255,0.06)",
                                        borderWidth: 1,
                                        borderColor: b.achieved ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.12)",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: 999,
                                            backgroundColor: b.achieved ? theme.colors.accent : "rgba(255,255,255,0.18)",
                                        }}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 22 }}>
                                            {b.title}
                                        </Text>
                                        <Text style={{ marginTop: 2, color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                            {b.subtitle}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </GlassCard>

                        {/* Recent reviews (public) */}
                        <GlassCard>
                            <SectionLabel>Recent activity</SectionLabel>

                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                                Recent reviews
                            </Text>

                            {recentReviews.length === 0 ? (
                                <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                    No recent reviews to show yet.
                                </Text>
                            ) : (
                                <View style={{ marginTop: 12 }}>
                                    {recentReviews.map((r) => (
                                        <Pressable
                                            key={r.id}
                                            onPress={() => {
                                                if (!r.productId) return;
                                                router.push(`/(tabs)/reviews/${r.productId}`);
                                            }}
                                            style={({ pressed }) => ({
                                                paddingVertical: 12,
                                                paddingHorizontal: 14,
                                                borderRadius: 18,
                                                backgroundColor: "rgba(255,255,255,0.06)",
                                                borderWidth: 1,
                                                borderColor: "rgba(255,255,255,0.12)",
                                                opacity: pressed ? 0.85 : 1,
                                                marginBottom: 10,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                                                {r.productName ?? "View review"}
                                            </Text>
                                            {typeof r.rating === "number" ? (
                                                <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                                    Rating: {r.rating.toFixed(1)}
                                                </Text>
                                            ) : null}
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </GlassCard>
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}
