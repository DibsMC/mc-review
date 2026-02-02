import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export function AmbientBackground() {
    const a = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(a, {
                toValue: 1,
                duration: 42000,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [a]);

    const slow1 = a.interpolate({ inputRange: [0, 1], outputRange: [-26, 26] });
    const slow2 = a.interpolate({ inputRange: [0, 1], outputRange: [22, -22] });
    const slow3 = a.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View
                style={[
                    styles.blob,
                    styles.blobA,
                    { transform: [{ translateX: slow1 }, { translateY: slow2 }] },
                ]}
            />
            <Animated.View
                style={[
                    styles.blob,
                    styles.blobB,
                    { transform: [{ translateX: slow2 }, { translateY: slow3 }] },
                ]}
            />
            <Animated.View
                style={[
                    styles.blob,
                    styles.blobC,
                    { transform: [{ translateX: slow3 }, { translateY: slow1 }] },
                ]}
            />
            <View style={styles.vignette} />
        </View>
    );
}

const styles = StyleSheet.create({
    blob: {
        position: "absolute",
        width: 560,
        height: 560,
        borderRadius: 280,
    },
    blobA: {
        top: -210,
        left: -210,
        backgroundColor: "rgba(70, 180, 170, 0.14)", // muted emerald
    },
    blobB: {
        bottom: -260,
        right: -240,
        backgroundColor: "rgba(80, 120, 220, 0.12)", // soft indigo
    },
    blobC: {
        top: 140,
        right: -260,
        width: 480,
        height: 480,
        borderRadius: 240,
        backgroundColor: "rgba(160, 110, 220, 0.08)", // faint violet accent
    },
    vignette: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.22)",
    },
});
