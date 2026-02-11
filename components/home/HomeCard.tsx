import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { JazzBudRating } from "../ui/JazzBudRating";
import { typography } from "../../lib/typography";

const budImg = require("../../assets/icons/bud.png");

export type HomeCardType =
    | "new_review"
    | "new_flower"
    | "trending"
    | "top_rated"
    | "badge"
    | "review_updated"
    | "news"
    | "caught_up";

export type HomeCardModel = {
    id: string;
    type: HomeCardType;
    eyebrow?: string;
    title: string;
    subtitle?: string;
    meta?: string;

    // optional: shown on trending/top rated
    rating?: number | null;
    ratingCount?: number | null;

    onPress?: () => void;
};

type PillTheme = {
    // IMPORTANT: tuple, not string[]
    bg: readonly [string, string, ...string[]];
    ring: string;
    inner: string;
    glow: string;
};

function pillThemeForType(type: HomeCardType): PillTheme {
    // pastel, muted, earthy. Badge specifically is toned down to green family.
    switch (type) {
        case "badge":
            return {
                bg: ["rgba(205, 225, 210, 0.95)", "rgba(170, 205, 182, 0.92)"],
                ring: "rgba(65, 110, 82, 0.38)",
                inner: "rgba(255,255,255,0.30)",
                glow: "rgba(120, 255, 210, 0.18)",
            };
        case "trending":
            return {
                bg: ["rgba(210, 230, 224, 0.95)", "rgba(176, 210, 200, 0.92)"],
                ring: "rgba(80, 135, 120, 0.36)",
                inner: "rgba(255,255,255,0.28)",
                glow: "rgba(120, 200, 255, 0.16)",
            };
        case "top_rated":
            return {
                bg: ["rgba(220, 232, 214, 0.95)", "rgba(185, 215, 170, 0.92)"],
                ring: "rgba(95, 135, 70, 0.34)",
                inner: "rgba(255,255,255,0.28)",
                glow: "rgba(160, 255, 150, 0.16)",
            };
        case "new_flower":
            return {
                bg: ["rgba(220, 236, 232, 0.95)", "rgba(180, 215, 208, 0.92)"],
                ring: "rgba(70, 120, 120, 0.34)",
                inner: "rgba(255,255,255,0.28)",
                glow: "rgba(120, 255, 230, 0.14)",
            };
        case "review_updated":
        case "new_review":
        default:
            return {
                bg: ["rgba(210, 220, 235, 0.95)", "rgba(178, 190, 220, 0.92)"],
                ring: "rgba(95, 110, 150, 0.34)",
                inner: "rgba(255,255,255,0.26)",
                glow: "rgba(160, 180, 255, 0.16)",
            };
    }
}

