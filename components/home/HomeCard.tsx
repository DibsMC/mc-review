import React from "react";
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
    onPress?: () => void;

    // optional (some cards may pass these, we simply ignore if not present)
    rating?: number | null;
    ratingCount?: number | null;
};

function iconCircleForType(type: HomeCardType) {
    // Muted earthy tones. Keep subtle, not danger.
    switch (type) {
        case "badge":
            return ["rgba(232,220,208,0.96)", "rgba(220,205,192,0.96)"] as const; // warm beige
        case "trending":
            return ["rgba(190,210,205,0.96)", "rgba(172,196,190,0.96)"] as const; // sage
        case "top_rated":
            return ["rgba(200,216,190,0.96)", "rgba(182,204,170,0.96)"] as const; // moss
        case "news":
            return ["rgba(205,216,220,0.96)", "rgba(186,202,208,0.96)"] as const; // cool grey-blue
        default:
            return ["rgba(210,220,218,0.96)", "rgba(188,204,200,0.96)"] as const; // neutral sage
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
    const circle = iconCircleForType(card.type);

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
                            ? ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.06)"]
                            : ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.05)"]
                    }
                    style={styles.surface}
                >
                    <View pointerEvents="none" style={styles.glowA} />
                    <View pointerEvents="none" style={styles.glowB} />

                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            {!!card.eyebrow ? (
                                <Text style={styles.eyebrow} numberOfLines={1}>
                                    {String(card.eyebrow).toUpperCase()}
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
                        </View>

                        {/* Earthy icon circle */}
                        <View style={styles.iconWrap}>
                            <LinearGradient colors={[...circle]} style={styles.iconCircle}>
                                <Image source={budImg} style={styles.icon} resizeMode="contain" />
                            </LinearGradient>
                        </View>
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
        shadowOpacity: 0.22,
        shadowRadius: 26,
        shadowOffset: { width: 0, height: 14 },
        elevation: 6,
    },
    wrapHero: {
        shadowOpacity: 0.32,
        shadowRadius: 34,
        elevation: 8,
    },
    pressed: {
        transform: [{ scale: 0.985 }],
        opacity: 0.96,
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
        paddingVertical: 18,
        paddingHorizontal: 18,
    },
    glowA: {
        position: "absolute",
        right: -70,
        top: -80,
        width: 200,
        height: 200,
        borderRadius: 999,
        backgroundColor: "rgba(130,255,210,0.10)",
    },
    glowB: {
        position: "absolute",
        left: -80,
        bottom: -90,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: "rgba(120,160,255,0.08)",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    eyebrow: {
        fontSize: 12,
        letterSpacing: 1,
        color: "rgba(255,255,255,0.55)",
        fontWeight: "800",
    },
    title: {
        marginTop: 10,
        fontSize: 24,
        fontWeight: "900",
        color: "rgba(255,255,255,0.94)",
    },
    titleHero: {
        fontSize: 28,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 15,
        fontWeight: "800",
        color: "rgba(255,255,255,0.66)",
        lineHeight: 20,
    },
    meta: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: "800",
        color: "rgba(255,255,255,0.52)",
    },

    iconWrap: {
        width: 78,
        height: 78,
        borderRadius: 39,
        alignItems: "center",
        justifyContent: "center",
    },
    iconCircle: {
        width: 78,
        height: 78,
        borderRadius: 39,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        shadowColor: "rgba(0,0,0,0.35)",
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    icon: {
        width: 34,
        height: 34,
        // No tint, we want the bud PNG to show naturally
    },
});
