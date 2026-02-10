import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from "react";
import { EmailAuthProvider } from "@react-native-firebase/auth";
import {
    Alert,
    Image,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    UIManager,
    View,
    ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { theme } from "../../../lib/theme";
import { getUnlockedBadges } from "../../../lib/communityBadges";

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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

function SectionLabel({
    children,
    icon,
}: {
    children: string;
    icon?: React.ReactNode;
}) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
            <Text
                style={{
                    fontSize: 12,
                    letterSpacing: 0.9,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: "900",
                }}
            >
                {children}
            </Text>
        </View>
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
                colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.10)"]}
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
    const picked = useMemo(() => AVATARS.find((a) => a.id === avatarId) ?? null, [avatarId]);

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
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.14)"]}
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

function StatRow({ label, value }: { label: string; value: number }) {
    return (
        <View
            style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 10,
            }}
        >
            <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 18, fontWeight: "900" }}>
                {label}
            </Text>
            <Text style={{ color: theme.colors.textOnDark, fontSize: 26, fontWeight: "900" }}>
                {String(value)}
            </Text>
        </View>
    );
}

type BadgeTier = "bronze" | "silver" | "gold" | "emerald" | "platinum";

function tierStyle(tier: BadgeTier) {
    switch (tier) {
        case "bronze":
            return { dot: "rgba(205,127,50,0.90)", border: "rgba(205,127,50,0.35)", bg: "rgba(205,127,50,0.10)" };
        case "silver":
            return { dot: "rgba(200,200,210,0.95)", border: "rgba(200,200,210,0.35)", bg: "rgba(200,200,210,0.10)" };
        case "gold":
            return { dot: "rgba(212,175,55,0.95)", border: "rgba(212,175,55,0.40)", bg: "rgba(212,175,55,0.10)" };
        case "emerald":
            return { dot: "rgba(80,220,160,0.95)", border: "rgba(80,220,160,0.35)", bg: "rgba(80,220,160,0.10)" };
        case "platinum":
            return { dot: "rgba(235,235,245,0.95)", border: "rgba(235,235,245,0.45)", bg: "rgba(255,255,255,0.10)" };
    }
}

function BadgeRow({
    title,
    subtitle,
    emoji,
    tier,
}: {
    title: string;
    subtitle: string;
    emoji: string;
    tier: BadgeTier;
}) {
    const t = tierStyle(tier);

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 18,
                backgroundColor: t.bg,
                borderWidth: 1,
                borderColor: t.border,
                marginBottom: 10,
            }}
        >
            <View
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.14)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                    marginRight: 12,
                }}
            >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </View>

            <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textOnDark, fontSize: 18, fontWeight: "900", lineHeight: 22 }}>
                    {title}
                </Text>
                <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.70)", fontSize: 14, fontWeight: "800", lineHeight: 18 }}>
                    {subtitle}
                </Text>
            </View>

            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.dot, opacity: 0.95 }} />
        </View>
    );
}

function InfoParagraph({ children }: { children: string }) {
    return (
        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20, fontSize: 14, marginTop: 8 }}>
            {children}
        </Text>
    );
}

function AccordionItem({
    title,
    isOpen,
    onToggle,
    children,
}: {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <View
            style={{
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: "rgba(0,0,0,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
            }}
        >
            <Pressable
                onPress={onToggle}
                style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    opacity: pressed ? 0.8 : 1,
                })}
            >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ flex: 1, color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                        {title}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 18 }}>
                        {isOpen ? "-" : "+"}
                    </Text>
                </View>
            </Pressable>

            {isOpen ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 }}>{children}</View> : null}
        </View>
    );
}

