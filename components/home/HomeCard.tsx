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
};

export function HomeCard({
    card,
    hero,
    style,
}: {
    card: HomeCardModel;
    hero?: boolean;
    style?: ViewStyle;
}) {
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

                        <View style={styles.iconPill}>
                            <Image source={budImg} style={styles.icon} resizeMode="contain" />
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
    meta: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: "800",
        color: "rgba(255,255,255,0.52)",
    },
    iconPill: {
        width: 44,
        height: 44,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(235,237,240,0.92)",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
    },
    icon: {
        width: 22,
        height: 22,
        tintColor: "rgba(0,0,0,0.92)",
    },
});
