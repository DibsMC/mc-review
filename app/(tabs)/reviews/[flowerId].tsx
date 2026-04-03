import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../lib/theme";
import { trackEvent } from "../../../lib/analytics";
import { ensureUserProfileDoc } from "../../../lib/userProfileDoc";
import BrandedScreenBackground from "../../../components/BrandedScreenBackground";
import { getAsyncStorage } from "../../../lib/nativeDeps";

const budImg = require("../../../assets/icons/bud.png");
const flowersBg = require("../../../assets/images/flowers-bg.png");

type CatalogueSourceMeta = {
    name?: string | null;
    url?: string | null;
    type?: string | null;
    checkedAt?: FirebaseFirestoreTypes.Timestamp | number | null;
    notes?: string | null;
};

type AvailabilityReview = {
    status?: "available" | "possibly_unavailable" | "discontinued" | "unknown" | null;
    confidence?: string | null;
    checkedAt?: FirebaseFirestoreTypes.Timestamp | number | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    notes?: string | null;
    signals?: string[] | null;
};

type Product = {
    id: string;
    name: string;
    maker: string;
    variant?: string | null;
    type: string; // "flower" etc
    strainType?: string | null;
    thcPct?: number | null;
    cbdPct?: number | null;
    terpenes?: string | null;
    genetics?: string | null;
    countryOfOrigin?: string | null;
    irradiationStatus?: string | null;
    producerUseCases?: string[] | null;
    producerNotes?: string | null;
    catalogueSource?: CatalogueSourceMeta | null;
    availabilityReview?: AvailabilityReview | null;
};

type Review = {
    id: string;
    productId: string;
    userId: string;

    rating: number;
    score?: number | null;
    helpfulCount?: number | null;
    reportCount?: number | null;
    moderationStatus?: string | null;

    text?: string | null;
    createdAt?: FirebaseFirestoreTypes.Timestamp | number | null;

    sleepy?: number | null;
    calm?: number | null;
    daytime?: number | null;
    clarity?: number | null;
    painRelief?: number | null;
    useCases?: string[] | null;
    painTags?: string[] | null;
    onsetLabel?: string | null;
    durationLabel?: string | null;
    downsideTags?: string[] | null;
    wouldOrderAgain?: boolean | null;
};

type UserProfile = {
    displayName?: string | null;
};

type PersonalNoteItem = {
    id: string;
    text: string;
    updatedAtMs: number;
};

type StoredReportedReviewEntry = {
    reviewId?: unknown;
    productId?: unknown;
    productName?: unknown;
    targetUserId?: unknown;
    reporterUid?: unknown;
    reporterDisplayName?: unknown;
    reporterEmail?: unknown;
    reviewTextPreview?: unknown;
    createdAtMs?: unknown;
    createdAt?: unknown;
};

type SortMode = "recent" | "high" | "low";

type FavoriteSlot = "general" | "daytime" | "afternoon" | "night";
type FavoriteSlots = Record<FavoriteSlot, boolean>;

const EMPTY_SLOTS: FavoriteSlots = {
    general: false,
    daytime: false,
    afternoon: false,
    night: false,
};

const FAVORITE_SLOT_META: Array<{
    key: FavoriteSlot;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}> = [
    { key: "general", label: "Favourite", icon: "star", color: "rgba(201,88,108,0.98)" },
    { key: "daytime", label: "Daytime", icon: "sunny", color: "rgba(229,189,72,0.98)" },
    { key: "afternoon", label: "Afternoon", icon: "time", color: "rgba(231,152,85,0.98)" },
    { key: "night", label: "Night", icon: "moon", color: "rgba(122,155,255,0.98)" },
];

function normalizeFavoriteSlots(raw: unknown): FavoriteSlots {
    if (!raw || typeof raw !== "object") return { ...EMPTY_SLOTS };
    const slots = raw as Record<string, unknown>;
    return {
        general: !!slots.general,
        daytime: !!slots.daytime,
        afternoon: !!slots.afternoon,
        night: !!slots.night,
    };
}

function hasAnyFavoriteSlot(slots: FavoriteSlots) {
    return slots.general || slots.daytime || slots.afternoon || slots.night;
}

const USE_CASE_OPTIONS = [
    "Daytime relief",
    "Evening wind-down",
    "Sleep support",
    "Stress reset",
    "Pain relief",
    "Mood lift",
] as const;

const PAIN_OPTIONS = [
    "Headache",
    "Back pain",
    "Leg pain",
    "Joint pain",
    "Nerve pain",
    "Period cramps",
] as const;

const ONSET_OPTIONS = [
    "Fast",
    "Gradual",
    "Took a while",
    "Needed a couple of pulls",
] as const;

const DURATION_OPTIONS = [
    "Short",
    "Balanced",
    "Long-lasting",
] as const;

const DOWNSIDE_OPTIONS = [
    "Too dry",
    "Too heavy",
    "Foggy head",
    "Racy start",
    "Harsh taste",
    "Short-lived",
] as const;

function formatPct(n: number | null | undefined) {
    if (n === null || n === undefined) return "-";
    return `${n}%`;
}

function safeName(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : "";
}

function getCreatedAtMs(r: Review) {
    const c = r.createdAt;
    if (!c) return 0;
    if (typeof c === "number") return c;
    // Firestore Timestamp
    if (typeof (c as any)?.toMillis === "function") return (c as any).toMillis();
    if (typeof (c as any)?.seconds === "number") return (c as any).seconds * 1000;
    return 0;
}

function round1(n: number) {
    return Math.round(n * 10) / 10;
}

function toggleChoice(list: string[], value: string) {
    return list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
}

function boolLabel(value: boolean | null | undefined) {
    if (value === true) return "Would order again";
    if (value === false) return "Would not order again";
    return null;
}

function avgNumbers(vals: Array<number | null | undefined>) {
    const xs = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (xs.length === 0) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function timestampToMs(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
    if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
    return 0;
}

function normalizePersonalNotesEntry(raw: unknown): PersonalNoteItem[] {
    if (!raw || typeof raw !== "object") return [];

    const entry = raw as Record<string, unknown>;
    const items = Array.isArray(entry.items)
        ? entry.items
              .map((item, index) => {
                  if (!item || typeof item !== "object") return null;
                  const parsed = item as Record<string, unknown>;
                  const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
                  if (!text) return null;
                  return {
                      id:
                          typeof parsed.id === "string" && parsed.id.trim()
                              ? parsed.id.trim()
                              : `note-${index + 1}`,
                      text,
                      updatedAtMs: timestampToMs(parsed.updatedAt ?? entry.updatedAt),
                  } satisfies PersonalNoteItem;
              })
              .filter((item): item is PersonalNoteItem => Boolean(item))
        : [];

    if (items.length > 0) {
        return items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    }

    const legacyText = typeof entry.text === "string" ? entry.text.trim() : "";
    if (!legacyText) return [];

    return [
        {
            id: "legacy-note",
            text: legacyText,
            updatedAtMs: timestampToMs(entry.updatedAt),
        },
    ];
}

function formatNoteUpdatedAt(updatedAtMs: number) {
    if (!updatedAtMs) return "Saved recently";
    return `Updated ${new Date(updatedAtMs).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
    })}`;
}

function noteStorageKey(productId: string) {
    return productId.replace(/[.\/#[\]$]/g, "_");
}

function localNoteStorageKey(uid: string, productId: string) {
    return `@mc/private-notes/${uid}/${noteStorageKey(productId)}`;
}

function formatCheckedAt(value: unknown) {
    const ms = timestampToMs(value);
    if (!ms) return null;
    return new Date(ms).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function extractReportedReviewIds(rawMeta: unknown, rawIds: unknown) {
    const ids = new Set<string>();

    if (rawMeta && typeof rawMeta === "object") {
        Object.entries(rawMeta as Record<string, unknown>).forEach(([reviewId, value]) => {
            if (!reviewId.trim()) return;
            if (value && typeof value === "object") ids.add(reviewId.trim());
        });
    }

    if (rawIds && typeof rawIds === "object") {
        Object.entries(rawIds as Record<string, unknown>).forEach(([reviewId, value]) => {
            if (!reviewId.trim()) return;
            if (value) ids.add(reviewId.trim());
        });
    }

    return Array.from(ids);
}

function parseLocalNotes(raw: string | null): PersonalNoteItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item, index) => {
                if (!item || typeof item !== "object") return null;
                const entry = item as Record<string, unknown>;
                const text = typeof entry.text === "string" ? entry.text.trim() : "";
                if (!text) return null;
                return {
                    id:
                        typeof entry.id === "string" && entry.id.trim()
                            ? entry.id.trim()
                            : `local-note-${index + 1}`,
                    text,
                    updatedAtMs: timestampToMs(entry.updatedAtMs ?? entry.updatedAt),
                } satisfies PersonalNoteItem;
            })
            .filter((item): item is PersonalNoteItem => Boolean(item))
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    } catch {
        return [];
    }
}

// 75% overall rating, 25% effects average (only if any effects exist)
function computeHeadlineScore(input: {
    rating: number;
    daytime?: number | null;
    sleepy?: number | null;
    calm?: number | null;
    clarity?: number | null;
}) {
    const rating = Number.isFinite(input.rating) ? input.rating : 0;
    const effects = avgNumbers([input.daytime, input.sleepy, input.calm, input.clarity]);
    if (!effects) return round1(rating);
    return round1(rating * 0.75 + effects * 0.25);
}

/* -------------------- Terpenes parsing -------------------- */

function prettyTerpeneName(raw: string) {
    const normalized = raw
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");

    const aliases: Record<string, string> = {
        "a-pinene": "alpha-pinene",
        "b-pinene": "beta-pinene",
        "a-caryophyllene": "alpha-caryophyllene",
        "b-caryophyllene": "beta-caryophyllene",
    };

    const resolved = aliases[normalized] ?? normalized;
    return resolved
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function terpeneKey(raw: string) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");
}

function terpeneVisualMeta(raw: string) {
    const key = terpeneKey(raw);

    if (key.includes("limonene")) {
        return {
            icon: "sunny-outline" as const,
            borderColor: "rgba(246,207,97,0.26)",
            backgroundColor: "rgba(246,207,97,0.14)",
            iconBackground: "rgba(246,207,97,0.18)",
            iconColor: "rgba(255,231,161,0.98)",
        };
    }

    if (key.includes("myrcene")) {
        return {
            icon: "moon-outline" as const,
            borderColor: "rgba(129,180,151,0.26)",
            backgroundColor: "rgba(63,103,80,0.30)",
            iconBackground: "rgba(129,180,151,0.18)",
            iconColor: "rgba(212,245,225,0.98)",
        };
    }

    if (key.includes("linalool")) {
        return {
            icon: "flower-outline" as const,
            borderColor: "rgba(185,150,235,0.28)",
            backgroundColor: "rgba(85,62,118,0.28)",
            iconBackground: "rgba(185,150,235,0.18)",
            iconColor: "rgba(239,224,255,0.98)",
        };
    }

    if (key.includes("pinene")) {
        return {
            icon: "leaf-outline" as const,
            borderColor: "rgba(101,203,152,0.24)",
            backgroundColor: "rgba(42,88,63,0.28)",
            iconBackground: "rgba(101,203,152,0.18)",
            iconColor: "rgba(213,249,226,0.98)",
        };
    }

    if (key.includes("caryophyllene")) {
        return {
            icon: "flame-outline" as const,
            borderColor: "rgba(236,149,102,0.26)",
            backgroundColor: "rgba(112,58,42,0.28)",
            iconBackground: "rgba(236,149,102,0.18)",
            iconColor: "rgba(255,221,204,0.98)",
        };
    }

    if (key.includes("humulene")) {
        return {
            icon: "nutrition-outline" as const,
            borderColor: "rgba(212,190,120,0.24)",
            backgroundColor: "rgba(98,83,44,0.28)",
            iconBackground: "rgba(212,190,120,0.18)",
            iconColor: "rgba(255,241,202,0.98)",
        };
    }

    if (key.includes("terpinolene") || key.includes("ocimene")) {
        return {
            icon: "sparkles-outline" as const,
            borderColor: "rgba(132,196,255,0.24)",
            backgroundColor: "rgba(42,73,102,0.28)",
            iconBackground: "rgba(132,196,255,0.16)",
            iconColor: "rgba(219,239,255,0.98)",
        };
    }

    return {
        icon: "flask-outline" as const,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.06)",
        iconBackground: "rgba(255,255,255,0.08)",
        iconColor: "rgba(255,255,255,0.94)",
    };
}

