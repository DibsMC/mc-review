// app/(tabs)/user/profile/[uid].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { theme } from "../../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../../lib/nativeDeps";

const budImg = require("../../../../assets/icons/bud.png");

type UserDoc = {
    displayName?: string | null;
    photoURL?: string | null;
    avatarId?: string | null;
    bio?: string | null;
    createdAt?: any;

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

type UserReviewRow = {
    id: string;
    productId: string;
    rating?: number | null;
    helpfulCount?: number | null;
    text?: string | null;
    createdAtMs: number;
};

type Badge = {
    id: string;
    title: string;
    subtitle: string;
    achieved: boolean;
};

const EMOJI_AVATARS: Record<string, string> = {
    leaf: "🍃",
    herb: "🌿",
    cloud: "💨",
    fire: "🔥",
    moon: "🌙",
    alien: "👽",
    ufo: "🛸",
    planet: "🪐",
    glasses: "🕶️",
    headphones: "🎧",
    brain: "🧠",
    zen: "🧘",
    honey: "🍯",
    beaker: "🧪",
    melting: "🫠",
    dizzy: "😵‍💫",
    exhale: "😮‍💨",
    sparkles: "✨",
    donut: "🍩",
    juice: "🧃",
};

const IMAGE_AVATARS: Record<string, any> = {
    "baked-chilled-cheetah": require("../../../../assets/avatars/baked-animals/baked-chilled-cheeta.png"),
    "baked-contemplative-frog": require("../../../../assets/avatars/baked-animals/baked-contemplative-frog.png"),
    "baked-corporate-sloth": require("../../../../assets/avatars/baked-animals/baked-corporate-sloth.png"),
    "baked-cunning-fox": require("../../../../assets/avatars/baked-animals/baked-cunning-fox.png"),
    "baked-dino": require("../../../../assets/avatars/baked-animals/baked-dino.png"),
    "baked-dj-meerkat": require("../../../../assets/avatars/baked-animals/baked-dj-meerkat.png"),
    "baked-ginger-cat": require("../../../../assets/avatars/baked-animals/baked-ginger-cat.png"),
    "baked-goat": require("../../../../assets/avatars/baked-animals/baked-goat.png"),
    "baked-gorilla": require("../../../../assets/avatars/baked-animals/baked-gorrilla.png"),
    "baked-grumpy-badger": require("../../../../assets/avatars/baked-animals/baked-grumpy-badger.png"),
    "baked-kangaroo": require("../../../../assets/avatars/baked-animals/baked-kangaroo.png"),
    "baked-lion": require("../../../../assets/avatars/baked-animals/baked-lion.png"),
    "baked-lizard": require("../../../../assets/avatars/baked-animals/baked-lizard.png"),
    "baked-octopus": require("../../../../assets/avatars/baked-animals/baked-octopus.png"),
    "baked-overconfident-parrot": require("../../../../assets/avatars/baked-animals/baked-over-confident-parot.png"),
    "baked-panda": require("../../../../assets/avatars/baked-animals/baked-panda.png"),
    "baked-peppa": require("../../../../assets/avatars/baked-animals/baked-peppa.png"),
    "baked-pixie": require("../../../../assets/avatars/baked-animals/baked-pixie.png"),
    "baked-rabbit": require("../../../../assets/avatars/baked-animals/baked-rabbit.png"),
    "baked-raccoon": require("../../../../assets/avatars/baked-animals/baked-racoon.png"),
    "baked-rasta-dog": require("../../../../assets/avatars/baked-animals/baked-rasta-dog.png"),
    "baked-rhino-soldier": require("../../../../assets/avatars/baked-animals/baked-rhino-soldier.png"),
    "baked-robot": require("../../../../assets/avatars/baked-animals/baked-robot.png"),
    "baked-scorpion": require("../../../../assets/avatars/baked-animals/baked-scorpion.png"),
    "baked-sloth": require("../../../../assets/avatars/baked-animals/baked-sloth.png"),
    "baked-sly-otter": require("../../../../assets/avatars/baked-animals/baked-sly-otter.png"),
    "baked-smug-pug": require("../../../../assets/avatars/baked-animals/baked-smug-pug.png"),
    "baked-zen-tortoise": require("../../../../assets/avatars/baked-animals/baked-zen-tortouise.png"),
    "cheeky-monkey": require("../../../../assets/avatars/baked-animals/cheeky-monkey.png"),
    "wise-old-owl": require("../../../../assets/avatars/baked-animals/wise-old-owl.png"),
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
    avatarId,
    seed,
    photoURL,
}: {
    size?: number;
    avatarId?: string | null;
    seed: string;
    photoURL?: string | null;
}) {
    const [dicebearFailed, setDicebearFailed] = useState(false);
    const dicebearUrl = useMemo(() => getDiceBearPngUrl(seed, size), [seed, size]);
    const imageAvatar = avatarId ? IMAGE_AVATARS[avatarId] : null;
    const emojiAvatar = avatarId ? EMOJI_AVATARS[avatarId] : null;
    const showDiceBear = !photoURL && !imageAvatar && !emojiAvatar && !dicebearFailed;

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
            ) : imageAvatar ? (
                <Image
                    source={imageAvatar}
                    resizeMode="cover"
                    style={{ width: Math.round(size * 1.12), height: Math.round(size * 1.12) }}
                />
            ) : emojiAvatar ? (
                <Text style={{ fontSize: Math.round(size * 0.52) }}>{emojiAvatar}</Text>
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
    const [joinYear, setJoinYear] = useState<number | null>(null);

    const [allReviews, setAllReviews] = useState<UserReviewRow[]>([]);
    const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
    const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
    const [productNameMap, setProductNameMap] = useState<Record<string, string>>({});
    const [isFollowing, setIsFollowing] = useState(false);
    const [followBusy, setFollowBusy] = useState(false);

    const goBackToUser = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/user");
    }, [router]);

    useEffect(() => {
        if (!uid) return;

        setLoading(true);
        setUserDoc(null);
        setJoinYear(null);

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
                        avatarId: typeof data?.avatarId === "string" ? data.avatarId : null,
                        bio: typeof data?.bio === "string" ? data.bio : null,
                        createdAt: data?.createdAt ?? data?.created_at ?? null,
                        favoriteProductIds: Array.isArray(data?.favoriteProductIds)
                            ? (data.favoriteProductIds as any[]).filter((x) => typeof x === "string")
                            : [],
                        favourites: data?.favourites,
                        favorites: data?.favorites,
                    });

                    const createdAt = data?.createdAt ?? data?.created_at ?? null;
                    if (typeof createdAt?.toDate === "function") {
                        setJoinYear(createdAt.toDate().getFullYear());
                    } else if (typeof createdAt === "number") {
                        setJoinYear(new Date(createdAt).getFullYear());
                    } else if (typeof createdAt?.seconds === "number") {
                        setJoinYear(new Date(createdAt.seconds * 1000).getFullYear());
                    } else {
                        setJoinYear(null);
                    }
                    setLoading(false);
                },
                (err) => {
                    console.log("profile users/{uid} snapshot error:", err);
                    setUserDoc(null);
                    setJoinYear(null);
                    setLoading(false);
                }
            );

        return () => unsub();
    }, [uid]);

    useEffect(() => {
        if (!uid) return;

        const asString = (value: any): string =>
            typeof value === "string" ? value.trim() : "";

        const rowsFromDocs = (
            docs: Array<FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>>
        ): UserReviewRow[] => {
            return docs.map((d) => {
                const data = d.data() as any;
                const createdAtMs = getCreatedAtMs(
                    data?.createdAt ?? data?.created_at ?? data?.updatedAt ?? data?.updated_at ?? null
                );
                const productId =
                    asString(data?.productId) ||
                    asString(data?.product_id) ||
                    asString(data?.flowerId) ||
                    asString(data?.flower_id) ||
                    asString(data?.strainId) ||
                    asString(data?.strain_id);
                const helpfulRaw =
                    typeof data?.helpfulCount === "number"
                        ? data.helpfulCount
                        : typeof data?.helpful_count === "number"
                          ? data.helpful_count
                          : 0;
                const helpfulCount = Number.isFinite(helpfulRaw) ? Math.max(0, helpfulRaw) : 0;

                return {
                    id: d.id,
                    productId,
                    rating: typeof data?.rating === "number" ? data.rating : null,
                    helpfulCount,
                    text: typeof data?.text === "string" ? data.text : null,
                    createdAtMs,
                };
            });
        };

        const applyRows = (rows: UserReviewRow[]) => {
            const sortedRows = rows
                .slice()
                .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

            // Keep all rows for counts; only product-linked rows are navigable in recent/activity lists.
            const linkedRows = sortedRows.filter((r) => !!r.productId);
            const sumHelpful = sortedRows.reduce((sum, r) => {
                const hc = typeof r.helpfulCount === "number" ? r.helpfulCount : 0;
                return sum + (Number.isFinite(hc) && hc > 0 ? hc : 0);
            }, 0);

            const recent = linkedRows.slice(0, 5).map((r) => ({
                id: r.id,
                productId: r.productId,
                rating: r.rating,
                createdAtMs: r.createdAtMs,
                productName: null,
            }));

            setReviewsWritten(sortedRows.length);
            setHelpfulReceived(sumHelpful);
            setAllReviews(linkedRows);
            setRecentReviews(recent);
        };

        // Reviews written + helpful received + recent reviews.
        // Merge canonical and legacy owner keys each refresh so partial legacy data doesn't undercount stats.
        const unsub = firestore()
            .collection("reviews")
            .where("userId", "==", uid)
            .onSnapshot(
                async (snap) => {
                    try {
                        const [legacyUid, legacyAuthorUid, legacyAuthorId] = await Promise.all([
                            firestore().collection("reviews").where("uid", "==", uid).get(),
                            firestore().collection("reviews").where("authorUid", "==", uid).get(),
                            firestore().collection("reviews").where("authorId", "==", uid).get(),
                        ]);

                        const deduped = new Map<
                            string,
                            FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>
                        >();
                        [...snap.docs, ...legacyUid.docs, ...legacyAuthorUid.docs, ...legacyAuthorId.docs].forEach(
                            (docSnap) => {
                                deduped.set(docSnap.id, docSnap);
                            }
                        );

                        applyRows(rowsFromDocs(Array.from(deduped.values())));
                    } catch (legacyErr) {
                        console.log("profile reviews legacy fallback error:", legacyErr);
                        applyRows(rowsFromDocs(snap.docs));
                    }
                },
                (err) => {
                    console.log("profile reviews snapshot error:", err);
                    setReviewsWritten(0);
                    setHelpfulReceived(0);
                    setAllReviews([]);
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
        // Resolve product names for this user's reviews (batched with IN queries)
        const ids = Array.from(new Set(allReviews.map((r) => r.productId).filter(Boolean)));
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
    }, [allReviews]);

    useEffect(() => {
        if (!currentUid || !uid || isSelf) {
            setIsFollowing(false);
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(currentUid)
            .collection("following")
            .doc(uid)
            .onSnapshot(
                (docSnap) => {
                    setIsFollowing(docSnap.exists);
                },
                (err) => {
                    console.log("following status snapshot error:", err);
                    setIsFollowing(false);
                }
            );

        return () => unsub();
    }, [currentUid, uid, isSelf]);

    const displayName = userDoc?.displayName?.trim() ? userDoc.displayName : "Anonymous";
    const bio =
        userDoc?.bio?.trim() ? userDoc.bio : "Sharing honest experiences with the community";
    const communityLine = joinYear ? `Part of the community since ${joinYear}` : null;

    const toggleFollow = useCallback(async () => {
        if (!currentUid || !uid || isSelf || followBusy) return;

        const ref = firestore()
            .collection("users")
            .doc(currentUid)
            .collection("following")
            .doc(uid);

        setFollowBusy(true);
        try {
            if (isFollowing) {
                await ref.delete();
                return;
            }

            await ref.set(
                {
                    followedUid: uid,
                    followedAt: firestore.FieldValue.serverTimestamp(),
                    displayNameSnapshot: displayName,
                    avatarIdSnapshot: userDoc?.avatarId ?? null,
                },
                { merge: true }
            );
        } catch (err) {
            console.log("toggle follow error:", err);
        } finally {
            setFollowBusy(false);
        }
    }, [currentUid, uid, isSelf, followBusy, isFollowing, displayName, userDoc?.avatarId]);

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
                        onPress={goBackToUser}
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
                                    <AvatarCircle
                                        size={62}
                                        avatarId={userDoc.avatarId ?? null}
                                        seed={uid || displayName}
                                        photoURL={userDoc.photoURL ?? null}
                                    />

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

                                        {communityLine ? (
                                            <Text
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: 12,
                                                    lineHeight: 17,
                                                    color: "rgba(255,255,255,0.68)",
                                                    fontWeight: "800",
                                                }}
                                                numberOfLines={1}
                                            >
                                                {communityLine}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>

                                {!isSelf ? (
                                    <View style={{ marginTop: 14, alignItems: "flex-start" }}>
                                        <Pressable
                                            onPress={toggleFollow}
                                            disabled={followBusy}
                                            style={({ pressed }) => ({
                                                paddingVertical: 8,
                                                paddingHorizontal: 12,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: isFollowing
                                                    ? "rgba(212,175,55,0.42)"
                                                    : "rgba(255,255,255,0.22)",
                                                backgroundColor: isFollowing
                                                    ? "rgba(212,175,55,0.16)"
                                                    : "rgba(255,255,255,0.10)",
                                                opacity: followBusy ? 0.55 : pressed ? 0.84 : 1,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                                {followBusy
                                                    ? "Saving..."
                                                    : isFollowing
                                                        ? "Following"
                                                        : "Follow member"}
                                            </Text>
                                        </Pressable>
                                    </View>
                                ) : null}
                            </LinearGradient>
                        </View>

                        {/* Stats (computed from canonical collections) */}
                        <GlassCard style={{ marginBottom: 14 }}>
                            <SectionLabel>Stats</SectionLabel>

                            <Pressable
                                onPress={() => setReviewsModalOpen(true)}
                                style={({ pressed }) => ({
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 10,
                                    opacity: pressed ? 0.88 : 1,
                                })}
                            >
                                <Text
                                    style={{
                                        flex: 1,
                                        color: theme.colors.textOnDarkSecondary,
                                        fontWeight: "800",
                                        fontSize: 16,
                                        textDecorationLine: "underline",
                                    }}
                                >
                                    Reviews written
                                </Text>
                                <Text
                                    style={{
                                        color: theme.colors.textOnDark,
                                        fontWeight: "900",
                                        fontSize: 28,
                                        letterSpacing: 0.2,
                                    }}
                                >
                                    {toInt(reviewsWritten)}
                                </Text>
                            </Pressable>

                            {[
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
                                Tap Reviews written to browse every review this member has posted.
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

            <Modal
                visible={reviewsModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setReviewsModalOpen(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.52)",
                        paddingHorizontal: 16,
                        paddingTop: Math.max(20, insets.top + 10),
                        paddingBottom: Math.max(20, insets.bottom + 8),
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            borderRadius: 22,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.18)",
                            backgroundColor: "rgba(16,18,26,0.96)",
                        }}
                    >
                        <LinearGradient
                            colors={["rgba(212,175,55,0.14)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.16)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1, padding: 16 }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 24 }}>
                                        {displayName}'s reviews
                                    </Text>
                                    <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary }}>
                                        {toInt(reviewsWritten)} total reviews
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => setReviewsModalOpen(false)}
                                    style={({ pressed }) => ({
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.16)",
                                        backgroundColor: "rgba(255,255,255,0.10)",
                                        opacity: pressed ? 0.84 : 1,
                                    })}
                                >
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Close</Text>
                                </Pressable>
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 14 }}
                            >
                                {allReviews.length === 0 ? (
                                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                        No reviews to show yet.
                                    </Text>
                                ) : (
                                    allReviews.map((review) => {
                                        const productName = productNameMap[review.productId] ?? "View product";
                                        return (
                                            <Pressable
                                                key={review.id}
                                                onPress={() => {
                                                    setReviewsModalOpen(false);
                                                    if (!review.productId) return;
                                                    router.push(`/(tabs)/reviews/${review.productId}`);
                                                }}
                                                style={({ pressed }) => ({
                                                    borderRadius: 18,
                                                    padding: 14,
                                                    marginBottom: 10,
                                                    backgroundColor: "rgba(255,255,255,0.06)",
                                                    borderWidth: 1,
                                                    borderColor: "rgba(255,255,255,0.14)",
                                                    opacity: pressed ? 0.84 : 1,
                                                })}
                                            >
                                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                                                    {productName}
                                                </Text>

                                                <View
                                                    style={{
                                                        marginTop: 6,
                                                        flexDirection: "row",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                    }}
                                                >
                                                    <Text style={{ color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                                        {review.createdAtMs ? new Date(review.createdAtMs).toLocaleDateString() : ""}
                                                    </Text>

                                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                                        {typeof review.rating === "number" ? review.rating.toFixed(1) : "-"}
                                                    </Text>
                                                </View>

                                                {review.text ? (
                                                    <Text
                                                        style={{
                                                            marginTop: 8,
                                                            color: theme.colors.textOnDarkSecondary,
                                                            lineHeight: 18,
                                                        }}
                                                        numberOfLines={2}
                                                    >
                                                        {review.text}
                                                    </Text>
                                                ) : null}
                                            </Pressable>
                                        );
                                    })
                                )}
                            </ScrollView>
                        </LinearGradient>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
