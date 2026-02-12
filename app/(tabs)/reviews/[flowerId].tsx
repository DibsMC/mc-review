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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { theme } from "../../../lib/theme";

const budImg = require("../../../assets/icons/bud.png");
const flowersBg = require("../../../assets/images/flowers-bg.png");

type Product = {
    id: string;
    name: string;
    maker: string;
    variant?: string | null;
    type: string;
    thcPct?: number | null;
    cbdPct?: number | null;
    terpenes?: string | null;
};

type Review = {
    id: string;
    productId: string;
    userId: string;

    rating: number;
    score?: number | null;

    text?: string | null;
    createdAt?: FirebaseFirestoreTypes.Timestamp | number | null;
    updatedAt?: FirebaseFirestoreTypes.Timestamp | number | null;

    helpfulCount?: number | null;

    sleepy?: number | null;
    calm?: number | null;
    daytime?: number | null;
    clarity?: number | null;

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
    backPain: number | null;
    jointPain: number | null;
    legPain: number | null;
    headacheRelief: number | null;
    racingThoughts: number | null;
};

function safeName(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : "";
}

function formatPct(n: number | null | undefined) {
    if (n === null || n === undefined) return "-";
    return `${n}%`;
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

    actionsRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },

    actionPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    actionPillActive: { borderColor: "rgba(212,175,55,0.55)", backgroundColor: "rgba(212, 175, 55, 0.22)" },
    actionPillDisabled: { opacity: 0.55 },
    actionPillText: { fontWeight: "900", color: theme.colors.textOnDark },

    countPill: {
        marginLeft: 10,
        minWidth: 28,
        height: 22,
        paddingHorizontal: 8,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.32)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    countPillText: { color: "rgba(255,255,255,0.90)", fontWeight: "900", fontSize: 12 },

    dangerPill: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,120,120,0.45)",
        backgroundColor: "rgba(255,120,120,0.18)",
    },
    dangerPillText: { fontWeight: "900", color: "rgba(255,160,160,1)", includeFontPadding: false },

    adminPill: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    adminPillText: { fontWeight: "900", color: "rgba(255,255,255,0.78)" },

    reportPill: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    reportPillText: { fontWeight: "900", color: "rgba(255,255,255,0.78)" },

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
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.78)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnAlt: {
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        backgroundColor: "rgba(255,255,255,0.14)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnText: { fontWeight: "900", fontSize: 16, letterSpacing: 0.2, textAlign: "center", color: "#fff", includeFontPadding: false },

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
    editorModalRoot: { flex: 1, position: "relative" },
    editorBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.92)" },
    editorSafe: { flex: 1 },
    editorKav: {
        flex: 1,
        backgroundColor: "rgba(10,10,10,0.98)",
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
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();

    const { flowerId, productId: productIdParam } = useLocalSearchParams<{ flowerId?: string; productId?: string }>();
    const productId = typeof productIdParam === "string" ? productIdParam : typeof flowerId === "string" ? flowerId : "";

    const TOP_PAD = 72;
    const bottomSpace = tabBarHeight + Math.max(insets.bottom, 12) + 24;

    const { height: windowH } = Dimensions.get("window");
    const bgShift = Math.round(windowH * 0.18);
    const bgScale = 1.12;

    const COOLDOWN_MS = 10_000;
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

    const [nameMap, setNameMap] = useState<Record<string, string>>({});

    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [sortOpen, setSortOpen] = useState(false);
    const sortBtnRef = useRef<View | null>(null);
    const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    const [submitting, setSubmitting] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
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
            backPain: null,
            jointPain: null,
            legPain: null,
            headacheRelief: null,
            racingThoughts: null,
        }),
        []
    );
    const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);

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

    // Back button
    const handleBack = useCallback(() => {
        try {
            router.back();
        } catch {
            router.replace("/(tabs)/reviews");
        }
    }, [router]);

    // User profile listener (admin + favourites)
    useEffect(() => {
        if (!currentUid) {
            setIsAdmin(false);
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

                    const favs = Array.isArray(data?.favoriteProductIds)
                        ? (data.favoriteProductIds as any[]).filter((x) => typeof x === "string")
                        : [];
                    setLegacyFavoriteProductIds(favs as string[]);
                },
                () => {
                    setIsAdmin(false);
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
    }, [currentUid, productId]);

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
                    setProduct({
                        id: doc.id,
                        name: typeof data?.name === "string" ? data.name : "",
                        maker: typeof data?.maker === "string" ? data.maker : "",
                        variant: data?.variant ?? null,
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
                            rating: ratingFromDb,
                            score: typeof data.score === "number" ? data.score : null,
                            text: typeof data.text === "string" ? data.text : null,
                            createdAt: (data.createdAt ?? null) as any,
                            updatedAt: (data.updatedAt ?? null) as any,

                            helpfulCount,

                            sleepy: typeof data.sleepy === "number" ? data.sleepy : null,
                            calm: typeof data.calm === "number" ? data.calm : null,
                            daytime: typeof data.daytime === "number" ? data.daytime : null,
                            clarity: typeof data.clarity === "number" ? data.clarity : null,

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
        return reviews.map((r) =>
            avgEffects([r.daytime, r.sleepy, r.calm, r.clarity, r.backPain, r.jointPain, r.legPain, r.headacheRelief, r.racingThoughts])
        );
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

        const backPainAvg = avgNumbers(reviews.map((r) => r.backPain));
        const jointPainAvg = avgNumbers(reviews.map((r) => r.jointPain));
        const legPainAvg = avgNumbers(reviews.map((r) => r.legPain));
        const headacheReliefAvg = avgNumbers(reviews.map((r) => r.headacheRelief));
        const racingThoughtsAvg = avgNumbers(reviews.map((r) => r.racingThoughts));

        const withAnySub = reviews.filter((r) => {
            const vals = [r.sleepy, r.calm, r.daytime, r.clarity, r.backPain, r.jointPain, r.legPain, r.headacheRelief, r.racingThoughts];
            return vals.some((v) => typeof v === "number" && v >= 1 && v <= 5);
        }).length;

        return {
            sleepyAvg,
            calmAvg,
            daytimeAvg,
            clarityAvg,
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

        const effectsMean = avgEffects([r.daytime, r.sleepy, r.calm, r.clarity, r.backPain, r.jointPain, r.legPain, r.headacheRelief, r.racingThoughts]);

        const effectVals = [r.daytime, r.sleepy, r.calm, r.clarity, r.backPain, r.jointPain, r.legPain, r.headacheRelief, r.racingThoughts].filter(
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
        const visible = myReportedIds.size ? reviews.filter((r) => !myReportedIds.has(r.id)) : reviews;
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
    }, [reviews, sortMode, myReportedIds, getReviewScore]);

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

    const openWriteNewReview = useCallback(() => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in to write a review.");
            return;
        }
        if (!productId) return;

        setEditingReviewId(null);
        setDraft(emptyDraft);
        setEditorOpen(true);
    }, [emptyDraft, productId]);

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
                        createdAt: firestore.FieldValue.serverTimestamp(),
                    });
            }

            setEditorOpen(false);
            setEditingReviewId(null);
            startCooldown();
        } catch (e: any) {
            console.log("saveReview error:", e);
            Alert.alert("Could not save review", getFriendlyReviewError(e, "save"));
        } finally {
            setSubmitting(false);
        }
    }, [draft, editingReviewId, isCooldown, productId, sanitizeEffectScore, startCooldown]);

    /* -------------------- Delete -------------------- */

    const deleteReview = useCallback(async (reviewId: string) => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Sign in required", "Please sign in.");
            return;
        }

        try {
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
                { text: "Delete", style: "destructive", onPress: () => deleteReview(reviewId) },
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

            await firestore().runTransaction(async (tx) => {
                const reviewSnap = await tx.get(reviewRef);
                const myVoteSnap = await tx.get(myVoteRef);

                if (!reviewSnap.exists) return;

                const data = reviewSnap.data() as any;
                const reviewOwnerUid = typeof data?.userId === "string" ? data.userId : "";
                if (reviewOwnerUid && reviewOwnerUid === user.uid) {
                    throw new Error("You can't mark your own review as helpful.");
                }

                const currentCountRaw = typeof data?.helpfulCount === "number" ? data.helpfulCount : 0;
                const currentCount = Number.isFinite(currentCountRaw) ? currentCountRaw : 0;

                const alreadyVoted = myVoteSnap.exists();

                if (alreadyVoted) {
                    tx.delete(myVoteRef);
                    tx.update(reviewRef, {
                        helpfulCount: Math.max(0, currentCount - 1),
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    });
                } else {
                    tx.set(myVoteRef, { reviewId, createdAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
                    tx.update(reviewRef, {
                        helpfulCount: currentCount + 1,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    });
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

        setReportSubmitting(true);

        try {
            const reviewId = reportingReview.id;

            await firestore().collection("reviewReports").add({
                reviewId,
                productId,
                reportedUserId: reportingReview.userId,
                reporterUserId: user.uid,
                reason: reportReason,
                note: reportNote.trim() ? reportNote.trim() : null,
                createdAt: firestore.FieldValue.serverTimestamp(),
                createdAtMs: Date.now(),
            });

            await firestore()
                .collection("users")
                .doc(user.uid)
                .collection("reportedReviews")
                .doc(reviewId)
                .set(
                    {
                        reviewId,
                        productId,
                        reason: reportReason,
                        note: reportNote.trim() ? reportNote.trim() : null,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        createdAtMs: Date.now(),
                    },
                    { merge: true }
                );

            setReportOpen(false);
            setReportingReview(null);

            Alert.alert("Reported", "Thanks. That review will be hidden for you.");
        } catch (e: any) {
            console.log("submitReport error:", e);
            Alert.alert("Could not report", getFriendlyReviewError(e, "report"));
        } finally {
            setReportSubmitting(false);
        }
    }, [productId, reportNote, reportReason, reportingReview]);

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
                        {safeName(product?.maker) ? `${product?.maker} · ` : ""}
                        {product?.type ?? "flower"}
                        {typeof product?.thcPct === "number" ? ` · THC ${formatPct(product?.thcPct)}` : ""}
                        {typeof product?.cbdPct === "number" ? ` · CBD ${formatPct(product?.cbdPct)}` : ""}
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

                    <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ color: theme.colors.textOnDarkSecondary, fontWeight: "900" }}>
                            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                        </Text>

                        <Text style={{ fontSize: 40, fontWeight: "900", color: theme.colors.textOnDark }}>{robustProductScore ? robustProductScore.toFixed(1) : "0.0"}</Text>
                    </View>

                    <Text style={{ marginTop: 18, fontSize: 28, fontWeight: "900", color: theme.colors.textOnDark }}>Summary of effects</Text>

                    <View style={{ marginTop: 10 }}>
                        {[
                            { label: "Daytime suitability", value: effectsSummary.daytimeAvg },
                            { label: "Sleepiness", value: effectsSummary.sleepyAvg },
                            { label: "Calm", value: effectsSummary.calmAvg },
                            { label: "Mental clarity", value: effectsSummary.clarityAvg },
                            { label: "Back pain relief", value: effectsSummary.backPainAvg },
                            { label: "Joint pain relief", value: effectsSummary.jointPainAvg },
                            { label: "Leg pain relief", value: effectsSummary.legPainAvg },
                            { label: "Headache relief", value: effectsSummary.headacheReliefAvg },
                            { label: "Racing thoughts relief", value: effectsSummary.racingThoughtsAvg },
                        ].map((row) => (
                            <View key={row.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                                <Text style={{ flex: 1, color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>{row.label}</Text>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                    <BudRating value={row.value ? row.value : 0} size={16} />
                                    <Text style={{ width: 44, textAlign: "right", color: theme.colors.textOnDark, fontWeight: "900", fontSize: 18 }}>
                                        {round1(row.value)}
                                    </Text>
                                </View>
                            </View>
                        ))}

                        {effectsSummary.withAnySub > 0 ? (
                            <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                                Based on {effectsSummary.withAnySub} reviews with effect ratings.
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View style={{ height: 14 }} />

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, marginTop: 2 }}>
                    <Text style={{ fontSize: 42, fontWeight: "800", color: "rgba(255,255,255,0.90)", letterSpacing: -0.4 }}>Reviews</Text>

                    <View ref={sortBtnRef as any}>
                        <Pressable
                            onPress={openSortMenu}
                            style={({ pressed }) => [styles.sortPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                        >
                            <Text style={{ fontWeight: "800", color: "rgba(255,255,255,0.88)" }}>{sortLabel}</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={{ height: 12 }} />

                <Pressable
                    onPress={openWriteNewReview}
                    disabled={isCooldown}
                    style={({ pressed }) => [
                        styles.formBtnAlt,
                        {
                            borderRadius: 26,
                            opacity: isCooldown ? 0.45 : pressed ? 0.9 : 1,
                            transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                    ]}
                >
                    <Text style={[styles.formBtnText, { color: theme.colors.textOnDark, fontSize: 22 }]}>{isCooldown ? `Wait ${secondsLeft}s` : "Write a new review"}</Text>
                </Pressable>

                <View style={{ height: 14 }} />
            </View>
        );
    }, [
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
        secondsLeft,
        sortLabel,
        terps,
        toggleFavoriteSlot,
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

    /* -------------------- Loading / Not found -------------------- */

    if (loadingProduct) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 72 }}>
                    <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                    <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary }}>Loading product...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!product) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
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

            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
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
                <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={closeEditor}>
                    <View style={styles.editorModalRoot}>
                        <Pressable style={styles.editorBackdrop} onPress={closeEditor} />

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

                                    {(
                                        [
                                            { label: "Daytime suitability", key: "daytime" as const },
                                            { label: "Sleepiness", key: "sleepy" as const },
                                            { label: "Calm", key: "calm" as const },
                                            { label: "Mental clarity", key: "clarity" as const },
                                            { label: "Back pain relief", key: "backPain" as const },
                                            { label: "Joint pain relief", key: "jointPain" as const },
                                            { label: "Leg pain relief", key: "legPain" as const },
                                            { label: "Headache relief", key: "headacheRelief" as const },
                                            { label: "Racing thoughts relief", key: "racingThoughts" as const },
                                        ] as Array<{ label: string; key: EffectKey }>
                                    ).map((row) => {
                                        const v = ((draft as any)[row.key] ?? null) as number | null;

                                        return (
                                            <View key={row.key} style={styles.effectBlock}>
                                                <View style={styles.effectHeaderRow}>
                                                    <Text style={styles.effectLabel}>{row.label}</Text>
                                                    <Text style={[styles.effectValue, v === null ? { color: "rgba(255,255,255,0.58)" } : null]}>
                                                        {v === null ? "—" : v}
                                                    </Text>
                                                </View>

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
                                                styles.formBtn,
                                                {
                                                    flex: 1,
                                                    opacity: reportSubmitting ? 0.45 : pressed ? 0.9 : 1,
                                                    transform: [{ scale: pressed ? 0.985 : 1 }],
                                                },
                                            ]}
                                            disabled={reportSubmitting}
                                        >
                                            <Text style={styles.formBtnText}>{reportSubmitting ? "Submitting..." : "Submit report"}</Text>
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
                        data={sortedReviews}
                        keyExtractor={(r) => r.id}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={() => {
                            Keyboard.dismiss();
                            setSortOpen(false);
                        }}
                        contentContainerStyle={{ paddingTop: TOP_PAD, paddingBottom: bottomSpace }}
                        ListHeaderComponent={Header}
                        ListEmptyComponent={loadingReviews ? null : EmptyState}
                        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                        renderItem={({ item: review }) => {
                            const isMine = !!currentUid && review.userId === currentUid;
                            const hasVoted = !!currentUid && myHelpfulIds.has(review.id);
                            const canVote = !!currentUid && !isMine;

                            const chips = [
                                { label: "Daytime", value: review.daytime },
                                { label: "Sleepy", value: review.sleepy },
                                { label: "Calm", value: review.calm },
                                { label: "Clarity", value: review.clarity },
                                { label: "Back pain", value: review.backPain },
                                { label: "Joint pain", value: review.jointPain },
                                { label: "Leg pain", value: review.legPain },
                                { label: "Headache", value: review.headacheRelief },
                                { label: "Racing thoughts", value: review.racingThoughts },
                            ].filter((e) => typeof e.value === "number" && (e.value as number) >= 1 && (e.value as number) <= 5);

                            return (
                                <View style={styles.reviewItem}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: "900", color: theme.colors.textOnDark, fontSize: 16 }}>{displayNameForUid(review.userId)}</Text>
                                            <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary, fontSize: 13 }}>{new Date(getCreatedAtMs(review)).toLocaleDateString()}</Text>
                                        </View>

                                        <BudRating value={getReviewScore(review)} size={14} />
                                    </View>

                                    {review.text ? <Text style={{ marginTop: 10, color: theme.colors.textOnDark, lineHeight: 20 }}>{review.text}</Text> : null}

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

                                        {!isMine ? (
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