function formatTerpeneValue(strength: string) {
    const trimmed = strength.trim();
    if (!trimmed) return null;
    if (trimmed.endsWith("%")) return trimmed;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
            return {
                name,
                strength,
                valueLabel: formatTerpeneValue(strength),
                ...terpeneVisualMeta(nameRaw),
            };
        })
        .filter((t) => t.name);
}

/* -------------------- BudRating -------------------- */

function BudRating({ value, size = 18 }: { value: number; size?: number }) {
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
    const glowEnabled = Platform.OS !== "android";
    const scale = Platform.OS === "android" ? 1 : 1.06;

    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const rawFill = Math.max(0, Math.min(1, safe - i));
                const fill = Math.round(rawFill * 10) / 10;
                const px = Math.round(size * fill);

                return (
                    <View
                        key={`bud-${i}`}
                        style={{
                            width: size,
                            height: size,
                            marginRight: i === 4 ? 0 : 8,
                        }}
                    >
                        <Image
                            source={budImg}
                            resizeMode="contain"
                            style={{
                                width: size,
                                height: size,
                                opacity: 0.28,
                            }}
                        />

                        {fill > 0 ? (
                            <View
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: px,
                                    height: size,
                                    overflow: "hidden",
                                }}
                            >
                                {glowEnabled ? (
                                    <View
                                        pointerEvents="none"
                                        style={{
                                            position: "absolute",
                                            left: -4,
                                            top: -4,
                                            width: size + 8,
                                            height: size + 8,
                                            borderRadius: 999,
                                            shadowColor: "rgba(188,239,162,0.96)",
                                            shadowOpacity: 1,
                                            shadowRadius: 10,
                                            shadowOffset: { width: 0, height: 0 },
                                            elevation: 6,
                                            opacity: 0.92,
                                        }}
                                    />
                                ) : null}
                                <Image
                                    source={budImg}
                                    resizeMode="contain"
                                    style={{
                                        width: size,
                                        height: size,
                                        opacity: 1,
                                        transform: [{ scale }],
                                    }}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

function MetricCard({
    icon,
    label,
    hint,
    lowLabel,
    highLabel,
    value,
    onChange,
    disabled,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint: string;
    lowLabel: string;
    highLabel: string;
    value: number;
    onChange: (n: number) => void;
    disabled: boolean;
}) {
    return (
        <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
                <View style={styles.metricIconWrap}>
                    <Ionicons name={icon} size={16} color={theme.colors.textOnDark} />
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={styles.metricTitle}>{label}</Text>
                    <Text style={styles.metricHint}>{hint}</Text>
                </View>
            </View>

            <View style={styles.metricScaleWrap}>
                <Text style={styles.metricEdgeLabel}>{lowLabel}</Text>

                <View style={styles.metricButtonsRow}>
                    {[1, 2, 3, 4, 5].map((n) => {
                        const selected = value === n;

                        return (
                            <Pressable
                                key={`${label}-${n}`}
                                onPress={() => {
                                    if (disabled) return;
                                    onChange(n);
                                }}
                                disabled={disabled}
                                style={[
                                    styles.metricButton,
                                    selected ? styles.metricButtonSelected : null,
                                    disabled ? { opacity: 0.6 } : null,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.metricButtonText,
                                        selected ? styles.metricButtonTextSelected : null,
                                    ]}
                                >
                                    {n}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.metricEdgeLabel}>{highLabel}</Text>
            </View>
        </View>
    );
}

function PillOption({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.pillOption,
                selected ? styles.pillOptionSelected : null,
                pressed ? { opacity: 0.82 } : null,
            ]}
        >
            <Text style={[styles.pillOptionText, selected ? styles.pillOptionTextSelected : null]}>
                {label}
            </Text>
        </Pressable>
    );
}

/* -------------------- BlingButton -------------------- */

function BlingButton({
    label,
    onPress,
    disabled,
    variant,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    variant: "gold" | "green";
}) {
    const gold = ["rgba(212,175,55,0.98)", "rgba(228,198,92,0.94)", "rgba(246,228,140,0.92)"] as const;
    const green = ["rgba(120,190,140,0.98)", "rgba(150,215,168,0.95)", "rgba(185,235,200,0.92)"] as const;

    const border = variant === "gold" ? "rgba(212,175,55,0.45)" : "rgba(150,215,168,0.40)";
    const textColor = "rgba(10,12,14,0.92)";

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[styles.blingBtnOuter, { borderColor: border, opacity: disabled ? 0.65 : 1 }]}
        >
            <LinearGradient
                pointerEvents="none"
                colors={variant === "gold" ? [...gold] : [...green]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
            />

            <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.blingGloss}
            />

            <View pointerEvents="none" style={styles.blingInnerGlow} />

            <Text style={[styles.blingBtnText, { color: textColor }]}>{label}</Text>
        </Pressable>
    );
}

/* ==================== SCREEN ==================== */

export default function FlowerDetail() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { flowerId } = useLocalSearchParams<{ flowerId?: string }>();
    const productId = typeof flowerId === "string" ? flowerId : "";

    const [product, setProduct] = useState<Product | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    const [nameMap, setNameMap] = useState<Record<string, string>>({});

    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [sortOpen, setSortOpen] = useState(false);

    const sortBtnRef = useRef<View | null>(null);
    const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    const [reviewOpen, setReviewOpen] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

    const [rating, setRating] = useState<number>(5);
    const [text, setText] = useState<string>("");

    const [daytime, setDaytime] = useState<number>(3);
    const [sleepy, setSleepy] = useState<number>(3);
    const [calm, setCalm] = useState<number>(3);
    const [clarity, setClarity] = useState<number>(3);
    const [painRelief, setPainRelief] = useState<number>(3);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [useCases, setUseCases] = useState<string[]>([]);
    const [painTags, setPainTags] = useState<string[]>([]);
    const [onsetLabel, setOnsetLabel] = useState<string | null>(null);
    const [durationLabel, setDurationLabel] = useState<string | null>(null);
    const [downsideTags, setDownsideTags] = useState<string[]>([]);
    const [wouldOrderAgain, setWouldOrderAgain] = useState<boolean | null>(null);
    const [notesOpen, setNotesOpen] = useState(false);
    const [noteEditorOpen, setNoteEditorOpen] = useState(false);
    const [personalNoteDraft, setPersonalNoteDraft] = useState("");
    const [personalNotes, setPersonalNotes] = useState<PersonalNoteItem[]>([]);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteSaving, setNoteSaving] = useState(false);
    const [legacyFavoriteProductIds, setLegacyFavoriteProductIds] = useState<string[]>([]);
    const [favoriteSlots, setFavoriteSlots] = useState<FavoriteSlots>({ ...EMPTY_SLOTS });
    const [helpfulReviewIds, setHelpfulReviewIds] = useState<string[]>([]);
    const [reportedReviewIdsDoc, setReportedReviewIdsDoc] = useState<string[]>([]);
    const [reportedReviewIdsLegacy, setReportedReviewIdsLegacy] = useState<string[]>([]);

    const [submitting, setSubmitting] = useState(false);

    const COOLDOWN_MS = 10_000;
    const [cooldownUntil, setCooldownUntil] = useState<number>(0);
    const [thankYouVisible, setThankYouVisible] = useState(false);
    const thankYouTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trackedProductViewRef = useRef<string | null>(null);
    const personalNotesRef = useRef<PersonalNoteItem[]>([]);
    const localPersonalNotesRef = useRef<PersonalNoteItem[]>([]);
    const remotePersonalNotesRef = useRef<PersonalNoteItem[]>([]);

    const [nowTick, setNowTick] = useState(Date.now());
    const isCooldown = nowTick < cooldownUntil;
    const reportedReviewIds = useMemo(
        () => Array.from(new Set([...reportedReviewIdsDoc, ...reportedReviewIdsLegacy])),
        [reportedReviewIdsDoc, reportedReviewIdsLegacy]
    );

    const secondsLeft = useMemo(() => {
        if (!isCooldown) return 0;
        const msLeft = cooldownUntil - nowTick;
        return Math.max(1, Math.ceil(msLeft / 1000));
    }, [cooldownUntil, isCooldown, nowTick]);

    const currentUser = auth().currentUser;
    const currentUid = currentUser?.uid ?? "";
    const meName = safeName(currentUser?.displayName) || "You";
    const currentEmail = typeof currentUser?.email === "string" ? currentUser.email.trim().toLowerCase() : "";
    const personalNoteKey = useMemo(() => noteStorageKey(productId), [productId]);
    const AsyncStorage = getAsyncStorage();

    const applyPersonalNotes = useCallback((nextNotes: PersonalNoteItem[]) => {
        personalNotesRef.current = nextNotes;
        setPersonalNotes(nextNotes);
    }, []);

    const syncCurrentUserDoc = useCallback(async () => {
        if (!currentUid) return;
        await ensureUserProfileDoc({
            uid: currentUid,
            email: currentEmail || null,
            displayName: meName,
            touchLastActive: true,
        });
    }, [currentEmail, currentUid, meName]);

    const patchReviewState = useCallback(
        (
            reviewId: string,
            updater: (review: Review) => Partial<Review>
        ) => {
            setReviews((prev) =>
                prev.map((review) =>
                    review.id === reviewId
                        ? {
                              ...review,
                              ...updater(review),
                          }
                        : review
                )
            );
        },
        []
    );

    const getReviewScore = (r: Review) => {
        if (typeof r.score === "number" && Number.isFinite(r.score)) return r.score;
        if (typeof r.rating === "number" && Number.isFinite(r.rating)) return r.rating;
        return 0;
    };

    const myLastReview = useMemo(() => {
        if (!currentUid) return null;
        const mine = reviews.filter((r) => r.userId === currentUid);
        if (mine.length === 0) return null;
        return [...mine].sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a))[0];
    }, [currentUid, reviews]);

    const avgOverall = useMemo(() => {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, r) => acc + getReviewScore(r), 0);
        return sum / reviews.length;
    }, [reviews]);

    const effectsSummary = useMemo(() => {
        const sleepyAvg = avgNumbers(reviews.map((r) => r.sleepy));
        const calmAvg = avgNumbers(reviews.map((r) => r.calm));
        const daytimeAvg = avgNumbers(reviews.map((r) => r.daytime));
        const clarityAvg = avgNumbers(reviews.map((r) => r.clarity));
        const painReliefAvg = avgNumbers(reviews.map((r) => r.painRelief));

        const withAnySub = reviews.filter(
            (r) =>
                typeof r.sleepy === "number" ||
                typeof r.calm === "number" ||
                typeof r.daytime === "number" ||
                typeof r.clarity === "number" ||
                typeof r.painRelief === "number"
        ).length;

        return { sleepyAvg, calmAvg, daytimeAvg, clarityAvg, painReliefAvg, withAnySub };
    }, [reviews]);

    const sortedReviews = useMemo(() => {
        const list = [...reviews];

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
    }, [reviews, sortMode]);

    useEffect(() => {
        return () => {
            if (thankYouTimer.current) clearTimeout(thankYouTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!isCooldown) return;
        const t = setInterval(() => setNowTick(Date.now()), 250);
        return () => clearInterval(t);
    }, [isCooldown]);

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
                        strainType: typeof data?.strainType === "string" ? data.strainType : null,
                        thcPct: typeof data?.thcPct === "number" ? data.thcPct : null,
                        cbdPct: typeof data?.cbdPct === "number" ? data.cbdPct : null,
                        terpenes: typeof data?.terpenes === "string" ? data.terpenes : null,
                        genetics: typeof data?.genetics === "string" ? data.genetics : null,
                        countryOfOrigin: typeof data?.countryOfOrigin === "string" ? data.countryOfOrigin : null,
                        irradiationStatus: typeof data?.irradiationStatus === "string" ? data.irradiationStatus : null,
                        producerUseCases: Array.isArray(data?.producerUseCases)
                            ? data.producerUseCases.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
                            : null,
                        producerNotes: typeof data?.producerNotes === "string" ? data.producerNotes : null,
                        catalogueSource:
                            data?.catalogueSource && typeof data.catalogueSource === "object"
                                ? {
                                      name: typeof data.catalogueSource.name === "string" ? data.catalogueSource.name : null,
                                      url: typeof data.catalogueSource.url === "string" ? data.catalogueSource.url : null,
                                      type: typeof data.catalogueSource.type === "string" ? data.catalogueSource.type : null,
                                      checkedAt: data.catalogueSource.checkedAt ?? null,
                                      notes: typeof data.catalogueSource.notes === "string" ? data.catalogueSource.notes : null,
                                  }
                                : null,
                        availabilityReview:
                            data?.availabilityReview && typeof data.availabilityReview === "object"
                                ? {
                                      status: typeof data.availabilityReview.status === "string" ? data.availabilityReview.status : null,
                                      confidence:
                                          typeof data.availabilityReview.confidence === "string"
                                              ? data.availabilityReview.confidence
                                              : null,
                                      checkedAt: data.availabilityReview.checkedAt ?? data.availabilityCheckedAt ?? null,
                                      sourceName:
                                          typeof data.availabilityReview.sourceName === "string"
                                              ? data.availabilityReview.sourceName
                                              : null,
                                      sourceUrl:
                                          typeof data.availabilityReview.sourceUrl === "string"
                                              ? data.availabilityReview.sourceUrl
                                              : null,
                                      notes:
                                          typeof data.availabilityReview.notes === "string"
                                              ? data.availabilityReview.notes
                                              : null,
                                      signals: Array.isArray(data?.availabilityReview?.signals)
                                          ? data.availabilityReview.signals.filter(
                                                (item: unknown): item is string => typeof item === "string" && item.trim().length > 0
                                            )
                                          : null,
                                  }
                                : typeof data?.availabilityStatus === "string" || data?.availabilityCheckedAt
                                  ? {
                                        status: typeof data.availabilityStatus === "string" ? data.availabilityStatus : null,
                                        checkedAt: data.availabilityCheckedAt ?? null,
                                    }
                                  : null,
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

                        const sleepyFromDb = typeof data.sleepy === "number" ? data.sleepy : null;
                        const calmFromDb = typeof data.calm === "number" ? data.calm : null;
                        const daytimeFromDb = typeof data.daytime === "number" ? data.daytime : null;
                        const clarityFromDb = typeof data.clarity === "number" ? data.clarity : null;
                        const painReliefFromDb = typeof data.painRelief === "number" ? data.painRelief : null;

                        const scoreFromDb = typeof data.score === "number" ? data.score : null;

                        const computedScore = computeHeadlineScore({
                            rating: ratingFromDb,
                            daytime: daytimeFromDb,
                            sleepy: sleepyFromDb,
                            calm: calmFromDb,
                            clarity: clarityFromDb,
                        });

                        return {
                            id: d.id,
                            productId: typeof data.productId === "string" ? data.productId : "",
                            userId: typeof data.userId === "string" ? data.userId : "",
                            rating: ratingFromDb,
                            score: scoreFromDb ?? computedScore,
                            helpfulCount: typeof data.helpfulCount === "number" ? Math.max(0, data.helpfulCount) : 0,
                            reportCount: typeof data.reportCount === "number" ? Math.max(0, data.reportCount) : 0,
                            moderationStatus: typeof data.moderationStatus === "string" ? data.moderationStatus : "active",
                            text: typeof data.text === "string" ? data.text : null,
                            createdAt: (data.createdAt ?? null) as any,
                            sleepy: sleepyFromDb,
                            calm: calmFromDb,
                            daytime: daytimeFromDb,
                            clarity: clarityFromDb,
                            painRelief: painReliefFromDb,
                            useCases: Array.isArray(data.useCases)
                                ? data.useCases.filter((item: unknown): item is string => typeof item === "string")
                                : null,
                            painTags: Array.isArray(data.painTags)
                                ? data.painTags.filter((item: unknown): item is string => typeof item === "string")
                                : null,
                            onsetLabel: typeof data.onsetLabel === "string" ? data.onsetLabel : null,
                            durationLabel: typeof data.durationLabel === "string" ? data.durationLabel : null,
                            downsideTags: Array.isArray(data.downsideTags)
                                ? data.downsideTags.filter((item: unknown): item is string => typeof item === "string")
                                : null,
                            wouldOrderAgain:
                                typeof data.wouldOrderAgain === "boolean" ? data.wouldOrderAgain : null,
                        };
                    });

                    setReviews(
                        list.filter(
                            (review) =>
                                review.moderationStatus !== "removed_admin" &&
                                review.moderationStatus !== "removed_auto"
                        )
                    );
                    setLoadingReviews(false);
                },
                (err) => {
                    console.log("reviews load error:", err);
                    setLoadingReviews(false);
                }
            );

        return () => unsub();
    }, [productId]);

    // Fetch user names for review list
    useEffect(() => {
        const uids = Array.from(new Set(reviews.map((r) => r.userId).filter(Boolean)));
        if (uids.length === 0) return;

        const missing = uids.filter((uid) => !nameMap[uid]);
        if (missing.length === 0) return;

        let cancelled = false;

        (async () => {
            try {
                const chunks: string[][] = [];
                for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));

                const updates: Record<string, string> = {};

                for (const chunk of chunks) {
                    const snap = await firestore()
                        .collection("users")
                        .where(firestore.FieldPath.documentId(), "in", chunk)
                        .get();

                    snap.docs.forEach((doc) => {
                        const data = doc.data() as UserProfile;
                        const dn = safeName(data?.displayName);
                        if (dn) updates[doc.id] = dn;
                    });
                }

                if (!cancelled && Object.keys(updates).length > 0) {
                    setNameMap((prev) => ({ ...prev, ...updates }));
                }
            } catch (e) {
                console.log("user name fetch error:", e);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviews]);

    useEffect(() => {
        if (!currentUid || !productId) {
            setLegacyFavoriteProductIds([]);
            setFavoriteSlots({ ...EMPTY_SLOTS });
            return;
        }

        const userRef = firestore().collection("users").doc(currentUid);

        const unsubUser = userRef.onSnapshot(
            (doc) => {
                const data = (doc.data() as Record<string, any> | undefined) ?? {};
                const favs = Array.isArray(data.favoriteProductIds)
                    ? data.favoriteProductIds.filter((value: unknown): value is string => typeof value === "string")
                    : [];
                setLegacyFavoriteProductIds(favs);
            },
            () => {
                setLegacyFavoriteProductIds([]);
            }
        );

        const unsubFavoriteDoc = userRef
            .collection("favorites")
            .doc(productId)
            .onSnapshot(
                (doc) => {
                    const data = (doc.data() as Record<string, any> | undefined) ?? {};
                    setFavoriteSlots(normalizeFavoriteSlots(data.slots));
                },
                () => {
                    setFavoriteSlots({ ...EMPTY_SLOTS });
                }
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

    useEffect(() => {
        if (!currentUid || !productId) {
            personalNotesRef.current = [];
            localPersonalNotesRef.current = [];
            remotePersonalNotesRef.current = [];
            setPersonalNotes([]);
            setPersonalNoteDraft("");
            setEditingNoteId(null);
            setNotesOpen(false);
            setNoteEditorOpen(false);
            return;
        }

        const userRef = firestore().collection("users").doc(currentUid);
        const localStorageKey = localNoteStorageKey(currentUid, productId);

        personalNotesRef.current = [];
        localPersonalNotesRef.current = [];
        remotePersonalNotesRef.current = [];

        const syncNotes = () => {
            const nextNotes =
                remotePersonalNotesRef.current.length > 0
                    ? remotePersonalNotesRef.current
                    : localPersonalNotesRef.current.length > 0
                      ? localPersonalNotesRef.current
                      : personalNotesRef.current;
            applyPersonalNotes(nextNotes);
        };

        if (AsyncStorage) {
            AsyncStorage.getItem(localStorageKey)
                .then((raw) => {
                    localPersonalNotesRef.current = parseLocalNotes(raw);
                    syncNotes();
                })
                .catch((error) => {
                    console.log("personal note local load error:", error);
                });
        }

        const unsubLegacy = userRef.onSnapshot(
            (doc) => {
                const data = (doc.data() as Record<string, any> | undefined) ?? {};
                const noteEntry = data?.productNotes?.[personalNoteKey] ?? data?.productNotes?.[productId];
                remotePersonalNotesRef.current = normalizePersonalNotesEntry(noteEntry);
                if (remotePersonalNotesRef.current.length > 0) {
                    localPersonalNotesRef.current = remotePersonalNotesRef.current;
                    if (AsyncStorage) {
                        AsyncStorage.setItem(localStorageKey, JSON.stringify(remotePersonalNotesRef.current)).catch((error) => {
                            console.log("personal note local sync error:", error);
                        });
                    }
                }
                syncNotes();
            },
            (error) => {
                console.log("personal note legacy load error:", error);
            }
        );

        return () => {
            unsubLegacy();
        };
    }, [AsyncStorage, applyPersonalNotes, currentUid, personalNoteKey, productId]);

    useEffect(() => {
        if (!currentUid) {
            setHelpfulReviewIds([]);
            setReportedReviewIdsDoc([]);
            setReportedReviewIdsLegacy([]);
            return;
        }

        const userRef = firestore().collection("users").doc(currentUid);

        const unsubHelpful = userRef.collection("helpful").onSnapshot(
            (snapshot) => {
                setHelpfulReviewIds(snapshot.docs.map((doc) => doc.id));
            },
            () => {
                setHelpfulReviewIds([]);
            }
        );

        const unsubReportedDoc = userRef.onSnapshot(
            (snapshot) => {
                const data = snapshot.data() as {
                    reportedReviewMeta?: Record<string, StoredReportedReviewEntry>;
                    reportedReviewIds?: Record<string, boolean>;
                } | null;
                setReportedReviewIdsDoc(
                    extractReportedReviewIds(data?.reportedReviewMeta, data?.reportedReviewIds)
                );
            },
            () => {
                setReportedReviewIdsDoc([]);
            }
        );

        const unsubReportedLegacy = userRef.collection("reportedReviews").onSnapshot(
            (snapshot) => {
                setReportedReviewIdsLegacy(snapshot.docs.map((doc) => doc.id));
            },
            () => {
                setReportedReviewIdsLegacy([]);
            }
        );

        return () => {
            unsubHelpful();
            unsubReportedDoc();
            unsubReportedLegacy();
        };
    }, [currentUid]);

    useEffect(() => {
        if (!product) return;
        if (trackedProductViewRef.current === product.id) return;

        trackedProductViewRef.current = product.id;

        void trackEvent("product_view", {
            product_id: product.id,
            maker: product.maker || null,
            review_count: reviews.length,
        });
    }, [product, reviews.length]);

    const startCooldown = () => {
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        setNowTick(Date.now());

        setThankYouVisible(true);
        if (thankYouTimer.current) clearTimeout(thankYouTimer.current);

        thankYouTimer.current = setTimeout(() => {
            setThankYouVisible(false);
        }, COOLDOWN_MS);
    };

    const openWriteNewReview = () => {
        if (isCooldown) return;
        setEditingReviewId(null);
        setText("");
        setRating(5);
        setSleepy(3);
        setCalm(3);
        setDaytime(3);
        setClarity(3);
        setPainRelief(3);
        setDetailsOpen(false);
        setUseCases([]);
        setPainTags([]);
        setOnsetLabel(null);
        setDurationLabel(null);
        setDownsideTags([]);
        setWouldOrderAgain(null);
        setReviewOpen(true);
        setSortOpen(false);
        void trackEvent("review_start", {
            product_id: productId,
            mode: "new",
        });
    };

    const openEditLastReview = () => {
        if (isCooldown) return;

        if (!myLastReview) {
            openWriteNewReview();
            return;
        }

        setEditingReviewId(myLastReview.id);

        setRating(typeof myLastReview.rating === "number" ? myLastReview.rating : 5);
        setText(typeof myLastReview.text === "string" ? myLastReview.text : "");

        setDaytime(typeof myLastReview.daytime === "number" ? myLastReview.daytime : 3);
        setSleepy(typeof myLastReview.sleepy === "number" ? myLastReview.sleepy : 3);
        setCalm(typeof myLastReview.calm === "number" ? myLastReview.calm : 3);
        setClarity(typeof myLastReview.clarity === "number" ? myLastReview.clarity : 3);
        setPainRelief(typeof myLastReview.painRelief === "number" ? myLastReview.painRelief : 3);
        setDetailsOpen(
            Boolean(
                typeof myLastReview.painRelief === "number" ||
                myLastReview.useCases?.length ||
                myLastReview.painTags?.length ||
                myLastReview.onsetLabel ||
                myLastReview.durationLabel ||
                myLastReview.downsideTags?.length ||
                myLastReview.wouldOrderAgain !== null
            )
        );
        setUseCases(myLastReview.useCases ?? []);
        setPainTags(myLastReview.painTags ?? []);
        setOnsetLabel(myLastReview.onsetLabel ?? null);
        setDurationLabel(myLastReview.durationLabel ?? null);
        setDownsideTags(myLastReview.downsideTags ?? []);
        setWouldOrderAgain(
            typeof myLastReview.wouldOrderAgain === "boolean"
                ? myLastReview.wouldOrderAgain
                : null
        );

        setReviewOpen(true);
        setSortOpen(false);
        void trackEvent("review_start", {
            product_id: productId,
            mode: "edit_last",
        });
    };

    const submitReview = async () => {
        if (submitting || isCooldown) return;

        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Not signed in", "Please sign in to leave a review.");
            return;
        }

        if (!productId) {
            Alert.alert("Missing product id", "Go back and open the product again.");
            return;
        }

        const ratingInt = parseInt(String(rating), 10);
        const sleepyInt = parseInt(String(sleepy), 10);
        const calmInt = parseInt(String(calm), 10);
        const daytimeInt = parseInt(String(daytime), 10);
        const clarityInt = parseInt(String(clarity), 10);
        const painReliefInt = parseInt(String(painRelief), 10);

        if (!Number.isFinite(ratingInt) || ratingInt < 1 || ratingInt > 5) {
            Alert.alert("Rating must be 1 to 5");
            return;
        }

        const score = computeHeadlineScore({
            rating: ratingInt,
            daytime: daytimeInt,
            sleepy: sleepyInt,
            calm: calmInt,
            clarity: clarityInt,
        });

        setSubmitting(true);

        try {
            if (editingReviewId) {
                await firestore().collection("reviews").doc(editingReviewId).update({
                    rating: ratingInt,
                    score,
                    text: text.trim() ? text.trim() : null,
                    sleepy: sleepyInt,
                    calm: calmInt,
                    daytime: daytimeInt,
                    clarity: clarityInt,
                    painRelief: painReliefInt,
                    useCases,
                    painTags,
                    onsetLabel,
                    durationLabel,
                    downsideTags,
                    wouldOrderAgain,
                    editedAt: firestore.FieldValue.serverTimestamp(),
                });
            } else {
                await firestore().collection("reviews").add({
                    productId: String(productId),
                    userId: user.uid,
                    rating: ratingInt,
                    score,
                    text: text.trim() ? text.trim() : null,
                    sleepy: sleepyInt,
                    calm: calmInt,
                    daytime: daytimeInt,
                    clarity: clarityInt,
                    painRelief: painReliefInt,
                    useCases,
                    painTags,
                    onsetLabel,
                    durationLabel,
                    downsideTags,
                    wouldOrderAgain,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });
            }

            Keyboard.dismiss();

            setText("");
            setRating(5);
            setSleepy(3);
            setCalm(3);
            setDaytime(3);
            setClarity(3);
            setPainRelief(3);
            setDetailsOpen(false);
            setUseCases([]);
            setPainTags([]);
            setOnsetLabel(null);
            setDurationLabel(null);
            setDownsideTags([]);
            setWouldOrderAgain(null);

            startCooldown();
            setReviewOpen(false);
            setEditingReviewId(null);
            await trackEvent(editingReviewId ? "review_edit" : "review_submit", {
                product_id: productId,
                has_note: Boolean(text.trim()),
                use_case_count: useCases.length,
                pain_tag_count: painTags.length,
                downside_count: downsideTags.length,
                would_order_again: wouldOrderAgain,
            });
        } catch (e: any) {
            console.log("submit review error:", e);
            Alert.alert("Couldnt save review", e?.message ?? "Unknown error");
        } finally {
            setSubmitting(false);
        }
    };

    const displayNameForUid = (uid: string) => {
        if (!uid) return "Member";
        if (uid.startsWith("deleted:")) return "Deleted member";
        if (uid === currentUid) return `${meName} (you)`;
        const mapped = nameMap[uid];
        return mapped ? mapped : "Member";
    };

    const primaryButtonLabel = myLastReview ? "Edit last review" : "Write a review";
    const sortLabel = sortMode === "recent" ? "Most recent" : sortMode === "high" ? "Highest" : "Lowest";

    const openSortMenu = () => {
        Keyboard.dismiss();
        setSortOpen(true);

        requestAnimationFrame(() => {
            sortBtnRef.current?.measureInWindow((x, y, w, h) => {
                setSortAnchor({ x, y, w, h });
            });
        });
    };

    const toggleFavoriteSlot = useCallback(
        async (slot: FavoriteSlot) => {
            const user = auth().currentUser;
            if (!user) {
                router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
                return;
            }
            if (!productId) return;

            const userRef = firestore().collection("users").doc(user.uid);
            const favoriteRef = userRef.collection("favorites").doc(productId);

            try {
                await ensureUserProfileDoc({
                    uid: user.uid,
                    email: user.email ?? null,
                    displayName: user.displayName ?? null,
                    touchLastActive: true,
                });
                const nextSlots: FavoriteSlots = {
                    ...favoriteSlots,
                    [slot]: !favoriteSlots[slot],
                };
                const anySelected = hasAnyFavoriteSlot(nextSlots);

                if (anySelected) {
                    await favoriteRef.set({
                        productId,
                        slots: nextSlots,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    });
                    await userRef.set(
                        { favoriteProductIds: firestore.FieldValue.arrayUnion(productId) },
                        { merge: true }
                    );
                } else {
                    await favoriteRef.delete();
                    await userRef.set(
                        { favoriteProductIds: firestore.FieldValue.arrayRemove(productId) },
                        { merge: true }
                    );
                }
            } catch (error: any) {
                Alert.alert("Could not update tags", error?.message ?? "Unknown error");
            }
        },
        [favoriteSlots, productId, router]
    );

    const openPersonalNotes = () => {
        if (!currentUid) {
            router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
            return;
        }

        setNotesOpen(true);
    };

    const openNoteEditor = (note?: PersonalNoteItem | null) => {
        if (!currentUid) {
            router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
            return;
        }

        setEditingNoteId(note?.id ?? null);
        setPersonalNoteDraft(note?.text ?? "");
        setNotesOpen(false);
        setNoteEditorOpen(true);
    };

    const closeNoteEditor = () => {
        setPersonalNoteDraft("");
        setEditingNoteId(null);
        setNoteEditorOpen(false);
        setNotesOpen(true);
    };

    const savePersonalNote = async () => {
        if (!currentUid || !productId) return;

        try {
            setNoteSaving(true);
            const trimmed = personalNoteDraft.trim();
            if (!trimmed) {
                Alert.alert("Add a note first", "Write something to save, or close this if you do not need a note.");
                return;
            }

            const noteId = editingNoteId ?? `note-${Date.now()}`;
            const updatedAtMs = Date.now();
            const nextNotes = [
                {
                    id: noteId,
                    text: trimmed,
                    updatedAtMs,
                },
                ...personalNotes.filter((note) => note.id !== noteId),
            ].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

            const noteItemsPayload = nextNotes.map((note) => ({
                id: note.id,
                text: note.text,
                updatedAt: note.updatedAtMs,
            }));

            const localStorageKey = localNoteStorageKey(currentUid, productId);
            if (AsyncStorage) {
                await AsyncStorage.setItem(localStorageKey, JSON.stringify(nextNotes));
            }

            localPersonalNotesRef.current = nextNotes;
            applyPersonalNotes(nextNotes);
            setPersonalNoteDraft("");
            setEditingNoteId(null);
            setNoteEditorOpen(false);
            setNotesOpen(true);

            const userRef = firestore().collection("users").doc(currentUid);
            syncCurrentUserDoc()
                .then(() =>
                    userRef.set(
                        {
                            [`productNotes.${personalNoteKey}.productId`]: productId,
                            [`productNotes.${personalNoteKey}.text`]: nextNotes[0]?.text ?? "",
                            [`productNotes.${personalNoteKey}.updatedAt`]: firestore.FieldValue.serverTimestamp(),
                            [`productNotes.${personalNoteKey}.items`]: noteItemsPayload,
                        },
                        { merge: true }
                    )
                )
                .catch((error) => {
                    console.log("personal note remote save error:", error);
                });

            await trackEvent("product_note_saved", {
                product_id: productId,
                has_note: trimmed.length > 0,
                note_count: nextNotes.length,
            });
        } catch (error: any) {
            Alert.alert("Could not save note", error?.message ?? "Unknown error");
        } finally {
            setNoteSaving(false);
        }
    };

    const deletePersonalNote = async () => {
        if (!currentUid || !productId || !editingNoteId) return;

        try {
            setNoteSaving(true);
            const nextNotes = personalNotes.filter((note) => note.id !== editingNoteId);
            const noteItemsPayload = nextNotes.map((note) => ({
                id: note.id,
                text: note.text,
                updatedAt: note.updatedAtMs,
            }));
            const localStorageKey = localNoteStorageKey(currentUid, productId);
            if (AsyncStorage) {
                if (nextNotes.length > 0) {
                    await AsyncStorage.setItem(localStorageKey, JSON.stringify(nextNotes));
                } else {
                    await AsyncStorage.removeItem(localStorageKey);
                }
            }

            localPersonalNotesRef.current = nextNotes;
            applyPersonalNotes(nextNotes);
            setPersonalNoteDraft("");
            setEditingNoteId(null);
            setNoteEditorOpen(false);
            setNotesOpen(true);

            const userRef = firestore().collection("users").doc(currentUid);
            syncCurrentUserDoc()
                .then(() =>
                    userRef.set(
                        {
                            [`productNotes.${personalNoteKey}.productId`]: productId,
                            [`productNotes.${personalNoteKey}.text`]: nextNotes[0]?.text ?? "",
                            [`productNotes.${personalNoteKey}.updatedAt`]: firestore.FieldValue.serverTimestamp(),
                            [`productNotes.${personalNoteKey}.items`]: noteItemsPayload,
                        },
                        { merge: true }
                    )
                )
                .catch((error) => {
                    console.log("personal note remote delete sync error:", error);
                });

            await trackEvent("product_note_deleted", {
                product_id: productId,
                note_count: nextNotes.length,
            });
        } catch (error: any) {
            Alert.alert("Could not remove note", error?.message ?? "Unknown error");
        } finally {
            setNoteSaving(false);
        }
    };

    const openReviewerProfile = (uid: string) => {
        if (!uid) return;
        if (uid === currentUid) {
            router.push("/(tabs)/user");
            return;
        }
        router.push(`/(tabs)/user/profile/${encodeURIComponent(uid)}`);
    };

    const toggleHelpfulReview = async (review: Review) => {
        if (!review.id || !review.userId) return;
        if (!currentUid) {
            router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
            return;
        }
        if (review.userId === currentUid) return;

        const alreadyHelpful = helpfulReviewIds.includes(review.id);
        const userRef = firestore().collection("users").doc(currentUid);
        const helpfulRef = userRef.collection("helpful").doc(review.id);
        const reviewRef = firestore().collection("reviews").doc(review.id);

        try {
            await syncCurrentUserDoc();
            await firestore().runTransaction(async (tx) => {
                const reviewSnap = await tx.get(reviewRef);
                if (!reviewSnap.exists) return;

                const reviewData = reviewSnap.data() as Record<string, unknown>;
                const helpfulCount =
                    typeof reviewData?.helpfulCount === "number" && Number.isFinite(reviewData.helpfulCount)
                        ? Math.max(0, reviewData.helpfulCount)
                        : 0;
                const nextHelpfulCount = Math.max(0, helpfulCount + (alreadyHelpful ? -1 : 1));

                if (alreadyHelpful) {
                    tx.delete(helpfulRef);
                } else {
                    tx.set(
                        helpfulRef,
                        {
                            reviewId: review.id,
                            productId,
                            productName: product?.name ?? "",
                            targetUserId: review.userId,
                            createdAt: firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );
                }

                tx.update(reviewRef, {
                    helpfulCount: nextHelpfulCount,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
            });
            setHelpfulReviewIds((prev) =>
                alreadyHelpful ? prev.filter((value) => value !== review.id) : [...prev, review.id]
            );
            patchReviewState(review.id, (currentReview) => ({
                helpfulCount: Math.max(
                    0,
                    (typeof currentReview.helpfulCount === "number" ? currentReview.helpfulCount : 0) +
                        (alreadyHelpful ? -1 : 1)
                ),
            }));
            await trackEvent(alreadyHelpful ? "review_helpful_removed" : "review_helpful_added", {
                product_id: productId,
                review_id: review.id,
                review_owner_id: review.userId,
            });
        } catch (error: any) {
            Alert.alert("Could not update helpful", error?.message ?? "Unknown error");
        }
    };

    const toggleReportReview = async (review: Review) => {
        if (!review.id || !review.userId) return;
        if (!currentUid) {
            router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
            return;
        }
        if (review.userId === currentUid) return;

        const alreadyReported = reportedReviewIds.includes(review.id);
        const userRef = firestore().collection("users").doc(currentUid);
        const reportRef = userRef.collection("reportedReviews").doc(review.id);
        const reviewRef = firestore().collection("reviews").doc(review.id);

        try {
            await syncCurrentUserDoc();
            await firestore().runTransaction(async (tx) => {
                const reviewSnap = await tx.get(reviewRef);
                if (!reviewSnap.exists) return;

                const reviewData = reviewSnap.data() as Record<string, unknown>;
                const reportCount =
                    typeof reviewData?.reportCount === "number" && Number.isFinite(reviewData.reportCount)
                        ? Math.max(0, reviewData.reportCount)
                        : 0;
                const currentStatus =
                    typeof reviewData?.moderationStatus === "string" ? reviewData.moderationStatus : "active";
                const nextReportCount = Math.max(0, reportCount + (alreadyReported ? -1 : 1));
                const nextStatus = alreadyReported
                    ? currentStatus
                    : nextReportCount >= 5
                      ? "removed_auto"
                      : "under_review";

                if (alreadyReported) {
                    tx.delete(reportRef);
                } else {
                    tx.set(
                        reportRef,
                        {
                            reviewId: review.id,
                            productId,
                            productName: product?.name ?? "",
                            targetUserId: review.userId,
                            reporterUid: currentUid,
                            reporterDisplayName: meName,
                            reporterEmail: currentEmail,
                            reviewTextPreview: typeof review.text === "string" ? review.text.slice(0, 280) : "",
                            createdAt: firestore.FieldValue.serverTimestamp(),
                            createdAtMs: Date.now(),
                        },
                        { merge: true }
                    );
                }

                tx.update(reviewRef, {
                    reportCount: nextReportCount,
                    moderationStatus: nextStatus,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
            });
            setReportedReviewIdsLegacy((prev) =>
                alreadyReported ? prev.filter((value) => value !== review.id) : [...prev, review.id]
            );
            patchReviewState(review.id, (currentReview) => ({
                reportCount: Math.max(
                    0,
                    (typeof currentReview.reportCount === "number" ? currentReview.reportCount : 0) +
                        (alreadyReported ? -1 : 1)
                ),
                moderationStatus: alreadyReported
                    ? currentReview.moderationStatus ?? "active"
                    : Math.max(
                          0,
                          (typeof currentReview.reportCount === "number" ? currentReview.reportCount : 0) + 1
                      ) >= 5
                      ? "removed_auto"
                      : "under_review",
            }));
            await trackEvent(alreadyReported ? "review_report_removed" : "review_report_added", {
                product_id: productId,
                review_id: review.id,
                review_owner_id: review.userId,
            });
        } catch (error: any) {
            Alert.alert("Could not update report", error?.message ?? "Unknown error");
        }
    };

    if (loadingProduct) {
        return (
            <BrandedScreenBackground
                source={flowersBg}
                gradientColors={[
                    "rgba(24,14,8,0.10)",
                    "rgba(10,12,16,0.50)",
                    "rgba(7,8,12,0.94)",
                ]}
                scrimColor="rgba(5,7,11,0.26)"
                showEdgeVeils={false}
            >
                <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 72, backgroundColor: "transparent" }}>
                    <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                    <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary }}>Loading product...</Text>
                </SafeAreaView>
            </BrandedScreenBackground>
        );
    }

    if (!product) {
        return (
            <BrandedScreenBackground
                source={flowersBg}
                gradientColors={[
                    "rgba(24,14,8,0.10)",
                    "rgba(10,12,16,0.50)",
                    "rgba(7,8,12,0.94)",
                ]}
                scrimColor="rgba(5,7,11,0.26)"
                showEdgeVeils={false}
            >
                <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: "transparent" }}>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 16, color: theme.colors.textOnDark }}>
                        Product not found
                    </Text>
                    <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary }}>
                        That product id doesnt exist in Firestore.
                    </Text>
                </SafeAreaView>
            </BrandedScreenBackground>
        );
    }

    const terps = parseTerpenes(product.terpenes);
    const producerUseCases = product.producerUseCases ?? [];
    const productFactChips = [
        product.strainType ? { label: "Type", value: product.strainType } : null,
        product.genetics ? { label: "Genetics", value: product.genetics } : null,
        product.countryOfOrigin ? { label: "Origin", value: product.countryOfOrigin } : null,
        product.irradiationStatus ? { label: "Irradiation", value: product.irradiationStatus } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item));
    const hasCatalogueFacts =
        productFactChips.length > 0 ||
        terps.length > 0 ||
        producerUseCases.length > 0 ||
        !!product.producerNotes;
    const isDiscontinued = product.availabilityReview?.status === "discontinued";

    return (
        <BrandedScreenBackground
            source={flowersBg}
            gradientColors={[
                "rgba(8,11,16,0.88)",
                "rgba(9,11,16,0.56)",
                "rgba(7,8,12,0.94)",
            ]}
            scrimColor="rgba(5,7,11,0.32)"
            showAmbientGlows={false}
            showEdgeVeils={false}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(7,10,15,0.98)",
                    "rgba(7,10,15,0.92)",
                    "rgba(7,10,15,0.60)",
                    "rgba(7,10,15,0.00)",
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: insets.top + 150,
                    zIndex: 1,
                }}
            />

            <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                    styles.floatingBackButton,
                    {
                        top: insets.top + 10,
                    },
                    pressed ? { opacity: 0.82 } : null,
                ]}
            >
                <Ionicons name="chevron-back" size={28} color={theme.colors.textOnDark} />
            </Pressable>

            {/* Sort menu Modal */}
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
                                backgroundColor: "rgba(246,247,248,0.14)",
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

            <Modal visible={notesOpen} transparent animationType="fade" onRequestClose={() => setNotesOpen(false)}>
                <Pressable onPress={() => setNotesOpen(false)} style={styles.noteModalBackdrop}>
                    <Pressable onPress={() => undefined} style={styles.noteModalCard}>
                        <Text style={styles.noteModalTitle}>Check your notes</Text>
                        <Text style={styles.noteModalHint}>
                            These notes stay private to you. Keep batch thoughts, timing, reminders, and whether you would order this flower again.
                        </Text>

                        {personalNotes.length > 0 ? (
                            <View style={styles.noteList}>
                                {personalNotes.map((note) => (
                                    <Pressable
                                        key={note.id}
                                        onPress={() => openNoteEditor(note)}
                                        style={({ pressed }) => [styles.noteListCard, pressed ? { opacity: 0.9 } : null]}
                                    >
                                        <View style={styles.noteListCardHeader}>
                                            <Text style={styles.noteListCardDate}>{formatNoteUpdatedAt(note.updatedAtMs)}</Text>
                                            <View style={styles.noteListEditPill}>
                                                <Ionicons name="create-outline" size={12} color={theme.colors.textOnDark} />
                                                <Text style={styles.noteListEditPillText}>Edit</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.noteListCardText} numberOfLines={4}>
                                            {note.text}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.noteEmptyState}>
                                <Ionicons name="document-text-outline" size={20} color="rgba(255,255,255,0.52)" />
                                <Text style={styles.noteEmptyStateTitle}>No private notes yet</Text>
                                <Text style={styles.noteEmptyStateText}>
                                    Add one now and it will stay tucked away here for you whenever you come back to this flower.
                                </Text>
                            </View>
                        )}

                        <Pressable
                            onPress={() => openNoteEditor()}
                            style={({ pressed }) => [styles.notePrimaryButton, styles.notePrimaryButtonCompact, pressed ? styles.notePrimaryButtonPressed : null]}
                        >
                            <LinearGradient
                                colors={["rgba(240,229,176,0.96)", "rgba(168,210,130,0.96)", "rgba(86,140,86,0.96)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.notePrimaryButtonFill}
                            >
                                <LinearGradient
                                    colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.00)"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.notePrimaryButtonGloss}
                                />
                                <Ionicons name="create-outline" size={15} color="rgba(12,16,14,0.92)" />
                                <Text style={styles.notePrimaryButtonText}>Write a new note</Text>
                            </LinearGradient>
                        </Pressable>

                        <View style={styles.noteModalActions}>
                            <Pressable
                                onPress={() => {
                                    setNotesOpen(false);
                                }}
                                style={[styles.formBtnAlt, styles.noteModalActionButton]}
                            >
                                <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Close</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={noteEditorOpen} transparent animationType="fade" onRequestClose={closeNoteEditor}>
                <Pressable onPress={closeNoteEditor} style={styles.noteModalBackdrop}>
                    <Pressable onPress={() => undefined} style={styles.noteModalCard}>
                        <Text style={styles.noteModalTitle}>{editingNoteId ? "Edit note" : "Add a private note"}</Text>
                        <Text style={styles.noteModalHint}>
                            Keep a private reminder about batch quality, timing, pain relief, or anything else you want to remember for later.
                        </Text>

                        <TextInput
                            value={personalNoteDraft}
                            onChangeText={setPersonalNoteDraft}
                            editable={!noteSaving}
                            placeholder="Example: better after day three, really good for evening pain relief, bit dry on the second pot..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            multiline
                            textAlignVertical="top"
                            style={styles.noteModalInput}
                        />

                        <View style={styles.noteModalActions}>
                            <Pressable
                                onPress={closeNoteEditor}
                                disabled={noteSaving}
                                style={[styles.formBtnAlt, styles.noteModalActionButton, noteSaving ? { opacity: 0.7 } : null]}
                            >
                                <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>
                                    {editingNoteId ? "Back to notes" : "Cancel"}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    void savePersonalNote();
                                }}
                                disabled={noteSaving}
                                style={[styles.notePrimaryButton, styles.noteModalActionButton, noteSaving ? { opacity: 0.7 } : null]}
                            >
                                <LinearGradient
                                    colors={["rgba(244,232,177,0.98)", "rgba(171,216,132,0.98)", "rgba(82,144,84,0.98)"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.notePrimaryButtonFill}
                                >
                                    <LinearGradient
                                        colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.00)"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.notePrimaryButtonGloss}
                                    />
                                    <Text style={styles.notePrimaryButtonText}>{noteSaving ? "Saving..." : "Save note"}</Text>
                                </LinearGradient>
                            </Pressable>
                        </View>

                        {editingNoteId ? (
                            <Pressable
                                onPress={() => {
                                    void deletePersonalNote();
                                }}
                                disabled={noteSaving}
                                style={({ pressed }) => [
                                    styles.noteDeleteButton,
                                    noteSaving ? { opacity: 0.7 } : pressed ? { opacity: 0.82 } : null,
                                ]}
                            >
                                <Ionicons name="trash-outline" size={15} color="rgba(255,211,211,0.92)" />
                                <Text style={styles.noteDeleteButtonText}>Delete this note</Text>
                            </Pressable>
                        ) : null}
                    </Pressable>
                </Pressable>
            </Modal>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
                <FlatList
                    removeClippedSubviews={false}
                    data={sortedReviews}
                    keyExtractor={(r) => r.id}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={() => {
                        Keyboard.dismiss();
                        setSortOpen(false);
                    }}
                    contentContainerStyle={{ paddingBottom: Math.max(118, insets.bottom + 94) }}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                    ListHeaderComponent={
                        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: insets.top + 84 }}>
                            {/* HERO glass card */}
                            <View
                                style={{
                                    borderRadius: 22,
                                    padding: 16,
                                    backgroundColor: "rgba(9,13,20,0.78)",
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.12)",
                                    overflow: "hidden",
                                }}
                            >
                                <Text style={{ fontSize: 30, fontWeight: "800", lineHeight: 34, letterSpacing: -0.3, color: theme.colors.textOnDark }}>
                                    {product.name}
                                    {product.variant ? ` (${product.variant})` : ""}
                                </Text>

                                {/* Meta line */}
                                <Text style={{ marginTop: 10, fontSize: 15, opacity: 0.95, color: theme.colors.textOnDarkSecondary }}>
                                    {(product.maker || "Unknown maker") +
                                        " · " +
                                        (product.type || "flower") +
                                        " · THC " +
                                        formatPct(product.thcPct) +
                                        " · CBD " +
                                        formatPct(product.cbdPct)}
                                </Text>

                                {isDiscontinued ? (
                                    <View style={styles.discontinuedPill}>
                                        <Ionicons name="alert-circle-outline" size={14} color="rgba(255,222,222,0.96)" />
                                        <Text style={styles.discontinuedPillText}>Discontinued</Text>
                                    </View>
                                ) : null}

                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.saveTagsLabel}>Save tags</Text>
                                    <View style={styles.favoritePillRow}>
                                        {FAVORITE_SLOT_META.map((slot) => {
                                            const active = !!favoriteSlots[slot.key];
                                            return (
                                                <Pressable
                                                    key={slot.key}
                                                    onPress={() => {
                                                        void toggleFavoriteSlot(slot.key);
                                                    }}
                                                    style={({ pressed }) => [
                                                        styles.favoritePill,
                                                        active
                                                            ? [
                                                                styles.favoritePillActive,
                                                                {
                                                                    borderColor: slot.color,
                                                                    backgroundColor: "rgba(255,255,255,0.12)",
                                                                },
                                                            ]
                                                            : null,
                                                        pressed ? { opacity: 0.85 } : null,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={slot.icon}
                                                        size={15}
                                                        color={active ? slot.color : "rgba(255,255,255,0.58)"}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.favoritePillText,
                                                            active ? styles.favoritePillTextActive : null,
                                                        ]}
                                                    >
                                                        {slot.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Headline rating */}
                                <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center" }}>
                                    {reviews.length ? (
                                        <>
                                            <BudRating value={avgOverall} size={18} />
                                            <Text style={{ fontSize: 22, fontWeight: "900", marginLeft: 10, color: theme.colors.textOnDark }}>
                                                {round1(avgOverall).toFixed(1)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.textOnDarkSecondary }}>
                                            No ratings yet
                                        </Text>
                                    )}
                                </View>

                                <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, opacity: 0.95 }}>
                                    {reviews.length ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "Be the first to review this"}
                                </Text>

                                <View style={styles.heroActionsRow}>
                                    <Pressable
                                        onPress={() => {
                                            if (currentUid) {
                                                if (myLastReview) openEditLastReview();
                                                else openWriteNewReview();
                                                return;
                                            }

                                            router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
                                        }}
                                        style={({ pressed }) => [
                                            styles.heroActionButton,
                                            styles.heroActionButtonAccent,
                                            pressed ? { opacity: 0.82 } : null,
                                        ]}
                                    >
                                        <Ionicons name="create-outline" size={15} color={theme.colors.textOnDark} />
                                        <Text style={styles.heroActionText}>
                                            {currentUid ? primaryButtonLabel : "Sign in to review"}
                                        </Text>
                                    </Pressable>
                                </View>

                                <View style={styles.heroNotesRow}>
                                    <Pressable
                                        onPress={openPersonalNotes}
                                        style={({ pressed }) => [
                                            styles.heroNoteButton,
                                            pressed ? styles.notePrimaryButtonPressed : null,
                                        ]}
                                    >
                                        <LinearGradient
                                            colors={
                                                currentUid
                                                    ? ["rgba(243,231,177,0.96)", "rgba(173,218,130,0.96)", "rgba(80,142,84,0.96)"]
                                                    : ["rgba(41,71,57,0.92)", "rgba(27,58,44,0.92)", "rgba(18,35,28,0.92)"]
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.heroNoteButtonFill}
                                        >
                                            <LinearGradient
                                                colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0.00)"]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.heroNoteButtonGloss}
                                            />
                                            <Ionicons
                                                name={currentUid && personalNotes.length > 0 ? "book-outline" : "document-text-outline"}
                                                size={15}
                                                color={currentUid ? "rgba(12,16,14,0.92)" : theme.colors.textOnDark}
                                            />
                                            <Text
                                                style={[
                                                    styles.heroNoteButtonText,
                                                    currentUid ? styles.heroNoteButtonTextActive : null,
                                                ]}
                                            >
                                                {currentUid
                                                    ? "Notes"
                                                    : "Sign in for notes"}
                                            </Text>
                                        </LinearGradient>
                                    </Pressable>
                                </View>

                                {hasCatalogueFacts ? (
                                    <View style={styles.productFactsCard}>
                                        <View style={styles.productFactsHeader}>
                                            <View style={styles.productFactsIconWrap}>
                                                <Ionicons name="library-outline" size={15} color="rgba(245,212,126,0.96)" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.productFactsTitle}>Strain info</Text>
                                            </View>
                                            {terps.length > 0 ? (
                                                <Pressable
                                                    onPress={() => router.push("/(tabs)/user/terpenes-info")}
                                                    style={({ pressed }) => [
                                                        styles.productFactsGuideButton,
                                                        pressed ? styles.productFactsGuideButtonPressed : null,
                                                    ]}
                                                >
                                                    <Ionicons name="leaf-outline" size={13} color="rgba(180,228,150,0.96)" />
                                                    <Text style={styles.productFactsGuideButtonText}>Learn terpenes</Text>
                                                </Pressable>
                                            ) : null}
                                        </View>

                                        {productFactChips.length > 0 ? (
                                            <View style={styles.productFactsSection}>
                                                <View style={styles.productFactsInfoGrid}>
                                                    {productFactChips.map((chip) => (
                                                        <View key={`${chip.label}-${chip.value}`} style={styles.productFactsInfoCell}>
                                                            <Text style={styles.productFactsInfoLabel}>{chip.label}</Text>
                                                            <Text style={styles.productFactsInfoValue}>{chip.value}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null}

                                        {terps.length > 0 ? (
                                            <View style={styles.productFactsSection}>
                                                <Text style={styles.productFactsSectionTitle}>Dominant terpenes</Text>
                                                <View style={styles.productFactsTagRow}>
                                                    {terps.map((terp) => {
                                                        return (
                                                            <View
                                                                key={`${terp.name}-${terp.strength || "terp"}`}
                                                                style={[
                                                                    styles.productFactsTerpTag,
                                                                    {
                                                                        borderColor: terp.borderColor,
                                                                        backgroundColor: terp.backgroundColor,
                                                                    },
                                                                ]}
                                                            >
                                                                <View
                                                                    style={[
                                                                        styles.productFactsTerpIconWrap,
                                                                        { backgroundColor: terp.iconBackground },
                                                                    ]}
                                                                >
                                                                    <Ionicons name={terp.icon} size={14} color={terp.iconColor} />
                                                                </View>
                                                                <View style={styles.productFactsTerpCopy}>
                                                                    <Text style={styles.productFactsTerpTagText}>{terp.name}</Text>
                                                                    {terp.valueLabel ? (
                                                                        <Text style={styles.productFactsTerpMetaText}>{terp.valueLabel}</Text>
                                                                    ) : null}
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        ) : null}

                                        {producerUseCases.length > 0 ? (
                                            <View style={styles.productFactsSection}>
                                                <Text style={styles.productFactsSectionTitle}>Known for</Text>
                                                <View style={styles.productFactsTagRow}>
                                                    {producerUseCases.map((item) => (
                                                        <View key={item} style={styles.productFactsTag}>
                                                            <Text style={styles.productFactsTagText}>{item}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null}

                                        {product.producerNotes ? (
                                            <View style={styles.productFactsSection}>
                                                <Text style={styles.productFactsSectionTitle}>Grower notes</Text>
                                                <Text style={styles.productFactsBody}>{product.producerNotes}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}

                                {/* Summary of effects */}
                                <View
                                    style={{
                                        marginTop: 16,
                                        padding: 14,
                                        borderRadius: 18,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.12)",
                                        backgroundColor: "rgba(11,15,22,0.76)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <Text style={{ fontSize: 16, fontWeight: "800", letterSpacing: -0.2, color: theme.colors.textOnDark }}>
                                        Summary of effects
                                    </Text>

                                    {effectsSummary.withAnySub === 0 ? (
                                        <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary }}>
                                            No effect ratings yet. Be the first to add them.
                                        </Text>
                                    ) : (
                                        <View style={{ marginTop: 10 }}>
                                            {[
                                                { label: "Daytime suitability", avg: effectsSummary.daytimeAvg },
                                                { label: "Sleepiness", avg: effectsSummary.sleepyAvg },
                                                { label: "Calm", avg: effectsSummary.calmAvg },
                                                { label: "Mental clarity", avg: effectsSummary.clarityAvg },
                                                { label: "Pain relief", avg: effectsSummary.painReliefAvg },
                                            ].map((row) => (
                                                <View
                                                    key={row.label}
                                                    style={{
                                                        flexDirection: "row",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        paddingVertical: 8,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontWeight: "800",
                                                            color: theme.colors.textOnDarkSecondary,
                                                            flex: 1,
                                                            marginRight: 12,
                                                        }}
                                                    >
                                                        {row.label}
                                                    </Text>

                                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                                        <BudRating value={row.avg} size={16} />
                                                        <Text
                                                            style={{
                                                                marginLeft: 10,
                                                                fontWeight: "900",
                                                                color: theme.colors.textOnDark,
                                                                minWidth: 44,
                                                                textAlign: "right",
                                                            }}
                                                        >
                                                            {round1(row.avg).toFixed(1)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}

                                            <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, opacity: 0.95 }}>
                                                Based on {effectsSummary.withAnySub} review{effectsSummary.withAnySub === 1 ? "" : "s"} with effect ratings.
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Write / Edit controls */}
                                {!reviewOpen ? (
                                    <View style={styles.quickReviewPrompt}>
                                        <Text style={styles.quickReviewTitle}>Quick review, richer detail if you want it</Text>
                                        <Text style={styles.quickReviewHint}>
                                            Keep it fast: score the core effects, add a short note, then expand only if you want to.
                                        </Text>
                                        <Text style={styles.reviewTimingHint}>
                                            Best practice: only review after you have had a proper feel for it, ideally around 3 days in.
                                        </Text>

                                        {!currentUid ? (
                                            <Pressable
                                                onPress={() => {
                                                    router.push(`/auth?returnTo=${encodeURIComponent(`/(tabs)/reviews/${productId}`)}`);
                                                }}
                                                style={({ pressed }) => [
                                                    styles.inlineAuthButton,
                                                    pressed ? { opacity: 0.82 } : null,
                                                ]}
                                            >
                                                <Ionicons name="log-in-outline" size={16} color={theme.colors.textOnDark} />
                                                <Text style={styles.inlineAuthButtonText}>Sign in to write a review</Text>
                                            </Pressable>
                                        ) : (
                                            <View style={{ marginTop: 14 }}>
                                                <BlingButton
                                                    variant="gold"
                                                    label={isCooldown ? `You can edit again in ${secondsLeft}s` : primaryButtonLabel}
                                                    disabled={submitting || isCooldown}
                                                    onPress={() => {
                                                        Keyboard.dismiss();
                                                        setSortOpen(false);
                                                        if (isCooldown) return;
                                                        if (myLastReview) openEditLastReview();
                                                        else openWriteNewReview();
                                                    }}
                                                />

                                                {myLastReview ? (
                                                    <View style={{ marginTop: 12 }}>
                                                        <BlingButton
                                                            variant="green"
                                                            label="Write a new review"
                                                            disabled={submitting || isCooldown}
                                                            onPress={() => {
                                                                Keyboard.dismiss();
                                                                setSortOpen(false);
                                                                if (isCooldown) return;
                                                                openWriteNewReview();
                                                            }}
                                                        />
                                                    </View>
                                                ) : null}
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <View style={styles.reviewCard}>
                                        <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.2, color: theme.colors.textOnDark }}>
                                            {editingReviewId ? "Edit last review" : "Write a review"}
                                        </Text>

                                        <Text style={styles.reviewCardLead}>
                                            Score the core experience first. Add detail only if it helps tell the story.
                                        </Text>

                                        <MetricCard
                                            icon="star-outline"
                                            label="Overall rating"
                                            hint="Your overall verdict once it settled."
                                            lowLabel="Poor"
                                            highLabel="Excellent"
                                            value={rating}
                                            onChange={setRating}
                                            disabled={submitting}
                                        />

                                        <MetricCard
                                            icon="sunny-outline"
                                            label="Daytime suitability"
                                            hint="Lower scores mean it got in the way. Higher scores mean you could stay functional."
                                            lowLabel="Not a chance"
                                            highLabel="Perfectly usable"
                                            value={daytime}
                                            onChange={setDaytime}
                                            disabled={submitting}
                                        />

                                        <MetricCard
                                            icon="moon-outline"
                                            label="Sleepiness"
                                            hint="1 keeps you alert. 5 makes you feel drowsy or bedtime-ready."
                                            lowLabel="Wide awake"
                                            highLabel="Ready for bed"
                                            value={sleepy}
                                            onChange={setSleepy}
                                            disabled={submitting}
                                        />

                                        <MetricCard
                                            icon="leaf-outline"
                                            label="Calm"
                                            hint="1 brings little calm. 5 noticeably settles tension or agitation."
                                            lowLabel="Low calm"
                                            highLabel="Very calm"
                                            value={calm}
                                            onChange={setCalm}
                                            disabled={submitting}
                                        />

                                        <MetricCard
                                            icon="eye-outline"
                                            label="Mental clarity"
                                            hint="Think of this as the racing-thoughts check: 1 = foggy, scattered, or racy. 5 = clear and steadier."
                                            lowLabel="Racy"
                                            highLabel="Clear"
                                            value={clarity}
                                            onChange={setClarity}
                                            disabled={submitting}
                                        />

                                        <MetricCard
                                            icon="medkit-outline"
                                            label="Pain relief"
                                            hint="Use this if it helped physically. 1 barely helped. 5 gave strong relief."
                                            lowLabel="No help"
                                            highLabel="Strong relief"
                                            value={painRelief}
                                            onChange={setPainRelief}
                                            disabled={submitting}
                                        />

                                        <Pressable
                                            onPress={() => setDetailsOpen((prev) => !prev)}
                                            style={({ pressed }) => [
                                                styles.detailsToggle,
                                                pressed ? { opacity: 0.82 } : null,
                                            ]}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.detailsToggleTitle}>Add detail</Text>
                                                <Text style={styles.detailsToggleHint}>
                                                    Use case, onset, duration, downsides, and whether you would order it again.
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name={detailsOpen ? "chevron-up-outline" : "chevron-down-outline"}
                                                size={18}
                                                color={theme.colors.textOnDarkSecondary}
                                            />
                                        </Pressable>

                                        {detailsOpen ? (
                                            <View style={styles.detailPanel}>
                                                <Text style={styles.detailGroupTitle}>What were you using it for?</Text>
                                                <View style={styles.pillRow}>
                                                    {USE_CASE_OPTIONS.map((option) => (
                                                        <PillOption
                                                            key={option}
                                                            label={option}
                                                            selected={useCases.includes(option)}
                                                            onPress={() => {
                                                                setUseCases((prev) => toggleChoice(prev, option));
                                                            }}
                                                        />
                                                    ))}
                                                </View>

                                                <Text style={styles.detailGroupTitle}>Pain it helped with</Text>
                                                <View style={styles.pillRow}>
                                                    {PAIN_OPTIONS.map((option) => (
                                                        <PillOption
                                                            key={option}
                                                            label={option}
                                                            selected={painTags.includes(option)}
                                                            onPress={() => {
                                                                setPainTags((prev) => toggleChoice(prev, option));
                                                            }}
                                                        />
                                                    ))}
                                                </View>

                                                <Text style={styles.detailGroupTitle}>Onset</Text>
                                                <View style={styles.pillRow}>
                                                    {ONSET_OPTIONS.map((option) => (
                                                        <PillOption
                                                            key={option}
                                                            label={option}
                                                            selected={onsetLabel === option}
                                                            onPress={() => {
                                                                setOnsetLabel((prev) => prev === option ? null : option);
                                                            }}
                                                        />
                                                    ))}
                                                </View>

                                                <Text style={styles.detailGroupTitle}>Duration</Text>
                                                <View style={styles.pillRow}>
                                                    {DURATION_OPTIONS.map((option) => (
                                                        <PillOption
                                                            key={option}
                                                            label={option}
                                                            selected={durationLabel === option}
                                                            onPress={() => {
                                                                setDurationLabel((prev) => prev === option ? null : option);
                                                            }}
                                                        />
                                                    ))}
                                                </View>

                                                <Text style={styles.detailGroupTitle}>Main downsides</Text>
                                                <View style={styles.pillRow}>
                                                    {DOWNSIDE_OPTIONS.map((option) => (
                                                        <PillOption
                                                            key={option}
                                                            label={option}
                                                            selected={downsideTags.includes(option)}
                                                            onPress={() => {
                                                                setDownsideTags((prev) => toggleChoice(prev, option));
                                                            }}
                                                        />
                                                    ))}
                                                </View>

                                                <Text style={styles.detailGroupTitle}>Would you order it again?</Text>
                                                <View style={styles.pillRow}>
                                                    <PillOption
                                                        label="Yes"
                                                        selected={wouldOrderAgain === true}
                                                        onPress={() => {
                                                            setWouldOrderAgain((prev) => prev === true ? null : true);
                                                        }}
                                                    />
                                                    <PillOption
                                                        label="No"
                                                        selected={wouldOrderAgain === false}
                                                        onPress={() => {
                                                            setWouldOrderAgain((prev) => prev === false ? null : false);
                                                        }}
                                                    />
                                                </View>
                                            </View>
                                        ) : null}

                                        <Text style={{ marginTop: 18, marginBottom: 10, fontWeight: "900", color: theme.colors.textOnDark }}>
                                            Notes
                                        </Text>

                                        <TextInput
                                            value={text}
                                            onChangeText={setText}
                                            editable={!submitting}
                                            placeholder="What stood out? Effects, onset, how usable it felt, and whether you would pick it again..."
                                            placeholderTextColor="rgba(255,255,255,0.35)"
                                            multiline
                                            scrollEnabled
                                            returnKeyType="default"
                                            textAlignVertical="top"
                                            style={styles.notesInput}
                                        />

                                        <View style={{ flexDirection: "row", marginTop: 12 }}>
                                            <Pressable
                                                onPress={async () => {
                                                    Keyboard.dismiss();
                                                    await submitReview();
                                                }}
                                                disabled={submitting || isCooldown}
                                                style={[styles.formBtn, { marginRight: 10, opacity: submitting || isCooldown ? 0.7 : 1 }]}
                                            >
                                                <Text style={styles.formBtnText}>
                                                    {submitting ? "Saving..." : editingReviewId ? "Save changes" : "Submit review"}
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                onPress={() => {
                                                    Keyboard.dismiss();
                                                    setReviewOpen(false);
                                                    setEditingReviewId(null);
                                                }}
                                                disabled={submitting}
                                                style={[styles.formBtnAlt, { opacity: submitting ? 0.7 : 1 }]}
                                            >
                                                <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Close</Text>
                                            </Pressable>
                                        </View>

                                        {thankYouVisible ? (
                                            <View style={{ alignItems: "center", marginTop: 14 }}>
                                                <View style={styles.toast}>
                                                    <Text style={{ color: "#fff", textAlign: "center" }}>
                                                        <Text style={{ fontWeight: "900" }}>Saved.</Text> Your review is live.
                                                    </Text>
                                                </View>

                                                <Text style={styles.toastHint}>
                                                    If your experience changes over time, you can post another review.
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}

                                {/* Reviews header + sort button */}
                                <View style={{ marginTop: 24 }}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: -0.3, color: theme.colors.textOnDark }}>
                                            Reviews
                                        </Text>

                                        <View
                                            ref={(n) => {
                                                sortBtnRef.current = n;
                                            }}
                                            collapsable={false}
                                        >
                                            <Pressable
                                                onPress={() => {
                                                    if (sortOpen) setSortOpen(false);
                                                    else openSortMenu();
                                                }}
                                                style={styles.sortPill}
                                            >
                                                <Text style={{ fontWeight: "900", color: theme.colors.textOnDark, includeFontPadding: false }}>
                                                    {sortLabel}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    </View>

                                    {loadingReviews ? (
                                        <View style={{ marginTop: 10 }}>
                                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                                            <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary }}>
                                                Loading reviews...
                                            </Text>
                                        </View>
                                    ) : null}

                                    {!loadingReviews && reviews.length === 0 ? (
                                        <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary }}>
                                            No reviews yet.
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const displayName = displayNameForUid(item.userId);
                        const score = getReviewScore(item);
                        const dateMs = getCreatedAtMs(item);
                        const isHelpful = helpfulReviewIds.includes(item.id);
                        const isReported = reportedReviewIds.includes(item.id);
                        const isOwnReview = item.userId === currentUid;
                        const reviewMeta = [
                            boolLabel(item.wouldOrderAgain),
                            item.onsetLabel,
                            item.durationLabel,
                        ].filter(Boolean) as string[];

                        return (
                            <View style={styles.reviewItem}>
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.03)", "rgba(0,0,0,0.08)"]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <Pressable
                                        onPress={() => {
                                            openReviewerProfile(item.userId);
                                        }}
                                        disabled={!item.userId}
                                        style={({ pressed }) => ({
                                            flexShrink: 1,
                                            marginRight: 10,
                                            opacity: pressed ? 0.8 : 1,
                                        })}
                                    >
                                        <Text
                                            style={{
                                                fontWeight: "900",
                                                fontSize: 15,
                                                color: theme.colors.textOnDark,
                                            }}
                                        >
                                            {displayName}
                                        </Text>
                                        <Text style={styles.reviewProfileHint}>
                                            {isOwnReview ? "Open your profile" : "View profile"}
                                        </Text>
                                    </Pressable>

                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, fontSize: 12 }}>
                                            {dateMs ? new Date(dateMs).toLocaleDateString() : ""}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}>
                                    <BudRating value={score} size={18} />
                                    <Text style={{ fontWeight: "900", marginLeft: 10, color: theme.colors.textOnDark }}>
                                        {round1(score).toFixed(1)}
                                    </Text>
                                </View>

                                <View style={styles.reviewMetricChipRow}>
                                    <View style={styles.reviewMetricChip}>
                                        <Text style={styles.reviewMetricChipText}>Day {item.daytime ?? "-"}</Text>
                                    </View>
                                    <View style={styles.reviewMetricChip}>
                                        <Text style={styles.reviewMetricChipText}>Sleep {item.sleepy ?? "-"}</Text>
                                    </View>
                                    <View style={styles.reviewMetricChip}>
                                        <Text style={styles.reviewMetricChipText}>Calm {item.calm ?? "-"}</Text>
                                    </View>
                                    <View style={styles.reviewMetricChip}>
                                        <Text style={styles.reviewMetricChipText}>Clear {item.clarity ?? "-"}</Text>
                                    </View>
                                    <View style={styles.reviewMetricChip}>
                                        <Text style={styles.reviewMetricChipText}>Pain {item.painRelief ?? "-"}</Text>
                                    </View>
                                </View>

                                {reviewMeta.length > 0 ? (
                                    <View style={styles.reviewMetricChipRow}>
                                        {reviewMeta.map((meta) => (
                                            <View key={meta} style={styles.reviewMetaChip}>
                                                <Text style={styles.reviewMetaChipText}>{meta}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                {item.useCases?.length ? (
                                    <View style={styles.reviewMetricChipRow}>
                                        {item.useCases.slice(0, 3).map((useCase) => (
                                            <View key={useCase} style={styles.reviewMetaChip}>
                                                <Text style={styles.reviewMetaChipText}>{useCase}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                {item.painTags?.length ? (
                                    <View style={styles.reviewMetricChipRow}>
                                        {item.painTags.map((painTag) => (
                                            <View key={painTag} style={styles.reviewPainChip}>
                                                <Text style={styles.reviewPainChipText}>{painTag}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                {item.downsideTags?.length ? (
                                    <Text style={styles.reviewDownsideText}>
                                        Downsides: {item.downsideTags.join(", ")}
                                    </Text>
                                ) : null}

                                {item.text ? (
                                    <Text style={{ marginTop: 10, fontSize: 14, lineHeight: 20, color: theme.colors.textOnDarkSecondary }}>
                                        {item.text}
                                    </Text>
                                ) : null}

                                <View style={styles.reviewActionRow}>
                                    {!isOwnReview ? (
                                        <>
                                            <Pressable
                                                onPress={() => {
                                                    void toggleHelpfulReview(item);
                                                }}
                                                style={({ pressed }) => [
                                                    styles.reviewActionButton,
                                                    isHelpful ? styles.reviewActionButtonActive : null,
                                                    pressed ? { opacity: 0.82 } : null,
                                                ]}
                                            >
                                                <Ionicons
                                                    name={isHelpful ? "thumbs-up" : "thumbs-up-outline"}
                                                    size={14}
                                                    color={theme.colors.textOnDark}
                                                />
                                                <Text style={styles.reviewActionButtonText}>
                                                    {isHelpful ? "Helpful saved" : "Mark helpful"}
                                                    {typeof item.helpfulCount === "number" ? ` (${Math.max(0, item.helpfulCount)})` : ""}
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                onPress={() => {
                                                    void toggleReportReview(item);
                                                }}
                                                style={({ pressed }) => [
                                                    styles.reviewActionButton,
                                                    isReported ? styles.reviewActionButtonDanger : null,
                                                    pressed ? { opacity: 0.82 } : null,
                                                ]}
                                            >
                                                <Ionicons
                                                    name={isReported ? "flag" : "flag-outline"}
                                                    size={14}
                                                    color={theme.colors.textOnDark}
                                                />
                                                <Text style={styles.reviewActionButtonText}>
                                                    {isReported ? "Reported" : "Report review"}
                                                </Text>
                                            </Pressable>
                                        </>
                                    ) : null}

                                </View>
                            </View>
                        );
                    }}
                />
            </KeyboardAvoidingView>
            </SafeAreaView>
        </BrandedScreenBackground>
    );
}

const styles = StyleSheet.create({
    floatingBackButton: {
        position: "absolute",
        left: 16,
        width: 52,
        height: 52,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(11,15,22,0.68)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4,
    },
    blingBtnOuter: {
        height: 58,
        borderRadius: 20,
        borderWidth: 1,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    blingBtnText: {
        fontWeight: "900",
        fontSize: 18,
        lineHeight: 20,
        textAlign: "center",
        includeFontPadding: false,
        textAlignVertical: "center",
    },
    blingGloss: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 22,
        opacity: 0.9,
    },
    blingInnerGlow: {
        position: "absolute",
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.10)",
        opacity: 0.35,
    },
    heroActionsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },
    heroActionButton: {
        flex: 1,
        minHeight: 42,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.06)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
    },
    heroActionButtonAccent: {
        backgroundColor: "rgba(212,175,55,0.14)",
        borderColor: "rgba(212,175,55,0.28)",
    },
    heroActionText: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 13,
    },
    heroNotesRow: {
        marginTop: 12,
        alignItems: "flex-start",
    },
    discontinuedPill: {
        marginTop: 12,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,128,128,0.32)",
        backgroundColor: "rgba(90,24,24,0.42)",
    },
    discontinuedPillText: {
        color: "rgba(255,238,238,0.96)",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.1,
    },
    productFactsCard: {
        marginTop: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(11,15,22,0.78)",
        padding: 14,
    },
    productFactsHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },
    productFactsIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(245,212,126,0.28)",
        backgroundColor: "rgba(245,212,126,0.10)",
        alignItems: "center",
        justifyContent: "center",
    },
    productFactsTitle: {
        color: theme.colors.textOnDark,
        fontWeight: "900",
        fontSize: 16,
    },
    productFactsGuideButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(180,228,150,0.22)",
        backgroundColor: "rgba(31,62,38,0.42)",
        paddingVertical: 7,
        paddingHorizontal: 10,
    },
    productFactsGuideButtonPressed: {
        opacity: 0.82,
    },
    productFactsGuideButtonText: {
        color: "rgba(226,244,214,0.96)",
        fontWeight: "800",
        fontSize: 11,
    },
    productFactsSection: {
        marginTop: 14,
    },
    productFactsSectionTitle: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 13,
        marginBottom: 8,
    },
    productFactsInfoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    productFactsInfoCell: {
        minWidth: 112,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    productFactsInfoLabel: {
        color: "rgba(255,255,255,0.56)",
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    productFactsInfoValue: {
        marginTop: 4,
        color: theme.colors.textOnDark,
        fontSize: 13,
        fontWeight: "800",
    },
    productFactsTagRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    productFactsTag: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(212,175,55,0.24)",
        backgroundColor: "rgba(212,175,55,0.12)",
        paddingVertical: 7,
        paddingHorizontal: 11,
    },
    productFactsTagText: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 12,
    },
    productFactsTerpTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        minWidth: 148,
    },
    productFactsTerpIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    productFactsTerpCopy: {
        flexShrink: 1,
    },
    productFactsTerpTagText: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 12,
    },
    productFactsTerpMetaText: {
        marginTop: 2,
        color: "rgba(255,255,255,0.66)",
        fontSize: 11,
        fontWeight: "700",
    },
    productFactsBody: {
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
        lineHeight: 20,
    },
    heroNoteButton: {
        minHeight: 34,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(170,216,130,0.32)",
        backgroundColor: "rgba(22,56,40,0.28)",
        overflow: "hidden",
        alignSelf: "flex-start",
    },
    heroNoteButtonFill: {
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    heroNoteButtonGloss: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.46,
    },
    heroNoteButtonText: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 12,
    },
    heroNoteButtonTextActive: {
        color: "rgba(12,16,14,0.92)",
    },
    heroNotePreview: {
        color: theme.colors.textOnDarkSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    notePrimaryButton: {
        minHeight: 42,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(205,236,186,0.24)",
        overflow: "hidden",
        alignSelf: "flex-start",
    },
    notePrimaryButtonPressed: {
        opacity: 0.86,
        transform: [{ scale: 0.992 }],
    },
    notePrimaryButtonCompact: {
        minWidth: 184,
        marginTop: 14,
    },
    notePrimaryButtonFill: {
        minHeight: 42,
        borderRadius: 16,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    notePrimaryButtonGloss: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.42,
    },
    notePrimaryButtonText: {
        color: "rgba(12,16,14,0.94)",
        fontWeight: "900",
        fontSize: 14,
        includeFontPadding: false,
    },
    saveTagsLabel: {
        color: "rgba(255,255,255,0.82)",
        fontWeight: "800",
        fontSize: 13,
        marginBottom: 8,
    },
    favoritePillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    favoritePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingVertical: 9,
        paddingHorizontal: 12,
    },
    favoritePillActive: {
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    favoritePillText: {
        color: "rgba(255,255,255,0.74)",
        fontSize: 13,
        fontWeight: "700",
    },
    favoritePillTextActive: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
    },
    quickReviewPrompt: {
        marginTop: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(11,15,22,0.78)",
        padding: 14,
    },
    quickReviewTitle: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 17,
        lineHeight: 23,
    },
    quickReviewHint: {
        marginTop: 6,
        color: theme.colors.textOnDarkSecondary,
        lineHeight: 21,
        fontSize: 14,
    },
    reviewTimingHint: {
        marginTop: 8,
        color: "rgba(212,175,55,0.92)",
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "700",
    },
    inlineAuthButton: {
        marginTop: 14,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(212,175,55,0.28)",
        backgroundColor: "rgba(212,175,55,0.14)",
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    inlineAuthButtonText: {
        color: theme.colors.textOnDark,
        fontWeight: "900",
        fontSize: 13,
    },
    reviewCardLead: {
        marginTop: 6,
        color: theme.colors.textOnDarkSecondary,
        lineHeight: 21,
        fontSize: 14,
    },
    metricCard: {
        marginTop: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(7,11,17,0.82)",
        padding: 12,
    },
    metricHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },
    metricIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
    },
    metricTitle: {
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 15,
    },
    metricHint: {
        marginTop: 4,
        color: theme.colors.textOnDarkSecondary,
        lineHeight: 21,
        fontSize: 14,
    },
    metricScaleWrap: {
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    metricEdgeLabel: {
        width: 60,
        color: "rgba(205,210,222,0.88)",
        fontSize: 13,
        fontWeight: "700",
    },
    metricButtonsRow: {
        flex: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "space-between",
    },
    metricButton: {
        flex: 1,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.06)",
        alignItems: "center",
        justifyContent: "center",
    },
    metricButtonSelected: {
        borderColor: "rgba(212,175,55,0.52)",
        backgroundColor: "rgba(212,175,55,0.16)",
    },
    metricButtonText: {
        color: theme.colors.textOnDarkSecondary,
        fontWeight: "900",
        fontSize: 13,
    },
    metricButtonTextSelected: {
        color: theme.colors.textOnDark,
    },
    detailsToggle: {
        marginTop: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(10,14,20,0.70)",
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    detailsToggleTitle: {
        color: theme.colors.textOnDark,
        fontWeight: "900",
        fontSize: 14,
    },
    detailsToggleHint: {
        marginTop: 4,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    detailPanel: {
        marginTop: 10,
        gap: 10,
    },
    detailGroupTitle: {
        marginTop: 2,
        color: theme.colors.textOnDark,
        fontWeight: "800",
        fontSize: 14,
    },
    pillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    pillOption: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(10,14,20,0.70)",
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    pillOptionSelected: {
        borderColor: "rgba(212,175,55,0.42)",
        backgroundColor: "rgba(212,175,55,0.14)",
    },
    pillOptionText: {
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
        fontWeight: "700",
    },
    pillOptionTextSelected: {
        color: theme.colors.textOnDark,
    },

    sortPill: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(11,15,22,0.82)",
    },

    reviewItem: {
        marginHorizontal: 16,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(10,14,20,0.80)",
        overflow: "hidden",
    },
    reviewProfileHint: {
        marginTop: 4,
        color: "rgba(255,255,255,0.56)",
        fontSize: 11,
        fontWeight: "700",
    },
    reviewActionRow: {
        marginTop: 12,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    reviewActionButton: {
        minHeight: 36,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    reviewActionButtonActive: {
        borderColor: "rgba(120,190,140,0.28)",
        backgroundColor: "rgba(27,68,48,0.62)",
    },
    reviewActionButtonDanger: {
        borderColor: "rgba(255,126,126,0.28)",
        backgroundColor: "rgba(86,36,36,0.62)",
    },
    reviewActionButtonText: {
        color: theme.colors.textOnDark,
        fontSize: 12,
        fontWeight: "800",
    },
    reviewMetricChipRow: {
        marginTop: 10,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    reviewMetricChip: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    reviewMetricChipText: {
        color: theme.colors.textOnDark,
        fontSize: 11,
        fontWeight: "900",
    },
    reviewMetaChip: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "rgba(212,175,55,0.12)",
        borderWidth: 1,
        borderColor: "rgba(212,175,55,0.24)",
    },
    reviewMetaChipText: {
        color: theme.colors.textOnDark,
        fontSize: 11,
        fontWeight: "800",
    },
    reviewPainChip: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "rgba(120,190,140,0.14)",
        borderWidth: 1,
        borderColor: "rgba(120,190,140,0.26)",
    },
    reviewPainChipText: {
        color: theme.colors.textOnDark,
        fontSize: 11,
        fontWeight: "800",
    },
    reviewDownsideText: {
        marginTop: 10,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 12,
        lineHeight: 18,
    },

    reviewCard: {
        marginTop: 18,
        padding: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(9,13,20,0.80)",
        overflow: "hidden",
    },

    notesInput: {
        minHeight: 110,
        maxHeight: 190,
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

    formBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(173,218,130,0.34)",
        backgroundColor: "rgba(70,136,78,0.92)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnAlt: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,145,145,0.28)",
        backgroundColor: "rgba(98,38,38,0.82)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnText: {
        fontWeight: "900",
        textAlign: "center",
        color: "#fff",
        includeFontPadding: false,
    },

    toast: {
        backgroundColor: "rgba(0,0,0,0.75)",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        width: "100%",
        maxWidth: 340,
    },
    toastHint: {
        marginTop: 10,
        fontSize: 14,
        color: "rgba(255,255,255,0.62)",
        textAlign: "center",
        width: "100%",
        maxWidth: 340,
        lineHeight: 20,
    },
    noteModalBackdrop: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
        backgroundColor: "rgba(4,6,10,0.60)",
    },
    noteModalCard: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(20,24,32,0.96)",
        padding: 18,
        maxHeight: "82%",
    },
    noteModalTitle: {
        color: theme.colors.textOnDark,
        fontSize: 22,
        fontWeight: "900",
    },
    noteModalHint: {
        marginTop: 8,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
        lineHeight: 19,
    },
    noteModalInput: {
        minHeight: 140,
        marginTop: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 15,
        lineHeight: 21,
        backgroundColor: "rgba(0,0,0,0.26)",
        color: theme.colors.textOnDark,
    },
    noteList: {
        marginTop: 14,
        gap: 10,
    },
    noteListCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(9,12,18,0.72)",
        padding: 14,
    },
    noteListCardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    noteListCardDate: {
        color: "rgba(255,224,175,0.90)",
        fontSize: 12,
        fontWeight: "800",
    },
    noteListEditPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    noteListEditPillText: {
        color: theme.colors.textOnDark,
        fontSize: 11,
        fontWeight: "800",
    },
    noteListCardText: {
        marginTop: 10,
        color: theme.colors.textOnDark,
        fontSize: 14,
        lineHeight: 21,
    },
    noteEmptyState: {
        marginTop: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(9,12,18,0.62)",
        padding: 18,
        alignItems: "center",
    },
    noteEmptyStateTitle: {
        marginTop: 10,
        color: theme.colors.textOnDark,
        fontSize: 16,
        fontWeight: "900",
    },
    noteEmptyStateText: {
        marginTop: 8,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
        lineHeight: 19,
        textAlign: "center",
    },
    noteModalActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },
    noteModalActionButton: {
        minHeight: 50,
    },
    noteDeleteButton: {
        marginTop: 12,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,145,145,0.24)",
        backgroundColor: "rgba(86,34,34,0.46)",
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    noteDeleteButtonText: {
        color: "rgba(255,226,226,0.94)",
        fontSize: 13,
        fontWeight: "800",
    },
});