export function HomeCard({
    card,
    hero,
    style,
}: {
    card: HomeCardModel;
    hero?: boolean;
    style?: ViewStyle;
}) {
    const pill = useMemo(() => pillThemeForType(card.type), [card.type]);

    const showRating =
        typeof card.rating === "number" && Number.isFinite(card.rating) && (card.rating ?? 0) > 0;

    const ratingCount =
        typeof card.ratingCount === "number" &&
            Number.isFinite(card.ratingCount) &&
            (card.ratingCount ?? 0) > 0
            ? Math.floor(card.ratingCount as number)
            : null;

    return (
        <Pressable
            onPress={card.onPress}
            disabled={!card.onPress}
            style={({ pressed }) => [
                styles.wrap,
                hero ? styles.wrapHero : null,
                pressed ? styles.pressed : null,
                style,
            ]}
        >
            <View style={styles.base}>
                <LinearGradient
                    colors={
                        hero
                            ? ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]
                            : ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.05)"]
                    }
                    start={{ x: 0.08, y: 0.05 }}
                    end={{ x: 0.95, y: 1 }}
                    style={styles.surface}
                >
                    <View pointerEvents="none" style={styles.glowA} />
                    <View pointerEvents="none" style={styles.glowB} />

                    <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.00)"]}
                        start={{ x: 0.2, y: 0 }}
                        end={{ x: 0.2, y: 1 }}
                        style={styles.sheen}
                    />

                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            {!!card.eyebrow ? (
                                <Text style={styles.eyebrow} numberOfLines={1}>
                                    {String(card.eyebrow)}
                                </Text>
                            ) : null}

                            <Text style={[styles.title, hero ? styles.titleHero : null]} numberOfLines={1}>
                                {card.title}
                            </Text>

                            {!!card.subtitle ? (
                                <Text style={styles.subtitle} numberOfLines={2}>
                                    {card.subtitle}
                                </Text>
                            ) : null}

                            {!!card.meta ? (
                                <Text style={styles.meta} numberOfLines={1}>
                                    {card.meta}
                                </Text>
                            ) : null}

                            {showRating ? (
                                <View style={styles.ratingRow}>
                                    <JazzBudRating value={card.rating as number} size={18} />
                                    <Text style={styles.ratingText}>
                                        {Number(card.rating).toFixed(1)}
                                        {ratingCount ? ` (${ratingCount})` : ""}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <LinearGradient
                            colors={pill.bg}
                            start={{ x: 0.15, y: 0.1 }}
                            end={{ x: 0.9, y: 1 }}
                            style={[styles.iconPill, { borderColor: pill.ring }]}
                        >
                            <View pointerEvents="none" style={[styles.iconInnerRing, { borderColor: pill.inner }]} />

                            <View pointerEvents="none" style={[styles.iconGlow, { shadowColor: pill.glow }]} />

                            <Image source={budImg} style={styles.bud} resizeMode="contain" />
                        </LinearGradient>
                    </View>
                </LinearGradient>
            </View>
        </Pressable>
    );
}

const R = 22;

const styles = StyleSheet.create({
    wrap: {
        borderRadius: R,
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 16 },
        elevation: 7,
    },
    wrapHero: {
        shadowOpacity: 0.34,
        shadowRadius: 34,
        elevation: 9,
    },
    pressed: {
        transform: [{ scale: 0.988 }],
        opacity: 0.97,
    },
    base: {
        borderRadius: R,
        overflow: "hidden",
        backgroundColor: "rgba(16,18,24,0.96)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    surface: {
        borderRadius: R,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    sheen: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 46,
        opacity: 0.55,
    },
    glowA: {
        position: "absolute",
        right: -70,
        top: -80,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: "rgba(130,255,210,0.10)",
    },
    glowB: {
        position: "absolute",
        left: -90,
        bottom: -110,
        width: 260,
        height: 260,
        borderRadius: 999,
        backgroundColor: "rgba(120,160,255,0.08)",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },

    eyebrow: {
        ...typography.sectionLabel,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: 1,
        fontWeight: "800",
    },
    title: {
        marginTop: 8,
        ...typography.heading,
        fontSize: 22,
        lineHeight: 28,
        fontWeight: "900",
        color: "rgba(255,255,255,0.94)",
    },
    titleHero: {
        fontSize: 26,
        lineHeight: 32,
    },
    subtitle: {
        marginTop: 6,
        ...typography.body,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "700",
        color: "rgba(255,255,255,0.68)",
    },
    meta: {
        marginTop: 8,
        ...typography.secondary,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "800",
        color: "rgba(255,255,255,0.52)",
    },

    ratingRow: {
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    ratingText: {
        ...typography.secondary,
        color: "rgba(255,255,255,0.85)",
        fontWeight: "900",
        fontSize: 13,
        lineHeight: 18,
    },

    iconPill: {
        width: 64,
        height: 64,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        shadowColor: "rgba(0,0,0,0.55)",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },
    iconInnerRing: {
        position: "absolute",
        left: 6,
        right: 6,
        top: 6,
        bottom: 6,
        borderRadius: 999,
        borderWidth: 1,
        opacity: 0.7,
    },
    iconGlow: {
        position: "absolute",
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
        borderRadius: 999,
        shadowOpacity: 0.9,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
        opacity: 0.25,
    },
    bud: {
        width: 40,
        height: 40,
        shadowColor: "rgba(210,255,185,0.85)",
        shadowOpacity: 0.34,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 0 },
    },
});
