// lib/typography.ts
import { TextStyle } from "react-native";
import { theme } from "./theme"; // ONLY if your theme file is actually lib/theme.ts (not .tsx)

export const typography = {
    screenTitle: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "700",
        color: theme.colors.textOnDark,
    } satisfies TextStyle,

    heading: {
        fontSize: 18,
        lineHeight: 24,
        fontWeight: "700",
        color: theme.colors.textOnDark,
    } satisfies TextStyle,

    sectionLabel: {
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.9,
        textTransform: "uppercase",
        fontWeight: "700",
        color: theme.colors.textOnDarkSecondary,
    } satisfies TextStyle,

    cardTitle: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "700",
        color: theme.colors.textOnDark,
    } satisfies TextStyle,

    body: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "400",
        color: theme.colors.textOnDark,
    } satisfies TextStyle,

    secondary: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "400",
        color: theme.colors.textOnDarkSecondary,
    } satisfies TextStyle,

    button: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "700",
        color: theme.colors.textOnDark,
    } satisfies TextStyle,

    chip: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "700",
        color: theme.colors.textOnDark,
    } satisfies TextStyle,

    danger: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "700",
        color: theme.colors.danger,
    } satisfies TextStyle,

} as const;
