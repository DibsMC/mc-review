import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import * as FileSystem from "expo-file-system/legacy";
import { theme } from "../../../lib/theme";

const budImg = require("../../../assets/icons/bud.png");

type AvatarOption = {
    id: string;
    emoji: string;
    label: string;
};

const AVATARS: AvatarOption[] = [
    { id: "leaf", emoji: "🍃", label: "Leaf" },
    { id: "herb", emoji: "🌿", label: "Herb" },
    { id: "cloud", emoji: "💨", label: "Cloud" },
    { id: "fire", emoji: "🔥", label: "Fire" },
    { id: "moon", emoji: "🌙", label: "Moon" },
    { id: "alien", emoji: "👽", label: "Alien" },
    { id: "ufo", emoji: "🛸", label: "UFO" },
    { id: "planet", emoji: "🪐", label: "Planet" },
    { id: "glasses", emoji: "🕶️", label: "Shades" },
    { id: "headphones", emoji: "🎧", label: "Headphones" },
    { id: "brain", emoji: "🧠", label: "Brain" },
    { id: "zen", emoji: "🧘", label: "Zen" },
    { id: "honey", emoji: "🍯", label: "Honey" },
    { id: "beaker", emoji: "🧪", label: "Beaker" },
    { id: "melting", emoji: "🫠", label: "Melting" },
    { id: "dizzy", emoji: "😵‍💫", label: "Dizzy" },
    { id: "exhale", emoji: "😮‍💨", label: "Exhale" },
    { id: "sparkles", emoji: "✨", label: "Sparkles" },
    { id: "donut", emoji: "🍩", label: "Donut" },
    { id: "juice", emoji: "🧃", label: "Juice" },
];

type RecentReviewRow = {
    id: string;
    productId: string;
    rating?: number | null;
    score?: number | null;
    createdAtMs?: number | null;
    helpfulCount?: number | null;
};

type ProductMini = {
    id: string;
    name: string;
    maker?: string | null;
};

function Divider() {
    return (
        <View
            style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.10)",
                opacity: 0.9,
            }}
        />
    );
}

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
                    borderRadius: 24,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: borderTint ?? "rgba(255,255,255,0.16)",
                    backgroundColor: "rgba(255,255,255,0.08)",
                },
                style,
            ]}
        >
            {/* Base glass wash */}
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(255,255,255,0.14)",
                    "rgba(255,255,255,0.06)",
                    "rgba(0,0,0,0.16)",
                ]}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* Top highlight band */}
            <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, opacity: 0.85 }}
            />

            {/* Subtle edge vignette */}
            <LinearGradient
                pointerEvents="none"
                colors={["rgba(0,0,0,0.00)", "rgba(0,0,0,0.18)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.7 }}
            />

            {/* Inner stroke (etched look) */}
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    top: 1,
                    left: 1,
                    right: 1,
                    bottom: 1,
                    borderRadius: 23,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                }}
            />

            <View style={{ padding: 16 }}>{children}</View>
        </View>
    );
}

function MenuRow({
    title,
    subtitle,
    onPress,
    danger,
    rightLabel,
}: {
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
    rightLabel?: string;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: 14,
                opacity: pressed ? 0.82 : 1,
                transform: [{ scale: pressed ? 0.992 : 1 }],
            })}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "900",
                            color: danger ? "rgba(255,110,110,1)" : theme.colors.textOnDark,
                            marginBottom: subtitle ? 4 : 0,
                        }}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text
                            style={{
                                fontSize: 13,
                                lineHeight: 18,
                                color: theme.colors.textOnDarkSecondary,
                                opacity: 0.95,
                            }}
                        >
                            {subtitle}
                        </Text>
                    ) : null}
                </View>

                {rightLabel ? (
                    <View
                        style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,255,255,0.10)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.14)",
                            marginRight: 10,
                        }}
                    >
                        <Text
                            style={{
                                color: theme.colors.textOnDark,
                                fontWeight: "900",
                                fontSize: 12,
                            }}
                        >
                            {rightLabel}
                        </Text>
                    </View>
                ) : null}

                <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.55)" }}>›</Text>
            </View>
        </Pressable>
    );
}

