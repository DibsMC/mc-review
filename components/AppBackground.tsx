import { ReactNode } from "react";
import { View, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";
import { AmbientBackground } from "./home/AmbientBackground";

const budImg = require("../assets/icons/bud.png");

export default function AppBackground({ children }: { children: ReactNode }) {
    return (
        <View style={styles.root}>
            <LinearGradient
                colors={[theme.colors.appBgTop, theme.colors.appBgBottom]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <AmbientBackground />
            <Image source={budImg} resizeMode="contain" blurRadius={20} style={styles.budA} />
            <Image source={budImg} resizeMode="contain" blurRadius={14} style={styles.budB} />
            <LinearGradient
                pointerEvents="none"
                colors={["rgba(7,10,15,0.94)", "rgba(7,10,15,0.70)", "rgba(7,10,15,0.20)", "rgba(7,10,15,0.00)"]}
                locations={[0, 0.28, 0.72, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.topVeil}
            />
            <LinearGradient
                pointerEvents="none"
                colors={["rgba(6,8,12,0.00)", "rgba(6,8,12,0.08)", "rgba(6,8,12,0.24)", "rgba(6,8,12,0.42)"]}
                locations={[0, 0.34, 0.7, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.bottomVeil}
            />
            <View pointerEvents="none" style={styles.film} />
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: theme.colors.appBgSolid,
    },
    budA: {
        position: "absolute",
        right: -60,
        top: 92,
        width: 260,
        height: 260,
        opacity: 0.09,
        transform: [{ rotate: "-8deg" }],
    },
    budB: {
        position: "absolute",
        left: -70,
        bottom: 36,
        width: 300,
        height: 300,
        opacity: 0.07,
        transform: [{ rotate: "10deg" }],
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
    film: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(4,6,10,0.12)",
    },
    content: {
        flex: 1,
        backgroundColor: "transparent",
    },
});
