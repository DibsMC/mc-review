import { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";

export default function AppBackground({ children }: { children: ReactNode }) {
    return (
        <View style={styles.root}>
            <LinearGradient
                colors={[theme.colors.appBgTop, theme.colors.appBgBottom]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: theme.colors.appBgSolid,
    },
    content: {
        flex: 1,
        backgroundColor: "transparent",
    },
});
