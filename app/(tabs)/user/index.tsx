import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
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

function Divider() {
    return (
        <View
            style={{
                height: 1,
                backgroundColor: theme.colors.dividerOnDark,
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
                opacity: pressed ? 0.75 : 1,
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

function AvatarCircle({
    avatarId,
    photoURL,
    size = 56,
}: {
    avatarId: string | null;
    photoURL?: string | null;
    size?: number;
}) {
    const picked = useMemo(
        () => AVATARS.find((a) => a.id === avatarId) ?? null,
        [avatarId]
    );

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
            ) : picked ? (
                <Text style={{ fontSize: Math.round(size * 0.52) }}>{picked.emoji}</Text>
            ) : (
                <Image
                    source={budImg}
                    resizeMode="contain"
                    style={{
                        width: Math.round(size * 0.52),
                        height: Math.round(size * 0.52),
                    }}
                />
            )}
        </View>
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

export default function UserMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const user = auth().currentUser;
    const uid = user?.uid ?? "";

    const displayName = user?.displayName?.trim()
        ? user.displayName
        : "Anonymous";

    const photoURL = user?.photoURL ?? null;
    const emailMasked = user?.email ? maskEmail(user.email) : "";

    const [avatarId, setAvatarId] = useState<string | null>(null);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

    // Optional, future-ready: stats stored on the user doc
    const [joinYear, setJoinYear] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState<number | null>(null);
    const [productCount, setProductCount] = useState<number | null>(null);
    const [lastActiveLabel, setLastActiveLabel] = useState<string | null>(null);

    useEffect(() => {
        if (!uid) return;

        const unsub = firestore()
            .collection("users")
            .doc(uid)
            .onSnapshot(
                (doc) => {
                    const data = (doc.data() as any) ?? {};
                    const v = typeof data?.avatarId === "string" ? data.avatarId : null;
                    setAvatarId(v);

                    const createdAt: any = data?.createdAt ?? data?.created_at ?? null;
                    if (createdAt?.toDate) {
                        setJoinYear(createdAt.toDate().getFullYear());
                    } else if (typeof createdAt === "number") {
                        setJoinYear(new Date(createdAt).getFullYear());
                    } else {
                        setJoinYear(null);
                    }

                    const rc = typeof data?.reviewCount === "number" ? data.reviewCount : null;
                    const pc = typeof data?.productCount === "number" ? data.productCount : null;
                    setReviewCount(rc);
                    setProductCount(pc);

                    // Keep this simple for now. If you later store lastActive as a timestamp, format it here.
                    const la =
                        typeof data?.lastActiveLabel === "string"
                            ? data.lastActiveLabel
                            : null;
                    setLastActiveLabel(la);
                },
                () => {
                    // ignore
                }
            );

        return () => unsub();
    }, [uid]);

    const saveAvatar = async (next: string | null) => {
        if (!uid) return;
        try {
            await firestore().collection("users").doc(uid).set(
                { avatarId: next ?? null },
                { merge: true }
            );
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

    const headerBorder = theme.colors.goldGlassBorder;
    const headerBg = theme.colors.goldGlass;
    const editRightLabel = photoURL ? "Photo" : avatarId ? "Avatar" : "Set up";

    const headerOneLiner = joinYear
        ? `Part of the community since ${joinYear}`
        : "Sharing honest experiences with the community";

    const statsBits: string[] = [];
    if (typeof reviewCount === "number") statsBits.push(`${reviewCount} reviews`);
    if (typeof productCount === "number") statsBits.push(`${productCount} products`);
    if (lastActiveLabel) statsBits.push(`Last active ${lastActiveLabel}`);
    const statsLine = statsBits.length ? statsBits.join(" · ") : null;

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
                        colors={[
                            "rgba(212,175,55,0.18)",
                            "rgba(255,255,255,0.06)",
                            "rgba(0,0,0,0.10)",
                        ]}
                        start={{ x: 0.05, y: 0 }}
                        end={{ x: 0.95, y: 1 }}
                        style={{
                            padding: 16,
                            backgroundColor: headerBg,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Pressable
                                onPress={() => setAvatarPickerOpen(true)}
                                style={({ pressed }) => ({
                                    opacity: pressed ? 0.8 : 1,
                                    marginRight: 14,
                                })}
                            >
                                <AvatarCircle avatarId={avatarId} photoURL={photoURL} size={64} />
                            </Pressable>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontSize: 24,
                                        fontWeight: "900",
                                        color: theme.colors.textOnDark,
                                        lineHeight: 28,
                                    }}
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
                                >
                                    {headerOneLiner}
                                </Text>

                                {statsLine ? (
                                    <Text
                                        style={{
                                            marginTop: 8,
                                            fontSize: 12,
                                            color: "rgba(255,255,255,0.60)",
                                            fontWeight: "800",
                                        }}
                                    >
                                        {statsLine}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Your Activity */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Your activity</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDark,
                            fontWeight: "900",
                            fontSize: 16,
                            marginBottom: 6,
                        }}
                    >
                        Your recent reviews
                    </Text>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                        }}
                    >
                        {typeof reviewCount === "number"
                            ? `You’ve shared ${reviewCount} review${reviewCount === 1 ? "" : "s"} so far.`
                            : "Your reviews will show up here once you post a few."}
                    </Text>

                    <Text
                        style={{
                            marginTop: 10,
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                        }}
                    >
                        This is about contribution, not competition.
                    </Text>

                    <View style={{ marginTop: 12 }}>
                        <MenuRow
                            title="Reviews and scale"
                            subtitle="How the bud score works and how to write reviews that actually help."
                            onPress={() => router.push("/(tabs)/user/reviews-info")}
                        />
                    </View>
                </GlassCard>

                {/* Community Impact */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Your impact</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                        }}
                    >
                        Your reviews help others make informed choices. Community ratings are built from honest
                        experiences like yours.
                    </Text>

                    <Text
                        style={{
                            marginTop: 10,
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                        }}
                    >
                        Every review improves the accuracy of recommendations over time.
                    </Text>
                </GlassCard>

                {/* Preferences & Personalisation */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Preferences</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                            marginBottom: 10,
                        }}
                    >
                        These help personalise what you see in the app. More personalisation options are coming.
                    </Text>

                    <MenuRow
                        title="Edit profile"
                        subtitle="Update your display name, set a photo, or choose an avatar."
                        rightLabel={editRightLabel}
                        onPress={() => router.push("/(tabs)/user/edit-profile")}
                    />
                </GlassCard>

                {/* Feedback & App Direction */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Help shape the app</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                            marginBottom: 10,
                        }}
                    >
                        This app is evolving. Your feedback helps shape what comes next.
                    </Text>

                    <MenuRow
                        title="Send feedback"
                        subtitle="Bugs, ideas, features, new products. Anything welcome."
                        onPress={() => router.push("/(tabs)/user/feedback")}
                    />
                </GlassCard>

                {/* Future Features (soft teaser) */}
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

                {/* Account & Security */}
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
                        title="Terms and legal"
                        subtitle="Privacy, terms, and the sensible bits."
                        onPress={() => router.push("/(tabs)/user/legal")}
                    />

                    <Divider />

                    <MenuRow
                        title="Delete account"
                        subtitle="This is permanent. No tricks."
                        danger
                        onPress={() => {
                            Alert.alert(
                                "Delete account",
                                "This will be added soon. For now, use Feedback and ask for account deletion.",
                                [{ text: "OK" }]
                            );
                        }}
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
            <Modal
                visible={avatarPickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setAvatarPickerOpen(false)}
            >
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
                            colors={[
                                "rgba(212,175,55,0.14)",
                                "rgba(255,255,255,0.06)",
                                "rgba(0,0,0,0.18)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ padding: 16 }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 22,
                                        fontWeight: "900",
                                        color: theme.colors.textOnDark,
                                    }}
                                >
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
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                        Close
                                    </Text>
                                </Pressable>
                            </View>

                            <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                Simple, adult-friendly avatars for now. Proper themed packs can come later.
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
                                                    backgroundColor: active
                                                        ? "rgba(212,175,55,0.20)"
                                                        : "rgba(255,255,255,0.08)",
                                                    borderWidth: 1,
                                                    borderColor: active
                                                        ? "rgba(212,175,55,0.55)"
                                                        : "rgba(255,255,255,0.14)",
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
                                    Use default bud
                                </Text>
                            </Pressable>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