function maskEmail(email: string) {
    const parts = email.split("@");
    if (parts.length !== 2) return "";
    const name = parts[0] ?? "";
    const domain = parts[1] ?? "";
    const first = name.slice(0, 1);
    return `${first}***@${domain}`;
}

function getDiceBearPngUrl(seed: string, size: number) {
    const safeSeed = encodeURIComponent(seed || "guest");
    const safeSize = Math.min(256, Math.max(32, Math.round(size)));
    return `https://api.dicebear.com/9.x/lorelei/png?seed=${safeSeed}&size=${safeSize}`;
}

function AvatarCircle({
    avatarId,
    photoURL,
    size = 56,
    seed,
}: {
    avatarId: string | null;
    photoURL?: string | null;
    size?: number;
    seed: string;
}) {
    const picked = useMemo(() => AVATARS.find((a) => a.id === avatarId) ?? null, [avatarId]);

    const [dicebearFailed, setDicebearFailed] = useState(false);
    const dicebearUrl = useMemo(() => getDiceBearPngUrl(seed, size), [seed, size]);
    const showDiceBear = !photoURL && !picked && !dicebearFailed;

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
                    "rgba(255,255,255,0.12)",
                    "rgba(255,255,255,0.05)",
                    "rgba(0,0,0,0.16)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {photoURL ? (
                <Image source={{ uri: photoURL }} style={{ width: size, height: size }} />
            ) : picked ? (
                <Text style={{ fontSize: Math.round(size * 0.52) }}>{picked.emoji}</Text>
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

/**
 * New premium stat row:
 * - "etched" slot background
 * - subtle divider
 * - value in a glass pill
 */
import { StyleSheet } from "react-native";

function StatRow({
    label,
    value,
    showDivider,
}: {
    label: string;
    value: number;
    showDivider?: boolean;
}) {
    return (
        <View>
            <View
                style={{
                    borderRadius: 18,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                }}
            >
                {/* Smooth glass wash */}
                <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(255,255,255,0.10)", "rgba(0,0,0,0.12)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Soft top highlight */}
                <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.00)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 24,
                        opacity: 0.9,
                    }}
                />

                <View
                    style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        flexDirection: "row",
                        alignItems: "center",
                    }}
                >
                    <Text
                        style={{
                            flex: 1,
                            color: "rgba(255,255,255,0.72)",
                            fontWeight: "900",
                            fontSize: 15,
                            letterSpacing: 0.2,
                        }}
                    >
                        {label}
                    </Text>

                    <View
                        style={{
                            minWidth: 56,
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,255,255,0.10)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.16)",
                        }}
                    >
                        <Text
                            style={{
                                color: theme.colors.textOnDark,
                                fontWeight: "900",
                                fontSize: 20,
                                textAlign: "center",
                                letterSpacing: 0.3,
                            }}
                        >
                            {value}
                        </Text>
                    </View>
                </View>

                {/* Inner sheen (hairline) - avoids the “mid line” / double-border look */}
                <View
                    pointerEvents="none"
                    style={{
                        ...StyleSheet.absoluteFillObject,
                        margin: 1,
                        borderRadius: 18,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: "rgba(255,255,255,0.10)",
                    }}
                />
            </View>

            {showDivider ? <View style={{ height: 10 }} /> : null}
        </View>
    );
}

