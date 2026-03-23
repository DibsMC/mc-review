import React, { useMemo, useRef } from "react";
import {
    Animated,
    Platform,
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
    children: React.ReactNode;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
};

export function CinematicCard({ children, onPress, style }: Props) {
    const scale = useRef(new Animated.Value(1)).current;

    const isPressable = typeof onPress === "function";

    const onPressIn = () => {
        if (!isPressable) return;
        Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            speed: 28,
            bounciness: 0,
        }).start();
    };

    const onPressOut = () => {
        if (!isPressable) return;
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 24,
            bounciness: 0,
        }).start();
    };

    const Container = isPressable ? Pressable : View;

    // Avoid creating a new object every render (helps perf in FlatList)
    const pressableProps = useMemo(() => {
        if (!isPressable) return {};
        return {
            onPress,
            onPressIn,
            onPressOut,
            android_ripple: { color: "rgba(255,255,255,0.08)", borderless: false },
        };
    }, [isPressable, onPress]);

    return (
        <Animated.View style={[{ transform: [{ scale }] }, styles.outer, style]}>
            {/* Outer shadow + border shell */}
            <View style={styles.shell}>
                {/* Base glass fill */}
                <View style={styles.baseFill} />

                {/* Soft top gloss */}
                <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.topGloss}
                />

                {/* Subtle depth gradient (very mild, keeps it chill) */}
                <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(255,255,255,0.03)", "rgba(0,0,0,0.18)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Inner rim (emboss effect) */}
                <View pointerEvents="none" style={styles.innerRim} />

                {/* Content */}
                <Container {...(pressableProps as any)} style={styles.contentTapArea}>
                    {children}
                </Container>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    outer: {
        // This wrapper holds the scale transform only.
    },

    shell: {
        borderRadius: 26,
        overflow: "hidden",

        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",

        backgroundColor: "rgba(10,14,20,0.78)",

        ...Platform.select({
            ios: {
                shadowColor: "rgba(0,0,0,0.45)",
                shadowOpacity: 0.42,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 14 },
            },
            android: {
                elevation: 10,
            },
            default: {},
        }),
    },

    baseFill: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(9,13,20,0.72)",
    },

    topGloss: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 30,
        opacity: 0.9,
    },

    innerRim: {
        position: "absolute",
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
        borderRadius: 20,

        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",

        backgroundColor: "rgba(255,255,255,0.02)",
        opacity: 0.4,
    },

    contentTapArea: {
        // Ensures taps feel like they’re on a solid object
        borderRadius: 26,
    },
});
