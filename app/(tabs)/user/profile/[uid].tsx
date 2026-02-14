// app/(tabs)/user/profile/[uid].tsx
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../../lib/nativeDeps";

const budImg = require("../../../../assets/icons/bud.png");

type UserDoc = {
    displayName?: string | null;
    photoURL?: string | null;
    bio?: string | null;

    // favorites stored on the user doc (per your rules)
    favoriteProductIds?: string[] | null;
    favourites?: any;
    favorites?: any;
};

type RecentReview = {
    id: string;
    productId: string;
    rating?: number | null;
    createdAtMs: number;
    productName?: string | null;
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

function getCreatedAtMs(createdAt: any): number {
    if (!createdAt) return 0;
    if (typeof createdAt === "number") return createdAt;
    if (typeof createdAt?.toMillis === "function") return createdAt.toMillis();
    if (typeof createdAt?.seconds === "number") return createdAt.seconds * 1000;
    return 0;
}

export default function PublicProfileScreen() {
    const firestore = getFirebaseFirestore();
    const auth = getFirebaseAuth();

    if (!firestore || !auth) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
                    <Text style={{ color: "white", fontSize: 20, fontWeight: "900", textAlign: "center" }}>
                        Profile unavailable
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 8, textAlign: "center" }}>
                        Required modules did not load. Please close and reopen the app.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const router = useRouter();
    const insets = useSafeAreaInsets();

    const params = useLocalSearchParams<{ uid?: string }>();
    const uid = typeof params?.uid === "string" ? params.uid : "";

    const currentUid = auth().currentUser?.uid ?? "";
    const isSelf = !!uid && !!currentUid && uid === currentUid;

    const [loading, setLoading] = useState(true);
    const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

    // Stats we will compute from canonical sources:
    // reviewsWritten = count of reviews where userId == uid
    // helpfulReceived = sum(helpfulCount) across that user's reviews
    // helpfulGiven = count of users/{uid}/helpful (only if isSelf, due to rules)
    const [reviewsWritten, setReviewsWritten] = useState(0);
    const [helpfulReceived, setHelpfulReceived] = useState(0);
    const [helpfulGiven, setHelpfulGiven] = useState<number | null>(null);

    const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
    const [productNameMap, setProductNameMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!uid) return;

        setLoading(true);
        setUserDoc(null);

        // Your rules allow read on /users/{userId}
        const unsub = firestore()
            .collection("users")
            .doc(uid)
            .onSnapshot(
                (docSnap) => {
                    const data = (docSnap.data() as any) ?? null;

                    if (!docSnap.exists || !data) {
                        setUserDoc(null);
                        setLoading(false);
                        return;
                    }

                    setUserDoc({
                        displayName: typeof data?.displayName === "string" ? data.displayName : "Anonymous",
                        photoURL: typeof data?.photoURL === "string" ? data.photoURL : null,
                        bio: typeof data?.bio === "string" ? data.bio : null,
                        favoriteProductIds: Array.isArray(data?.favoriteProductIds)
                            ? (data.favoriteProductIds as any[]).filter((x) => typeof x === "string")
                            : [],
                        favourites: data?.favourites,
                        favorites: data?.favorites,
                    });

                    setLoading(false);
                },
                (err) => {
                    console.log("profile users/{uid} snapshot error:", err);
                    setUserDoc(null);
                    setLoading(false);
                }
            );

        return () => unsub();
    }, [uid]);

    useEffect(() => {
        if (!uid) return;

        // Reviews written + helpful received + recent reviews
        const unsub = firestore()
            .collection("reviews")
            .where("userId", "==", uid)
            .orderBy("createdAt", "desc")
            .onSnapshot(
                (snap) => {
                    setReviewsWritten(snap.size);

                    let sumHelpful = 0;
                    const recent: RecentReview[] = [];

                    snap.docs.forEach((d, idx) => {
                        const data = d.data() as any;

                        const hc = typeof data?.helpfulCount === "number" ? data.helpfulCount : 0;
                        if (Number.isFinite(hc) && hc > 0) sumHelpful += hc;

                        if (idx < 5) {
                            recent.push({
                                id: d.id,
                                productId: typeof data?.productId === "string" ? data.productId : "",
                                rating: typeof data?.rating === "number" ? data.rating : null,
                                createdAtMs: getCreatedAtMs(data?.createdAt),
                                productName: null,
                            });
                        }
                    });

                    setHelpfulReceived(sumHelpful);
                    setRecentReviews(recent.filter((r) => !!r.productId));
                },
                (err) => {
                    console.log("profile reviews snapshot error:", err);
                    setReviewsWritten(0);
                    setHelpfulReceived(0);
                    setRecentReviews([]);
                }
            );

        return () => unsub();
    }, [uid]);

    useEffect(() => {
        // Helpful given is only readable for the owner (per your rules)
        if (!uid) return;

        if (!isSelf) {
            setHelpfulGiven(null);
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(uid)
            .collection("helpful")
            .onSnapshot(
                (snap) => {
                    setHelpfulGiven(snap.size);
                },
                (err) => {
                    console.log("profile helpful given snapshot error:", err);
                    setHelpfulGiven(0);
                }
            );

        return () => unsub();
    }, [uid, isSelf]);

    useEffect(() => {
        // Resolve product names for the 5 recent reviews (batched with IN queries)
        const ids = Array.from(new Set(recentReviews.map((r) => r.productId).filter(Boolean)));
        if (ids.length === 0) return;

        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

        const unsubs: Array<() => void> = [];

        chunks.forEach((chunk) => {
            const q = firestore()
                .collection("products")
                .where(firestore.FieldPath.documentId(), "in", chunk);

            const unsub = q.onSnapshot(
                (snap) => {
                    const updates: Record<string, string> = {};
                    snap.docs.forEach((d) => {
                        const data = d.data() as any;
                        const nm = typeof data?.name === "string" ? data.name : "";
                        if (nm) updates[d.id] = nm;
                    });
                    setProductNameMap((prev) => ({ ...prev, ...updates }));
                },
                (err) => {
                    console.log("profile products name snapshot error:", err);
                }
            );

            unsubs.push(unsub);
        });

        return () => {
            unsubs.forEach((fn) => fn());
        };
    }, [recentReviews]);

    const displayName = userDoc?.displayName?.trim() ? userDoc.displayName : "Anonymous";
    const bio =
        userDoc?.bio?.trim() ? userDoc.bio : "Sharing honest experiences with the community";

    const favouritesCount = useMemo(() => {
        const a = Array.isArray(userDoc?.favoriteProductIds) ? userDoc!.favoriteProductIds!.length : 0;

        // In case you also store favourites in legacy shapes
        const legacyA = userDoc?.favourites && typeof userDoc.favourites === "object" ? Object.keys(userDoc.favourites).length : 0;
        const legacyB = userDoc?.favorites && typeof userDoc.favorites === "object" ? Object.keys(userDoc.favorites).length : 0;

        return Math.max(a, legacyA, legacyB, 0);
    }, [userDoc]);

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

    const headerBorder =
        (theme as any)?.colors?.goldGlassBorder ?? "rgba(212,175,55,0.28)";
    const headerBg =
        (theme as any)?.colors?.goldGlass ?? "rgba(255,255,255,0.06)";

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
                {!loading && !userDoc ? (
                    <GlassCard>
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                            Profile not found
                        </Text>
                        <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            This user may not have created a profile yet.
                        </Text>
                    </GlassCard>
                ) : null}

                {/* Profile content */}
                {!loading && userDoc ? (
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
                                colors={[
                                    "rgba(212,175,55,0.18)",
                                    "rgba(255,255,255,0.06)",
                                    "rgba(0,0,0,0.10)",
                                ]}
                                start={{ x: 0.05, y: 0 }}
                                end={{ x: 0.95, y: 1 }}
                                style={{ padding: 16, backgroundColor: headerBg }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <AvatarCircle size={62} seed={uid || displayName} photoURL={userDoc.photoURL ?? null} />

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

                        {/* Stats (computed from canonical collections) */}
                        <GlassCard style={{ marginBottom: 14 }}>
                            <SectionLabel>Stats</SectionLabel>

                            {[
                                { label: "Reviews written", value: toInt(reviewsWritten) },
                                { label: "Helpful received", value: toInt(helpfulReceived) },
                                { label: "Favourites", value: toInt(favouritesCount) },
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

                            {/* Helpful given only shows for your own profile due to rules */}
                            <View
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
                                    Helpful given
                                </Text>

                                <Text
                                    style={{
                                        color: theme.colors.textOnDark,
                                        fontWeight: "900",
                                        fontSize: 28,
                                        letterSpacing: 0.2,
                                    }}
                                >
                                    {isSelf ? toInt(helpfulGiven) : "Private"}
                                </Text>
                            </View>

                            <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                Helpful received is the total helpful votes across all reviews by this user.
                            </Text>
                        </GlassCard>

                        {/* Badges */}
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

                        {/* Recent reviews */}
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
                                    {recentReviews.map((r) => {
                                        const name = productNameMap[r.productId] ?? null;

                                        return (
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
                                                    {name ?? "View product"}
                                                </Text>

                                                <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                                    <Text style={{ color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                                        {r.createdAtMs ? new Date(r.createdAtMs).toLocaleDateString() : ""}
                                                    </Text>

                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                                        <Image
                                                            source={budImg}
                                                            resizeMode="contain"
                                                            style={{ width: 16, height: 16, opacity: 0.9 }}
                                                        />
                                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                                            {typeof r.rating === "number" ? r.rating.toFixed(1) : "-"}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                        </GlassCard>
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}