function BadgeRow({
    title,
    subtitle,
    achieved,
}: {
    title: string;
    subtitle: string;
    achieved: boolean;
}) {
    return (
        <View
            style={{
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: achieved ? "rgba(212,175,55,0.26)" : "rgba(255,255,255,0.12)",
                backgroundColor: achieved ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.06)",
                marginBottom: 10,
            }}
        >
            {/* Main glass wash */}
            <LinearGradient
                pointerEvents="none"
                colors={
                    achieved
                        ? ["rgba(255,255,255,0.14)", "rgba(212,175,55,0.06)", "rgba(0,0,0,0.14)"]
                        : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.14)"]
                }
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* Soft top highlight */}
            <LinearGradient
                pointerEvents="none"
                colors={
                    achieved
                        ? ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]
                        : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.00)"]
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 26,
                    opacity: achieved ? 0.9 : 0.75,
                }}
            />

            <View
                style={{
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                }}
            >
                {/* Badge dot */}
                <View
                    style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        marginRight: 12,
                        backgroundColor: achieved ? "rgba(212,175,55,1)" : "rgba(255,255,255,0.22)",
                        borderWidth: 1,
                        borderColor: achieved ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.14)",
                    }}
                />

                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            color: theme.colors.textOnDark,
                            fontWeight: "900",
                            fontSize: 18,
                            letterSpacing: 0.2,
                            opacity: achieved ? 1 : 0.92,
                        }}
                    >
                        {title}
                    </Text>

                    <Text
                        style={{
                            marginTop: 3,
                            color: theme.colors.textOnDarkSecondary,
                            fontWeight: "800",
                            fontSize: 13,
                            lineHeight: 18,
                            opacity: achieved ? 0.95 : 0.8,
                        }}
                    >
                        {subtitle}
                    </Text>
                </View>

                {/* Right pill: Earned / Locked */}
                <View
                    style={{
                        marginLeft: 12,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: achieved ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.08)",
                        borderWidth: 1,
                        borderColor: achieved ? "rgba(212,175,55,0.28)" : "rgba(255,255,255,0.12)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "900",
                            color: achieved ? "rgba(255,235,190,0.98)" : "rgba(255,255,255,0.60)",
                            letterSpacing: 0.2,
                        }}
                    >
                        {achieved ? "Earned" : "Locked"}
                    </Text>
                </View>
            </View>

            {/* Inner etched stroke (subtle depth) */}
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    top: 1,
                    left: 1,
                    right: 1,
                    bottom: 1,
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: achieved ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)",
                }}
            />
        </View>
    );
}

function formatDate(ms: number | null | undefined) {
    if (!ms) return "";
    try {
        return new Date(ms).toLocaleDateString();
    } catch {
        return "";
    }
}

