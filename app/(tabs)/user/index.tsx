import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageSourcePropType,
    ImageBackground,
    Linking,
    Modal,
    Pressable,
    Share,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

const budImg = require("../../../assets/icons/bud.png");
const userBackground = require("../../../assets/images/user-bg.png");

type AvatarOption = {
    id: string;
    label: string;
    emoji?: string;
    image?: ImageSourcePropType;
};

const EMOJI_AVATARS: AvatarOption[] = [
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

const BAKED_AVATARS: AvatarOption[] = [
    {
        id: "baked-chilled-cheetah",
        label: "Baked Chilled Cheetah",
        image: require("../../../assets/avatars/baked-animals/baked-chilled-cheeta.png"),
    },
    {
        id: "baked-contemplative-frog",
        label: "Baked Contemplative Frog",
        image: require("../../../assets/avatars/baked-animals/baked-contemplative-frog.png"),
    },
    {
        id: "baked-corporate-sloth",
        label: "Baked Corporate Sloth",
        image: require("../../../assets/avatars/baked-animals/baked-corporate-sloth.png"),
    },
    {
        id: "baked-cunning-fox",
        label: "Baked Cunning Fox",
        image: require("../../../assets/avatars/baked-animals/baked-cunning-fox.png"),
    },
    {
        id: "baked-dino",
        label: "Baked Dino",
        image: require("../../../assets/avatars/baked-animals/baked-dino.png"),
    },
    {
        id: "baked-dj-meerkat",
        label: "Baked DJ Meerkat",
        image: require("../../../assets/avatars/baked-animals/baked-dj-meerkat.png"),
    },
    {
        id: "baked-ginger-cat",
        label: "Baked Ginger Cat",
        image: require("../../../assets/avatars/baked-animals/baked-ginger-cat.png"),
    },
    {
        id: "baked-goat",
        label: "Baked Goat",
        image: require("../../../assets/avatars/baked-animals/baked-goat.png"),
    },
    {
        id: "baked-gorilla",
        label: "Baked Gorilla",
        image: require("../../../assets/avatars/baked-animals/baked-gorrilla.png"),
    },
    {
        id: "baked-grumpy-badger",
        label: "Baked Grumpy Badger",
        image: require("../../../assets/avatars/baked-animals/baked-grumpy-badger.png"),
    },
    {
        id: "baked-kangaroo",
        label: "Baked Kangaroo",
        image: require("../../../assets/avatars/baked-animals/baked-kangaroo.png"),
    },
    {
        id: "baked-lion",
        label: "Baked Lion",
        image: require("../../../assets/avatars/baked-animals/baked-lion.png"),
    },
    {
        id: "baked-lizard",
        label: "Baked Lizard",
        image: require("../../../assets/avatars/baked-animals/baked-lizard.png"),
    },
    {
        id: "baked-octopus",
        label: "Baked Octopus",
        image: require("../../../assets/avatars/baked-animals/baked-octopus.png"),
    },
    {
        id: "baked-overconfident-parrot",
        label: "Baked Overconfident Parrot",
        image: require("../../../assets/avatars/baked-animals/baked-over-confident-parot.png"),
    },
    {
        id: "baked-panda",
        label: "Baked Panda",
        image: require("../../../assets/avatars/baked-animals/baked-panda.png"),
    },
    {
        id: "baked-peppa",
        label: "Baked Peppa",
        image: require("../../../assets/avatars/baked-animals/baked-peppa.png"),
    },
    {
        id: "baked-pixie",
        label: "Baked Pixie",
        image: require("../../../assets/avatars/baked-animals/baked-pixie.png"),
    },
    {
        id: "baked-rabbit",
        label: "Baked Rabbit",
        image: require("../../../assets/avatars/baked-animals/baked-rabbit.png"),
    },
    {
        id: "baked-raccoon",
        label: "Baked Raccoon",
        image: require("../../../assets/avatars/baked-animals/baked-racoon.png"),
    },
    {
        id: "baked-rasta-dog",
        label: "Baked Rasta Dog",
        image: require("../../../assets/avatars/baked-animals/baked-rasta-dog.png"),
    },
    {
        id: "baked-rhino-soldier",
        label: "Baked Rhino Soldier",
        image: require("../../../assets/avatars/baked-animals/baked-rhino-soldier.png"),
    },
    {
        id: "baked-robot",
        label: "Baked Robot",
        image: require("../../../assets/avatars/baked-animals/baked-robot.png"),
    },
    {
        id: "baked-scorpion",
        label: "Baked Scorpion",
        image: require("../../../assets/avatars/baked-animals/baked-scorpion.png"),
    },
    {
        id: "baked-sloth",
        label: "Baked Sloth",
        image: require("../../../assets/avatars/baked-animals/baked-sloth.png"),
    },
    {
        id: "baked-sly-otter",
        label: "Baked Sly Otter",
        image: require("../../../assets/avatars/baked-animals/baked-sly-otter.png"),
    },
    {
        id: "baked-smug-pug",
        label: "Baked Smug Pug",
        image: require("../../../assets/avatars/baked-animals/baked-smug-pug.png"),
    },
    {
        id: "baked-zen-tortoise",
        label: "Baked Zen Tortoise",
        image: require("../../../assets/avatars/baked-animals/baked-zen-tortouise.png"),
    },
    {
        id: "cheeky-monkey",
        label: "Cheeky Monkey",
        image: require("../../../assets/avatars/baked-animals/cheeky-monkey.png"),
    },
    {
        id: "wise-old-owl",
        label: "Wise Old Owl",
        image: require("../../../assets/avatars/baked-animals/wise-old-owl.png"),
    },
];

const AVATARS: AvatarOption[] = [...BAKED_AVATARS, ...EMOJI_AVATARS];

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

type FollowedUser = {
    uid: string;
    displayName: string;
    avatarId: string | null;
    photoURL: string | null;
    followedAtMs: number;
};

type NotificationItem = {
    id: string;
    type: "followed_review" | "system";
    actorUid: string | null;
    actorDisplayNameSnapshot: string;
    actorAvatarIdSnapshot: string | null;
    actorPhotoURLSnapshot: string | null;
    reviewId: string | null;
    productId: string | null;
    reviewRating: number | null;
    textPreview: string;
    createdAtMs: number;
    eventAtMs: number;
    isRead: boolean;
};

function getFriendlyAccountError(error: any) {
    const code = typeof error?.code === "string" ? error.code : "";
    if (code.includes("network-request-failed")) {
        return "No internet connection. Check your signal and try again.";
    }
    if (code.includes("too-many-requests")) {
        return "Too many attempts right now. Please wait and try again.";
    }
    return typeof error?.message === "string" && error.message.trim() ? error.message : "Something went wrong. Please try again.";
}

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

function toMs(value: any) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    return 0;
}

