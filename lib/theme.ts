// lib/theme.ts
import { Platform } from "react-native";

export const theme = {
    colors: {
        // Backgrounds
        appBgTop: "#1B2230",
        appBgBottom: "#07080B",
        appBgSolid: "#0A0B0F",

        // Surfaces
        card: "#F6F7F8",
        cardAlt: "#F2F3F5",

        // Text on dark backgrounds
        textOnDark: "#F4F5F7",
        textOnDarkSecondary: "#B9BCC5",
        textOnDarkMuted: "#808493",

        // Text on light surfaces
        textOnLight: "#0F1115",
        textOnLightSecondary: "#424652",
        textOnLightMuted: "#6B7280",

        // UI
        dividerOnDark: "rgba(255,255,255,0.10)",
        dividerOnLight: "rgba(15,17,21,0.10)",
        iconMuted: "#8C909D",

        // Gold button
        primaryGold: "rgba(212, 175, 55, 1)",          // rich gold
        primaryGoldPressed: "rgba(190, 155, 45, 1)",   // pressed
        primaryGoldText: "rgba(20, 18, 12, 1)",        // dark text for contrast

        // Subtle gold glass for secondary
        goldGlass: "rgba(212, 175, 55, 0.14)",
        goldGlassBorder: "rgba(212, 175, 55, 0.28)",


        // Buttons
        buttonBg: "#1B1E26",
        buttonBgPressed: "#14171E",
        buttonBorder: "rgba(255,255,255,0.14)",
        buttonText: "#F4F5F7",

        // Accent
        accent: "#D6C2A3",

        // Bud rating tones
        budFilled: "rgba(120, 190, 140, 1)",
        budEmpty: "rgba(255,255,255,0.22)",
    },

    spacing: {
        xs: 6,
        sm: 10,
        md: 14,
        lg: 18,
        xl: 24,
        xxl: 32,
    },

    radius: {
        sm: 10,
        md: 14,
        lg: 18,
    },

    typography: {
        title: { fontSize: 26, fontWeight: "800" as const, letterSpacing: 0.2 },
        subtitle: { fontSize: 15, fontWeight: "600" as const },
        body: { fontSize: 15, fontWeight: "500" as const },
        caption: { fontSize: 13, fontWeight: "500" as const },
    },

    shadow: {
        card: Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOpacity: 0.32,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 16 },
            },
            android: { elevation: 9 },
            default: {},
        }),
        button: Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOpacity: 0.28,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 4 },
            default: {},
        }),
    },
} as const;

export type Theme = typeof theme;