export default function UserMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const user = auth().currentUser;
    const uid = user?.uid ?? "";

    const displayName = user?.displayName?.trim() ? user.displayName : "Anonymous";
    const photoURL = user?.photoURL ?? null;
    const emailMasked = user?.email ? maskEmail(user.email) : "";

    const [avatarId, setAvatarId] = useState<string | null>(null);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

    const [joinYear, setJoinYear] = useState<number | null>(null);

    // Stats
    const [reviewsWritten, setReviewsWritten] = useState<number>(0);
    const [helpfulReceived, setHelpfulReceived] = useState<number>(0);
    const [helpfulGiven, setHelpfulGiven] = useState<number>(0);
    const [favouritesCount, setFavouritesCount] = useState<number>(0);
    const [loadingStats, setLoadingStats] = useState<boolean>(true);

    const [recentReviews, setRecentReviews] = useState<RecentReviewRow[]>([]);
    const [loadingRecent, setLoadingRecent] = useState<boolean>(true);

    const [productMap, setProductMap] = useState<Record<string, ProductMini>>({});

    // Products map (for recent review cards)
    useEffect(() => {
        if (!uid) return;

        const unsubProducts = firestore().collection("products").onSnapshot(
            (snap) => {
                const next: Record<string, ProductMini> = {};
                snap.docs.forEach((d) => {
                    const data = (d.data() as any) ?? {};
                    next[d.id] = {
                        id: d.id,
                        name: typeof data?.name === "string" ? data.name : "",
                        maker: typeof data?.maker === "string" ? data.maker : null,
                    };
                });
                setProductMap(next);
            },
            () => {
                // ignore
            }
        );

        return () => unsubProducts();
    }, [uid]);

    // Users doc (avatar + join year)
    useEffect(() => {
        if (!uid) return;

        const unsubUser = firestore().collection("users").doc(uid).onSnapshot(
            (doc) => {
                const data = (doc.data() as any) ?? {};

                const v = typeof data?.avatarId === "string" ? data.avatarId : null;
                setAvatarId(v);

                const createdAt: any = data?.createdAt ?? data?.created_at ?? null;
                if (createdAt?.toDate) setJoinYear(createdAt.toDate().getFullYear());
                else if (typeof createdAt === "number") setJoinYear(new Date(createdAt).getFullYear());
                else setJoinYear(null);
            },
            () => {
                // ignore
            }
        );

        return () => unsubUser();
    }, [uid]);

    // Reviews written + helpful received fallback from /reviews
    useEffect(() => {
        if (!uid) return;

        setLoadingStats(true);

        const unsubMyReviews = firestore()
            .collection("reviews")
            .where("userId", "==", uid)
            .onSnapshot(
                (snap) => {
                    let count = 0;
                    let helpfulSum = 0;

                    snap.docs.forEach((d) => {
                        count += 1;
                        const data = (d.data() as any) ?? {};
                        const hc = typeof data?.helpfulCount === "number" ? data.helpfulCount : 0;
                        helpfulSum += hc;
                    });

                    setReviewsWritten(count);
                    setHelpfulReceived(helpfulSum);
                    setLoadingStats(false);
                },
                () => setLoadingStats(false)
            );

        const unsubHelpfulVotes = firestore()
            .collection("reviewHelpfulVotes")
            .where("userId", "==", uid)
            .onSnapshot(
                (snap) => setHelpfulGiven(snap.size),
                () => {
                    // ignore
                }
            );

        return () => {
            unsubMyReviews();
            unsubHelpfulVotes();
        };
    }, [uid]);

    // Favourites count
    useEffect(() => {
        if (!uid) {
            setFavouritesCount(0);
            return;
        }

        // US spelling (your reviews page uses /favorites)
        const refUS = firestore().collection("users").doc(uid).collection("favorites");
        // Safety: if anything writes UK spelling
        const refUK = firestore().collection("users").doc(uid).collection("favourites");

        const unsubUS = refUS.onSnapshot(
            (snap) => setFavouritesCount(snap.size),
            (err) => {
                console.log("favorites count error:", err);
                setFavouritesCount(0);
            }
        );

        const unsubUK = refUK.onSnapshot(
            (snap) => setFavouritesCount((prev) => Math.max(prev, snap.size)),
            () => {
                // ignore
            }
        );

        return () => {
            unsubUS();
            unsubUK();
        };
    }, [uid]);

    // Recent reviews (top 5)
    useEffect(() => {
        if (!uid) return;

        setLoadingRecent(true);

        const unsubRecent = firestore()
            .collection("reviews")
            .where("userId", "==", uid)
            .orderBy("createdAt", "desc")
            .limit(5)
            .onSnapshot(
                (snap) => {
                    const rows: RecentReviewRow[] = snap.docs.map((d) => {
                        const data = (d.data() as any) ?? {};
                        const createdAt: any = data?.createdAt ?? null;

                        let ms: number | null = null;
                        if (createdAt?.toDate) ms = createdAt.toDate().getTime();
                        else if (typeof createdAt === "number") ms = createdAt;

                        return {
                            id: d.id,
                            productId: typeof data?.productId === "string" ? data.productId : "",
                            rating: typeof data?.rating === "number" ? data.rating : null,
                            score: typeof data?.score === "number" ? data.score : null,
                            helpfulCount: typeof data?.helpfulCount === "number" ? data.helpfulCount : 0,
                            createdAtMs: ms,
                        };
                    });

                    setRecentReviews(rows.filter((r) => !!r.productId));
                    setLoadingRecent(false);
                },
                () => {
                    setRecentReviews([]);
                    setLoadingRecent(false);
                }
            );

        return () => unsubRecent();
    }, [uid]);

    const saveAvatar = async (next: string | null) => {
        if (!uid) return;
        try {
            await firestore().collection("users").doc(uid).set({ avatarId: next ?? null }, { merge: true });
            setAvatarId(next);
        } catch (e: any) {
            Alert.alert("Could not save avatar", e?.message ?? "Unknown error");
        }
    };

    const handleSignOut = async () => {
        try {
            await auth().signOut();
        } catch (e: any) {
            Alert.alert("Sign out failed", e?.message ?? "Unknown error");
        }
    };

    const downloadMyData = async () => {
        const u = auth().currentUser;
        if (!u) {
            Alert.alert("Error", "No signed-in user found.");
            return;
        }

        try {
            const uId = u.uid;

            const userDoc = await firestore().collection("users").doc(uId).get();
            const profileData = userDoc.data() ?? null;

            const reviewsSnap = await firestore().collection("reviews").where("userId", "==", uId).get();
            const reviews = reviewsSnap.docs.map((d) => ({ reviewId: d.id, ...(d.data() as any) }));

            const exportData = {
                account: {
                    uid: uId,
                    email: u.email ?? null,
                    createdAt: u.metadata.creationTime ?? null,
                    lastSignIn: u.metadata.lastSignInTime ?? null,
                },
                profile: profileData,
                reviews,
                exportedAt: new Date().toISOString(),
            };

            const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
            if (!baseDir) {
                throw new Error("No local storage directory is available on this device.");
            }

            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileUri = `${baseDir}review-budz-export-${stamp}.json`;

            await FileSystem.writeAsStringAsync(
                fileUri,
                JSON.stringify(exportData, null, 2),
                { encoding: FileSystem.EncodingType.UTF8 }
            );

            try {
                const canOpen = await Linking.canOpenURL(fileUri);
                if (canOpen) {
                    await Linking.openURL(fileUri);
                }
            } catch {
                // Ignore open errors: file is still saved.
            }

            Alert.alert(
                "Data export ready",
                "Your data has been exported as a JSON file on this device. You can open or share it from Files."
            );
            console.log("GDPR EXPORT FILE:", fileUri);
        } catch (e: any) {
            Alert.alert("Export failed", e?.message ?? "Unknown error");
        }
    };

    const headerBorder = theme.colors.goldGlassBorder;
    const headerBg = theme.colors.goldGlass;
    const editRightLabel = photoURL ? "Photo" : avatarId ? "Avatar" : "Set up";

    const headerOneLiner = joinYear ? `Part of the community since ${joinYear}` : "Sharing honest experiences with the community";

    const seed = uid || displayName;

    const badges = useMemo(() => {
        return [
            { key: "contributor", title: "Contributor", subtitle: "Posted your first review", achieved: reviewsWritten >= 1 },
            { key: "regular", title: "Regular", subtitle: "5+ reviews written", achieved: reviewsWritten >= 5 },
            { key: "super", title: "Super Reviewer", subtitle: "15+ reviews written", achieved: reviewsWritten >= 15 },
            { key: "helpful1", title: "Helpful", subtitle: "10+ helpful received", achieved: helpfulReceived >= 10 },
            { key: "helpful2", title: "Trusted", subtitle: "50+ helpful received", achieved: helpfulReceived >= 50 },
        ];
    }, [reviewsWritten, helpfulReceived]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    top: -120,
                    left: -90,
                    width: 320,
                    height: 320,
                    borderRadius: 999,
                    backgroundColor: "rgba(120,255,210,0.08)",
                }}
            />
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    top: 80,
                    right: -140,
                    width: 300,
                    height: 300,
                    borderRadius: 999,
                    backgroundColor: "rgba(120,150,255,0.07)",
                }}
            />
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: Math.max(24, insets.bottom + 18),
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
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
                            <Pressable
                                onPress={() => setAvatarPickerOpen(true)}
                                style={({ pressed }) => ({
                                    opacity: pressed ? 0.8 : 1,
                                    marginRight: 14,
                                })}
                            >
                                <AvatarCircle avatarId={avatarId} photoURL={photoURL} size={62} seed={seed} />
                            </Pressable>

                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.textOnDark, lineHeight: 28 }}>
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
                                >
                                    {headerOneLiner}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Your Stats */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Your stats</SectionLabel>

                    {loadingStats ? (
                        <View style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center" }}>
                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                            <Text style={{ marginLeft: 10, color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                Loading stats...
                            </Text>
                        </View>
                    ) : null}

                    <StatRow label="Reviews written" value={reviewsWritten} showDivider />
                    <StatRow label="Helpful received" value={helpfulReceived} showDivider />
                    <StatRow label="Helpful given" value={helpfulGiven} showDivider />
                    <StatRow label="Favourites" value={favouritesCount} />

                    <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Reviews written is the number of reviews you have posted. Helpful received is the total number of helpful votes on all of your reviews.
                    </Text>
                </GlassCard>

                {/* Community Badges */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Community badges</SectionLabel>
                    {badges.map((b) => (
                        <BadgeRow key={b.key} title={b.title} subtitle={b.subtitle} achieved={b.achieved} />
                    ))}
                </GlassCard>

                {/* Your Activity */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Your activity</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16, marginBottom: 6 }}>
                        Your recent reviews
                    </Text>

                    {loadingRecent ? (
                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            Loading your recent reviews...
                        </Text>
                    ) : recentReviews.length === 0 ? (
                        <>
                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                Your reviews will show up here once you post a few.
                            </Text>
                            <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                This is about contribution, not competition.
                            </Text>
                        </>
                    ) : (
                        <View style={{ marginTop: 8 }}>
                            {recentReviews.map((r) => {
                                const prod = productMap[r.productId];
                                const title = prod?.name?.trim() ? prod.name : "Product";
                                const maker = prod?.maker?.trim() ? prod.maker : null;

                                const scoreVal =
                                    typeof r.score === "number" && r.score >= 1 && r.score <= 5
                                        ? r.score
                                        : typeof r.rating === "number"
                                            ? r.rating
                                            : null;

                                return (
                                    <Pressable
                                        key={r.id}
                                        onPress={() => router.push(`/reviews/${r.productId}`)}
                                        style={({ pressed }) => ({
                                            borderRadius: 18,
                                            padding: 14,
                                            marginTop: 10,
                                            backgroundColor: "rgba(255,255,255,0.06)",
                                            borderWidth: 1,
                                            borderColor: "rgba(255,255,255,0.12)",
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                                            {title}
                                        </Text>

                                        <Text
                                            style={{
                                                marginTop: 4,
                                                color: theme.colors.textOnDarkSecondary,
                                                fontWeight: "800",
                                                fontSize: 12,
                                            }}
                                        >
                                            {[
                                                maker ? maker : "",
                                                scoreVal ? `Score ${scoreVal.toFixed(1)}` : "",
                                                typeof r.helpfulCount === "number" ? `Helpful ${r.helpfulCount}` : "",
                                                r.createdAtMs ? formatDate(r.createdAtMs) : "",
                                            ]
                                                .filter(Boolean)
                                                .join(" | ")}
                                        </Text>
                                    </Pressable>
                                );
                            })}

                            <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                This is about contribution, not competition.
                            </Text>
                        </View>
                    )}

                    <View style={{ marginTop: 12 }}>
                        <MenuRow
                            title="How review scoring works"
                            subtitle="How the score is calculated and how to write reviews that actually help."
                            onPress={() => router.push("/(tabs)/user/reviews-info")}
                        />
                    </View>
                </GlassCard>

                {/* Community Impact */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Your impact</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Your reviews help others make informed choices. Community ratings are built from honest experiences like yours.
                    </Text>

                    <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Every review improves the accuracy of recommendations over time.
                    </Text>
                </GlassCard>

                {/* Preferences */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Preferences</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18, marginBottom: 10 }}>
                        These help personalise what you see in the app. More personalisation options are coming.
                    </Text>

                    <MenuRow
                        title="Change profile picture"
                        subtitle="Edit your username."
                        rightLabel={editRightLabel}
                        onPress={() => router.push("/(tabs)/user/edit-profile")}
                    />
                </GlassCard>

                {/* Feedback */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Help shape the app</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18, marginBottom: 10 }}>
                        This app is evolving. Your feedback helps shape what comes next.
                    </Text>

                    <MenuRow
                        title="Send feedback"
                        subtitle="Bugs, ideas, features, new products. Anything welcome."
                        onPress={() => router.push("/(tabs)/user/feedback")}
                    />
                </GlassCard>

                {/* Future */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>What’s coming</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        More ways to personalise your experience
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Expanded profiles and community features
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Smarter recommendations over time
                    </Text>

                    <Text style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", lineHeight: 18 }}>
                        Plans, not promises.
                    </Text>

                    <View style={{ marginTop: 12 }}>
                        <MenuRow
                            title="About"
                            subtitle="Where the app is heading and why the community side matters."
                            onPress={() => router.push("/(tabs)/user/about")}
                        />
                    </View>
                </GlassCard>

                {/* Account */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Account</SectionLabel>

                    <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 12, fontWeight: "900" }}>
                            Email
                        </Text>
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>
                            {emailMasked || "Not available"}
                        </Text>
                    </View>

                    <Divider />

                    <MenuRow
                        title="Change email"
                        subtitle="Update the email you use to sign in."
                        onPress={() => router.push("/(tabs)/user/change-email")}
                    />

                    <Divider />

                    <MenuRow
                        title="Terms and conditions"
                        subtitle="Read terms, privacy, and legal information."
                        onPress={() => router.push("/(tabs)/user/legal")}
                    />

                    <Divider />

                    <MenuRow
                        title="Download my data"
                        subtitle="Export your profile and reviews (GDPR)."
                        onPress={() => downloadMyData()}
                    />

                    <Divider />

                    <MenuRow
                        title="Delete account"
                        subtitle="This is permanent. No tricks."
                        danger
                        onPress={() => router.push("/(tabs)/user/delete-account")}
                    />
                </GlassCard>

                {/* Sign out */}
                <GlassCard>
                    <MenuRow
                        title="Sign out"
                        subtitle="Sign out of this account on this device."
                        danger
                        onPress={() => {
                            Alert.alert("Sign out", "Are you sure you want to sign out?", [
                                { text: "Cancel", style: "cancel" },
                                { text: "Sign out", style: "destructive", onPress: handleSignOut },
                            ]);
                        }}
                    />
                </GlassCard>

                <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                        Built with the community, improved by feedback.
                    </Text>
                </View>
            </ScrollView>

            {/* Avatar Picker */}
            <Modal visible={avatarPickerOpen} transparent animationType="fade" onRequestClose={() => setAvatarPickerOpen(false)}>
                <Pressable
                    onPress={() => setAvatarPickerOpen(false)}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.35)",
                        padding: 16,
                        justifyContent: "flex-end",
                    }}
                >
                    <Pressable
                        onPress={() => { }}
                        style={{
                            borderRadius: 22,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.18)",
                            backgroundColor: "rgba(20,24,32,0.92)",
                        }}
                    >
                        <LinearGradient
                            colors={["rgba(212,175,55,0.14)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.18)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ padding: 16 }}
                        >
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.textOnDark }}>
                                    Pick an avatar
                                </Text>

                                <Pressable
                                    onPress={() => setAvatarPickerOpen(false)}
                                    style={({ pressed }) => ({
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        borderRadius: 999,
                                        backgroundColor: "rgba(255,255,255,0.10)",
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.14)",
                                        opacity: pressed ? 0.8 : 1,
                                    })}
                                >
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Close</Text>
                                </Pressable>
                            </View>

                            <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                Emoji avatars are manual picks. If you don’t choose one, you’ll get a fun persona by default.
                            </Text>

                            <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap" }}>
                                {AVATARS.map((a) => {
                                    const active = avatarId === a.id;
                                    return (
                                        <Pressable
                                            key={a.id}
                                            onPress={async () => {
                                                await saveAvatar(a.id);
                                                setAvatarPickerOpen(false);
                                            }}
                                            style={({ pressed }) => ({
                                                width: "20%",
                                                padding: 6,
                                                opacity: pressed ? 0.8 : 1,
                                            })}
                                        >
                                            <View
                                                style={{
                                                    aspectRatio: 1,
                                                    borderRadius: 18,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    backgroundColor: active ? "rgba(212,175,55,0.20)" : "rgba(255,255,255,0.08)",
                                                    borderWidth: 1,
                                                    borderColor: active ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.14)",
                                                }}
                                            >
                                                <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Pressable
                                onPress={async () => {
                                    await saveAvatar(null);
                                    setAvatarPickerOpen(false);
                                }}
                                style={({ pressed }) => ({
                                    marginTop: 10,
                                    paddingVertical: 12,
                                    borderRadius: 14,
                                    alignItems: "center",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.14)",
                                    opacity: pressed ? 0.8 : 1,
                                })}
                            >
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                    Use default bud (no persona)
                                </Text>
                            </Pressable>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