function formatRelativeTime(ms: number | null | undefined) {
    if (!ms) return "just now";
    const deltaMs = Date.now() - ms;
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return "just now";
    const minutes = Math.floor(deltaMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(ms) || "recently";
}

function getLegacyFileSystemModule() {
    try {
        return require("expo-file-system/legacy");
    } catch {
        return null;
    }
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
            ) : picked?.image ? (
                <Image
                    source={picked.image}
                    resizeMode="cover"
                    style={{ width: Math.round(size * 1.12), height: Math.round(size * 1.12) }}
                />
            ) : picked?.emoji ? (
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

const GENERIC_PROFILE_NAMES = new Set(["anonymous", "new member", "a member", "member", "someone", "user"]);

function isGenericProfileName(value: string | null | undefined) {
    const norm = (value ?? "").trim().toLowerCase();
    if (!norm) return true;
    return GENERIC_PROFILE_NAMES.has(norm);
}

export default function UserMenuScreen() {
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();

    if (!auth || !firestore) {
        return (
            <SafeAreaView style={styles.screen}>
                <ImageBackground source={userBackground} resizeMode="cover" style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={styles.backgroundScrim} />
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
                    <Text style={{ color: "white", fontSize: 20, fontWeight: "900", textAlign: "center" }}>
                        User screen unavailable
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

    const user = auth().currentUser;
    const uid = user?.uid ?? "";
    const photoURL = user?.photoURL ?? null;
    const emailMasked = user?.email ? maskEmail(user.email) : "";

    const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
    const [avatarId, setAvatarId] = useState<string | null>(null);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [reviewGuideAccepted, setReviewGuideAccepted] = useState(false);

    const [joinYear, setJoinYear] = useState<number | null>(null);

    // Stats
    const [reviewsWritten, setReviewsWritten] = useState<number>(0);
    const [helpfulReceived, setHelpfulReceived] = useState<number>(0);
    const [helpfulGivenVotes, setHelpfulGivenVotes] = useState<number>(0);
    const [helpfulGivenProfile, setHelpfulGivenProfile] = useState<number>(0);
    const [favouritesCount, setFavouritesCount] = useState<number>(0);
    const [loadingStats, setLoadingStats] = useState<boolean>(true);

    const [recentReviews, setRecentReviews] = useState<RecentReviewRow[]>([]);
    const [loadingRecent, setLoadingRecent] = useState<boolean>(true);
    const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
    const [loadingFollowing, setLoadingFollowing] = useState<boolean>(true);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState<boolean>(true);
    const [markingAllNotificationsRead, setMarkingAllNotificationsRead] = useState<boolean>(false);
    const [notificationsReady, setNotificationsReady] = useState<boolean>(false);

    const [productMap, setProductMap] = useState<Record<string, ProductMini>>({});
    const knownNotificationIdsRef = useRef<Set<string>>(new Set());
    const displayName = useMemo(() => {
        const fromProfile = (profileDisplayName ?? "").trim();
        if (fromProfile) return fromProfile;

        const fromAuth = user?.displayName?.trim();
        if (fromAuth) return fromAuth;

        return "Anonymous";
    }, [profileDisplayName, user?.displayName]);
    const needsUsernameSetup = isGenericProfileName(displayName);

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
                const profileName = typeof data?.displayName === "string" ? data.displayName.trim() : "";
                setProfileDisplayName(profileName || null);
                setAvatarId(v);
                setIsAdmin(!!data?.isAdmin);
                setReviewGuideAccepted(!!data?.reviewGuideAcceptedAtMs || !!data?.reviewGuideAcceptedVersion);
                setHelpfulGivenProfile(
                    typeof data?.helpfulGiven === "number" && Number.isFinite(data.helpfulGiven)
                        ? Math.max(0, data.helpfulGiven)
                        : 0
                );

                const createdAt: any = data?.createdAt ?? data?.created_at ?? null;
                if (createdAt?.toDate) setJoinYear(createdAt.toDate().getFullYear());
                else if (typeof createdAt === "number") setJoinYear(new Date(createdAt).getFullYear());
                else setJoinYear(null);
            },
            () => {
                setProfileDisplayName(null);
                setIsAdmin(false);
                setReviewGuideAccepted(false);
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

        // Source of truth for "helpful given" is users/{uid}/helpful.
        const unsubHelpfulVotes = firestore()
            .collection("users")
            .doc(uid)
            .collection("helpful")
            .onSnapshot(
                (snap) => setHelpfulGivenVotes(snap.size),
                () => {
                    // ignore
                }
            );

        return () => {
            unsubMyReviews();
            unsubHelpfulVotes();
        };
    }, [uid]);

    const helpfulGiven = useMemo(
        () => Math.max(helpfulGivenVotes, helpfulGivenProfile),
        [helpfulGivenProfile, helpfulGivenVotes]
    );
    const unreadNotificationsCount = useMemo(
        () => notifications.reduce((sum, n) => sum + (n.isRead ? 0 : 1), 0),
        [notifications]
    );

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

    useEffect(() => {
        if (!uid) {
            setFollowedUsers([]);
            setLoadingFollowing(false);
            return;
        }

        setLoadingFollowing(true);
        let isMounted = true;

        const unsubFollowing = firestore()
            .collection("users")
            .doc(uid)
            .collection("following")
            .onSnapshot(
                async (snap) => {
                    const baseRows = snap.docs.map((docSnap) => {
                        const data = (docSnap.data() as any) ?? {};
                        const targetUid =
                            typeof data?.followedUid === "string" && data.followedUid.trim()
                                ? data.followedUid.trim()
                                : docSnap.id;

                        return {
                            uid: targetUid,
                            displayName:
                                typeof data?.displayNameSnapshot === "string" && data.displayNameSnapshot.trim()
                                    ? data.displayNameSnapshot.trim()
                                    : "Member",
                            avatarId:
                                typeof data?.avatarIdSnapshot === "string" ? data.avatarIdSnapshot : null,
                            photoURL: null as string | null,
                            followedAtMs: toMs(data?.followedAt),
                        };
                    });

                    if (baseRows.length === 0) {
                        if (!isMounted) return;
                        setFollowedUsers([]);
                        setLoadingFollowing(false);
                        return;
                    }

                    const ids = Array.from(new Set(baseRows.map((r) => r.uid).filter(Boolean)));
                    const chunks: string[][] = [];
                    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

                    const profileMap: Record<string, { displayName?: string; avatarId?: string | null; photoURL?: string | null }> = {};

                    try {
                        await Promise.all(
                            chunks.map(async (chunk) => {
                                const q = firestore()
                                    .collection("users")
                                    .where(firestore.FieldPath.documentId(), "in", chunk);
                                const usersSnap = await q.get();
                                usersSnap.docs.forEach((userDoc) => {
                                    const data = (userDoc.data() as any) ?? {};
                                    profileMap[userDoc.id] = {
                                        displayName:
                                            typeof data?.displayName === "string" && data.displayName.trim()
                                                ? data.displayName.trim()
                                                : "Member",
                                        avatarId: typeof data?.avatarId === "string" ? data.avatarId : null,
                                        photoURL: typeof data?.photoURL === "string" ? data.photoURL : null,
                                    };
                                });
                            })
                        );
                    } catch (err) {
                        console.log("followed users profile fetch error:", err);
                    }

                    if (!isMounted) return;
                    const merged = baseRows
                        .map((row) => {
                            const profile = profileMap[row.uid];
                            if (!profile) return row;
                            return {
                                ...row,
                                displayName: profile.displayName ?? row.displayName,
                                avatarId: profile.avatarId ?? row.avatarId ?? null,
                                photoURL: profile.photoURL ?? null,
                            };
                        })
                        .sort((a, b) => b.followedAtMs - a.followedAtMs);

                    setFollowedUsers(merged);
                    setLoadingFollowing(false);
                },
                (err) => {
                    console.log("following snapshot error:", err);
                    if (!isMounted) return;
                    setFollowedUsers([]);
                    setLoadingFollowing(false);
                }
            );

        return () => {
            isMounted = false;
            unsubFollowing();
        };
    }, [uid]);

    useEffect(() => {
        if (!uid) {
            knownNotificationIdsRef.current = new Set();
            setNotifications([]);
            setLoadingNotifications(false);
            setNotificationsReady(false);
            return;
        }

        setLoadingNotifications(true);
        setNotificationsReady(false);

        const unsubNotifications = firestore()
            .collection("users")
            .doc(uid)
            .collection("notifications")
            .orderBy("createdAt", "desc")
            .limit(80)
            .onSnapshot(
                (snap) => {
                    const rows: NotificationItem[] = snap.docs.map((docSnap) => {
                        const data = (docSnap.data() as any) ?? {};
                        const createdAtMs = toMs(data?.createdAt ?? data?.created_at ?? null);
                        const eventAtMs = toMs(data?.eventAtMs ?? data?.eventAt ?? null);
                        return {
                            id: docSnap.id,
                            type: data?.type === "followed_review" ? "followed_review" : "system",
                            actorUid: typeof data?.actorUid === "string" ? data.actorUid : null,
                            actorDisplayNameSnapshot:
                                typeof data?.actorDisplayNameSnapshot === "string" && data.actorDisplayNameSnapshot.trim()
                                    ? data.actorDisplayNameSnapshot.trim()
                                    : "Member",
                            actorAvatarIdSnapshot:
                                typeof data?.actorAvatarIdSnapshot === "string" ? data.actorAvatarIdSnapshot : null,
                            actorPhotoURLSnapshot:
                                typeof data?.actorPhotoURLSnapshot === "string" ? data.actorPhotoURLSnapshot : null,
                            reviewId: typeof data?.reviewId === "string" ? data.reviewId : null,
                            productId: typeof data?.productId === "string" ? data.productId : null,
                            reviewRating: typeof data?.reviewRating === "number" ? data.reviewRating : null,
                            textPreview: typeof data?.textPreview === "string" ? data.textPreview : "",
                            createdAtMs,
                            eventAtMs,
                            isRead: !!data?.isRead,
                        };
                    });

                    setNotifications(rows);
                    knownNotificationIdsRef.current = new Set(rows.map((r) => r.id));
                    setLoadingNotifications(false);
                    setNotificationsReady(true);
                },
                (err) => {
                    console.log("notifications snapshot error:", err);
                    knownNotificationIdsRef.current = new Set();
                    setNotifications([]);
                    setLoadingNotifications(false);
                    setNotificationsReady(true);
                }
            );

        return () => unsubNotifications();
    }, [uid]);

    useEffect(() => {
        if (!uid || !notificationsReady || followedUsers.length === 0) return;

        const followedByUid = new Map<string, FollowedUser>();
        followedUsers.forEach((member) => {
            if (member.uid) followedByUid.set(member.uid, member);
        });
        if (followedByUid.size === 0) return;

        const lookbackMs = 45 * 24 * 60 * 60 * 1000;
        const oldestAllowedMs = Date.now() - lookbackMs;

        let cancelled = false;
        let running = false;

        const unsubReviews = firestore().collection("reviews").onSnapshot(
            async (snap) => {
                if (cancelled || running) return;
                running = true;

                try {
                    const candidates = snap.docs
                        .map((docSnap) => {
                            const data = (docSnap.data() as any) ?? {};
                            const actorUid = typeof data?.userId === "string" ? data.userId : "";
                            if (!actorUid || actorUid === uid) return null;

                            const followed = followedByUid.get(actorUid);
                            if (!followed) return null;

                            const productId = typeof data?.productId === "string" ? data.productId : "";
                            if (!productId) return null;

                            const createdAtMs = toMs(
                                data?.createdAt ?? data?.created_at ?? data?.updatedAt ?? data?.updated_at ?? null
                            );
                            if (!createdAtMs) return null;

                            const followedAtMs = Number.isFinite(followed.followedAtMs)
                                ? Math.max(0, followed.followedAtMs)
                                : 0;
                            const thresholdMs = Math.max(oldestAllowedMs, followedAtMs);
                            if (createdAtMs < thresholdMs) return null;

                            const textPreview =
                                typeof data?.text === "string"
                                    ? data.text.replace(/\s+/g, " ").trim().slice(0, 140)
                                    : "";
                            const reviewRating =
                                typeof data?.rating === "number" && Number.isFinite(data.rating) ? data.rating : null;

                            return {
                                notificationId: `followed_review_${docSnap.id}`,
                                reviewId: docSnap.id,
                                actorUid,
                                productId,
                                createdAtMs,
                                textPreview,
                                reviewRating,
                                actorDisplayNameSnapshot: followed.displayName || "Member",
                                actorAvatarIdSnapshot: followed.avatarId ?? null,
                                actorPhotoURLSnapshot: followed.photoURL ?? null,
                            };
                        })
                        .filter((x): x is NonNullable<typeof x> => !!x)
                        .sort((a, b) => b.createdAtMs - a.createdAtMs)
                        .slice(0, 60);

                    for (const candidate of candidates) {
                        if (cancelled) break;
                        if (knownNotificationIdsRef.current.has(candidate.notificationId)) continue;

                        knownNotificationIdsRef.current.add(candidate.notificationId);

                        await firestore()
                            .collection("users")
                            .doc(uid)
                            .collection("notifications")
                            .doc(candidate.notificationId)
                            .set({
                                type: "followed_review",
                                actorUid: candidate.actorUid,
                                actorDisplayNameSnapshot: candidate.actorDisplayNameSnapshot,
                                actorAvatarIdSnapshot: candidate.actorAvatarIdSnapshot,
                                actorPhotoURLSnapshot: candidate.actorPhotoURLSnapshot,
                                reviewId: candidate.reviewId,
                                productId: candidate.productId,
                                reviewRating: candidate.reviewRating,
                                textPreview: candidate.textPreview,
                                eventAtMs: candidate.createdAtMs,
                                isRead: false,
                                createdAt: firestore.FieldValue.serverTimestamp(),
                            });
                    }
                } catch (err) {
                    console.log("notification generation error:", err);
                } finally {
                    running = false;
                }
            },
            (err) => {
                console.log("reviews snapshot for notifications error:", err);
            }
        );

        return () => {
            cancelled = true;
            unsubReviews();
        };
    }, [uid, followedUsers, notificationsReady]);

    const markNotificationRead = async (notificationId: string) => {
        if (!uid || !notificationId) return;
        try {
            await firestore()
                .collection("users")
                .doc(uid)
                .collection("notifications")
                .doc(notificationId)
                .set(
                    {
                        isRead: true,
                        readAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
        } catch (err) {
            console.log("mark notification read error:", err);
        }
    };

    const markAllNotificationsRead = async () => {
        if (!uid || markingAllNotificationsRead) return;
        const unread = notifications.filter((n) => !n.isRead);
        if (unread.length === 0) return;

        setMarkingAllNotificationsRead(true);
        try {
            const batch = firestore().batch();
            unread.forEach((n) => {
                const ref = firestore()
                    .collection("users")
                    .doc(uid)
                    .collection("notifications")
                    .doc(n.id);
                batch.set(
                    ref,
                    {
                        isRead: true,
                        readAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            });
            await batch.commit();
        } catch (err) {
            console.log("mark all notifications read error:", err);
        } finally {
            setMarkingAllNotificationsRead(false);
        }
    };

    const saveAvatar = async (next: string | null) => {
        if (!uid) return;
        try {
            const ref = firestore().collection("users").doc(uid);
            const existing = await ref.get();

            if (!existing.exists) {
                const authUser = auth().currentUser;
                await ref.set(
                    {
                        displayName:
                            (typeof authUser?.displayName === "string" && authUser.displayName.trim()) || "New Member",
                        email: typeof authUser?.email === "string" ? authUser.email.trim().toLowerCase() : "",
                        emailVerified: !!authUser?.emailVerified,
                        isAdmin: false,
                        accountDisabled: false,
                        favoriteProductIds: [],
                        reviewRestrictionLevel: 0,
                        reviewRestrictionUntilMs: null,
                        reviewRestrictionManual: false,
                        moderationStrikeCount: 0,
                        lastEscalationRemovedTotal: 0,
                        avatarId: next ?? null,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            } else {
                await ref.set(
                    {
                        avatarId: next ?? null,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            }

            setAvatarId(next);
        } catch (e: any) {
            Alert.alert("Could not save avatar", e?.message ?? "Unknown error");
        }
    };

    const handleSignOut = async () => {
        try {
            await auth().signOut();
            router.replace("/auth");
        } catch (e: any) {
            Alert.alert("Sign out failed", getFriendlyAccountError(e));
        }
    };

    const downloadMyData = async () => {
        const u = auth().currentUser;
        if (!u) {
            Alert.alert("Error", "No signed-in user found.");
            return;
        }

        try {
            const FileSystem = getLegacyFileSystemModule();
            if (!FileSystem) {
                Alert.alert("Export unavailable", "File export is not available on this install.");
                return;
            }

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

            const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
            if (!baseDir) {
                throw new Error("No local storage directory is available on this device.");
            }

            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileUri = `${baseDir}review-budz-export-${stamp}.txt`;

            const textExport = [
                "Review Budz GDPR Export",
                `Exported at: ${exportData.exportedAt}`,
                "",
                "=== Account ===",
                JSON.stringify(exportData.account, null, 2),
                "",
                "=== Profile ===",
                JSON.stringify(exportData.profile, null, 2),
                "",
                "=== Reviews ===",
                JSON.stringify(exportData.reviews, null, 2),
            ].join("\n");

            await FileSystem.writeAsStringAsync(
                fileUri,
                textExport,
                { encoding: FileSystem.EncodingType.UTF8 }
            );

            try {
                await Share.share({
                    title: "Export your data",
                    message: "GDPR export file. Choose 'Save to Files' to keep a copy on your phone.",
                    url: fileUri,
                });
                Alert.alert(
                    "Data export ready",
                    "Use the share sheet and choose 'Save to Files' to keep the export on your phone."
                );
                return;
            } catch {
                // Fall back below if share sheet could not open.
            }

            // Fallback path: attempt direct open.
            try {
                const canOpen = await Linking.canOpenURL(fileUri);
                if (canOpen) await Linking.openURL(fileUri);
            } catch {
                // Ignore open errors: file is still saved.
            }

            Alert.alert("Data export ready", `Export file saved at:\n${fileUri}`);
        } catch (e: any) {
            Alert.alert("Export failed", e?.message ?? "Unknown error");
        }
    };

    const headerBorder = theme.colors.goldGlassBorder;
    const headerBg = theme.colors.goldGlass;
    const editRightLabel = photoURL ? "Photo" : avatarId ? "Avatar" : "Set up";
    const guideRightLabel = reviewGuideAccepted ? "Read" : "Required";

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
        <SafeAreaView style={styles.screen}>
            <ImageBackground source={userBackground} resizeMode="cover" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.backgroundScrim} />
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

                {needsUsernameSetup ? (
                    <GlassCard
                        style={{ marginBottom: 14 }}
                        borderTint="rgba(255,210,120,0.42)"
                    >
                        <SectionLabel>Profile setup</SectionLabel>

                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 17 }}>
                            Set your username
                        </Text>

                        <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            Your username is shown on reviews and helps people recognise trusted feedback.
                        </Text>

                        <View style={{ marginTop: 12 }}>
                            <MenuRow
                                title="Choose username now"
                                subtitle="Takes 10 seconds. You can change it later."
                                rightLabel="Set"
                                onPress={() => router.push("/(tabs)/user/edit-profile")}
                            />
                        </View>
                    </GlassCard>
                ) : null}

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
                            subtitle="Required before posting your first review. Includes scoring rules and effect guidance."
                            rightLabel={guideRightLabel}
                            onPress={() => router.push("/(tabs)/user/reviews-info")}
                        />
                    </View>
                </GlassCard>

                {/* Following */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Following</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16, marginBottom: 6 }}>
                        Members you follow
                    </Text>

                    {loadingFollowing ? (
                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            Loading followed members...
                        </Text>
                    ) : followedUsers.length === 0 ? (
                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            Follow member profiles from review threads to build your trusted reviewer list.
                        </Text>
                    ) : (
                        <View style={{ marginTop: 8 }}>
                            {followedUsers.map((member) => (
                                <Pressable
                                    key={member.uid}
                                    onPress={() => router.push(`/(tabs)/user/profile/${encodeURIComponent(member.uid)}`)}
                                    style={({ pressed }) => ({
                                        borderRadius: 18,
                                        padding: 12,
                                        marginTop: 10,
                                        backgroundColor: "rgba(255,255,255,0.06)",
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.12)",
                                        opacity: pressed ? 0.84 : 1,
                                    })}
                                >
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <AvatarCircle
                                            avatarId={member.avatarId}
                                            photoURL={member.photoURL}
                                            size={44}
                                            seed={member.uid || member.displayName}
                                        />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                                                {member.displayName}
                                            </Text>
                                            <Text style={{ marginTop: 3, color: theme.colors.textOnDarkSecondary, fontSize: 12 }}>
                                                {member.followedAtMs
                                                    ? `Following since ${formatDate(member.followedAtMs)}`
                                                    : "Following"}
                                            </Text>
                                        </View>
                                        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 20, marginLeft: 10 }}>›</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </GlassCard>

                {/* Notifications */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Notifications</SectionLabel>

                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16, flex: 1 }}>
                            Activity from members you follow
                        </Text>
                        {unreadNotificationsCount > 0 ? (
                            <View
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                    backgroundColor: "rgba(255,255,255,0.12)",
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.16)",
                                }}
                            >
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 12 }}>
                                    {unreadNotificationsCount} new
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {unreadNotificationsCount > 0 ? (
                        <Pressable
                            onPress={markAllNotificationsRead}
                            style={({ pressed }) => ({
                                alignSelf: "flex-start",
                                marginTop: 4,
                                marginBottom: 6,
                                borderRadius: 999,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                backgroundColor: "rgba(255,255,255,0.10)",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.15)",
                                opacity: markingAllNotificationsRead ? 0.6 : pressed ? 0.84 : 1,
                            })}
                            disabled={markingAllNotificationsRead}
                        >
                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 12 }}>
                                {markingAllNotificationsRead ? "Marking..." : "Mark all as read"}
                            </Text>
                        </Pressable>
                    ) : null}

                    {loadingNotifications ? (
                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            Loading notifications...
                        </Text>
                    ) : notifications.length === 0 ? (
                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                            No notifications yet. Follow members to get alerts when they post new reviews.
                        </Text>
                    ) : (
                        <View style={{ marginTop: 4 }}>
                            {notifications.slice(0, 8).map((item) => {
                                const productName =
                                    (item.productId ? productMap[item.productId]?.name : null) ||
                                    "a strain";
                                const when = formatRelativeTime(item.eventAtMs || item.createdAtMs);
                                const title =
                                    item.type === "followed_review"
                                        ? `${item.actorDisplayNameSnapshot} posted a new review`
                                        : item.actorDisplayNameSnapshot;

                                return (
                                    <Pressable
                                        key={item.id}
                                        onPress={async () => {
                                            if (!item.isRead) await markNotificationRead(item.id);
                                            if (item.productId) router.push(`/reviews/${item.productId}`);
                                        }}
                                        style={({ pressed }) => ({
                                            borderRadius: 18,
                                            padding: 12,
                                            marginTop: 10,
                                            backgroundColor: item.isRead
                                                ? "rgba(255,255,255,0.05)"
                                                : "rgba(255,255,255,0.09)",
                                            borderWidth: 1,
                                            borderColor: item.isRead
                                                ? "rgba(255,255,255,0.11)"
                                                : "rgba(212,175,55,0.45)",
                                            opacity: pressed ? 0.84 : 1,
                                        })}
                                    >
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            <AvatarCircle
                                                avatarId={item.actorAvatarIdSnapshot}
                                                photoURL={item.actorPhotoURLSnapshot}
                                                size={42}
                                                seed={item.actorUid || item.actorDisplayNameSnapshot}
                                            />
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 14 }}>
                                                    {title}
                                                </Text>
                                                <Text
                                                    style={{
                                                        marginTop: 2,
                                                        color: theme.colors.textOnDarkSecondary,
                                                        fontWeight: "800",
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {`Review on ${productName} • ${when}`}
                                                </Text>
                                            </View>
                                            {!item.isRead ? (
                                                <View
                                                    style={{
                                                        width: 9,
                                                        height: 9,
                                                        borderRadius: 999,
                                                        backgroundColor: "rgba(212,175,55,0.95)",
                                                        marginLeft: 10,
                                                    }}
                                                />
                                            ) : null}
                                        </View>

                                        {item.textPreview ? (
                                            <Text
                                                numberOfLines={2}
                                                style={{
                                                    marginTop: 8,
                                                    color: theme.colors.textOnDarkSecondary,
                                                    lineHeight: 18,
                                                    fontSize: 13,
                                                }}
                                            >
                                                {item.textPreview}
                                            </Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
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
                        title={needsUsernameSetup ? "Set username" : "Edit username"}
                        subtitle={
                            needsUsernameSetup
                                ? "Pick the name people will see on your reviews."
                                : "Change the name shown on your reviews."
                        }
                        rightLabel={needsUsernameSetup ? "Required" : "Edit"}
                        onPress={() => router.push("/(tabs)/user/edit-profile")}
                    />

                    <Divider />

                    <MenuRow
                        title="Choose avatar"
                        subtitle="Pick from animal or emoji avatars."
                        rightLabel={editRightLabel}
                        onPress={() => setAvatarPickerOpen(true)}
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
                        A stronger community hub where members can quickly see what is working best for specific needs.
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Better member profiles, clearer trust signals, and smarter moderation to keep reviews useful.
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        Smarter recommendations and summaries built from real-world review patterns over time.
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                        The goal is to make Review Budz the go-to community place to check what may suit each person best.
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
                        title="Export my data"
                        subtitle="Create a GDPR text file and save it to Files."
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

                {/* Admin */}
                {isAdmin ? (
                    <GlassCard style={{ marginBottom: 14 }}>
                        <SectionLabel>Admin</SectionLabel>
                        <MenuRow
                            title="Admin moderation"
                            subtitle="Users, reports, restrictions, and review actions."
                            rightLabel="Enabled"
                            onPress={() => router.push("/(tabs)/user/admin-moderation")}
                        />
                    </GlassCard>
                ) : null}

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
                            maxHeight: "85%",
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
                                Pick an animal avatar or emoji persona. If you don’t choose one, you’ll get a fun persona by default.
                            </Text>

                            <ScrollView
                                style={{ marginTop: 14 }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 10 }}
                            >
                                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
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
                                                        overflow: "hidden",
                                                        backgroundColor: active ? "rgba(212,175,55,0.20)" : "rgba(255,255,255,0.08)",
                                                        borderWidth: 1,
                                                        borderColor: active ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.14)",
                                                    }}
                                                >
                                                    {a.image ? (
                                                        <Image
                                                            source={a.image}
                                                            resizeMode="cover"
                                                            style={{ width: "114%", height: "114%" }}
                                                        />
                                                    ) : (
                                                        <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
                                                    )}
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
                            </ScrollView>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.colors.appBgSolid,
    },
    backgroundScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(3, 8, 18, 0.62)",
    },
});
