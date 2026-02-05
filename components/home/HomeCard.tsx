import React from "react";
import {
    ColorValue,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { JazzBudRating } from "../ui/JazzBudRating";

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

    // OPTIONAL: used by Trending / Top rated
    rating?: number | null; // 0..5
    ratingCount?: number | null;
};

function pillTheme(
    type: HomeCardType
): {
    bg: readonly [ColorValue, ColorValue];
    ring: ColorValue;
    innerRing: ColorValue;
} {
    switch (type) {
        case "badge":
            return {
                bg: ["rgba(206, 214, 210, 0.92)", "rgba(180, 194, 188, 0.92)"] as const,
                ring: "rgba(255,255,255,0.22)",
                innerRing: "rgba(0,0,0,0.10)",
            };

        case "trending":
            return {
                bg: ["rgba(198, 220, 210, 0.92)", "rgba(165, 198, 182, 0.92)"] as const,
                ring: "rgba(255,255,255,0.22)",
                innerRing: "rgba(0,0,0,0.10)",
            };

        case "top_rated":
            return {
                bg: ["rgba(200, 216, 226, 0.92)", "rgba(168, 190, 206, 0.92)"] as const,
                ring: "rgba(255,255,255,0.22)",
                innerRing: "rgba(0,0,0,0.10)",
            };

        case "new_flower":
            return {
                bg: ["rgba(210, 226, 206, 0.92)", "rgba(176, 204, 174, 0.92)"] as const,
                ring: "rgba(255,255,255,0.22)",
                innerRing: "rgba(0,0,0,0.10)",
            };

        case "new_review":
        case "review_updated":
            return {
                bg: ["rgba(214, 214, 222, 0.92)", "rgba(186, 188, 202, 0.92)"] as const,
                ring: "rgba(255,255,255,0.22)",
                innerRing: "rgba(0,0,0,0.10)",
            };

        case "news":
        default:
            return {
                bg: ["rgba(208, 220, 226, 0.92)", "rgba(176, 196, 206, 0.92)"] as const,
                ring: "rgba(255,255,255,0.22)",
                innerRing: "rgba(0,0,0,0.10)",
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
    const pill = pillTheme(card.type);

    const showRating =
        typeof card.rating === "number" &&
        Number.isFinite(card.rating) &&
        card.rating > 0;

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

                            <Text
                                style={[styles.title, hero ? styles.titleHero : null]}
                                numberOfLines={1}
                            >
                                {card.title}
                            </Text>

                            {!!card.subtitle ? (
                                <Text style={styles.subtitle} numberOfLines={2}>
                                    {card.subtitle}
                                </Text>
                            ) : null}

                            {/* Rating row for Trending / Top rated */}
                            {showRating ? (
                                <View style={styles.ratingRow}>
                                    <JazzBudRating value={card.rating ?? 0} size={16} />
                                    <Text style={styles.ratingText}>
                                        {Number(card.rating).toFixed(1)}
                                        {typeof card.ratingCount === "number" && card.ratingCount > 0
                                            ? ` (${card.ratingCount})`
                                            : ""}
                                    </Text>
                                </View>
                            ) : null}

                            {!!card.meta ? (
                                <Text style={styles.meta} numberOfLines={1}>
                                    {card.meta}
                                </Text>
                            ) : null}
                        </View>

                        {/* Bud pill */}
                        <View style={styles.pillWrap}>
                            <LinearGradient
                                colors={pill.bg}
                                style={styles.pill}
                                start={{ x: 0.18, y: 0.18 }}
                                end={{ x: 0.82, y: 0.82 }}
                            >
                                <View
                                    pointerEvents="none"
                                    style={[styles.pillRing, { borderColor: pill.ring }]}
                                />
                                <View
                                    pointerEvents="none"
                                    style={[styles.pillInnerRing, { borderColor: pill.innerRing }]}
                                />

                                <LinearGradient
                                    pointerEvents="none"
                                    colors={["rgba(255,255,255,0.42)", "rgba(255,255,255,0.00)"]}
                                    style={styles.pillHighlight}
                                    start={{ x: 0.15, y: 0.1 }}
                                    end={{ x: 0.75, y: 0.85 }}
                                />

                                {/* IMPORTANT: no tintColor so the green bud stays green */}
                                <Image source={budImg} style={styles.bud} resizeMode="contain" />
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
        paddingVertical: 16,
        paddingHorizontal: 16,
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
        gap: 14,
    },
    eyebrow: {
        fontSize: 12,
        letterSpacing: 1,
        color: "rgba(255,255,255,0.55)",
        fontWeight: "800",
    },
    title: {
        marginTop: 8,
        fontSize: 22,
        fontWeight: "900",
        color: "rgba(255,255,255,0.94)",
    },
    titleHero: {
        fontSize: 26,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 14,
        fontWeight: "700",
        color: "rgba(255,255,255,0.68)",
    },

    ratingRow: {
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
    },
    ratingText: {
        marginLeft: 10,
        fontWeight: "900",
        color: "rgba(255,255,255,0.90)",
    },

    meta: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: "800",
        color: "rgba(255,255,255,0.52)",
    },

    pillWrap: {
        width: 74,
        height: 74,
        borderRadius: 999,
        overflow: "hidden",
    },
    pill: {
        width: "100%",
        height: "100%",
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    pillRing: {
        position: "absolute",
        inset: 0,
        borderRadius: 999,
        borderWidth: 1,
    },
    pillInnerRing: {
        position: "absolute",
        inset: 7,
        borderRadius: 999,
        borderWidth: 1,
        opacity: 0.9,
    },
    pillHighlight: {
        position: "absolute",
        left: 8,
        top: 8,
        width: 40,
        height: 40,
        borderRadius: 999,
        opacity: 0.65,
    },
    bud: {
        width: 46,
        height: 46,
        opacity: 0.98,
    },
});