export default function UserMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const user = auth().currentUser;
    const uid = user?.uid ?? "";

    // Prefer Firestore displayName when available; Auth fallback
    const authDisplayName = user?.displayName?.trim() ? user.displayName : "Member";

    const photoURL = user?.photoURL ?? null;
    const emailMasked = user?.email ? maskEmail(user.email) : "";

    const [avatarId, setAvatarId] = useState<string | null>(null);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);



    // Optional, future-ready: stats stored on the user doc
    const [joinYear, setJoinYear] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState<number | null>(null);
    const [productCount, setProductCount] = useState<number | null>(null);
    const [lastActiveLabel, setLastActiveLabel] = useState<string | null>(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletePw, setDeletePw] = useState("");
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteErr, setDeleteErr] = useState<string | null>(null);

    const openDelete = () => {
        setDeleteErr(null);
        setDeletePw("");
        setDeleteOpen(true);
    };

    const closeDelete = () => {
        if (deleteBusy) return;
        setDeleteOpen(false);
        setDeletePw("");
        setDeleteErr(null);
    };

    const deleteAccountNow = async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Not signed in", "Please sign in again.");
            return;
        }

        const email = user.email;
        const pw = deletePw.trim();

        if (!email) {
            Alert.alert("Missing email", "This account has no email attached. Cannot re-authenticate.");
            return;
        }

        if (!pw) {
            setDeleteErr("Please enter your password to confirm.");
            return;
        }

        setDeleteBusy(true);
        setDeleteErr(null);

        try {
            // 1) Re-authenticate (Firebase requires recent login for delete)
            const cred = EmailAuthProvider.credential(email, pw);
            await user.reauthenticateWithCredential(cred);

            // 2) Delete user subcollection: /users/{uid}/helpful/*
            const userRef = firestore().collection("users").doc(user.uid);
            try {
                const helpfulSnap = await userRef.collection("helpful").get();
                if (!helpfulSnap.empty) {
                    const batch = firestore().batch();
                    helpfulSnap.docs.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                }
            } catch {
                // If rules block this, we still proceed with account delete.
                // Worst case: orphaned helpful docs that are no longer used.
            }

            // 3) Delete the user profile doc (so name/favourites disappear)
            try {
                await userRef.delete();
            } catch {
                // same idea: proceed anyway
            }

            // 4) Delete the Auth user (actual account)
            await user.delete();

            // 5) Close modal + best-effort sign out
            closeDelete();
            try {
                await auth().signOut();
            } catch {
                // ignore
            }

            Alert.alert("Account deleted", "Your account has been deleted from this device.");
        } catch (e: any) {
            const code = e?.code || "";
            const msg = e?.message || "Unknown error";

            // Common cases with nicer messages
            if (code === "auth/wrong-password") {
                setDeleteErr("That password doesn’t match this account.");
            } else if (code === "auth/too-many-requests") {
                setDeleteErr("Too many attempts. Try again in a bit.");
            } else if (code === "auth/requires-recent-login") {
                setDeleteErr("Please sign out and back in, then try deleting again.");
            } else {
                setDeleteErr(msg);
            }
        } finally {
            setDeleteBusy(false);
        }
    };


    // Display name from Firestore (fixes "Member"/"Info" issues)
    const [publicDisplayName, setPublicDisplayName] = useState<string | null>(null);

    // Extra stats (safe defaults)
    const [helpfulReceived, setHelpfulReceived] = useState<number>(0);
    const [helpfulGiven, setHelpfulGiven] = useState<number>(0);
    const [favouritesCount, setFavouritesCount] = useState<number>(0);

    // Community stats fallback state
    const [reviewCountLoading, setReviewCountLoading] = useState<boolean>(false);

    const [openInfoKey, setOpenInfoKey] = useState<string | null>(null);

    // User doc listener (avatar, joinYear, doc-based stats)
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

                    const dnRaw = typeof data?.displayName === "string" ? data.displayName.trim() : "";
                    // Avoid placeholder junk values (e.g. "Info")
                    const dn = dnRaw && dnRaw.toLowerCase() !== "info" ? dnRaw : "";
                    setPublicDisplayName(dn || null);

                    const createdAt: any = data?.createdAt ?? data?.created_at ?? null;
                    if (createdAt?.toDate) setJoinYear(createdAt.toDate().getFullYear());
                    else if (typeof createdAt === "number") setJoinYear(new Date(createdAt).getFullYear());
                    else setJoinYear(null);

                    const rc = typeof data?.reviewCount === "number" ? data.reviewCount : null;
                    const pc = typeof data?.productCount === "number" ? data.productCount : null;
                    setReviewCount(rc);
                    setProductCount(pc);

                    const la = typeof data?.lastActiveLabel === "string" ? data.lastActiveLabel : null;
                    setLastActiveLabel(la);

                    // Favourites count derived from the real source of truth
                    const favIdsA = Array.isArray(data?.favoriteProductIds)
                        ? data.favoriteProductIds.filter((x: any) => typeof x === "string")
                        : [];

                    const favIdsB = Array.isArray(data?.favouriteProductIds)
                        ? data.favouriteProductIds.filter((x: any) => typeof x === "string")
                        : [];

                    // If both exist for some reason, merge unique
                    const mergedFavs = Array.from(new Set([...(favIdsA as string[]), ...(favIdsB as string[])]));

                    setFavouritesCount(mergedFavs.length);

                },
                () => {
                    // ignore
                }
            );

        return () => unsub();
    }, [uid]);

    // Helpful GIVEN + RECEIVED (MUST be a sibling hook, not nested)
    useEffect(() => {
        if (!uid) return;

        // Helpful GIVEN = count of my votes (/users/{uid}/helpful)
        const unsubGiven = firestore()
            .collection("users")
            .doc(uid)
            .collection("helpful")
            .onSnapshot(
                (snap) => setHelpfulGiven(snap.size),
                () => setHelpfulGiven(0)
            );

        // Helpful RECEIVED = sum of helpfulCount on all reviews where userId == uid
        const unsubReceived = firestore()
            .collection("reviews")
            .where("userId", "==", uid)
            .onSnapshot(
                (snap) => {
                    let total = 0;
                    snap.docs.forEach((d) => {
                        const hc = (d.data() as any)?.helpfulCount;
                        if (typeof hc === "number" && Number.isFinite(hc)) total += hc;
                    });
                    setHelpfulReceived(total);
                },
                () => setHelpfulReceived(0)
            );

        return () => {
            unsubGiven();
            unsubReceived();
        };
    }, [uid]);

    // Fallback: if users/{uid}.reviewCount isn't present, count reviews once
    useEffect(() => {
        if (!uid) return;
        if (typeof reviewCount === "number") return;

        let cancelled = false;

        const run = async () => {
            setReviewCountLoading(true);
            try {
                const snap = await firestore().collection("reviews").where("userId", "==", uid).get();
                if (!cancelled) setReviewCount(snap.size);
            } catch {
                // keep resilient: leave reviewCount as null if this fails
            } finally {
                if (!cancelled) setReviewCountLoading(false);
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [uid, reviewCount]);

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

    const headerBorder = theme.colors.goldGlassBorder;
    const headerBg = theme.colors.goldGlass;
    const editRightLabel = photoURL ? "Photo" : avatarId ? "Avatar" : "Set up";

    const headerOneLiner = joinYear ? `Part of the community since ${joinYear}` : "Sharing honest experiences with the community";

    const statsBits: string[] = [];
    if (typeof reviewCount === "number") statsBits.push(`${reviewCount} reviews`);
    if (typeof productCount === "number") statsBits.push(`${productCount} products`);
    if (lastActiveLabel) statsBits.push(`Last active ${lastActiveLabel}`);
    const statsLine = statsBits.length ? statsBits.join(" · ") : null;

    const safeReviewCount = typeof reviewCount === "number" ? reviewCount : 0;

    const unlockedBadges = getUnlockedBadges({
        reviewsWritten: safeReviewCount,
        helpfulReceived,
    });

    const toggleInfo = (key: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenInfoKey((prev) => (prev === key ? null : key));
    };

    const displayName = publicDisplayName || authDisplayName || "Member";

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
                        colors={["rgba(212,175,55,0.18)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.10)"]}
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

                {/* YOUR STATS */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel
                        icon={<Image source={budImg} resizeMode="contain" style={{ width: 14, height: 14, opacity: 0.9 }} />}
                    >
                        Your stats
                    </SectionLabel>

                    <StatRow label="Reviews written" value={reviewCountLoading ? 0 : safeReviewCount} />
                    <StatRow label="Helpful received" value={helpfulReceived} />
                    <StatRow label="Helpful given" value={helpfulGiven} />
                    <StatRow label="Favourites" value={favouritesCount} />

                    <Text
                        style={{
                            marginTop: 14,
                            color: "rgba(255,255,255,0.55)",
                            lineHeight: 22,
                            fontSize: 16,
                            fontWeight: "700",
                        }}
                    >
                        Reviews written is the number of reviews you have posted. Helpful received is the total number of helpful votes on all of your reviews.
                    </Text>
                </GlassCard>

                {/* HELPFUL INFORMATION */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Helpful information</SectionLabel>

                    <View style={{ gap: 10 }}>
                        <AccordionItem
                            title="Reviews & Scale"
                            isOpen={openInfoKey === "reviewsScale"}
                            onToggle={() => toggleInfo("reviewsScale")}
                        >
                            <InfoParagraph>
                                Every review includes a bud rating and written notes. The bud rating is a quick signal, while the written review is where the useful detail lives.
                            </InfoParagraph>
                            <InfoParagraph>
                                If you are deciding between products, look for repeated themes across multiple reviews rather than relying on a single opinion.
                            </InfoParagraph>

                            <View style={{ marginTop: 10 }}>
                                <MenuRow
                                    title="Read the scoring guide"
                                    subtitle="How the bud score works and how to write reviews that actually help."
                                    onPress={() => router.push("/(tabs)/user/reviews-info")}
                                />
                            </View>
                        </AccordionItem>

                        <AccordionItem title="About the App" isOpen={openInfoKey === "about"} onToggle={() => toggleInfo("about")}>
                            <InfoParagraph>This app started as a simple idea: make it easier to learn from real patient experiences.</InfoParagraph>
                            <InfoParagraph>
                                Medical cannabis reviews are often scattered across YouTube, Facebook groups, Reddit, and word of mouth. That makes it hard to compare products and spot consistent patterns.
                            </InfoParagraph>
                            <InfoParagraph>
                                By bringing reviews into one place, we can aggregate experiences. For example, if lots of people report a product helps with migraines, that pattern can be useful, while still acknowledging that everyone responds differently.
                            </InfoParagraph>
                            <InfoParagraph>
                                The goal is a community-driven platform that helps people navigate options with more confidence, using shared experience as a guide.
                            </InfoParagraph>

                            <View style={{ marginTop: 10 }}>
                                <MenuRow title="More about the app" subtitle="The longer version, plus the community angle." onPress={() => router.push("/(tabs)/user/about")} />
                            </View>
                        </AccordionItem>

                        <AccordionItem title="What’s Coming" isOpen={openInfoKey === "coming"} onToggle={() => toggleInfo("coming")}>
                            <InfoParagraph>This is the first launch of the app, and it will evolve.</InfoParagraph>
                            <InfoParagraph>We are open to feedback, especially when it is constructive and helps improve the experience for everyone.</InfoParagraph>
                            <InfoParagraph>
                                The app was built based on the creator’s own experience as a medical cannabis patient, with the aim of expanding over time to support more people, more products, and more use cases.
                            </InfoParagraph>
                            <InfoParagraph>Plans, not promises.</InfoParagraph>
                        </AccordionItem>

                        <AccordionItem title="What This App Is Not" isOpen={openInfoKey === "not"} onToggle={() => toggleInfo("not")}>
                            <InfoParagraph>This app is not medical advice.</InfoParagraph>
                            <InfoParagraph>Reviews are personal experiences, not clinical guidance.</InfoParagraph>
                            <InfoParagraph>
                                Always take responsibility for your own decisions and speak to a qualified professional if you need medical support or advice, especially if you have underlying conditions, take other medications, or experience side effects.
                            </InfoParagraph>
                        </AccordionItem>

                        <AccordionItem title="Why Reviews Matter" isOpen={openInfoKey === "matter"} onToggle={() => toggleInfo("matter")}>
                            <InfoParagraph>Peer insight can be valuable because it reflects real-world use.</InfoParagraph>
                            <InfoParagraph>One review is just one experience, but patterns across many reviews can help guide decisions and set expectations.</InfoParagraph>
                            <InfoParagraph>Use reviews to learn what to look out for, what tends to help others, and what might not suit you.</InfoParagraph>
                        </AccordionItem>
                    </View>
                </GlassCard>

                {/* COMMUNITY BADGES */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Community badges</SectionLabel>

                    {unlockedBadges.length > 0 ? (
                        <View>
                            {unlockedBadges.map((b) => (
                                <BadgeRow key={b.id} title={b.title} subtitle={b.subtitle} emoji={b.emoji} tier={b.tier} />
                            ))}
                        </View>
                    ) : (
                        <Text
                            style={{
                                color: "rgba(255,255,255,0.55)",
                                lineHeight: 22,
                                fontSize: 16,
                                fontWeight: "700",
                            }}
                        >
                            No badges yet. Write your first review to unlock one.
                        </Text>
                    )}
                </GlassCard>

                {/* Preferences */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Preferences</SectionLabel>

                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18, marginBottom: 10 }}>
                        These help personalise what you see in the app. More personalisation options are coming.
                    </Text>

                    <MenuRow
                        title="Edit profile"
                        subtitle="Update your display name - More features coming soon."
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

                    <MenuRow title="Send feedback" subtitle="Bugs, ideas, features, new products. Anything welcome." onPress={() => router.push("/(tabs)/user/feedback")} />
                </GlassCard>

                {/* Account */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Account</SectionLabel>

                    <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 12, fontWeight: "900" }}>Email</Text>
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>{emailMasked || "Not available"}</Text>
                    </View>

                    <Divider />

                    <MenuRow title="Change email" subtitle="Update the email you use to sign in." onPress={() => router.push("/(tabs)/user/change-email")} />

                    <Divider />

                    <MenuRow title="Terms and legal" subtitle="Privacy, terms, and the sensible bits." onPress={() => router.push("/(tabs)/user/legal")} />

                    <Divider />

                    <MenuRow
                        title="Delete account"
                        subtitle="This is permanent. No tricks."
                        danger
                        onPress={() => {
                            Alert.alert(
                                "Delete account",
                                "This will permanently delete your account on this device. You will need your password to confirm.",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Continue", style: "destructive", onPress: openDelete },
                                ]
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
            {/* Delete Account Modal */}
            <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={closeDelete}>
                <Pressable
                    onPress={closeDelete}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        padding: 16,
                        justifyContent: "center",
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
                            colors={["rgba(255,120,120,0.16)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.20)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ padding: 16 }}
                        >
                            <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.textOnDark }}>
                                Confirm account deletion
                            </Text>

                            <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                This is permanent. Enter your password to confirm.
                            </Text>

                            <TextInput
                                value={deletePw}
                                onChangeText={(t: string) => setDeletePw(t)}
                                placeholder="Password"
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                secureTextEntry
                                editable={!deleteBusy}
                                style={{
                                    marginTop: 12,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.16)",
                                    backgroundColor: "rgba(0,0,0,0.25)",
                                    paddingVertical: 12,
                                    paddingHorizontal: 14,
                                    borderRadius: 14,
                                    color: theme.colors.textOnDark,
                                    fontWeight: "800",
                                }}
                            />

                            {deleteErr ? (
                                <Text style={{ marginTop: 10, color: "rgba(255,160,160,1)", fontWeight: "900" }}>
                                    {deleteErr}
                                </Text>
                            ) : null}

                            <View style={{ flexDirection: "row", marginTop: 14 }}>
                                <Pressable
                                    onPress={closeDelete}
                                    disabled={deleteBusy}
                                    style={({ pressed }) => ({
                                        flex: 1,
                                        paddingVertical: 12,
                                        borderRadius: 14,
                                        alignItems: "center",
                                        backgroundColor: "rgba(255,255,255,0.10)",
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.14)",
                                        marginRight: 10,
                                        opacity: deleteBusy ? 0.6 : pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Cancel</Text>
                                </Pressable>

                                <Pressable
                                    onPress={deleteAccountNow}
                                    disabled={deleteBusy}
                                    style={({ pressed }) => ({
                                        flex: 1,
                                        paddingVertical: 12,
                                        borderRadius: 14,
                                        alignItems: "center",
                                        backgroundColor: "rgba(255,120,120,0.22)",
                                        borderWidth: 1,
                                        borderColor: "rgba(255,120,120,0.32)",
                                        opacity: deleteBusy ? 0.6 : pressed ? 0.85 : 1,
                                    })}
                                >
                                    {deleteBusy ? (
                                        <ActivityIndicator />
                                    ) : (
                                        <Text style={{ color: "rgba(255,200,200,1)", fontWeight: "900" }}>Delete</Text>
                                    )}
                                </Pressable>
                            </View>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>

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
                                <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.textOnDark }}>Pick an avatar</Text>

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
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Use default bud</Text>
                            </Pressable>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>

    );
}
