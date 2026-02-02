import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export function SkeletonCard() {
    const a = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: true }),
                Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [a]);

    const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });

    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <Animated.View style={[styles.lineSm, { opacity }]} />
                <Animated.View style={[styles.dot, { opacity }]} />
            </View>
            <Animated.View style={[styles.lineLg, { opacity }]} />
            <Animated.View style={[styles.lineMd, { opacity }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 14,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
        alignItems: "center",
    },
    lineSm: {
        height: 10,
        width: 90,
        borderRadius: 6,
        backgroundColor: "rgba(255,255,255,0.3)",
    },
    dot: {
        height: 22,
        width: 22,
        borderRadius: 11,
        backgroundColor: "rgba(255,255,255,0.25)",
    },
    lineLg: {
        height: 16,
        width: "70%",
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.3)",
    },
    lineMd: {
        marginTop: 10,
        height: 12,
        width: "58%",
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.25)",
    },
});
