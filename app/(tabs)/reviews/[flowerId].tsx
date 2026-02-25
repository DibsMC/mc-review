// app/(tabs)/reviews/[flowerId].tsx
// Product detail screen (reviews + write/edit/report/helpful)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { theme } from "../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";
import { buildCommunityNotesSummary } from "../../../lib/communityNotes";

const budImg = require("../../../assets/icons/bud.png");
const flowersBg = require("../../../assets/images/flowers-bg.png");

type Product = {
    id: string;
    name: string;
    maker: string;
    variant?: string | null;
    strainType?: "sativa" | "indica" | "hybrid" | null;
    type: string;
    thcPct?: number | null;
    cbdPct?: number | null;
    terpenes?: string | null;
};

type Review = {
    id: string;
    productId: string;
    userId: string;
    authorDeleted?: boolean | null;

    rating: number;
    score?: number | null;

    text?: string | null;
    createdAt?: FirebaseFirestoreTypes.Timestamp | number | null;
    updatedAt?: FirebaseFirestoreTypes.Timestamp | number | null;

    helpfulCount?: number | null;
    reportCount?: number | null;
    moderationStatus?: "active" | "under_review" | "removed_auto" | "removed_admin" | null;

    sleepy?: number | null;
    calm?: number | null;
    daytime?: number | null;
    clarity?: number | null;
    uplifting?: number | null;
    focusAdhd?: number | null;
    anxiety?: number | null;
    moodBalance?: number | null;
    appetite?: number | null;
    femaleHealth?: number | null;
    muscleRelaxation?: number | null;
    creativity?: number | null;
    painRelief?: number | null;

    backPain?: number | null;
    jointPain?: number | null;
    legPain?: number | null;
    headacheRelief?: number | null;
    racingThoughts?: number | null;
};

type UserProfile = {
    displayName?: string | null;
    isAdmin?: boolean | null;
    favoriteProductIds?: string[] | null;
    reviewRestrictionLevel?: number | null;
    reviewRestrictionUntilMs?: number | null;
    reviewRestrictionManual?: boolean | null;
    lastEscalationRemovedTotal?: number | null;
    reviewGuideAcceptedAtMs?: number | null;
    reviewGuideAcceptedVersion?: number | null;
};

type FavoriteSlot = "general" | "daytime" | "afternoon" | "night";
type FavoriteSlots = Record<FavoriteSlot, boolean>;

const EMPTY_SLOTS: FavoriteSlots = {
    general: false,
    daytime: false,
    afternoon: false,
    night: false,
};

const FAVORITE_SLOT_META: Array<{ key: FavoriteSlot; label: string; icon: string; color: string }> = [
    { key: "general", label: "Favourite", icon: "★", color: "rgba(201,88,108,0.98)" },
    { key: "daytime", label: "Daytime", icon: "☀", color: "rgba(229,189,72,0.98)" },
    { key: "afternoon", label: "Afternoon", icon: "◔", color: "rgba(231,152,85,0.98)" },
    { key: "night", label: "Night", icon: "☾", color: "rgba(122,155,255,0.98)" },
];

function normalizeFavoriteSlots(raw: any): FavoriteSlots {
    if (!raw || typeof raw !== "object") return { ...EMPTY_SLOTS };
    return {
        general: !!raw.general,
        daytime: !!raw.daytime,
        afternoon: !!raw.afternoon,
        night: !!raw.night,
    };
}

function hasAnyFavoriteSlot(slots: FavoriteSlots) {
    return slots.general || slots.daytime || slots.afternoon || slots.night;
}

type SortMode = "recent" | "high" | "low";

type EffectKey =
    | "daytime"
    | "sleepy"
    | "calm"
    | "clarity"
    | "uplifting"
    | "focusAdhd"
    | "anxiety"
    | "moodBalance"
    | "appetite"
    | "femaleHealth"
    | "muscleRelaxation"
    | "creativity"
    | "painRelief"
    | "backPain"
    | "jointPain"
    | "legPain"
    | "headacheRelief"
    | "racingThoughts";

type ReviewDraft = {
    rating: number;
    text: string;
    daytime: number | null;
    sleepy: number | null;
    calm: number | null;
    clarity: number | null;
    uplifting: number | null;
    focusAdhd: number | null;
    anxiety: number | null;
    moodBalance: number | null;
    appetite: number | null;
    femaleHealth: number | null;
    muscleRelaxation: number | null;
    creativity: number | null;
    painRelief: number | null;
    backPain: number | null;
    jointPain: number | null;
    legPain: number | null;
    headacheRelief: number | null;
    racingThoughts: number | null;
};

const EFFECT_FIELDS: Array<{ key: EffectKey; label: string; chipLabel?: string }> = [
    { key: "daytime", label: "Daytime suitability", chipLabel: "Daytime" },
    { key: "sleepy", label: "Couch lock / sleepiness", chipLabel: "Couch lock" },
    { key: "calm", label: "Calm", chipLabel: "Calm" },
    { key: "uplifting", label: "Uplifting", chipLabel: "Uplifting" },
    { key: "focusAdhd", label: "Focus / ADHD", chipLabel: "Focus" },
    { key: "anxiety", label: "Anxiety relief", chipLabel: "Anxiety" },
    { key: "moodBalance", label: "Mood balance", chipLabel: "Mood" },
    { key: "appetite", label: "Munchies", chipLabel: "Munchies" },
    { key: "femaleHealth", label: "Female health support", chipLabel: "Female health" },
    { key: "muscleRelaxation", label: "Muscle relaxation", chipLabel: "Muscle relief" },
    { key: "creativity", label: "Creativity", chipLabel: "Creative" },
    { key: "painRelief", label: "Pain relief", chipLabel: "Pain relief" },
    { key: "clarity", label: "Mental clarity", chipLabel: "Clarity" },
    { key: "backPain", label: "Back pain relief", chipLabel: "Back pain" },
    { key: "jointPain", label: "Joint pain relief", chipLabel: "Joint pain" },
    { key: "legPain", label: "Leg pain relief", chipLabel: "Leg pain" },
    { key: "headacheRelief", label: "Headache relief", chipLabel: "Headache" },
    { key: "racingThoughts", label: "Racing thoughts relief", chipLabel: "Racing thoughts" },
];

const EFFECT_HINTS: Record<EffectKey, string> = {
    daytime: "How usable this felt in daytime settings. 5 = very daytime-friendly.",
    sleepy: "How sedating/couch-lock this felt. 5 = very sleepy and heavy.",
    calm: "How much this settled stress and tension. 5 = deeply calming.",
    uplifting: "How much this lifted mood and energy. 5 = strongly uplifting.",
    focusAdhd: "How much this helped concentration and task follow-through. 5 = strong focus support.",
    anxiety: "How much this reduced anxiety or panic. 5 = major anxiety relief.",
    moodBalance: "How much this kept mood steady and even. 5 = very balanced mood.",
    appetite: "How much this increased appetite/munchies. 5 = very strong munchies.",
    femaleHealth: "How much this helped female-health symptoms. 5 = very strong support.",
    muscleRelaxation: "How much this eased body tension/stiffness. 5 = very strong muscle relaxation.",
    creativity: "How much this helped creative flow. 5 = strong creative boost.",
    painRelief: "Overall pain relief from this strain. 5 = strongest relief.",
    clarity: "How clear-headed this felt (low fog/confusion). 5 = very clear.",
    backPain: "Back pain relief specifically. 5 = strongest back pain relief.",
    jointPain: "Joint pain relief specifically. 5 = strongest joint pain relief.",
    legPain: "Leg pain relief specifically. 5 = strongest leg pain relief.",
    headacheRelief: "Headache relief specifically. 5 = strongest headache relief.",
    racingThoughts: "How much this reduced racing thoughts. 5 = strongest relief.",
};

function safeName(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : "";
}

function formatPct(n: number | null | undefined) {
    if (n === null || n === undefined) return "-";
    return `${n}%`;
}

function normalizeStrainType(v: any): "sativa" | "indica" | "hybrid" | "unknown" {
    if (v === null || v === undefined) return "unknown";

    const s = String(v).toLowerCase().trim();
    if (!s) return "unknown";
    if (s.includes("sativa")) return "sativa";
    if (s.includes("indica")) return "indica";
    if (s.includes("hybrid")) return "hybrid";
    if (s.includes("dominant") && (s.includes("sat") || s.includes("sativa"))) return "sativa";
    if (s.includes("dominant") && (s.includes("ind") || s.includes("indica"))) return "indica";
    if (s.startsWith("sat") || s === "s") return "sativa";
    if (s.startsWith("ind") || s === "i") return "indica";
    if (s.startsWith("hyb") || s === "h") return "hybrid";
    return "unknown";
}

function formatStrainType(v: any): string | null {
    const norm = normalizeStrainType(v);
    if (norm === "unknown") return null;
    return norm.charAt(0).toUpperCase() + norm.slice(1);
}

function round1(n: number) {
    const x = Number.isFinite(n) ? n : 0;
    return Math.round(x * 10) / 10;
}

function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
}

function avgNumbers(vals: Array<number | null | undefined>) {
    const xs = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (xs.length === 0) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function avgEffects(vals: Array<number | null | undefined>) {
    const xs = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5);
    if (xs.length === 0) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function getCreatedAtMs(r: Review) {
    const c = r.createdAt;
    if (!c) return 0;
    if (typeof c === "number") return c;
    if (typeof (c as any)?.toMillis === "function") return (c as any).toMillis();
    if (typeof (c as any)?.seconds === "number") return (c as any).seconds * 1000;
    return 0;
}

function getStructuredEffectValues(r: Partial<Review>) {
    return [
        r.daytime,
        r.sleepy,
        r.calm,
        r.clarity,
        r.uplifting,
        r.focusAdhd,
        r.anxiety,
        r.moodBalance,
        r.appetite,
        r.femaleHealth,
        r.muscleRelaxation,
        r.creativity,
        r.painRelief,
        r.backPain,
        r.jointPain,
        r.legPain,
        r.headacheRelief,
        r.racingThoughts,
    ];
}

function getFriendlyReviewError(error: any, action: "save" | "delete" | "helpful" | "report" | "favourite") {
    const code = typeof error?.code === "string" ? error.code : "";

    if (code.includes("network-request-failed") || code.includes("unavailable")) {
        return "No internet connection right now. Please try again when you're back online.";
    }
    if (code.includes("permission-denied")) {
        return "You don't have permission to do that action.";
    }
    if (code.includes("unauthenticated")) {
        return "Your session has expired. Please sign in again.";
    }
    if (code.includes("resource-exhausted") || code.includes("too-many-requests")) {
        return "Too many requests in a short time. Please wait a moment and try again.";
    }

    if (action === "save") return "We couldn't save your review. Please try again.";
    if (action === "delete") return "We couldn't delete that review. Please try again.";
    if (action === "helpful") return "We couldn't update your helpful vote. Please try again.";
    if (action === "report") return "We couldn't submit your report. Please try again.";
    if (action === "favourite") return "We couldn't update favourites right now. Please try again.";

    return typeof error?.message === "string" && error.message.trim() ? error.message : "Something went wrong. Please try again.";
}

/* -------------------- Robust scoring -------------------- */

function computeRobustProductScore(params: { ratings: number[]; effectsMeans: number[]; globalMeanRating: number }) {
    const { ratings, effectsMeans, globalMeanRating } = params;

    const v = ratings.length;
    if (v === 0) return 0;

    const R = avgNumbers(ratings);
    const C = Number.isFinite(globalMeanRating) && globalMeanRating > 0 ? globalMeanRating : 3.5;

    const m = 8;
    const bayes = (v / (v + m)) * R + (m / (v + m)) * C;

    const E = effectsMeans.length ? avgNumbers(effectsMeans) : 0;
    const hasEffects = effectsMeans.length > 0;
    const eDelta = hasEffects ? clamp((E - 3) / 2, -1, 1) : 0;

    const effectsBoost = eDelta * 0.25;

    const highCount = effectsMeans.filter((x) => x >= 4.5).length;
    const superPenalty = clamp(highCount >= 4 ? 0.08 * (highCount - 3) : 0, 0, 0.25);

    return round1(clamp(bayes + effectsBoost - superPenalty, 1, 5));
}

function computeRobustReviewScore(input: { rating: number; effectsMean: number | null; highEffectsCount: number }) {
    const rating = Number.isFinite(input.rating) ? input.rating : 0;
    if (!input.effectsMean) return round1(clamp(rating, 1, 5));

    const eDelta = clamp((input.effectsMean - 3) / 2, -1, 1);
    const effectsBoost = eDelta * 0.25;

    const superPenalty = clamp(input.highEffectsCount >= 4 ? 0.06 * (input.highEffectsCount - 3) : 0, 0, 0.18);

    return round1(clamp(rating + effectsBoost - superPenalty, 1, 5));
}

/* -------------------- Terpenes parsing -------------------- */

function prettyTerpeneName(raw: string) {
    const s = raw.trim().replace(/_/g, " ").replace(/-/g, " ");
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function parseTerpenes(input: string | null | undefined) {
    if (!input) return [];
    return input
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const [nameRaw, strengthRaw] = part.split(":").map((x) => (x ?? "").trim());
            const name = prettyTerpeneName(nameRaw);
            const strength = strengthRaw ? strengthRaw.toLowerCase() : "";
            return { name, strength };
        })
        .filter((t) => t.name);
}

