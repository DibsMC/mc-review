import { ReactNode } from "react";
import { ImageBackground, ImageSourcePropType, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type BrandedScreenBackgroundProps = {
    children: ReactNode;
    source: ImageSourcePropType;
    gradientColors?: readonly [string, string, string];
    scrimColor?: string;
    showAmbientGlows?: boolean;
    showEdgeVeils?: boolean;
};

export default function BrandedScreenBackground({
    children,
    source,
    gradientColors = [
        "rgba(18,12,6,0.18)",
        "rgba(10,11,16,0.58)",
        "rgba(5,7,12,0.92)",
    ],
    scrimColor = "rgba(5,7,11,0.22)",
    showAmbientGlows = true,
    showEdgeVeils = true,
}: BrandedScreenBackgroundProps) {
    return (
        <View style={styles.root}>
            <ImageBackground source={source} resizeMode="cover" style={StyleSheet.absoluteFill}>
                <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={[styles.scrim, { backgroundColor: scrimColor }]} />
                {showEdgeVeils ? (
                    <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(7,10,15,0.96)", "rgba(7,10,15,0.72)", "rgba(7,10,15,0.18)", "rgba(7,10,15,0.00)"]}
                        locations={[0, 0.28, 0.72, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.topVeil}
                    />
                ) : null}
                {showEdgeVeils ? (
                    <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(6,8,12,0.00)", "rgba(6,8,12,0.08)", "rgba(6,8,12,0.24)", "rgba(6,8,12,0.42)"]}
                        locations={[0, 0.34, 0.7, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.bottomVeil}
                    />
                ) : null}
                {showAmbientGlows ? <View pointerEvents="none" style={styles.goldGlow} /> : null}
                {showAmbientGlows ? <View pointerEvents="none" style={styles.inkGlow} /> : null}
            </ImageBackground>
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#090B10",
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    topVeil: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 170,
    },
    bottomVeil: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 190,
    },
    goldGlow: {
        position: "absolute",
        top: -120,
        right: -90,
        width: 280,
        height: 280,
        borderRadius: 999,
        backgroundColor: "rgba(255,196,94,0.07)",
    },
    inkGlow: {
        position: "absolute",
        left: -140,
        bottom: -120,
        width: 320,
        height: 320,
        borderRadius: 999,
        backgroundColor: "rgba(18,42,80,0.08)",
    },
    content: {
        flex: 1,
        backgroundColor: "transparent",
    },
});
