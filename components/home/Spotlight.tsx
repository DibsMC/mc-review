import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function Spotlight() {
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient
                colors={[
                    "rgba(160, 220, 220, 0.14)",
                    "rgba(120, 180, 200, 0.08)",
                    "rgba(0,0,0,0)",
                ]}
                locations={[0, 0.42, 1]}
                style={styles.gradient}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: {
        position: "absolute",
        top: -140,
        left: -120,
        right: -120,
        height: 460,
        borderRadius: 460,
    },
});