/* -------------------- BudRating display -------------------- */

function BudRating({ value, size = 18 }: { value: number; size?: number }) {
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
    const SCALE = 1.1;

    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const rawFill = Math.max(0, Math.min(1, safe - i));
                const fill = Math.round(rawFill * 4) / 4;
                const px = Math.round(size * fill);

                return (
                    <View key={`bud-${i}`} style={{ width: size, height: size, position: "relative", marginRight: i === 4 ? 0 : 6 }}>
                        <Image source={budImg} resizeMode="contain" style={{ width: size, height: size, opacity: 0.22 }} />
                        {fill > 0 ? (
                            <View style={{ position: "absolute", left: 0, top: 0, width: px, height: size, overflow: "hidden" }}>
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: "absolute",
                                        left: -4,
                                        top: -4,
                                        width: size + 8,
                                        height: size + 8,
                                        borderRadius: 999,
                                        shadowColor: "rgba(130,255,210,0.9)",
                                        shadowOpacity: 1,
                                        shadowRadius: 8,
                                        shadowOffset: { width: 0, height: 0 },
                                        elevation: 6,
                                        opacity: 0.85,
                                    }}
                                />
                                <Image source={budImg} resizeMode="contain" style={{ width: size, height: size, opacity: 1, transform: [{ scale: SCALE }] }} />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

/* -------------------- Bud selector (for write/edit modal) -------------------- */

function BudSelectRow({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
    const safe = typeof value === "number" ? clamp(Math.round(value), 1, 5) : null;

    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => {
                const selected = safe !== null && safe === n;
                return (
                    <Pressable
                        key={`pick-${n}`}
                        onPress={() => onChange(n)}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: n === 5 ? 0 : 10,
                            borderWidth: 2,
                            borderColor: selected ? "rgba(212,175,55,0.95)" : "rgba(255,255,255,0.18)",
                            backgroundColor: selected ? "rgba(212,175,55,0.10)" : "rgba(0,0,0,0.10)",
                        }}
                    >
                        <Image source={budImg} resizeMode="contain" style={{ width: 22, height: 22, opacity: selected ? 1 : 0.55 }} />
                    </Pressable>
                );
            })}
        </View>
    );
}

/* ==================== STYLES ==================== */

const styles = StyleSheet.create({
    topUiFade: { position: "absolute", top: 0, left: 0, right: 0, height: 170 },
    bottomUiFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },

    backBtnWrap: { position: "absolute", left: 12, zIndex: 999, elevation: 999 },
    backBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
    },
    backChevron: { fontSize: 22, fontWeight: "900", color: "rgba(255,255,255,0.92)", includeFontPadding: false },

    sortPill: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.24)",
        backgroundColor: "rgba(255,255,255,0.16)",
    },
    reviewsHeadingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        marginTop: 2,
    },
    reviewsTitleCard: {
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    reviewsTitleInner: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    reviewsEyebrow: {
        color: "rgba(255,255,255,0.64)",
        fontWeight: "900",
        fontSize: 11,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    reviewsTitle: {
        fontSize: 34,
        fontWeight: "900",
        color: "rgba(255,255,255,0.94)",
        letterSpacing: -0.5,
        includeFontPadding: false,
    },
    reviewSearchWrap: {
        marginTop: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.10)",
        overflow: "hidden",
    },
    reviewSearchInput: {
        minHeight: 46,
        paddingHorizontal: 14,
        color: theme.colors.textOnDark,
        fontSize: 15,
        fontWeight: "700",
    },
    reviewSearchFooter: {
        paddingHorizontal: 12,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
    },
    reviewSearchMeta: {
        flex: 1,
        color: "rgba(255,255,255,0.70)",
        fontSize: 12,
        fontWeight: "700",
    },
    reviewSearchClearBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.20)",
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    reviewSearchClearText: {
        color: theme.colors.textOnDark,
        fontWeight: "900",
        fontSize: 12,
    },

    favPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        backgroundColor: "rgba(255,255,255,0.12)",
        alignSelf: "flex-start",
    },
    favPillActive: { borderColor: "rgba(185,70,95,0.45)", backgroundColor: "rgba(185,70,95,0.14)" },
    favStar: { fontSize: 18, lineHeight: 18, marginRight: 10, fontWeight: "900" },
    favStarOn: { color: "rgba(185,70,95,0.98)" },
    favStarOff: { color: "rgba(255,255,255,0.55)" },
    favText: { fontWeight: "900", includeFontPadding: false },
    favTextOn: { color: "rgba(255,255,255,0.92)" },
    favTextOff: { color: "rgba(255,255,255,0.78)" },

    reviewItem: {
        marginHorizontal: 16,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(7, 51, 96, 0.45)",
        overflow: "hidden",
    },

    actionsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },

    actionPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    actionPillActive: { borderColor: "rgba(212,175,55,0.42)", backgroundColor: "rgba(212, 175, 55, 0.18)" },
    actionPillDisabled: { opacity: 0.55 },
    actionPillText: { fontWeight: "900", fontSize: 13, color: theme.colors.textOnDark, includeFontPadding: false },

    countPill: {
        marginLeft: 8,
        minWidth: 24,
        height: 19,
        paddingHorizontal: 6,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.32)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    countPillText: { color: "rgba(255,255,255,0.90)", fontWeight: "900", fontSize: 11, includeFontPadding: false },

    dangerPill: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,120,120,0.42)",
        backgroundColor: "rgba(255,120,120,0.16)",
    },
    dangerPillText: { fontWeight: "900", fontSize: 13, color: "rgba(255,160,160,1)", includeFontPadding: false },

    adminPill: {
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    adminPillText: { fontWeight: "900", fontSize: 13, color: "rgba(255,255,255,0.78)", includeFontPadding: false },

    reportPill: {
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(237,171,87,0.34)",
        backgroundColor: "rgba(237,171,87,0.15)",
    },
    reportPillText: { fontWeight: "900", fontSize: 13, color: "rgba(255,226,189,0.96)", includeFontPadding: false },

    reviewCard: {
        marginTop: 18,
        padding: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(7, 51, 96, 0.45)",
        overflow: "hidden",
    },

    formBtn: {
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: "rgba(52,156,88,0.95)",
        borderWidth: 1,
        borderColor: "rgba(138,231,168,0.42)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnAlt: {
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnWarn: {
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(237,171,87,0.40)",
        backgroundColor: "rgba(237,171,87,0.22)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnText: { fontWeight: "900", fontSize: 15, letterSpacing: 0.2, textAlign: "center", color: "#fff", includeFontPadding: false },

    modalCard: {
        width: "100%",
        maxHeight: "86%",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(7, 51, 96, 0.90)",
        overflow: "hidden",
    },
    modalInner: { padding: 18 },

    input: {
        minHeight: 110,
        maxHeight: 220,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
        fontSize: 16,
        lineHeight: 22,
        backgroundColor: "rgba(0,0,0,0.22)",
        color: theme.colors.textOnDark,
    },

    reportSheetOuter: {
        backgroundColor: "rgba(20,22,28,0.94)",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        overflow: "hidden",
    },
    reportSheetInner: { padding: 18 },
    reportOption: {
        marginTop: 10,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 14,
        backgroundColor: "rgba(255,255,255,0.10)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
    },
    reportOptionOn: { backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.22)" },
    reportNote: {
        marginTop: 12,
        minHeight: 90,
        maxHeight: 160,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 15,
        lineHeight: 20,
        backgroundColor: "rgba(0,0,0,0.22)",
        color: theme.colors.textOnDark,
    },

    // Editor modal (new layout)
    editorModalRoot: { flex: 1, position: "relative", backgroundColor: "#0A0B0F" },
    editorBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0A0B0F" },
    editorSafe: { flex: 1, backgroundColor: "#0A0B0F" },
    editorKav: {
        flex: 1,
        backgroundColor: "#0A0B0F",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        overflow: "hidden",
    },
    editorHeader: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 14,
        flexDirection: "row",
        alignItems: "center",
    },
    editorTitle: { flex: 1, fontSize: 28, fontWeight: "900", color: theme.colors.textOnDark },
    editorCloseBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
    },
    editorCloseText: { color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 },
    editorDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.10)" },
    editorScroll: { flex: 1 },
    editorScrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
    editorHint: { color: theme.colors.textOnDarkSecondary, fontWeight: "900", marginBottom: 10 },
    editorSectionTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.textOnDark, marginTop: 6 },
    editorBigValue: { marginTop: 12, fontSize: 22, fontWeight: "900", color: theme.colors.textOnDark },
    effectBlock: {
        marginTop: 14,
        padding: 12,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    effectHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    effectLabel: { fontSize: 16, fontWeight: "900", color: theme.colors.textOnDark, flex: 1, paddingRight: 10 },
    effectValue: { fontSize: 18, fontWeight: "900", color: theme.colors.textOnDark },
    editorFooter: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(10,10,10,0.98)",
        flexDirection: "row",
        alignItems: "center",
    },
});

/* ==================== SCREEN ==================== */

export default function FlowerDetail() {
    const firestore = getFirebaseFirestore();
    const auth = getFirebaseAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    if (!firestore || !auth) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.appBgSolid }}>
                <ImageBackground source={flowersBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
                    <Text style={{ color: "white", fontSize: 18, fontWeight: "900", textAlign: "center" }}>
                        Product screen unavailable
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 8, textAlign: "center" }}>
                        Please close and reopen the app.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const { flowerId, productId: productIdParam } = useLocalSearchParams<{ flowerId?: string; productId?: string }>();
    const productId = typeof productIdParam === "string" ? productIdParam : typeof flowerId === "string" ? flowerId : "";

    const TOP_PAD = 72;
    // Avoid tab-context hook crashes by using a stable tab-bar height estimate.
    const estimatedTabBarHeight = 56;
    const bottomSpace = estimatedTabBarHeight + Math.max(insets.bottom, 12) + 24;

    const { height: windowH } = Dimensions.get("window");
    const bgShift = Math.round(windowH * 0.18);
    const bgScale = 1.12;

    const COOLDOWN_MS = 10_000;
    const REPORT_AUTO_REMOVE_THRESHOLD = 5;
    const RESTRICTION_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
    const FIRST_RESTRICTION_MS = 7 * 24 * 60 * 60 * 1000;
    const SECOND_RESTRICTION_MS = 14 * 24 * 60 * 60 * 1000;
    const REVIEW_GUIDE_VERSION = 1;
    const [cooldownUntil, setCooldownUntil] = useState<number>(0);
    const [nowTick, setNowTick] = useState(Date.now());
    const isCooldown = nowTick < cooldownUntil;

    const currentUser = auth().currentUser;
    const currentUid = currentUser?.uid ?? "";
    const meName = safeName(currentUser?.displayName) || "You";

    const [product, setProduct] = useState<Product | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});

    const [nameMap, setNameMap] = useState<Record<string, string>>({});

    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [sortOpen, setSortOpen] = useState(false);
    const [reviewSearchQuery, setReviewSearchQuery] = useState("");
    const sortBtnRef = useRef<View | null>(null);
    const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    const [submitting, setSubmitting] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
    const [reviewRestrictionLevel, setReviewRestrictionLevel] = useState(0);
    const [reviewRestrictionUntilMs, setReviewRestrictionUntilMs] = useState<number | null>(null);
    const [reviewRestrictionManual, setReviewRestrictionManual] = useState(false);
    const [reviewGuideAccepted, setReviewGuideAccepted] = useState(false);
    const [guideGateOpen, setGuideGateOpen] = useState(false);
    const [guideAcknowledgeChecked, setGuideAcknowledgeChecked] = useState(false);
    const [guideSaving, setGuideSaving] = useState(false);
    const [legacyFavoriteProductIds, setLegacyFavoriteProductIds] = useState<string[]>([]);
    const [favoriteSlots, setFavoriteSlots] = useState<FavoriteSlots>({ ...EMPTY_SLOTS });
    const [myHelpfulIds, setMyHelpfulIds] = useState<Set<string>>(new Set());
    const [myReportedIds, setMyReportedIds] = useState<Set<string>>(new Set());

    const [reportOpen, setReportOpen] = useState(false);
    const [reportingReview, setReportingReview] = useState<Review | null>(null);
    const [reportReason, setReportReason] = useState<"Spam" | "Offensive" | "Off-topic" | "Other" | "">("");
    const [reportNote, setReportNote] = useState<string>("");
    const [reportSubmitting, setReportSubmitting] = useState(false);

    // Write/Edit modal state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

    const emptyDraft: ReviewDraft = useMemo(
        () => ({
            rating: 3,
            text: "",
            daytime: null,
            sleepy: null,
            calm: null,
            clarity: null,
            uplifting: null,
            focusAdhd: null,
            anxiety: null,
            moodBalance: null,
            appetite: null,
            femaleHealth: null,
            muscleRelaxation: null,
            creativity: null,
            painRelief: null,
            backPain: null,
            jointPain: null,
            legPain: null,
            headacheRelief: null,
            racingThoughts: null,
        }),
        []
    );
    const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);

    useEffect(() => {
        // Always default each product screen to Most recent.
        setSortMode("recent");
        setSortOpen(false);
    }, [productId]);

    useEffect(() => {
        setExpandedReviewIds((prev) => {
            const keep = new Set(reviews.map((r) => r.id));
            let changed = false;
            const next: Record<string, boolean> = {};
            Object.entries(prev).forEach(([id, expanded]) => {
                if (!keep.has(id)) {
                    changed = true;
                    return;
                }
                next[id] = expanded;
            });
            return changed ? next : prev;
        });
    }, [reviews]);

    const sanitizeEffectScore = useCallback((v: unknown): number | null => {
        if (typeof v !== "number" || !Number.isFinite(v)) return null;
        return clamp(Math.round(v), 1, 5);
    }, []);

    const secondsLeft = useMemo(() => {
        if (!isCooldown) return 0;
        const msLeft = cooldownUntil - nowTick;
        return Math.max(1, Math.ceil(msLeft / 1000));
    }, [cooldownUntil, isCooldown, nowTick]);

    useEffect(() => {
        if (!isCooldown) return;
        const t = setInterval(() => setNowTick(Date.now()), 250);
        return () => clearInterval(t);
    }, [isCooldown]);

    const startCooldown = useCallback(() => {
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        setNowTick(Date.now());
    }, []);

    const getRestrictionMessage = useCallback((level: number, untilMs: number | null, manual: boolean) => {
        if (manual || level >= 3) {
            return "Posting is locked. Please contact support to restore review posting access.";
        }
        if (typeof untilMs === "number" && untilMs > Date.now()) {
            const hours = Math.max(1, Math.ceil((untilMs - Date.now()) / (60 * 60 * 1000)));
            return `Posting is temporarily restricted. Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
        }
        return null;
    }, []);

    const enforceRestrictionForUser = useCallback(
        async (uid: string) => {
            const now = Date.now();
            const userRef = firestore().collection("users").doc(uid);
            const reviewsSnap = await firestore().collection("reviews").where("userId", "==", uid).get();

            const removed = reviewsSnap.docs
                .map((d) => d.data() as any)
                .filter((r) => {
                    const status = typeof r?.moderationStatus === "string" ? r.moderationStatus : "active";
                    return status === "removed_auto" || status === "removed_admin";
                })
                .map((r) => (typeof r?.removedAtMs === "number" ? r.removedAtMs : 0))
                .filter((ms) => ms > 0);

            const totalRemoved = removed.length;
            const recentRemoved = removed.filter((ms) => ms >= now - RESTRICTION_WINDOW_MS).length;

            if (recentRemoved < 3) {
                return {
                    level: reviewRestrictionLevel,
                    untilMs: reviewRestrictionUntilMs,
                    manual: reviewRestrictionManual,
                };
            }

            const userDoc = await userRef.get();
            const userData = (userDoc.data() as UserProfile | undefined) ?? {};
            const currentLevel = typeof userData.reviewRestrictionLevel === "number" ? userData.reviewRestrictionLevel : 0;
            const currentUntil = typeof userData.reviewRestrictionUntilMs === "number" ? userData.reviewRestrictionUntilMs : null;
            const currentManual = !!userData.reviewRestrictionManual;
            const lastEscTotal = typeof userData.lastEscalationRemovedTotal === "number" ? userData.lastEscalationRemovedTotal : 0;

            if (totalRemoved <= lastEscTotal) {
                return { level: currentLevel, untilMs: currentUntil, manual: currentManual };
            }

            const nextLevel = currentLevel <= 0 ? 1 : currentLevel === 1 ? 2 : 3;
            const nextUntil = nextLevel === 1 ? now + FIRST_RESTRICTION_MS : nextLevel === 2 ? now + SECOND_RESTRICTION_MS : null;
            const nextManual = nextLevel >= 3;

            await userRef.set(
                {
                    reviewRestrictionLevel: nextLevel,
                    reviewRestrictionUntilMs: nextUntil,
                    reviewRestrictionManual: nextManual,
                    lastEscalationRemovedTotal: totalRemoved,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            setReviewRestrictionLevel(nextLevel);
            setReviewRestrictionUntilMs(nextUntil);
            setReviewRestrictionManual(nextManual);

            return { level: nextLevel, untilMs: nextUntil, manual: nextManual };
        },
        [
            firestore,
            reviewRestrictionLevel,
            reviewRestrictionManual,
            reviewRestrictionUntilMs,
            FIRST_RESTRICTION_MS,
            SECOND_RESTRICTION_MS,
            RESTRICTION_WINDOW_MS,
        ]
    );

    // Back button
    const handleBack = useCallback(() => {
        Keyboard.dismiss();
        setSortOpen(false);
        setReportOpen(false);
        setReportingReview(null);
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace("/(tabs)/reviews");
    }, [router]);

    // User profile listener (admin + favourites)
    useEffect(() => {
        if (!currentUid) {
            setIsAdmin(false);
            setReviewRestrictionLevel(0);
            setReviewRestrictionUntilMs(null);
            setReviewRestrictionManual(false);
            setReviewGuideAccepted(false);
            setGuideGateOpen(false);
            setGuideAcknowledgeChecked(false);
            setLegacyFavoriteProductIds([]);
            setFavoriteSlots({ ...EMPTY_SLOTS });
            return;
        }

        const unsubUser = firestore()
            .collection("users")
            .doc(currentUid)
            .onSnapshot(
                (doc) => {
                    const data = (doc.data() as UserProfile) ?? {};
                    setIsAdmin(!!data?.isAdmin);
                    setReviewRestrictionLevel(typeof data?.reviewRestrictionLevel === "number" ? data.reviewRestrictionLevel : 0);
                    setReviewRestrictionUntilMs(typeof data?.reviewRestrictionUntilMs === "number" ? data.reviewRestrictionUntilMs : null);
                    setReviewRestrictionManual(!!data?.reviewRestrictionManual);
                    setReviewGuideAccepted(
                        !!data?.reviewGuideAcceptedAtMs ||
                        (typeof data?.reviewGuideAcceptedVersion === "number" && data.reviewGuideAcceptedVersion >= REVIEW_GUIDE_VERSION)
                    );

                    const favs = Array.isArray(data?.favoriteProductIds)
                        ? (data.favoriteProductIds as any[]).filter((x) => typeof x === "string")
                        : [];
                    setLegacyFavoriteProductIds(favs as string[]);
                },
                () => {
                    setIsAdmin(false);
                    setReviewRestrictionLevel(0);
                    setReviewRestrictionUntilMs(null);
                    setReviewRestrictionManual(false);
                    setReviewGuideAccepted(false);
                    setLegacyFavoriteProductIds([]);
                }
            );

        const unsubFavoriteDoc = firestore()
            .collection("users")
            .doc(currentUid)
            .collection("favorites")
            .doc(productId)
            .onSnapshot(
                (doc) => {
                    const data = (doc.data() as any) ?? null;
                    setFavoriteSlots(normalizeFavoriteSlots(data?.slots));
                },
                () => setFavoriteSlots({ ...EMPTY_SLOTS })
            );

        return () => {
            unsubUser();
            unsubFavoriteDoc();
        };
    }, [REVIEW_GUIDE_VERSION, currentUid, productId]);

    useEffect(() => {
        if (!productId) return;
        if (!legacyFavoriteProductIds.includes(productId)) return;
        setFavoriteSlots((prev) => (prev.general ? prev : { ...prev, general: true }));
    }, [legacyFavoriteProductIds, productId]);

    // Helpful votes listener
    useEffect(() => {
        if (!currentUid) {
            setMyHelpfulIds(new Set());
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(currentUid)
            .collection("helpful")
            .onSnapshot(
                (snap) => {
                    const next = new Set<string>();
                    snap.docs.forEach((d) => next.add(d.id));
                    setMyHelpfulIds(next);
                },
                (err) => {
                    console.log("my helpful listener error:", err);
                    setMyHelpfulIds(new Set());
                }
            );

        return () => unsub();
    }, [currentUid]);

    // Reported reviews listener
    useEffect(() => {
        if (!currentUid) {
            setMyReportedIds(new Set());
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(currentUid)
            .collection("reportedReviews")
            .onSnapshot(
                (snap) => {
                    const next = new Set<string>();
                    snap.docs.forEach((d) => next.add(d.id));
                    setMyReportedIds(next);
                },
                (err) => {
                    console.log("my reported listener error:", err);
                    setMyReportedIds(new Set());
                }
            );

        return () => unsub();
    }, [currentUid]);

    const toggleFavoriteSlot = useCallback(async (slot: FavoriteSlot) => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in to use favourites.");
            return;
        }
        if (!productId) return;

        const userRef = firestore().collection("users").doc(user.uid);
        const favoriteRef = userRef.collection("favorites").doc(productId);

        try {
            const nextSlots: FavoriteSlots = { ...favoriteSlots, [slot]: !favoriteSlots[slot] };
            const anySelected = hasAnyFavoriteSlot(nextSlots);

            if (anySelected) {
                // Overwrite document shape so legacy keys cannot cause rule rejections.
                await favoriteRef.set({
                    productId,
                    slots: nextSlots,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
                await userRef.set({ favoriteProductIds: firestore.FieldValue.arrayUnion(productId) }, { merge: true });
            } else {
                await favoriteRef.delete();
                await userRef.set({ favoriteProductIds: firestore.FieldValue.arrayRemove(productId) }, { merge: true });
            }
        } catch (e: any) {
            console.log("toggleFavorite error:", e);
            Alert.alert("Could not update favourite", getFriendlyReviewError(e, "favourite"));
        }
    }, [favoriteSlots, productId]);

    // Product listener
    useEffect(() => {
        if (!productId) return;

        setLoadingProduct(true);
        const unsub = firestore()
            .collection("products")
            .doc(productId)
            .onSnapshot(
                (doc) => {
                    if (!doc.exists) {
                        setProduct(null);
                        setLoadingProduct(false);
                        return;
                    }

                    const data = doc.data() as any;
                    const rawStrain =
                        data?.strainType ??
                        data?.strain ??
                        data?.dominance ??
                        data?.genetics ??
                        data?.type ??
                        data?.productType ??
                        null;
                    const normStrain = normalizeStrainType(rawStrain);
                    setProduct({
                        id: doc.id,
                        name: typeof data?.name === "string" ? data.name : "",
                        maker: typeof data?.maker === "string" ? data.maker : "",
                        variant: data?.variant ?? null,
                        strainType: normStrain === "unknown" ? null : normStrain,
                        type: typeof data?.type === "string" ? data.type : "flower",
                        thcPct: typeof data?.thcPct === "number" ? data.thcPct : null,
                        cbdPct: typeof data?.cbdPct === "number" ? data.cbdPct : null,
                        terpenes: typeof data?.terpenes === "string" ? data.terpenes : null,
                    });
                    setLoadingProduct(false);
                },
                (err) => {
                    console.log("product load error:", err);
                    setProduct(null);
                    setLoadingProduct(false);
                }
            );

        return () => unsub();
    }, [productId]);

    // Reviews listener
    useEffect(() => {
        if (!productId) return;

        setLoadingReviews(true);
        const unsub = firestore()
            .collection("reviews")
            .where("productId", "==", productId)
            .orderBy("createdAt", "desc")
            .onSnapshot(
                (snapshot) => {
                    const list: Review[] = snapshot.docs.map((d) => {
                        const data = d.data() as any;

                        const ratingFromDb = typeof data.rating === "number" ? data.rating : 0;
                        const helpfulCountRaw = typeof data.helpfulCount === "number" ? data.helpfulCount : 0;
                        const helpfulCount = Number.isFinite(helpfulCountRaw) ? helpfulCountRaw : 0;

                        return {
                            id: d.id,
                            productId: typeof data.productId === "string" ? data.productId : "",
                            userId: typeof data.userId === "string" ? data.userId : "",
                            authorDeleted: !!data.authorDeleted,
                            rating: ratingFromDb,
                            score: typeof data.score === "number" ? data.score : null,
                            text: typeof data.text === "string" ? data.text : null,
                            createdAt: (data.createdAt ?? null) as any,
                            updatedAt: (data.updatedAt ?? null) as any,

                            helpfulCount,
                            reportCount: typeof data.reportCount === "number" ? data.reportCount : 0,
                            moderationStatus: typeof data.moderationStatus === "string" ? data.moderationStatus : "active",

                            sleepy: typeof data.sleepy === "number" ? data.sleepy : null,
                            calm: typeof data.calm === "number" ? data.calm : null,
                            daytime: typeof data.daytime === "number" ? data.daytime : null,
                            clarity: typeof data.clarity === "number" ? data.clarity : null,
                            uplifting: typeof data.uplifting === "number" ? data.uplifting : null,
                            focusAdhd: typeof data.focusAdhd === "number" ? data.focusAdhd : null,
                            anxiety: typeof data.anxiety === "number" ? data.anxiety : null,
                            moodBalance: typeof data.moodBalance === "number" ? data.moodBalance : null,
                            appetite: typeof data.appetite === "number" ? data.appetite : null,
                            femaleHealth: typeof data.femaleHealth === "number" ? data.femaleHealth : null,
                            muscleRelaxation: typeof data.muscleRelaxation === "number" ? data.muscleRelaxation : null,
                            creativity: typeof data.creativity === "number" ? data.creativity : null,
                            painRelief: typeof data.painRelief === "number" ? data.painRelief : null,

                            backPain: typeof data.backPain === "number" ? data.backPain : null,
                            jointPain: typeof data.jointPain === "number" ? data.jointPain : null,
                            legPain: typeof data.legPain === "number" ? data.legPain : null,
                            headacheRelief: typeof data.headacheRelief === "number" ? data.headacheRelief : null,
                            racingThoughts: typeof data.racingThoughts === "number" ? data.racingThoughts : null,
                        };
                    });

                    setReviews(list);
                    setLoadingReviews(false);
                },
                (err) => {
                    console.log("reviews load error:", err);
                    setLoadingReviews(false);
                }
            );

        return () => unsub();
    }, [productId]);

    // Load display names for review authors
    useEffect(() => {
        const uids = Array.from(new Set(reviews.map((r) => r.userId).filter((x): x is string => typeof x === "string" && !!x)));
        if (uids.length === 0) return;

        const chunks: string[][] = [];
        for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));

        const unsubs: Array<() => void> = [];

        chunks.forEach((chunk) => {
            const q = firestore().collection("users").where(firestore.FieldPath.documentId(), "in", chunk);

            const unsub = q.onSnapshot(
                (snap) => {
                    const updates: Record<string, string> = {};
                    snap.docs.forEach((doc) => {
                        const data = doc.data() as UserProfile;
                        const dnRaw = safeName(data?.displayName);
                        const dn = dnRaw && dnRaw.toLowerCase() !== "info" ? dnRaw : "";
                        updates[doc.id] = dn;
                    });
                    setNameMap((prev) => ({ ...prev, ...updates }));
                },
                (err) => {
                    console.log("user name listener error:", err);
                }
            );

            unsubs.push(unsub);
        });

        return () => {
            unsubs.forEach((fn) => fn());
        };
    }, [reviews]);

    const displayNameForUid = useCallback(
        (uid: string) => {
            if (!uid) return "Member";
            if (uid === currentUid) return `${meName} (you)`;
            const mapped = safeName(nameMap[uid]);
            return mapped ? mapped : "Member";
        },
        [currentUid, meName, nameMap]
    );

    const globalMeanRating = 3.6;

    const ratingsList = useMemo(() => {
        return reviews.map((r) => r.rating).filter((x) => typeof x === "number" && Number.isFinite(x) && x >= 1 && x <= 5);
    }, [reviews]);

    const perReviewEffectsMean = useMemo(() => {
        return reviews.map((r) => avgEffects(getStructuredEffectValues(r)));
    }, [reviews]);

    const effectsMeansForProduct = useMemo(() => {
        return perReviewEffectsMean.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    }, [perReviewEffectsMean]);

    const robustProductScore = useMemo(() => {
        if (ratingsList.length === 0) return 0;
        return computeRobustProductScore({
            ratings: ratingsList,
            effectsMeans: effectsMeansForProduct,
            globalMeanRating,
        });
    }, [effectsMeansForProduct, ratingsList]);

    const effectsSummary = useMemo(() => {
        const sleepyAvg = avgNumbers(reviews.map((r) => r.sleepy));
        const calmAvg = avgNumbers(reviews.map((r) => r.calm));
        const daytimeAvg = avgNumbers(reviews.map((r) => r.daytime));
        const clarityAvg = avgNumbers(reviews.map((r) => r.clarity));
        const upliftingAvg = avgNumbers(reviews.map((r) => r.uplifting));
        const focusAdhdAvg = avgNumbers(reviews.map((r) => r.focusAdhd));
        const anxietyAvg = avgNumbers(reviews.map((r) => r.anxiety));
        const moodBalanceAvg = avgNumbers(reviews.map((r) => r.moodBalance));
        const appetiteAvg = avgNumbers(reviews.map((r) => r.appetite));
        const femaleHealthAvg = avgNumbers(reviews.map((r) => r.femaleHealth));
        const muscleRelaxationAvg = avgNumbers(reviews.map((r) => r.muscleRelaxation));
        const creativityAvg = avgNumbers(reviews.map((r) => r.creativity));
        const painReliefAvg = avgNumbers(reviews.map((r) => r.painRelief));

        const backPainAvg = avgNumbers(reviews.map((r) => r.backPain));
        const jointPainAvg = avgNumbers(reviews.map((r) => r.jointPain));
        const legPainAvg = avgNumbers(reviews.map((r) => r.legPain));
        const headacheReliefAvg = avgNumbers(reviews.map((r) => r.headacheRelief));
        const racingThoughtsAvg = avgNumbers(reviews.map((r) => r.racingThoughts));

        const withAnySub = reviews.filter((r) =>
            getStructuredEffectValues(r).some((v) => typeof v === "number" && v >= 1 && v <= 5)
        ).length;

        return {
            sleepyAvg,
            calmAvg,
            daytimeAvg,
            clarityAvg,
            upliftingAvg,
            focusAdhdAvg,
            anxietyAvg,
            moodBalanceAvg,
            appetiteAvg,
            femaleHealthAvg,
            muscleRelaxationAvg,
            creativityAvg,
            painReliefAvg,
            backPainAvg,
            jointPainAvg,
            legPainAvg,
            headacheReliefAvg,
            racingThoughtsAvg,
            withAnySub,
        };
    }, [reviews]);

    const getReviewScore = useCallback((r: Review) => {
        if (typeof r.score === "number" && Number.isFinite(r.score)) return r.score;

        const effectsMean = avgEffects(getStructuredEffectValues(r));

        const effectVals = getStructuredEffectValues(r).filter(
            (v): v is number => typeof v === "number" && v >= 1 && v <= 5
        );

        const highEffectsCount = effectVals.filter((v) => v >= 4.5).length;

        return computeRobustReviewScore({
            rating: r.rating,
            effectsMean,
            highEffectsCount,
        });
    }, []);

    const sortedReviews = useMemo(() => {
        const visible = reviews.filter((r) => {
            if (myReportedIds.has(r.id)) return false;
            if (isAdmin) return true;
            const status = typeof r.moderationStatus === "string" ? r.moderationStatus : "active";
            return status === "active";
        });
        const list = [...visible];

        if (sortMode === "recent") return list.sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));

        if (sortMode === "high") {
            return list.sort((a, b) => {
                const d = getReviewScore(b) - getReviewScore(a);
                if (d !== 0) return d;
                return getCreatedAtMs(b) - getCreatedAtMs(a);
            });
        }

        return list.sort((a, b) => {
            const d = getReviewScore(a) - getReviewScore(b);
            if (d !== 0) return d;
            return getCreatedAtMs(b) - getCreatedAtMs(a);
        });
    }, [reviews, sortMode, myReportedIds, isAdmin, getReviewScore]);

    const reviewSearchTokens = useMemo(() => {
        const raw = reviewSearchQuery.trim().toLowerCase();
        if (!raw) return [];
        return raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    }, [reviewSearchQuery]);

    const filteredSortedReviews = useMemo(() => {
        if (reviewSearchTokens.length === 0) return sortedReviews;

        return sortedReviews.filter((r) => {
            const author = displayNameForUid(r.userId).replace(/\(you\)/gi, "").trim().toLowerCase();
            const text = (typeof r.text === "string" ? r.text : "").toLowerCase();
            const searchable = `${author} ${text}`;
            return reviewSearchTokens.every((token) => searchable.includes(token));
        });
    }, [displayNameForUid, reviewSearchTokens, sortedReviews]);

    const communityNotes = useMemo(() => {
        const texts = sortedReviews
            .map((r) => (typeof r.text === "string" ? r.text.trim() : ""))
            .filter((value) => value.length >= 8);
        return buildCommunityNotesSummary(texts);
    }, [sortedReviews]);

    const sortLabel = sortMode === "recent" ? "Most recent" : sortMode === "high" ? "Highest" : "Lowest";

    const openSortMenu = useCallback(() => {
        Keyboard.dismiss();
        setSortOpen(true);

        requestAnimationFrame(() => {
            sortBtnRef.current?.measureInWindow((x, y, w, h) => {
                setSortAnchor({ x, y, w, h });
            });
        });
    }, []);

    /* -------------------- Write/Edit helpers -------------------- */

    const beginWriteNewReview = useCallback(() => {
        setEditingReviewId(null);
        setDraft(emptyDraft);
        setEditorOpen(true);
    }, [emptyDraft]);

    const acceptGuideAndContinue = useCallback(async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in to continue.");
            return;
        }
        if (guideSaving) return;
        if (!guideAcknowledgeChecked) {
            Alert.alert("Confirmation needed", "Please confirm that you have read the review guide.");
            return;
        }

        setGuideSaving(true);
        try {
            await firestore()
                .collection("users")
                .doc(user.uid)
                .set(
                    {
                        reviewGuideAcceptedAtMs: Date.now(),
                        reviewGuideAcceptedVersion: REVIEW_GUIDE_VERSION,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            setReviewGuideAccepted(true);
            setGuideGateOpen(false);
            setGuideAcknowledgeChecked(false);
            beginWriteNewReview();
        } catch (e: any) {
            console.log("accept guide failed:", e);
            Alert.alert("Could not continue", "We couldn't save your confirmation. Please try again.");
        } finally {
            setGuideSaving(false);
        }
    }, [REVIEW_GUIDE_VERSION, beginWriteNewReview, firestore, guideAcknowledgeChecked, guideSaving]);

    const openWriteNewReview = useCallback(async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in to write a review.");
            return;
        }
        if (!productId) return;

        try {
            const next = await enforceRestrictionForUser(user.uid);
            const msg = getRestrictionMessage(next.level, next.untilMs, next.manual);
            if (msg) {
                Alert.alert("Posting restricted", msg);
                return;
            }
        } catch (e) {
            console.log("restriction check failed:", e);
        }

        if (!reviewGuideAccepted) {
            Keyboard.dismiss();
            setGuideAcknowledgeChecked(false);
            setGuideGateOpen(true);
            return;
        }

        beginWriteNewReview();
    }, [
        beginWriteNewReview,
        enforceRestrictionForUser,
        getRestrictionMessage,
        productId,
        reviewGuideAccepted,
    ]);

    const openEditReview = useCallback(
        (reviewToEdit: Review) => {
            const user = auth().currentUser;
            if (!user) {
                Alert.alert("Sign in required", "Please sign in.");
                return;
            }
            if (!currentUid || reviewToEdit.userId !== currentUid) {
                Alert.alert("Not allowed", "You can only edit your own review.");
                return;
            }

            setEditingReviewId(reviewToEdit.id);
            setDraft({
                rating: clamp(Math.round(reviewToEdit.rating || 3), 1, 5),
                text: safeName(reviewToEdit.text),

                daytime: sanitizeEffectScore(reviewToEdit.daytime),
                sleepy: sanitizeEffectScore(reviewToEdit.sleepy),
                calm: sanitizeEffectScore(reviewToEdit.calm),
                clarity: sanitizeEffectScore(reviewToEdit.clarity),
                uplifting: sanitizeEffectScore(reviewToEdit.uplifting),
                focusAdhd: sanitizeEffectScore(reviewToEdit.focusAdhd),
                anxiety: sanitizeEffectScore(reviewToEdit.anxiety),
                moodBalance: sanitizeEffectScore(reviewToEdit.moodBalance),
                appetite: sanitizeEffectScore(reviewToEdit.appetite),
                femaleHealth: sanitizeEffectScore(reviewToEdit.femaleHealth),
                muscleRelaxation: sanitizeEffectScore(reviewToEdit.muscleRelaxation),
                creativity: sanitizeEffectScore(reviewToEdit.creativity),
                painRelief: sanitizeEffectScore(reviewToEdit.painRelief),

                backPain: sanitizeEffectScore(reviewToEdit.backPain),
                jointPain: sanitizeEffectScore(reviewToEdit.jointPain),
                legPain: sanitizeEffectScore(reviewToEdit.legPain),
                headacheRelief: sanitizeEffectScore(reviewToEdit.headacheRelief),
                racingThoughts: sanitizeEffectScore(reviewToEdit.racingThoughts),
            });

            setEditorOpen(true);
        },
        [currentUid, sanitizeEffectScore]
    );

    const closeEditor = useCallback(() => {
        if (submitting) return;
        Keyboard.dismiss();
        setEditorOpen(false);
        setEditingReviewId(null);
    }, [submitting]);

    const saveReview = useCallback(async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in.");
            return;
        }
        if (!productId) return;
        if (isCooldown) return;
        if (!reviewGuideAccepted && !editingReviewId) {
            setEditorOpen(false);
            setGuideAcknowledgeChecked(false);
            setGuideGateOpen(true);
            return;
        }

        try {
            const next = await enforceRestrictionForUser(user.uid);
            const msg = getRestrictionMessage(next.level, next.untilMs, next.manual);
            if (msg) {
                Alert.alert("Posting restricted", msg);
                return;
            }
        } catch (e) {
            console.log("restriction check failed:", e);
        }

        setSubmitting(true);

        try {
            const payload: any = {
                productId,
                userId: user.uid,
                rating: clamp(Math.round(draft.rating), 1, 5),
                text: draft.text.trim() ? draft.text.trim() : null,
                updatedAt: firestore.FieldValue.serverTimestamp(),
            };

            const effectEntries: Array<[EffectKey, number | null]> = [
                ["daytime", sanitizeEffectScore(draft.daytime)],
                ["sleepy", sanitizeEffectScore(draft.sleepy)],
                ["calm", sanitizeEffectScore(draft.calm)],
                ["clarity", sanitizeEffectScore(draft.clarity)],
                ["uplifting", sanitizeEffectScore(draft.uplifting)],
                ["focusAdhd", sanitizeEffectScore(draft.focusAdhd)],
                ["anxiety", sanitizeEffectScore(draft.anxiety)],
                ["moodBalance", sanitizeEffectScore(draft.moodBalance)],
                ["appetite", sanitizeEffectScore(draft.appetite)],
                ["femaleHealth", sanitizeEffectScore(draft.femaleHealth)],
                ["muscleRelaxation", sanitizeEffectScore(draft.muscleRelaxation)],
                ["creativity", sanitizeEffectScore(draft.creativity)],
                ["painRelief", sanitizeEffectScore(draft.painRelief)],
                ["backPain", sanitizeEffectScore(draft.backPain)],
                ["jointPain", sanitizeEffectScore(draft.jointPain)],
                ["legPain", sanitizeEffectScore(draft.legPain)],
                ["headacheRelief", sanitizeEffectScore(draft.headacheRelief)],
                ["racingThoughts", sanitizeEffectScore(draft.racingThoughts)],
            ];
            effectEntries.forEach(([key, value]) => {
                payload[key] = value === null ? null : value;
            });

            if (editingReviewId) {
                await firestore().collection("reviews").doc(editingReviewId).update(payload);
            } else {
                await firestore()
                    .collection("reviews")
                    .add({
                        ...payload,
                        helpfulCount: 0,
                        reportCount: 0,
                        moderationStatus: "active",
                        authorDeleted: false,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                    });
            }

            Keyboard.dismiss();
            setSortOpen(false);
            setReportOpen(false);
            setReportingReview(null);
            setEditorOpen(false);
            setEditingReviewId(null);
            startCooldown();
        } catch (e: any) {
            console.log("saveReview error:", e);
            Alert.alert("Could not save review", getFriendlyReviewError(e, "save"));
        } finally {
            setSubmitting(false);
        }
    }, [
        draft,
        editingReviewId,
        enforceRestrictionForUser,
        getRestrictionMessage,
        isCooldown,
        productId,
        reviewGuideAccepted,
        sanitizeEffectScore,
        startCooldown,
    ]);

    /* -------------------- Delete -------------------- */

    const deleteReview = useCallback(async (reviewId: string, mode: "owner" | "admin" = "owner") => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in.");
            return;
        }

        try {
            if (mode === "admin") {
                await firestore()
                    .collection("reviews")
                    .doc(reviewId)
                    .set(
                        {
                            moderationStatus: "removed_admin",
                            removedAtMs: Date.now(),
                            updatedAt: firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );
                return;
            }

            await firestore().collection("reviews").doc(reviewId).delete();
        } catch (e: any) {
            console.log("deleteReview error:", e);
            Alert.alert("Could not delete review", getFriendlyReviewError(e, "delete"));
        }
    }, []);

    const confirmDelete = useCallback(
        (reviewId: string, mode: "owner" | "admin") => {
            const title = mode === "admin" ? "Admin delete" : "Delete review";
            const msg = mode === "admin" ? "This will permanently remove this review from the community." : "This will permanently remove your review.";

            Alert.alert(title, msg, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteReview(reviewId, mode) },
            ]);
        },
        [deleteReview]
    );

    /* -------------------- Helpful (FIXED) -------------------- */

    const toggleHelpful = useCallback(async (reviewId: string) => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in to mark reviews as helpful.");
            return;
        }

        try {
            const reviewRef = firestore().collection("reviews").doc(reviewId);
            const myVoteRef = firestore().collection("users").doc(user.uid).collection("helpful").doc(reviewId);
            const myUserRef = firestore().collection("users").doc(user.uid);

            await firestore().runTransaction(async (tx) => {
                const [reviewSnap, myVoteSnap, myUserSnap] = await Promise.all([
                    tx.get(reviewRef),
                    tx.get(myVoteRef),
                    tx.get(myUserRef),
                ]);

                if (!reviewSnap.exists) return;

                const data = reviewSnap.data() as any;
                const reviewOwnerUid = typeof data?.userId === "string" ? data.userId : "";
                if (reviewOwnerUid && reviewOwnerUid === user.uid) {
                    throw new Error("You can't mark your own review as helpful.");
                }

                const currentCountRaw = typeof data?.helpfulCount === "number" ? data.helpfulCount : 0;
                const currentCount = Number.isFinite(currentCountRaw) ? currentCountRaw : 0;
                const myProfileData = (myUserSnap.data() as any) ?? {};
                const myGivenRaw =
                    typeof myProfileData?.helpfulGiven === "number" ? myProfileData.helpfulGiven : 0;
                const myGiven = Number.isFinite(myGivenRaw) ? Math.max(0, myGivenRaw) : 0;

                const alreadyVoted = myVoteSnap.exists();

                if (alreadyVoted) {
                    tx.delete(myVoteRef);
                    tx.update(reviewRef, {
                        helpfulCount: Math.max(0, currentCount - 1),
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    });
                    if (myUserSnap.exists()) {
                        tx.set(
                            myUserRef,
                            {
                                helpfulGiven: Math.max(0, myGiven - 1),
                                updatedAt: firestore.FieldValue.serverTimestamp(),
                            },
                            { merge: true }
                        );
                    }
                } else {
                    tx.set(myVoteRef, { reviewId, createdAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
                    tx.update(reviewRef, {
                        helpfulCount: currentCount + 1,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    });
                    if (myUserSnap.exists()) {
                        tx.set(
                            myUserRef,
                            {
                                helpfulGiven: myGiven + 1,
                                updatedAt: firestore.FieldValue.serverTimestamp(),
                            },
                            { merge: true }
                        );
                    }
                }
            });
        } catch (e: any) {
            console.log("toggleHelpful error:", e);
            Alert.alert("Could not update vote", getFriendlyReviewError(e, "helpful"));
        }
    }, []);

    /* -------------------- Report -------------------- */

    const openReport = useCallback((review: Review) => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in to report a review.");
            return;
        }
        if (review.authorDeleted) {
            Alert.alert("Not allowed", "This review author is already anonymised.");
            return;
        }
        if (review.userId && review.userId === user.uid) {
            Alert.alert("Not allowed", "You can't report your own review.");
            return;
        }

        Keyboard.dismiss();
        setReportingReview(review);
        setReportReason("");
        setReportNote("");
        setReportOpen(true);
    }, []);

    const submitReport = useCallback(async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in.");
            return;
        }
        if (!reportingReview) return;
        if (!reportReason) {
            Alert.alert("Pick a reason", "Please choose a reason to report.");
            return;
        }
        if (!productId) return;
        if (myReportedIds.has(reportingReview.id)) {
            Alert.alert("Already reported", "You have already reported this review.");
            return;
        }

        setReportSubmitting(true);

        try {
            const reviewId = reportingReview.id;
            const reportId = `${reviewId}_${user.uid}`;
            const nowMs = Date.now();

            const reviewRef = firestore().collection("reviews").doc(reviewId);
            const reportRef = firestore().collection("reviewReports").doc(reportId);
            const myReportedRef = firestore().collection("users").doc(user.uid).collection("reportedReviews").doc(reviewId);

            const result = await firestore().runTransaction(async (tx) => {
                const [reviewSnap, reportSnap] = await Promise.all([tx.get(reviewRef), tx.get(reportRef)]);
                if (!reviewSnap.exists) {
                    throw new Error("Review no longer exists.");
                }

                const reviewData = (reviewSnap.data() as any) ?? {};
                const currentCount = typeof reviewData.reportCount === "number" ? reviewData.reportCount : 0;
                const currentStatus = typeof reviewData.moderationStatus === "string" ? reviewData.moderationStatus : "active";

                if (reportSnap.exists()) {
                    return {
                        alreadyReported: true,
                        nextCount: currentCount,
                        nextStatus: currentStatus,
                    };
                }

                const nextCount = currentCount + 1;
                let nextStatus = currentStatus;
                const reviewPatch: any = {
                    reportCount: nextCount,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                };

                if (currentStatus !== "removed_auto" && currentStatus !== "removed_admin") {
                    if (nextCount >= REPORT_AUTO_REMOVE_THRESHOLD) {
                        nextStatus = "removed_auto";
                        reviewPatch.moderationStatus = "removed_auto";
                        reviewPatch.removedAtMs = nowMs;
                    } else {
                        nextStatus = "under_review";
                        reviewPatch.moderationStatus = "under_review";
                    }
                }

                tx.set(
                    reportRef,
                    {
                        reviewId,
                        productId,
                        reportedUserId: reportingReview.userId,
                        reporterUserId: user.uid,
                        reason: reportReason,
                        note: reportNote.trim() ? reportNote.trim() : null,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        createdAtMs: nowMs,
                    },
                    { merge: true }
                );

                tx.set(
                    myReportedRef,
                    {
                        reviewId,
                        productId,
                        reason: reportReason,
                        note: reportNote.trim() ? reportNote.trim() : null,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        createdAtMs: nowMs,
                    },
                    { merge: true }
                );

                tx.set(reviewRef, reviewPatch, { merge: true });

                return {
                    alreadyReported: false,
                    nextCount,
                    nextStatus,
                };
            });

            if (result.alreadyReported) {
                Alert.alert("Already reported", "You have already reported this review.");
                return;
            }

            setReportOpen(false);
            setReportingReview(null);

            if (result.nextStatus === "removed_auto") {
                Alert.alert("Reported", "Thanks. This review reached the report threshold and was automatically removed.");
            } else if (result.nextStatus === "under_review") {
                Alert.alert("Reported", "Thanks. This review is now under moderation review.");
            } else {
                Alert.alert("Reported", "Thanks. That review will be hidden for you.");
            }
        } catch (e: any) {
            console.log("submitReport error:", e);
            Alert.alert("Could not report", getFriendlyReviewError(e, "report"));
        } finally {
            setReportSubmitting(false);
        }
    }, [REPORT_AUTO_REMOVE_THRESHOLD, productId, reportNote, reportReason, reportingReview, myReportedIds]);

    /* -------------------- Header / Empty -------------------- */

    const terps = parseTerpenes(product?.terpenes);

    const Header = useMemo(() => {
        return (
            <View style={{ padding: 16 }}>
                <View
                    style={{
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.16)",
                        backgroundColor: "rgba(7, 51, 96, 0.45)",
                        overflow: "hidden",
                        padding: 16,
                    }}
                >
                    <Text style={{ fontSize: 44, fontWeight: "900", color: theme.colors.textOnDark, lineHeight: 46 }}>{product?.name ?? ""}</Text>

                    <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                        {[
                            safeName(product?.maker) || null,
                            formatStrainType(product?.strainType),
                            typeof product?.thcPct === "number" ? `THC ${formatPct(product?.thcPct)}` : null,
                            typeof product?.cbdPct === "number" ? `CBD ${formatPct(product?.cbdPct)}` : null,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </Text>

                    <View style={{ marginTop: 14 }}>
                        <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "800", marginBottom: 8 }}>Save tags</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {FAVORITE_SLOT_META.map((slot) => {
                                const active = !!favoriteSlots[slot.key];
                                return (
                                    <Pressable
                                        key={slot.key}
                                        onPress={() => toggleFavoriteSlot(slot.key)}
                                        style={({ pressed }) => [
                                            styles.favPill,
                                            active ? [styles.favPillActive, { borderColor: slot.color, backgroundColor: "rgba(255,255,255,0.14)" }] : null,
                                            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                                        ]}
                                    >
                                        <Text style={[styles.favStar, { color: active ? slot.color : "rgba(255,255,255,0.55)" }]}>{slot.icon}</Text>
                                        <Text style={[styles.favText, active ? styles.favTextOn : styles.favTextOff]}>{slot.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <Text style={{ marginTop: 18, fontSize: 22, fontWeight: "900", color: theme.colors.textOnDark }}>Terpenes</Text>

                    {terps.length === 0 ? (
                        <View style={{ marginTop: 10, ...styles.actionPill, alignSelf: "flex-start" }}>
                            <Text style={{ fontWeight: "900", color: "rgba(255,255,255,0.55)" }}>No terpene data available</Text>
                        </View>
                    ) : (
                        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {terps.map((t) => (
                                <View key={`${t.name}-${t.strength}`} style={styles.actionPill}>
                                    <Text style={{ fontWeight: "900", color: theme.colors.textOnDark }}>
                                        {t.name}
                                        {t.strength ? ` · ${t.strength}` : ""}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {communityNotes ? (
                        <View style={{ marginTop: 16 }}>
                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                                Community notes
                            </Text>
                            <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                {communityNotes.detailLine}
                            </Text>
                            {communityNotes.chips.length > 0 ? (
                                <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                    {communityNotes.chips.slice(0, 6).map((chip) => (
                                        <View
                                            key={chip}
                                            style={{
                                                paddingVertical: 6,
                                                paddingHorizontal: 10,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: "rgba(138,231,168,0.46)",
                                                backgroundColor: "rgba(52,156,88,0.16)",
                                            }}
                                        >
                                            <Text style={{ fontWeight: "800", color: "rgba(213,251,222,0.96)", fontSize: 12 }}>
                                                {chip}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                            <Text style={{ marginTop: 8, color: "rgba(206,232,219,0.78)", fontSize: 12, fontWeight: "700" }}>
                                Based on {communityNotes.mentionsCount} review note{communityNotes.mentionsCount === 1 ? "" : "s"}.
                            </Text>
                        </View>
                    ) : null}

                    <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ color: theme.colors.textOnDarkSecondary, fontWeight: "900" }}>
                            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                        </Text>

                        <Text style={{ fontSize: 40, fontWeight: "900", color: theme.colors.textOnDark }}>{robustProductScore ? robustProductScore.toFixed(1) : "0.0"}</Text>
                    </View>

                    <Text style={{ marginTop: 18, fontSize: 28, fontWeight: "900", color: theme.colors.textOnDark }}>Summary of effects</Text>

                    <View style={{ marginTop: 10 }}>
                        {(() => {
                            const summaryByKey: Record<EffectKey, number> = {
                                daytime: effectsSummary.daytimeAvg,
                                sleepy: effectsSummary.sleepyAvg,
                                calm: effectsSummary.calmAvg,
                                clarity: effectsSummary.clarityAvg,
                                uplifting: effectsSummary.upliftingAvg,
                                focusAdhd: effectsSummary.focusAdhdAvg,
                                anxiety: effectsSummary.anxietyAvg,
                                moodBalance: effectsSummary.moodBalanceAvg,
                                appetite: effectsSummary.appetiteAvg,
                                femaleHealth: effectsSummary.femaleHealthAvg,
                                muscleRelaxation: effectsSummary.muscleRelaxationAvg,
                                creativity: effectsSummary.creativityAvg,
                                painRelief: effectsSummary.painReliefAvg,
                                backPain: effectsSummary.backPainAvg,
                                jointPain: effectsSummary.jointPainAvg,
                                legPain: effectsSummary.legPainAvg,
                                headacheRelief: effectsSummary.headacheReliefAvg,
                                racingThoughts: effectsSummary.racingThoughtsAvg,
                            };

                            return EFFECT_FIELDS.map((row) => (
                            <View key={row.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                                <Text style={{ flex: 1, color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>{row.label}</Text>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                    <BudRating value={summaryByKey[row.key] ? summaryByKey[row.key] : 0} size={16} />
                                    <Text style={{ width: 44, textAlign: "right", color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                                        {round1(summaryByKey[row.key])}
                                    </Text>
                                </View>
                            </View>
                            ));
                        })()}

                        {effectsSummary.withAnySub > 0 ? (
                            <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                Based on {effectsSummary.withAnySub} reviews with effect ratings.
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View style={{ height: 14 }} />

                <View style={styles.reviewsHeadingRow}>
                    <View style={styles.reviewsTitleCard}>
                        <View style={styles.reviewsTitleInner}>
                            <Text style={styles.reviewsEyebrow}>Community</Text>
                            <Text style={styles.reviewsTitle}>Reviews</Text>
                        </View>
                    </View>

                    <View ref={sortBtnRef as any}>
                        <Pressable
                            onPress={openSortMenu}
                            style={({ pressed }) => [styles.sortPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                        >
                            <Text style={{ fontWeight: "800", color: "rgba(255,255,255,0.88)" }}>{sortLabel}</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.reviewSearchWrap}>
                    <TextInput
                        value={reviewSearchQuery}
                        onChangeText={setReviewSearchQuery}
                        placeholder="Search review notes and member names..."
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        style={styles.reviewSearchInput}
                    />
                    <View style={styles.reviewSearchFooter}>
                        <Text style={styles.reviewSearchMeta}>
                            {reviewSearchTokens.length === 0
                                ? `Search across ${sortedReviews.length} review${sortedReviews.length === 1 ? "" : "s"}.`
                                : `${filteredSortedReviews.length} match${filteredSortedReviews.length === 1 ? "" : "es"} found.`}
                        </Text>
                        {reviewSearchTokens.length > 0 ? (
                            <Pressable
                                onPress={() => setReviewSearchQuery("")}
                                style={({ pressed }) => [styles.reviewSearchClearBtn, { opacity: pressed ? 0.9 : 1 }]}
                            >
                                <Text style={styles.reviewSearchClearText}>Clear</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>

                <View style={{ height: 12 }} />

                <Pressable
                    onPress={openWriteNewReview}
                    disabled={isCooldown}
                    style={({ pressed }) => [
                        styles.formBtn,
                        {
                            borderRadius: 22,
                            opacity: isCooldown ? 0.45 : pressed ? 0.9 : 1,
                            transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                    ]}
                >
                    <Text style={[styles.formBtnText, { fontSize: 18 }]}>{isCooldown ? `Wait ${secondsLeft}s` : "Write a new review"}</Text>
                </Pressable>

                <View style={{ height: 14 }} />
            </View>
        );
    }, [
        communityNotes,
        effectsSummary,
        isCooldown,
        favoriteSlots,
        openSortMenu,
        openWriteNewReview,
        product?.cbdPct,
        product?.maker,
        product?.name,
        product?.terpenes,
        product?.thcPct,
        product?.type,
        reviews.length,
        robustProductScore,
        reviewSearchQuery,
        reviewSearchTokens.length,
        secondsLeft,
        sortedReviews.length,
        sortLabel,
        terps,
        toggleFavoriteSlot,
        filteredSortedReviews.length,
    ]);

    const EmptyState = useMemo(() => {
        return (
            <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                <View style={styles.reviewCard}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.textOnDark }}>No reviews yet</Text>
                    <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                        Be the first to add one. Your review helps everyone find the good stuff.
                    </Text>

                    <View style={{ marginTop: 14 }}>
                        <Pressable
                            onPress={openWriteNewReview}
                            disabled={isCooldown}
                            style={({ pressed }) => [
                                styles.formBtn,
                                {
                                    opacity: isCooldown ? 0.45 : pressed ? 0.9 : 1,
                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                },
                            ]}
                        >
                            <Text style={styles.formBtnText}>{isCooldown ? `Wait ${secondsLeft}s` : "Write the first review"}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }, [isCooldown, openWriteNewReview, secondsLeft]);

    const SearchEmptyState = useMemo(() => {
        return (
            <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                <View style={styles.reviewCard}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.textOnDark }}>No matches found</Text>
                    <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                        Try a different keyword from review notes, or search by member name.
                    </Text>

                    <View style={{ marginTop: 14 }}>
                        <Pressable
                            onPress={() => setReviewSearchQuery("")}
                            style={({ pressed }) => [
                                styles.formBtnAlt,
                                {
                                    opacity: pressed ? 0.9 : 1,
                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                },
                            ]}
                        >
                            <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Clear search</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }, []);

    /* -------------------- Loading / Not found -------------------- */

    if (loadingProduct) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.appBgSolid }} edges={["top", "bottom"]}>
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 72 }}>
                    <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                    <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary }}>Loading product...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!product) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.appBgSolid }} edges={["top", "bottom"]}>
                <View style={{ flex: 1, padding: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 16, color: theme.colors.textOnDark }}>Product not found</Text>
                    <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary }}>That product id doesnt exist in Firestore.</Text>
                </View>
            </SafeAreaView>
        );
    }

    /* ==================== RENDER ==================== */

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.appBgSolid }} edges={["top", "bottom"]}>
                <ImageBackground source={flowersBg} resizeMode="cover" style={StyleSheet.absoluteFillObject} imageStyle={{ transform: [{ translateY: bgShift }, { scale: bgScale }] }} />

                <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0, 0, 0, 0.49)" }]} />

                <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.70)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.00)"]} locations={[0, 0.55, 1]} style={styles.topUiFade} />

                <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.00)", "rgba(0,0,0,0.30)", "rgba(0,0,0,0.65)"]} locations={[0, 0.65, 1]} style={styles.bottomUiFade} />

                {/* Back button */}
                <View style={[styles.backBtnWrap, { top: insets.top + 6 }]}>
                    <Pressable
                        onPress={handleBack}
                        hitSlop={16}
                        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                    >
                        <Text style={styles.backChevron}>‹</Text>
                    </Pressable>
                </View>

                {/* Sort menu */}
                <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
                    <Pressable onPress={() => setSortOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.10)" }}>
                        <View pointerEvents="box-none" style={{ flex: 1 }}>
                            <View
                                pointerEvents="box-none"
                                style={{
                                    position: "absolute",
                                    left: sortAnchor ? Math.max(12, sortAnchor.x + sortAnchor.w - 190) : 12,
                                    top: sortAnchor ? sortAnchor.y + sortAnchor.h + 8 : 120,
                                    width: 190,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.18)",
                                    backgroundColor: "rgba(7, 51, 96, 0.45)",
                                    borderRadius: 14,
                                    overflow: "hidden",
                                    elevation: 12,
                                }}
                            >
                                {[
                                    { key: "recent" as const, label: "Most recent" },
                                    { key: "high" as const, label: "Highest" },
                                    { key: "low" as const, label: "Lowest" },
                                ].map((opt) => (
                                    <Pressable
                                        key={opt.key}
                                        onPress={() => {
                                            setSortMode(opt.key);
                                            setSortOpen(false);
                                        }}
                                        style={{
                                            paddingVertical: 12,
                                            paddingHorizontal: 12,
                                            backgroundColor: sortMode === opt.key ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        <Text style={{ fontWeight: "900", color: theme.colors.textOnDark }}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </Pressable>
                </Modal>

                {/* Write/Edit modal (NEW: full-screen surface + ScrollView + pinned footer) */}
                <Modal visible={editorOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
                    <View style={styles.editorModalRoot}>
                        <View style={styles.editorBackdrop} />

                        <SafeAreaView style={styles.editorSafe} edges={["top", "bottom"]}>
                            <KeyboardAvoidingView style={styles.editorKav} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}>
                                <View style={[styles.editorHeader, { paddingTop: Math.max(insets.top + 14, 56) }]}>
                                    <Text style={styles.editorTitle}>{editingReviewId ? "Edit a review" : "Write a review"}</Text>

                                    <Pressable
                                        onPress={closeEditor}
                                        hitSlop={12}
                                        style={({ pressed }) => [styles.editorCloseBtn, pressed ? { opacity: 0.9 } : null]}
                                    >
                                        <Text style={styles.editorCloseText}>✕</Text>
                                    </Pressable>
                                </View>

                                <View style={styles.editorDivider} />

                                <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                    <Text style={styles.editorHint}>Tap the buds to choose your rating. You will see the number update as you go.</Text>

                                    <Text style={styles.editorSectionTitle}>Overall rating</Text>
                                    <View style={{ marginTop: 12 }}>
                                        <BudSelectRow value={draft.rating} onChange={(n) => setDraft((p) => ({ ...p, rating: n }))} />
                                    </View>
                                    <Text style={styles.editorBigValue}>Rating: {draft.rating} / 5</Text>

                                    <Text style={[styles.editorSectionTitle, { marginTop: 16 }]}>Notes</Text>
                                    <TextInput
                                        value={draft.text}
                                        onChangeText={(t) => setDraft((p) => ({ ...p, text: t }))}
                                        placeholder="What stood out? Effects, flavour, value, anything worth sharing..."
                                        placeholderTextColor="rgba(255,255,255,0.35)"
                                        multiline
                                        textAlignVertical="top"
                                        style={[styles.input, { marginTop: 10, minHeight: 120 }]}
                                    />

                                    <Text style={[styles.editorSectionTitle, { marginTop: 16 }]}>Effects</Text>

                                    {EFFECT_FIELDS.map((row) => {
                                        const v = ((draft as any)[row.key] ?? null) as number | null;

                                        return (
                                            <View key={row.key} style={styles.effectBlock}>
                                                <View style={styles.effectHeaderRow}>
                                                    <Text style={styles.effectLabel}>{row.label}</Text>
                                                    <Text style={[styles.effectValue, v === null ? { color: "rgba(255,255,255,0.58)" } : null]}>
                                                        {v === null ? "—" : v}
                                                    </Text>
                                                </View>

                                                {EFFECT_HINTS[row.key] ? (
                                                    <Text style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 17 }}>
                                                        {EFFECT_HINTS[row.key]}
                                                    </Text>
                                                ) : null}

                                                <View style={{ marginTop: 10 }}>
                                                    <BudSelectRow value={v} onChange={(n) => setDraft((p) => ({ ...p, [row.key]: n } as any))} />
                                                </View>
                                            </View>
                                        );
                                    })}

                                    <View style={{ height: 28 }} />
                                </ScrollView>

                                <View style={styles.editorFooter}>
                                    <Pressable
                                        onPress={closeEditor}
                                        disabled={submitting}
                                        style={({ pressed }) => [
                                            styles.formBtnAlt,
                                            {
                                                flex: 1,
                                                marginRight: 10,
                                                opacity: submitting ? 0.45 : pressed ? 0.9 : 1,
                                                transform: [{ scale: pressed ? 0.985 : 1 }],
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Cancel</Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={saveReview}
                                        disabled={submitting || isCooldown}
                                        style={({ pressed }) => [
                                            styles.formBtn,
                                            {
                                                flex: 1,
                                                opacity: submitting || isCooldown ? 0.45 : pressed ? 0.9 : 1,
                                                transform: [{ scale: pressed ? 0.985 : 1 }],
                                            },
                                        ]}
                                    >
                                        <Text style={styles.formBtnText}>{submitting ? "Saving..." : isCooldown ? `Wait ${secondsLeft}s` : "Save review"}</Text>
                                    </Pressable>
                                </View>
                            </KeyboardAvoidingView>
                        </SafeAreaView>
                    </View>
                </Modal>

                {/* Review guide gate (required once before posting) */}
                <Modal
                    visible={guideGateOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        if (guideSaving) return;
                        setGuideGateOpen(false);
                    }}
                >
                    <View style={{ flex: 1, justifyContent: "flex-end" }}>
                        <Pressable
                            onPress={() => {
                                if (guideSaving) return;
                                setGuideGateOpen(false);
                            }}
                            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)" }]}
                        />
                        <View style={styles.reportSheetOuter}>
                            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={24}>
                                <ScrollView
                                    style={{ maxHeight: Dimensions.get("window").height * 0.82 }}
                                    contentContainerStyle={styles.reportSheetInner}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.textOnDark, flex: 1 }}>
                                            Before you write a review
                                        </Text>
                                        <Pressable
                                            onPress={() => {
                                                if (guideSaving) return;
                                                setGuideGateOpen(false);
                                            }}
                                            style={({ pressed }) => ({
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: "rgba(255,255,255,0.10)",
                                                borderWidth: 1,
                                                borderColor: "rgba(255,255,255,0.14)",
                                                opacity: pressed ? 0.9 : 1,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>✕</Text>
                                        </Pressable>
                                    </View>

                                    <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                        Score only what this flower actually helped. Leave other effects blank.
                                    </Text>

                                    <View style={{ marginTop: 12, gap: 10 }}>
                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                            1. Overall rating (required)
                                        </Text>
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 19 }}>
                                            Rate quality and real-world value: bud quality, moisture, flavour, effect consistency, and whether you'd use it again.
                                        </Text>

                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>
                                            2. Use effects carefully
                                        </Text>
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 19 }}>
                                            Avoid contradictory scoring. Example: very high couch lock should not also be high daytime suitability.
                                        </Text>

                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>
                                            3. Helpful examples
                                        </Text>
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 19 }}>
                                            Daytime: focus, function, getting tasks done.{"\n"}
                                            Couch lock / sleepiness: heavy sedation, unwind, evening use.{"\n"}
                                            Calm / anxiety relief: less racing thoughts, less paranoia.{"\n"}
                                            Appetite (munchies): stronger hunger drive after use.
                                        </Text>

                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>
                                            4. Your notes help everyone
                                        </Text>
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 19 }}>
                                            Mention timing, dose context, and what stood out. We use review text trends to improve cards and discovery.
                                        </Text>
                                    </View>

                                    <Pressable
                                        onPress={() => setGuideAcknowledgeChecked((v) => !v)}
                                        style={({ pressed }) => ({
                                            marginTop: 16,
                                            padding: 12,
                                            borderRadius: 14,
                                            borderWidth: 1,
                                            borderColor: guideAcknowledgeChecked ? "rgba(138,231,168,0.55)" : "rgba(255,255,255,0.18)",
                                            backgroundColor: guideAcknowledgeChecked ? "rgba(52,156,88,0.22)" : "rgba(255,255,255,0.08)",
                                            opacity: pressed ? 0.9 : 1,
                                            flexDirection: "row",
                                            alignItems: "center",
                                        })}
                                    >
                                        <View
                                            style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: 5,
                                                borderWidth: 1,
                                                borderColor: "rgba(255,255,255,0.35)",
                                                backgroundColor: guideAcknowledgeChecked ? "rgba(138,231,168,0.95)" : "transparent",
                                                marginRight: 10,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            {guideAcknowledgeChecked ? (
                                                <Text style={{ color: "rgba(19,33,17,0.95)", fontWeight: "900" }}>✓</Text>
                                            ) : null}
                                        </View>
                                        <Text style={{ flex: 1, color: theme.colors.textOnDark, fontWeight: "800", lineHeight: 19 }}>
                                            I have read and understood how to score reviews properly.
                                        </Text>
                                    </Pressable>

                                    <View style={{ flexDirection: "row", marginTop: 14 }}>
                                        <Pressable
                                            onPress={() => {
                                                setGuideGateOpen(false);
                                                router.push("/(tabs)/user/reviews-info");
                                            }}
                                            disabled={guideSaving}
                                            style={({ pressed }) => [
                                                styles.formBtnAlt,
                                                {
                                                    marginRight: 10,
                                                    flex: 1,
                                                    opacity: guideSaving ? 0.45 : pressed ? 0.9 : 1,
                                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Open full guide</Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={acceptGuideAndContinue}
                                            disabled={guideSaving || !guideAcknowledgeChecked}
                                            style={({ pressed }) => [
                                                styles.formBtn,
                                                {
                                                    flex: 1,
                                                    opacity: guideSaving || !guideAcknowledgeChecked ? 0.45 : pressed ? 0.9 : 1,
                                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                                },
                                            ]}
                                        >
                                            <Text style={styles.formBtnText}>{guideSaving ? "Saving..." : "Continue"}</Text>
                                        </Pressable>
                                    </View>
                                </ScrollView>
                            </KeyboardAvoidingView>
                        </View>
                    </View>
                </Modal>

                {/* Report bottom sheet */}
                <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
                    <View style={{ flex: 1, justifyContent: "flex-end" }}>
                        <Pressable
                            onPress={() => {
                                if (reportSubmitting) return;
                                setReportOpen(false);
                            }}
                            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.40)" }]}
                        />
                        <View style={styles.reportSheetOuter}>
                            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={24}>
                                <View style={styles.reportSheetInner}>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.textOnDark, flex: 1 }}>Report review</Text>
                                        <Pressable
                                            onPress={() => {
                                                if (reportSubmitting) return;
                                                setReportOpen(false);
                                            }}
                                            style={({ pressed }) => ({
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: "rgba(255,255,255,0.10)",
                                                borderWidth: 1,
                                                borderColor: "rgba(255,255,255,0.14)",
                                                opacity: pressed ? 0.9 : 1,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>✕</Text>
                                        </Pressable>
                                    </View>

                                    <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                                        Pick a reason. This review will be hidden for you after reporting.
                                    </Text>

                                    {(["Spam", "Offensive", "Off-topic", "Other"] as const).map((r) => {
                                        const selected = reportReason === r;
                                        return (
                                            <Pressable
                                                key={r}
                                                onPress={() => setReportReason(r)}
                                                disabled={reportSubmitting}
                                                style={[styles.reportOption, selected ? styles.reportOptionOn : null, reportSubmitting ? { opacity: 0.7 } : null]}
                                            >
                                                <Text style={{ fontWeight: "900", color: theme.colors.textOnDark }}>{r}</Text>
                                            </Pressable>
                                        );
                                    })}

                                    <TextInput
                                        value={reportNote}
                                        onChangeText={setReportNote}
                                        editable={!reportSubmitting}
                                        placeholder="Optional note (what's the issue?)"
                                        placeholderTextColor="rgba(255,255,255,0.35)"
                                        multiline
                                        scrollEnabled
                                        textAlignVertical="top"
                                        style={styles.reportNote}
                                    />

                                    <View style={{ flexDirection: "row", marginTop: 12 }}>
                                        <Pressable
                                            onPress={() => {
                                                if (reportSubmitting) return;
                                                setReportOpen(false);
                                            }}
                                            style={({ pressed }) => [
                                                styles.formBtnAlt,
                                                {
                                                    marginRight: 10,
                                                    flex: 1,
                                                    opacity: reportSubmitting ? 0.45 : pressed ? 0.9 : 1,
                                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                                },
                                            ]}
                                            disabled={reportSubmitting}
                                        >
                                            <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Cancel</Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={submitReport}
                                            style={({ pressed }) => [
                                                styles.formBtnWarn,
                                                {
                                                    flex: 1,
                                                    opacity: reportSubmitting ? 0.45 : pressed ? 0.9 : 1,
                                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                                },
                                            ]}
                                            disabled={reportSubmitting}
                                        >
                                            <Text style={[styles.formBtnText, { color: "rgba(34,24,8,0.98)" }]}>{reportSubmitting ? "Submitting..." : "Submit report"}</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </View>
                </Modal>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}>
                    <FlatList
                        removeClippedSubviews={false}
                        data={filteredSortedReviews}
                        keyExtractor={(r) => r.id}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={() => {
                            Keyboard.dismiss();
                            setSortOpen(false);
                        }}
                        contentContainerStyle={{ paddingTop: TOP_PAD, paddingBottom: bottomSpace }}
                        ListHeaderComponent={Header}
                        ListEmptyComponent={loadingReviews ? null : reviewSearchTokens.length > 0 ? SearchEmptyState : EmptyState}
                        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                        renderItem={({ item: review }) => {
                            const isMine = !!currentUid && review.userId === currentUid;
                            const hasVoted = !!currentUid && myHelpfulIds.has(review.id);
                            const canVote = !!currentUid && !isMine;
                            const authorName = review.authorDeleted ? "Deleted user" : displayNameForUid(review.userId);

                            const chips = EFFECT_FIELDS
                                .map((field) => ({
                                    label: field.chipLabel ?? field.label,
                                    value: (review as any)[field.key] as number | null | undefined,
                                }))
                                .filter((e) => typeof e.value === "number" && (e.value as number) >= 1 && (e.value as number) <= 5)
                                .sort((a, b) => (b.value as number) - (a.value as number))
                                .slice(0, 8);

                            const reviewText = typeof review.text === "string" ? review.text.trim() : "";
                            const isExpanded = !!expandedReviewIds[review.id];
                            const canExpand = reviewText.length > 180 || reviewText.includes("\n");

                            return (
                                <View style={styles.reviewItem}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <View style={{ flex: 1 }}>
                                            {review.authorDeleted || !review.userId ? (
                                                <Text style={{ fontWeight: "900", color: theme.colors.textOnDark, fontSize: 16 }}>{authorName}</Text>
                                            ) : (
                                                <Pressable
                                                    onPress={() =>
                                                        router.push({
                                                            pathname: "/(tabs)/user/profile/[uid]",
                                                            params: {
                                                                uid: review.userId,
                                                                returnTo: `/(tabs)/reviews/${flowerId}`,
                                                            },
                                                        })
                                                    }
                                                    style={({ pressed }) => ({
                                                        alignSelf: "flex-start",
                                                        opacity: pressed ? 0.82 : 1,
                                                    })}
                                                >
                                                    <Text
                                                        style={{
                                                            fontWeight: "900",
                                                            color: theme.colors.textOnDark,
                                                            fontSize: 16,
                                                            textDecorationLine: "underline",
                                                        }}
                                                    >
                                                        {authorName}
                                                    </Text>
                                                </Pressable>
                                            )}
                                            <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary, fontSize: 13 }}>{new Date(getCreatedAtMs(review)).toLocaleDateString()}</Text>
                                        </View>

                                        <BudRating value={getReviewScore(review)} size={14} />
                                    </View>

                                    {reviewText ? (
                                        <Text
                                            style={{ marginTop: 10, color: theme.colors.textOnDark, lineHeight: 20 }}
                                            numberOfLines={isExpanded ? undefined : 3}
                                            ellipsizeMode="tail"
                                        >
                                            {reviewText}
                                        </Text>
                                    ) : null}

                                    {reviewText && canExpand ? (
                                        <Pressable
                                            onPress={() =>
                                                setExpandedReviewIds((prev) => ({
                                                    ...prev,
                                                    [review.id]: !prev[review.id],
                                                }))
                                            }
                                            style={({ pressed }) => ({
                                                marginTop: 8,
                                                alignSelf: "flex-start",
                                                opacity: pressed ? 0.78 : 1,
                                            })}
                                        >
                                            <Text
                                                style={{
                                                    color: "rgba(212,175,55,0.98)",
                                                    fontWeight: "900",
                                                    fontSize: 13,
                                                    letterSpacing: 0.2,
                                                }}
                                            >
                                                {isExpanded ? "Show less" : "Read more"}
                                            </Text>
                                        </Pressable>
                                    ) : null}

                                    {chips.length ? (
                                        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                            {chips.map((e) => (
                                                <View
                                                    key={e.label}
                                                    style={{
                                                        paddingVertical: 6,
                                                        paddingHorizontal: 10,
                                                        borderRadius: 999,
                                                        backgroundColor: "rgba(212,175,55,0.20)",
                                                        borderWidth: 1,
                                                        borderColor: "rgba(212,175,55,0.40)",
                                                    }}
                                                >
                                                    <Text style={{ fontWeight: "900", fontSize: 12, color: theme.colors.textOnDark }}>
                                                        {e.label} {round1(e.value as number)}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    <View style={styles.actionsRow}>
                                        <Pressable
                                            onPress={() => toggleHelpful(review.id)}
                                            disabled={!canVote}
                                            style={({ pressed }) => [
                                                styles.actionPill,
                                                hasVoted ? styles.actionPillActive : null,
                                                !canVote ? styles.actionPillDisabled : null,
                                                { opacity: !canVote ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                                            ]}
                                        >
                                            <Text style={styles.actionPillText}>{isMine ? "Helpful (yours)" : "Helpful"}</Text>
                                            {(review.helpfulCount ?? 0) > 0 ? (
                                                <View style={styles.countPill}>
                                                    <Text style={styles.countPillText}>{review.helpfulCount}</Text>
                                                </View>
                                            ) : null}
                                        </Pressable>

                                        {!isMine && !review.authorDeleted ? (
                                            <Pressable
                                                onPress={() => openReport(review)}
                                                style={({ pressed }) => [styles.reportPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                                            >
                                                <Text style={styles.reportPillText}>Report</Text>
                                            </Pressable>
                                        ) : null}

                                        {isMine ? (
                                            <Pressable
                                                onPress={() => openEditReview(review)}
                                                style={({ pressed }) => [styles.actionPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                                            >
                                                <Text style={styles.actionPillText}>Edit</Text>
                                            </Pressable>
                                        ) : null}

                                        {isMine ? (
                                            <View style={{ width: "100%", alignItems: "center" }}>
                                                <Pressable
                                                    onPress={() => confirmDelete(review.id, "owner")}
                                                    style={({ pressed }) => [styles.dangerPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                                                >
                                                    <Text style={styles.dangerPillText}>Delete</Text>
                                                </Pressable>
                                            </View>
                                        ) : null}

                                        {isAdmin ? (
                                            <Pressable
                                                onPress={() => confirmDelete(review.id, "admin")}
                                                style={({ pressed }) => [styles.adminPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                                            >
                                                <Text style={styles.adminPillText}>Admin delete</Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                </View>
                            );
                        }}
                        ListFooterComponent={<View style={{ height: 16 }} />}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
}
