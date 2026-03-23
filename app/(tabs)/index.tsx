import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { theme } from "../../lib/theme";
import { trackEvent } from "../../lib/analytics";
import BrandedScreenBackground from "../../components/BrandedScreenBackground";
import { buildCommunityNotesSummary, type CommunityNotesSummary } from "../../lib/communityNotes";

const homeBg = require("../../assets/images/home-bg.png");
const homeHeroImage = require("../../assets/brand/review-budz-home-hero.png");

type Product = {
    id: string;
    name: string;
    maker: string;
    variant?: string | null;
    type: string;
    strainType?: "sativa" | "indica" | "hybrid" | null;
    thcPct?: number | null;
    cbdPct?: number | null;
    updatedAt?: FirebaseFirestoreTypes.Timestamp | number | null;
};

type ReviewRow = {
    id: string;
    productId: string;
    rating: number;
    score?: number | null;
    text?: string | null;
    createdAt?: FirebaseFirestoreTypes.Timestamp | number | null;
    moderationStatus?: string | null;
    authorDeleted?: boolean | null;
    useCases?: string[] | null;
    painTags?: string[] | null;
    onsetLabel?: string | null;
    durationLabel?: string | null;
    sleepy?: number | null;
    calm?: number | null;
    daytime?: number | null;
    clarity?: number | null;
    backPain?: number | null;
    jointPain?: number | null;
    legPain?: number | null;
    headacheRelief?: number | null;
    racingThoughts?: number | null;
    uplifting?: number | null;
    painRelief?: number | null;
    focusAdhd?: number | null;
    anxiety?: number | null;
    moodBalance?: number | null;
    appetite?: number | null;
    femaleHealth?: number | null;
    muscleRelaxation?: number | null;
    creativity?: number | null;
};

type ProductStat = {
    count: number;
    avg: number;
    lastReviewAt: number;
};

type HomeInsight = {
    product: Product;
    stat: ProductStat;
    summary: CommunityNotesSummary | null;
};

type EffectKey =
    | "sleepy"
    | "calming"
    | "uplifting"
    | "painRelief"
    | "focusAdhd"
    | "anxiety"
    | "moodBalance"
    | "appetite"
    | "femaleHealth"
    | "muscleRelaxation"
    | "creativity";

type EffectAggregate = Record<EffectKey, { count: number; sum: number }>;

type InsightChipSpec = {
    key: string;
    label: string;
    bg: string;
    border: string;
    text: string;
    accent?: string;
};

type StrainKind = "sativa" | "indica" | "hybrid" | "unknown";

const HERO_METRICS: Array<{
    key: "to_review" | "reviews_total" | "reviewed";
    label: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    tint: string;
    glow: [string, string];
}> = [
    {
        key: "to_review",
        label: "Reviews in 7 days",
        icon: "layers",
        tint: "rgba(232,211,138,0.96)",
        glow: ["rgba(93,72,28,0.92)", "rgba(24,20,18,0.96)"],
    },
    {
        key: "reviews_total",
        label: "Reviews in total",
        icon: "message-square",
        tint: "rgba(188,222,255,0.96)",
        glow: ["rgba(33,61,94,0.92)", "rgba(17,21,32,0.96)"],
    },
    {
        key: "reviewed",
        label: "Strains reviewed",
        icon: "check-circle",
        tint: "rgba(177,232,191,0.96)",
        glow: ["rgba(29,73,52,0.92)", "rgba(17,25,21,0.96)"],
    },
];

const RAIL_PALETTES: Array<[string, string]> = [
    ["rgba(48,98,70,0.98)", "rgba(17,27,23,0.98)"],
    ["rgba(79,58,126,0.98)", "rgba(22,18,39,0.98)"],
    ["rgba(128,66,54,0.98)", "rgba(33,17,20,0.98)"],
    ["rgba(38,83,118,0.98)", "rgba(15,21,36,0.98)"],
];

const CHIP_TONES: Array<{ bg: string; border: string; text: string }> = [
    { bg: "rgba(146,220,174,0.14)", border: "rgba(146,220,174,0.58)", text: "rgba(166,235,190,0.98)" },
    { bg: "rgba(147,172,255,0.14)", border: "rgba(147,172,255,0.58)", text: "rgba(177,194,255,0.98)" },
    { bg: "rgba(255,160,132,0.14)", border: "rgba(255,160,132,0.58)", text: "rgba(255,186,165,0.98)" },
];

const EFFECT_KEYS: EffectKey[] = [
    "sleepy",
    "calming",
    "uplifting",
    "painRelief",
    "focusAdhd",
    "anxiety",
    "moodBalance",
    "appetite",
    "femaleHealth",
    "muscleRelaxation",
    "creativity",
];

const EFFECT_META: Record<EffectKey, { short: string; bg: string; border: string; text: string; accent: string }> = {
    sleepy: {
        short: "Sleepy",
        bg: "rgba(48,66,106,0.64)",
        border: "rgba(147,172,255,0.42)",
        text: "rgba(240,245,255,0.96)",
        accent: "rgba(147,172,255,0.98)",
    },
    calming: {
        short: "Calm",
        bg: "rgba(23,57,38,0.68)",
        border: "rgba(146,220,174,0.46)",
        text: "rgba(241,252,244,0.96)",
        accent: "rgba(146,220,174,0.98)",
    },
    uplifting: {
        short: "Uplift",
        bg: "rgba(82,58,14,0.68)",
        border: "rgba(255,212,123,0.48)",
        text: "rgba(255,248,230,0.96)",
        accent: "rgba(255,212,123,0.98)",
    },
    painRelief: {
        short: "Pain",
        bg: "rgba(92,38,26,0.68)",
        border: "rgba(255,160,132,0.46)",
        text: "rgba(255,242,239,0.96)",
        accent: "rgba(255,160,132,0.98)",
    },
    focusAdhd: {
        short: "Focus",
        bg: "rgba(22,52,79,0.68)",
        border: "rgba(152,205,255,0.42)",
        text: "rgba(236,247,255,0.96)",
        accent: "rgba(152,205,255,0.98)",
    },
    anxiety: {
        short: "Anxiety",
        bg: "rgba(26,48,72,0.68)",
        border: "rgba(189,216,255,0.42)",
        text: "rgba(240,247,255,0.96)",
        accent: "rgba(189,216,255,0.98)",
    },
    moodBalance: {
        short: "Mood",
        bg: "rgba(32,60,37,0.68)",
        border: "rgba(181,236,170,0.42)",
        text: "rgba(244,252,241,0.96)",
        accent: "rgba(181,236,170,0.98)",
    },
    appetite: {
        short: "Munchies",
        bg: "rgba(96,66,21,0.68)",
        border: "rgba(255,203,134,0.46)",
        text: "rgba(255,247,233,0.96)",
        accent: "rgba(255,203,134,0.98)",
    },
    femaleHealth: {
        short: "Female",
        bg: "rgba(86,39,68,0.68)",
        border: "rgba(255,172,214,0.42)",
        text: "rgba(255,243,249,0.96)",
        accent: "rgba(255,172,214,0.98)",
    },
    muscleRelaxation: {
        short: "Muscle",
        bg: "rgba(38,48,84,0.68)",
        border: "rgba(199,211,255,0.42)",
        text: "rgba(243,246,255,0.96)",
        accent: "rgba(199,211,255,0.98)",
    },
    creativity: {
        short: "Creative",
        bg: "rgba(68,42,88,0.68)",
        border: "rgba(223,196,255,0.42)",
        text: "rgba(250,245,255,0.96)",
        accent: "rgba(223,196,255,0.98)",
    },
};

function formatPct(n: number | null | undefined) {
    if (n === null || n === undefined) return "-";
    return `${n}%`;
}

function round1(n: number) {
    return Math.round(n * 10) / 10;
}

function pluralizeReviews(count: number) {
    return `${count} review${count === 1 ? "" : "s"}`;
}

function getTimestampMs(value: FirebaseFirestoreTypes.Timestamp | number | null | undefined) {
    if (!value) return 0;
    if (typeof value === "number") {
        return value > 1e12 ? value : value * 1000;
    }
    if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
    if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
    return 0;
}

function formatShortDate(ms: number) {
    if (!ms) return "New";
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
    }).format(new Date(ms));
}

function isFlowerProduct(product: Product) {
    const raw = `${product.type ?? ""}`.toLowerCase().trim();
    return raw.length === 0 || raw.includes("flower") || raw === "sativa" || raw === "indica" || raw === "hybrid";
}

function productName(product: Product) {
    return `${product.name}${product.variant ? ` (${product.variant})` : ""}`;
}

function productMeta(product: Product) {
    return [product.maker || "Unknown maker", "flower", `THC ${formatPct(product.thcPct)}`, `CBD ${formatPct(product.cbdPct)}`].join(" · ");
}

function normalizeStrainType(value: unknown): StrainKind {
    if (value === null || value === undefined) return "unknown";

    const input = String(value).toLowerCase().trim();
    if (!input) return "unknown";
    if (input.includes("sativa")) return "sativa";
    if (input.includes("indica")) return "indica";
    if (input.includes("hybrid")) return "hybrid";
    if (input.includes("dominant") && (input.includes("sat") || input.includes("sativa"))) return "sativa";
    if (input.includes("dominant") && (input.includes("ind") || input.includes("indica"))) return "indica";
    if (input.startsWith("sat") || input === "s") return "sativa";
    if (input.startsWith("ind") || input === "i") return "indica";
    if (input.startsWith("hyb") || input === "h") return "hybrid";
    return "unknown";
}

function byUpdatedDesc(a: Product, b: Product) {
    const diff = getTimestampMs(b.updatedAt) - getTimestampMs(a.updatedAt);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
}

function byUpdatedAsc(a: Product, b: Product) {
    const aMs = getTimestampMs(a.updatedAt);
    const bMs = getTimestampMs(b.updatedAt);
    if (aMs === 0 && bMs !== 0) return -1;
    if (bMs === 0 && aMs !== 0) return 1;
    const diff = aMs - bMs;
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
}

function buildRecentCatalogueSelection(products: Product[], maxItems: number) {
    const ordered = [...products].sort(byUpdatedDesc);
    const selected: Product[] = [];
    const used = new Set<string>();

    ["indica", "hybrid", "sativa"].forEach((kind) => {
        const candidate = ordered.find((product) => !used.has(product.id) && normalizeStrainType(product.strainType) === kind);
        if (!candidate) return;
        selected.push(candidate);
        used.add(candidate.id);
    });

    const remaining = ordered.filter((product) => !used.has(product.id));
    const prioritizedRemaining = [
        ...remaining.filter((product) => {
            const kind = normalizeStrainType(product.strainType);
            return kind === "indica" || kind === "hybrid";
        }),
        ...remaining.filter((product) => normalizeStrainType(product.strainType) === "sativa"),
        ...remaining.filter((product) => normalizeStrainType(product.strainType) === "unknown"),
    ];

    for (const product of prioritizedRemaining) {
        if (selected.length >= maxItems) break;
        if (used.has(product.id)) continue;
        selected.push(product);
        used.add(product.id);
    }

    return [...selected].sort(byUpdatedDesc).slice(0, maxItems);
}

function railPalette(index: number) {
    return RAIL_PALETTES[index % RAIL_PALETTES.length];
}

function chipTone(index: number) {
    return CHIP_TONES[index % CHIP_TONES.length];
}

function toScore(v: unknown): number | null {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const rounded = Math.round(v);
    if (rounded < 1 || rounded > 5) return null;
    return rounded;
}

function avgPresent(values: Array<number | null>) {
    const present = values.filter((value): value is number => typeof value === "number");
    if (!present.length) return null;
    return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function avgNumbers(values: Array<number | null | undefined>) {
    const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!present.length) return 0;
    return present.reduce((sum, value) => sum + value, 0) / present.length;
}

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

function computeDisplayReviewScore(review: ReviewRow) {
    if (typeof review.score === "number" && Number.isFinite(review.score)) {
        return review.score;
    }

    return computeHeadlineScore({
        rating: review.rating,
        daytime: review.daytime,
        sleepy: review.sleepy,
        calm: review.calm,
        clarity: review.clarity,
    });
}

function deriveEffectScoresFromReview(review: ReviewRow): Partial<Record<EffectKey, number>> {
    const sleepy = toScore(review.sleepy);
    const calming = toScore(review.calm);
    const uplifting = toScore(review.uplifting) ?? toScore(review.daytime);
    const painRelief =
        toScore(review.painRelief) ??
        avgPresent([toScore(review.backPain), toScore(review.jointPain), toScore(review.legPain), toScore(review.headacheRelief)]);
    const focusAdhd = toScore(review.focusAdhd) ?? avgPresent([toScore(review.clarity), toScore(review.racingThoughts)]);
    const anxiety = toScore(review.anxiety) ?? avgPresent([toScore(review.calm), toScore(review.racingThoughts)]);
    const moodBalance = toScore(review.moodBalance) ?? avgPresent([toScore(review.calm), toScore(review.uplifting), toScore(review.anxiety)]);
    const appetite = toScore(review.appetite);
    const femaleHealth = toScore(review.femaleHealth);
    const muscleRelaxation =
        toScore(review.muscleRelaxation) ?? avgPresent([toScore(review.backPain), toScore(review.jointPain), toScore(review.legPain)]);
    const creativity = toScore(review.creativity) ?? toScore(review.daytime);

    const output: Partial<Record<EffectKey, number>> = {};
    const assign = (key: EffectKey, value: number | null) => {
        if (typeof value === "number") {
            output[key] = value;
        }
    };

    assign("sleepy", sleepy);
    assign("calming", calming);
    assign("uplifting", uplifting);
    assign("painRelief", painRelief);
    assign("focusAdhd", focusAdhd);
    assign("anxiety", anxiety);
    assign("moodBalance", moodBalance);
    assign("appetite", appetite);
    assign("femaleHealth", femaleHealth);
    assign("muscleRelaxation", muscleRelaxation);
    assign("creativity", creativity);

    return output;
}

function makeEmptyEffectAggregate(): EffectAggregate {
    return EFFECT_KEYS.reduce((accumulator, key) => {
        accumulator[key] = { count: 0, sum: 0 };
        return accumulator;
    }, {} as EffectAggregate);
}

function buildInsightChips(effectKeys: EffectKey[], noteLabels: string[]) {
    const chips: InsightChipSpec[] = effectKeys.slice(0, 3).map((key) => {
        const meta = EFFECT_META[key];
        return {
            key,
            label: meta.short,
            bg: meta.bg,
            border: meta.border,
            text: meta.text,
            accent: meta.accent,
        };
    });

    const seen = new Set(chips.map((chip) => chip.label.toLowerCase()));
    for (const label of noteLabels) {
        if (chips.length >= 4) break;
        if (seen.has(label.toLowerCase())) continue;
        const tone = chipTone(chips.length);
        chips.push({
            key: `note-${label.toLowerCase()}`,
            label,
            bg: tone.bg,
            border: tone.border,
            text: tone.text,
        });
        seen.add(label.toLowerCase());
    }

    return chips;
}

function HeroMetricCard({
    label,
    value,
    icon,
    tint,
    glow,
}: {
    label: string;
    value: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    tint: string;
    glow: [string, string];
}) {
    return (
        <LinearGradient colors={glow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroMetricCard}>
            <Feather name={icon} size={44} color={tint} style={styles.heroMetricIcon} />
            <Text style={styles.heroMetricValue}>{value}</Text>
            <Text style={styles.heroMetricLabel}>{label}</Text>
        </LinearGradient>
    );
}

function SectionHeader({
    eyebrow,
    title,
    caption,
}: {
    eyebrow: string;
    title: string;
    caption: string;
}) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionCaption}>{caption}</Text>
        </View>
    );
}

function RailProductCard({
    product,
    stat,
    palette,
    kicker,
    subtitle,
    footer,
    onPress,
}: {
    product: Product;
    stat?: ProductStat;
    palette: [string, string];
    kicker: string;
    subtitle: string;
    footer: string;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.railCard, pressed ? styles.cardPressed : null]}>
            <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.railSurface}>
                <Feather name="archive" size={68} color="rgba(255,255,255,0.06)" style={styles.railGraphic} />
                <Text style={styles.railKicker}>{kicker}</Text>
                <Text style={styles.railTitle} numberOfLines={2}>
                    {productName(product)}
                </Text>
                <Text style={styles.railMeta} numberOfLines={2}>
                    {productMeta(product)}
                </Text>
                <Text style={styles.railSubtitle} numberOfLines={2}>
                    {subtitle}
                </Text>

                <View style={styles.railFooterBadge}>
                    <Text style={styles.railFooterBadgeText}>
                        {stat ? `${round1(stat.avg).toFixed(1)} avg · ${stat.count} review${stat.count === 1 ? "" : "s"}` : footer}
                    </Text>
                </View>
            </LinearGradient>
        </Pressable>
    );
}

function InsightChipRow({ chips }: { chips: InsightChipSpec[] }) {
    if (!chips.length) return null;

    return (
        <View style={styles.insightChipRow}>
            {chips.map((chip) => {
                return (
                    <View
                        key={chip.key}
                        style={[
                            styles.insightChip,
                            {
                                backgroundColor: chip.bg,
                                borderColor: chip.border,
                            },
                        ]}
                    >
                        {chip.accent ? <View style={[styles.insightChipDot, { backgroundColor: chip.accent }]} /> : null}
                        <Text style={[styles.insightChipText, { color: chip.text }]}>{chip.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

function InsightFeatureCard({
    eyebrow,
    insight,
    chips,
    palette,
    onPress,
}: {
    eyebrow: string;
    insight: HomeInsight | null;
    chips: InsightChipSpec[];
    palette: [string, string];
    onPress?: () => void;
}) {
    return (
        <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.insightCard, pressed ? styles.cardPressed : null]}>
            <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.insightSurface}>
                <View style={styles.insightHeroRow}>
                    <View style={styles.insightCopyBlock}>
                        <Text style={styles.insightEyebrow}>{eyebrow}</Text>
                        <Text style={styles.insightTitle} numberOfLines={2}>
                            {insight ? productName(insight.product) : "Waiting for enough data"}
                        </Text>
                        <Text style={styles.insightMeta} numberOfLines={2}>
                            {insight ? productMeta(insight.product) : "A couple more reviews will bring this card to life."}
                        </Text>
                    </View>

                    <View style={styles.insightMediaSpacer} />
                </View>

                <InsightChipRow chips={chips} />

                <View style={styles.insightScoreRow}>
                    <Text style={styles.insightScoreValue}>{insight ? round1(insight.stat.avg).toFixed(1) : "--"}</Text>
                    <Text style={styles.insightScoreMeta}>
                        {insight ? pluralizeReviews(insight.stat.count) : "Still building"}
                    </Text>
                </View>

                <Text style={styles.insightSummary} numberOfLines={2}>
                    {insight?.summary?.shortLine ?? "Shared notes and score context will show up here as soon as they land."}
                </Text>
            </LinearGradient>
        </Pressable>
    );
}

function ActivityReviewCard({
    product,
    stat,
    reviewedAt,
    summary,
    onPress,
}: {
    product: Product;
    stat: ProductStat;
    reviewedAt: number;
    summary: CommunityNotesSummary | null;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.activityCard, pressed ? styles.cardPressed : null]}>
            <View style={styles.activityScoreBoard}>
                <Text style={styles.activityScoreLabel}>Score</Text>
                <Text style={styles.activityScoreValue}>{round1(stat.avg).toFixed(1)}</Text>
                <Text style={styles.activityScoreMeta}>{pluralizeReviews(stat.count)}</Text>
            </View>

            <View style={styles.activityBody}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                    {productName(product)}
                </Text>
                <Text style={styles.activityMeta} numberOfLines={1}>
                    {product.maker || "Unknown maker"} · reviewed {formatShortDate(reviewedAt)}
                </Text>
                <Text style={styles.activitySummary} numberOfLines={2}>
                    {summary?.shortLine ?? "Fresh member context is building on this one now."}
                </Text>
            </View>
        </Pressable>
    );
}

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [products, setProducts] = useState<Product[]>([]);
    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);

    useEffect(() => {
        setLoadingProducts(true);
        const unsub = firestore()
            .collection("products")
            .onSnapshot(
                (snapshot) => {
                    const next = snapshot.docs.map((doc) => {
                        const data = doc.data() as any;
                        const type =
                            typeof data?.productType === "string" && data.productType.trim()
                                ? data.productType
                                : typeof data?.type === "string" && data.type.trim()
                                  ? data.type
                                  : "flower";

                        return {
                            id: doc.id,
                            name: typeof data?.name === "string" ? data.name : "",
                            maker: typeof data?.maker === "string" ? data.maker : "",
                            variant: typeof data?.variant === "string" ? data.variant : null,
                            type,
                            strainType: (() => {
                                const rawStrain =
                                    data?.strainType ?? data?.strain ?? data?.dominance ?? data?.genetics ?? data?.type ?? data?.productType ?? null;
                                const normalized = normalizeStrainType(rawStrain);
                                return normalized === "unknown" ? null : normalized;
                            })(),
                            thcPct: typeof data?.thcPct === "number" ? data.thcPct : null,
                            cbdPct: typeof data?.cbdPct === "number" ? data.cbdPct : null,
                            updatedAt: (data?.updatedAt ?? data?.createdAt ?? null) as FirebaseFirestoreTypes.Timestamp | number | null,
                        } satisfies Product;
                    });

                    setProducts(next);
                    setLoadingProducts(false);
                },
                (error) => {
                    console.log("home products load error:", error);
                    setProducts([]);
                    setLoadingProducts(false);
                }
            );

        return () => unsub();
    }, []);

    useEffect(() => {
        setLoadingReviews(true);
        const unsub = firestore()
            .collection("reviews")
            .onSnapshot(
                (snapshot) => {
                    const next = snapshot.docs.map((doc) => {
                        const data = doc.data() as any;
                        return {
                            id: doc.id,
                            productId: typeof data?.productId === "string" ? data.productId : "",
                            rating: typeof data?.rating === "number" ? data.rating : 0,
                            score: typeof data?.score === "number" ? data.score : null,
                            text: typeof data?.text === "string" ? data.text : null,
                            createdAt: (data?.createdAt ?? null) as FirebaseFirestoreTypes.Timestamp | number | null,
                            moderationStatus: typeof data?.moderationStatus === "string" ? data.moderationStatus : "active",
                            authorDeleted: data?.authorDeleted === true,
                            useCases: Array.isArray(data?.useCases) ? data.useCases.filter((value: unknown): value is string => typeof value === "string") : null,
                            painTags: Array.isArray(data?.painTags) ? data.painTags.filter((value: unknown): value is string => typeof value === "string") : null,
                            onsetLabel: typeof data?.onsetLabel === "string" ? data.onsetLabel : null,
                            durationLabel: typeof data?.durationLabel === "string" ? data.durationLabel : null,
                            sleepy: typeof data?.sleepy === "number" ? data.sleepy : null,
                            calm: typeof data?.calm === "number" ? data.calm : null,
                            daytime: typeof data?.daytime === "number" ? data.daytime : null,
                            clarity: typeof data?.clarity === "number" ? data.clarity : null,
                            backPain: typeof data?.backPain === "number" ? data.backPain : null,
                            jointPain: typeof data?.jointPain === "number" ? data.jointPain : null,
                            legPain: typeof data?.legPain === "number" ? data.legPain : null,
                            headacheRelief: typeof data?.headacheRelief === "number" ? data.headacheRelief : null,
                            racingThoughts: typeof data?.racingThoughts === "number" ? data.racingThoughts : null,
                            uplifting: typeof data?.uplifting === "number" ? data.uplifting : null,
                            painRelief: typeof data?.painRelief === "number" ? data.painRelief : null,
                            focusAdhd: typeof data?.focusAdhd === "number" ? data.focusAdhd : null,
                            anxiety: typeof data?.anxiety === "number" ? data.anxiety : null,
                            moodBalance: typeof data?.moodBalance === "number" ? data.moodBalance : null,
                            appetite: typeof data?.appetite === "number" ? data.appetite : null,
                            femaleHealth: typeof data?.femaleHealth === "number" ? data.femaleHealth : null,
                            muscleRelaxation: typeof data?.muscleRelaxation === "number" ? data.muscleRelaxation : null,
                            creativity: typeof data?.creativity === "number" ? data.creativity : null,
                        } satisfies ReviewRow;
                    });

                    setReviews(next);
                    setLoadingReviews(false);
                },
                (error) => {
                    console.log("home reviews load error:", error);
                    setReviews([]);
                    setLoadingReviews(false);
                }
            );

        return () => unsub();
    }, []);

    const flowerProducts = useMemo(() => products.filter(isFlowerProduct), [products]);

    const productById = useMemo(() => {
        return Object.fromEntries(flowerProducts.map((product) => [product.id, product]));
    }, [flowerProducts]);

    const activeReviews = useMemo(() => {
        return reviews.filter(
            (review) =>
                (!review.moderationStatus || review.moderationStatus === "active") &&
                review.authorDeleted !== true
        );
    }, [reviews]);

    const { statsByProductId, communityNotesByProductId, effectBadgesByProductId } = useMemo(() => {
        const stats: Record<string, ProductStat> = {};
        const textsByProductId: Record<string, string[]> = {};
        const effectBucketsByProductId: Record<string, EffectAggregate> = {};

        for (const review of activeReviews) {
            if (!review.productId || !productById[review.productId]) continue;

            const value = computeDisplayReviewScore(review);

            if (!Number.isFinite(value) || value < 1 || value > 5) continue;

            const createdAtMs = getTimestampMs(review.createdAt);
            const existing = stats[review.productId];
            if (!existing) {
                stats[review.productId] = {
                    count: 1,
                    avg: value,
                    lastReviewAt: createdAtMs,
                };
            } else {
                const nextCount = existing.count + 1;
                stats[review.productId] = {
                    count: nextCount,
                    avg: (existing.avg * existing.count + value) / nextCount,
                    lastReviewAt: Math.max(existing.lastReviewAt, createdAtMs),
                };
            }

            const trimmed = review.text?.trim();
            if (trimmed && trimmed.length >= 8) {
                textsByProductId[review.productId] = [...(textsByProductId[review.productId] ?? []), trimmed];
            }
            if (review.useCases?.length) {
                textsByProductId[review.productId] = [...(textsByProductId[review.productId] ?? []), review.useCases.join(" ")];
            }
            if (review.painTags?.length) {
                textsByProductId[review.productId] = [
                    ...(textsByProductId[review.productId] ?? []),
                    review.painTags.map((tag) => `${tag} pain relief`).join(" "),
                ];
            }
            if (review.onsetLabel) {
                textsByProductId[review.productId] = [...(textsByProductId[review.productId] ?? []), `${review.onsetLabel} onset`];
            }
            if (review.durationLabel) {
                textsByProductId[review.productId] = [...(textsByProductId[review.productId] ?? []), `${review.durationLabel} duration`];
            }

            const effectScores = deriveEffectScoresFromReview(review);
            const effectAggregate = effectBucketsByProductId[review.productId] ?? makeEmptyEffectAggregate();
            EFFECT_KEYS.forEach((key) => {
                const effectValue = effectScores[key];
                if (typeof effectValue !== "number") return;
                effectAggregate[key].count += 1;
                effectAggregate[key].sum += effectValue;
            });
            effectBucketsByProductId[review.productId] = effectAggregate;
        }

        const notes: Record<string, CommunityNotesSummary> = {};
        Object.entries(textsByProductId).forEach(([productId, lines]) => {
            const summary = buildCommunityNotesSummary(lines);
            if (summary) {
                notes[productId] = summary;
            }
        });

        const effectBadges: Record<string, EffectKey[]> = {};
        Object.entries(effectBucketsByProductId).forEach(([productId, aggregate]) => {
            effectBadges[productId] = EFFECT_KEYS.map((key) => {
                const bucket = aggregate[key];
                return {
                    key,
                    count: bucket.count,
                    avg: bucket.count ? bucket.sum / bucket.count : 0,
                };
            })
                .filter((entry) => entry.count > 0 && entry.avg >= 3.5)
                .sort((a, b) => {
                    if (b.avg !== a.avg) return b.avg - a.avg;
                    return b.count - a.count;
                })
                .slice(0, 3)
                .map((entry) => entry.key);
        });

        return {
            statsByProductId: stats,
            communityNotesByProductId: notes,
            effectBadgesByProductId: effectBadges,
        };
    }, [activeReviews, productById]);

    const reviewTotal = activeReviews.length;
    const reviewedStrainCount = flowerProducts.filter((product) => (statsByProductId[product.id]?.count ?? 0) > 0).length;
    const recentReviewCount = activeReviews.filter((review) => {
        const createdAtMs = getTimestampMs(review.createdAt);
        return createdAtMs > 0 && createdAtMs >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length;

    const recentlyAddedFlowers = useMemo(() => {
        return buildRecentCatalogueSelection(flowerProducts, 6);
    }, [flowerProducts]);

    const needsFirstReview = useMemo(() => {
        const recentlyAddedIds = new Set(recentlyAddedFlowers.map((product) => product.id));
        return [...flowerProducts]
            .filter((product) => !statsByProductId[product.id]?.count && !recentlyAddedIds.has(product.id))
            .sort(byUpdatedAsc)
            .slice(0, 6);
    }, [flowerProducts, recentlyAddedFlowers, statsByProductId]);

    const topRatedInsight = useMemo<HomeInsight | null>(() => {
        const rated = flowerProducts.filter((product) => (statsByProductId[product.id]?.count ?? 0) > 0);
        if (!rated.length) return null;

        const candidates = [...rated].sort((a, b) => {
            const avgDiff = (statsByProductId[b.id]?.avg ?? 0) - (statsByProductId[a.id]?.avg ?? 0);
            if (avgDiff !== 0) return avgDiff;
            return (statsByProductId[b.id]?.count ?? 0) - (statsByProductId[a.id]?.count ?? 0);
        });

        const product = candidates[0] ?? null;
        if (!product) return null;
        return {
            product,
            stat: statsByProductId[product.id],
            summary: communityNotesByProductId[product.id] ?? null,
        };
    }, [flowerProducts, statsByProductId, communityNotesByProductId]);

    const mostReviewedInsight = useMemo<HomeInsight | null>(() => {
        const rated = flowerProducts.filter((product) => (statsByProductId[product.id]?.count ?? 0) > 0);
        if (!rated.length) return null;

        const candidates = [...rated].sort((a, b) => {
            const countDiff = (statsByProductId[b.id]?.count ?? 0) - (statsByProductId[a.id]?.count ?? 0);
            if (countDiff !== 0) return countDiff;
            return (statsByProductId[b.id]?.avg ?? 0) - (statsByProductId[a.id]?.avg ?? 0);
        });

        const product = candidates[0] ?? null;
        if (!product) return null;
        return {
            product,
            stat: statsByProductId[product.id],
            summary: communityNotesByProductId[product.id] ?? null,
        };
    }, [flowerProducts, statsByProductId, communityNotesByProductId]);

    const latestReviewedFlowers = useMemo(() => {
        const seen = new Set<string>();
        const rows: Array<{ product: Product; reviewedAt: number; stat: ProductStat; summary: CommunityNotesSummary | null }> = [];

        const ordered = [...activeReviews].sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
        for (const review of ordered) {
            if (!review.productId || seen.has(review.productId)) continue;
            const product = productById[review.productId];
            const stat = statsByProductId[review.productId];
            if (!product || !stat) continue;

            seen.add(review.productId);
            rows.push({
                product,
                reviewedAt: getTimestampMs(review.createdAt),
                stat,
                summary: communityNotesByProductId[review.productId] ?? null,
            });

            if (rows.length >= 4) break;
        }

        return rows;
    }, [activeReviews, communityNotesByProductId, productById, statsByProductId]);

    const isLoading = loadingProducts || loadingReviews;

    const catalogLastUpdatedMs = useMemo(() => {
        const productLatest = products.reduce((latest, product) => Math.max(latest, getTimestampMs(product.updatedAt)), 0);
        if (productLatest > 0) return productLatest;
        return Object.values(statsByProductId).reduce((latest, stat) => Math.max(latest, stat.lastReviewAt), 0);
    }, [products, statsByProductId]);

    const catalogLastUpdatedLabel = useMemo(() => {
        if (!catalogLastUpdatedMs) return "Live now";
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(catalogLastUpdatedMs));
    }, [catalogLastUpdatedMs]);

    const openSection = (section: string, product?: Product) => {
        void trackEvent("home_card_opened", {
            section,
            product_id: product?.id ?? null,
        });

        if (product) {
            router.push(`/reviews/${encodeURIComponent(product.id)}`);
            return;
        }

        router.push("/reviews");
    };

    return (
        <BrandedScreenBackground
            source={homeBg}
            gradientColors={["rgba(65,40,10,0.16)", "rgba(12,14,19,0.58)", "rgba(5,7,12,0.94)"]}
            scrimColor="rgba(9,10,14,0.22)"
        >
            <SafeAreaView style={styles.screen}>
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: Math.max(118, insets.bottom + 94) }]}
                    showsVerticalScrollIndicator={false}
                >
                    <LinearGradient
                        colors={["rgba(55,34,11,0.94)", "rgba(21,19,23,0.96)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroCard}
                    >
                        <View style={styles.heroVisualWrap}>
                            <LinearGradient
                                colors={["rgba(46,35,22,0.92)", "rgba(17,16,18,0.96)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFillObject}
                            />
                            <View style={styles.heroVisualFrame}>
                                <Image source={homeHeroImage} resizeMode="cover" blurRadius={18} style={styles.heroVisualBleed} />
                                <View style={styles.heroVisualContent}>
                                    <Image source={homeHeroImage} style={styles.heroVisual} resizeMode="cover" />
                                </View>
                                <LinearGradient
                                    colors={["rgba(255,223,163,0.00)", "rgba(255,214,132,0.10)", "rgba(255,223,163,0.00)"]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={styles.heroVisualCenterLiftVertical}
                                />
                                <LinearGradient
                                    colors={["rgba(255,223,163,0.00)", "rgba(255,214,132,0.08)", "rgba(255,223,163,0.00)"]}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.heroVisualCenterLiftHorizontal}
                                />
                                <LinearGradient
                                    colors={["rgba(8,10,14,0.26)", "rgba(8,10,14,0.04)", "rgba(8,10,14,0.30)"]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={styles.heroVisualEdgeFadeVertical}
                                />
                                <LinearGradient
                                    colors={["rgba(8,10,14,0.24)", "rgba(8,10,14,0.00)", "rgba(8,10,14,0.24)"]}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.heroVisualEdgeFadeHorizontal}
                                />
                            </View>
                            <LinearGradient
                                colors={["rgba(12,14,18,0.00)", "rgba(12,14,18,0.08)", "rgba(12,14,18,0.30)"]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.heroVisualBottomFade}
                            />
                            <LinearGradient
                                colors={["rgba(14,14,17,0.00)", "rgba(48,35,23,0.20)", "rgba(24,18,15,0.50)"]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.heroVisualSeamFade}
                            />
                        </View>

                        <View style={styles.heroBody}>
                            <View style={styles.heroStatsRow}>
                                {HERO_METRICS.map((metric) => {
                                    const value =
                                        metric.key === "to_review"
                                            ? recentReviewCount
                                            : metric.key === "reviews_total"
                                              ? reviewTotal
                                              : reviewedStrainCount;

                                    return (
                                        <HeroMetricCard
                                            key={metric.key}
                                            label={metric.label}
                                            value={isLoading ? "..." : String(value)}
                                            icon={metric.icon}
                                            tint={metric.tint}
                                            glow={metric.glow}
                                        />
                                    );
                                })}
                            </View>

                            <View style={styles.heroActions}>
                                <View style={styles.catalogStatusCard}>
                                    <View style={styles.catalogStatusIcon}>
                                        <Feather name="clock" size={16} color="rgba(244,225,177,0.98)" />
                                    </View>
                                    <Text style={styles.catalogStatusLabel}>Catalogue last updated</Text>
                                    <Text style={styles.catalogStatusValue}>{catalogLastUpdatedLabel}</Text>
                                </View>

                                <Pressable
                                    onPress={() => openSection("hero_browse")}
                                    style={({ pressed }) => [styles.heroPrimaryButton, pressed ? styles.cardPressed : null]}
                                >
                                    <LinearGradient
                                        colors={["rgba(255,242,201,0.98)", "rgba(225,193,96,0.98)", "rgba(197,151,45,0.98)"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.heroPrimaryButtonFill}
                                    >
                                        <View style={styles.heroBrowseHeader}>
                                            <View style={styles.heroBrowseArt}>
                                                <View style={[styles.heroBrowseSheet, styles.heroBrowseSheetBack]} />
                                                <View style={[styles.heroBrowseSheet, styles.heroBrowseSheetMid]} />
                                                <View style={[styles.heroBrowseSheet, styles.heroBrowseSheetFront]}>
                                                    <View style={styles.heroBrowseLineShort} />
                                                    <View style={styles.heroBrowseLine} />
                                                    <View style={styles.heroBrowseLine} />
                                                </View>
                                            </View>

                                            <Feather name="chevron-right" size={20} color="#11161E" />
                                        </View>

                                        <Text style={styles.heroPrimaryButtonText}>Open catalogue</Text>
                                        <Text style={styles.heroPrimaryButtonMeta}>See all flowers</Text>
                                    </LinearGradient>
                                </Pressable>
                            </View>
                        </View>
                    </LinearGradient>

                    <SectionHeader
                        eyebrow="Fresh in the catalog"
                        title="Recently added flowers"
                        caption="Fresh strains landing in the library and ready for their first proper write-up."
                    />

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
                        {recentlyAddedFlowers.map((product, index) => (
                            <RailProductCard
                                key={product.id}
                                product={product}
                                stat={statsByProductId[product.id]}
                                palette={railPalette(index)}
                                kicker={formatShortDate(getTimestampMs(product.updatedAt))}
                                subtitle={
                                    communityNotesByProductId[product.id]?.chips.slice(0, 2).join(" · ") ||
                                    (statsByProductId[product.id] ? "Already getting community notes" : "Fresh addition to the library")
                                }
                                footer="Needs first review"
                                onPress={() => openSection("recently_added", product)}
                            />
                        ))}
                    </ScrollView>

                    <SectionHeader
                        eyebrow="Community pulse"
                        title="Where the momentum is"
                        caption="The liveliest strains right now, with the score, chips, and member notes that make them worth opening."
                    />

                    <View style={styles.insightStack}>
                        <InsightFeatureCard
                            eyebrow="Top rated"
                            insight={topRatedInsight}
                            chips={
                                topRatedInsight
                                    ? buildInsightChips(
                                          effectBadgesByProductId[topRatedInsight.product.id] ?? [],
                                          communityNotesByProductId[topRatedInsight.product.id]?.chips ?? []
                                      )
                                    : []
                            }
                            palette={["rgba(43,97,68,0.98)", "rgba(24,29,25,0.98)"]}
                            onPress={topRatedInsight ? () => openSection("top_rated", topRatedInsight.product) : undefined}
                        />
                        <InsightFeatureCard
                            eyebrow="Most reviewed"
                            insight={mostReviewedInsight}
                            chips={
                                mostReviewedInsight
                                    ? buildInsightChips(
                                          effectBadgesByProductId[mostReviewedInsight.product.id] ?? [],
                                          communityNotesByProductId[mostReviewedInsight.product.id]?.chips ?? []
                                      )
                                    : []
                            }
                            palette={["rgba(43,72,116,0.98)", "rgba(23,24,38,0.98)"]}
                            onPress={mostReviewedInsight ? () => openSection("most_reviewed", mostReviewedInsight.product) : undefined}
                        />
                    </View>

                    <SectionHeader
                        eyebrow="Needs your take"
                        title="Still waiting on first reviews"
                        caption="This rail skips the newest arrivals and pulls from earlier catalogue drops that still need their first proper take."
                    />

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
                        {needsFirstReview.map((product, index) => (
                            <RailProductCard
                                key={product.id}
                                product={product}
                                palette={railPalette(index + 1)}
                                kicker="Needs first review"
                                subtitle="Perfect place to add value quickly"
                                footer="Needs first review"
                                onPress={() => openSection("needs_first_review", product)}
                            />
                        ))}
                    </ScrollView>

                    <SectionHeader
                        eyebrow="Latest activity"
                        title="Flowers people reviewed recently"
                        caption="Fresh member context with a proper score board, so you can spot what is being talked about now."
                    />

                    <View style={styles.activityStack}>
                        {latestReviewedFlowers.map(({ product, reviewedAt, stat, summary }) => (
                            <ActivityReviewCard
                                key={product.id}
                                product={product}
                                stat={stat}
                                reviewedAt={reviewedAt}
                                summary={summary}
                                onPress={() => openSection("latest_reviewed", product)}
                            />
                        ))}
                    </View>

                    {isLoading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                            <Text style={styles.loadingText}>Refreshing the Review Budz feed...</Text>
                        </View>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </BrandedScreenBackground>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "transparent",
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    heroCard: {
        borderRadius: 32,
        overflow: "hidden",
        backgroundColor: "rgba(16,18,24,0.92)",
        shadowColor: "#000",
        shadowOpacity: 0.26,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
        elevation: 8,
    },
    heroVisualWrap: {
        minHeight: Platform.OS === "android" ? 320 : 292,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 0,
        paddingTop: 0,
        position: "relative",
    },
    heroVisualFrame: {
        position: "absolute",
        left: 14,
        right: 14,
        top: Platform.OS === "android" ? 10 : 8,
        bottom: 0,
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: "rgba(10,11,15,0.30)",
    },
    heroVisualContent: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    heroVisual: {
        width: "100%",
        height: "100%",
        opacity: 0.985,
        transform: [
            { scale: Platform.OS === "android" ? 1.01 : 1.02 },
            { translateY: Platform.OS === "android" ? 56 : 24 },
        ],
    },
    heroVisualBleed: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.62,
        transform: [
            { scale: Platform.OS === "android" ? 1.08 : 1.1 },
            { translateY: Platform.OS === "android" ? 42 : 16 },
        ],
    },
    heroVisualCenterLiftVertical: {
        ...StyleSheet.absoluteFillObject,
    },
    heroVisualCenterLiftHorizontal: {
        ...StyleSheet.absoluteFillObject,
    },
    heroVisualEdgeFadeVertical: {
        ...StyleSheet.absoluteFillObject,
    },
    heroVisualEdgeFadeHorizontal: {
        ...StyleSheet.absoluteFillObject,
    },
    heroVisualBottomFade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 128,
    },
    heroVisualSeamFade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -2,
        height: 72,
    },
    heroBody: {
        position: "relative",
        paddingHorizontal: 18,
        marginTop: -10,
        paddingTop: 20,
        paddingBottom: 18,
    },
    heroStatsRow: {
        flexDirection: "row",
        gap: 10,
    },
    heroMetricCard: {
        flex: 1,
        minHeight: 122,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
        paddingVertical: 16,
    },
    heroMetricIcon: {
        position: "absolute",
        top: 10,
        right: 10,
        opacity: 0.16,
    },
    heroMetricValue: {
        color: theme.colors.textOnDark,
        fontSize: 29,
        fontWeight: "900",
        lineHeight: 34,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
    },
    heroMetricLabel: {
        marginTop: 8,
        color: "rgba(242,244,248,0.86)",
        fontSize: 12,
        fontWeight: "900",
        lineHeight: 16,
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    heroActions: {
        marginTop: 16,
        flexDirection: "row",
        gap: 12,
        alignItems: "stretch",
    },
    catalogStatusCard: {
        flex: 1,
        flexBasis: 0,
        minHeight: 84,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(244,214,137,0.20)",
        backgroundColor: "rgba(12,15,20,0.56)",
        paddingHorizontal: 14,
        paddingVertical: 12,
        justifyContent: "center",
    },
    catalogStatusIcon: {
        width: 28,
        height: 28,
        borderRadius: 999,
        backgroundColor: "rgba(244,214,137,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    catalogStatusLabel: {
        marginTop: 8,
        color: "rgba(244,233,209,0.68)",
        fontSize: 10,
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        lineHeight: 13,
    },
    catalogStatusValue: {
        marginTop: 6,
        color: theme.colors.textOnDark,
        fontSize: 16,
        fontWeight: "900",
        lineHeight: 20,
        fontVariant: ["tabular-nums"],
    },
    heroPrimaryButton: {
        flex: 1,
        flexBasis: 0,
        minHeight: 84,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "rgba(198,151,45,0.48)",
        shadowOpacity: 0.34,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 7,
    },
    heroPrimaryButtonFill: {
        minHeight: 84,
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    heroBrowseHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 2,
    },
    heroBrowseArt: {
        width: 38,
        height: 34,
        justifyContent: "center",
    },
    heroBrowseSheet: {
        position: "absolute",
        borderRadius: 12,
        borderWidth: 1.5,
    },
    heroBrowseSheetBack: {
        left: 3,
        top: 4,
        width: 22,
        height: 24,
        backgroundColor: "rgba(17,22,30,0.18)",
        borderColor: "rgba(17,22,30,0.18)",
    },
    heroBrowseSheetMid: {
        left: 9,
        top: 0,
        width: 22,
        height: 24,
        backgroundColor: "rgba(17,22,30,0.24)",
        borderColor: "rgba(17,22,30,0.22)",
    },
    heroBrowseSheetFront: {
        left: 13,
        top: 7,
        width: 24,
        height: 26,
        backgroundColor: "rgba(255,255,255,0.30)",
        borderColor: "rgba(17,22,30,0.28)",
        paddingHorizontal: 5,
        paddingTop: 6,
        gap: 2,
    },
    heroBrowseLineShort: {
        width: 10,
        height: 3,
        borderRadius: 999,
        backgroundColor: "rgba(17,22,30,0.46)",
    },
    heroBrowseLine: {
        width: 14,
        height: 3,
        borderRadius: 999,
        backgroundColor: "rgba(17,22,30,0.34)",
    },
    heroPrimaryButtonText: {
        color: "#11161E",
        fontWeight: "900",
        fontSize: 15,
        lineHeight: 17,
    },
    heroPrimaryButtonMeta: {
        color: "rgba(17,22,30,0.72)",
        fontWeight: "800",
        fontSize: 10,
        lineHeight: 12,
    },
    sectionHeader: {
        marginTop: 24,
        marginBottom: 12,
    },
    sectionEyebrow: {
        color: "rgba(255,255,255,0.56)",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    sectionTitle: {
        marginTop: 6,
        color: theme.colors.textOnDark,
        fontSize: 20,
        lineHeight: 24,
        fontWeight: "800",
        letterSpacing: -0.2,
    },
    sectionCaption: {
        marginTop: 6,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
        lineHeight: 19,
    },
    horizontalRail: {
        gap: 14,
        paddingRight: 6,
    },
    railCard: {
        width: 268,
        borderRadius: 26,
        overflow: "hidden",
    },
    railSurface: {
        minHeight: 224,
        borderRadius: 26,
        paddingHorizontal: 18,
        paddingVertical: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        alignItems: "center",
        justifyContent: "space-between",
    },
    railGraphic: {
        position: "absolute",
        top: 14,
        right: 12,
    },
    railKicker: {
        color: "rgba(255,255,255,0.66)",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1,
        textTransform: "uppercase",
        textAlign: "center",
    },
    railTitle: {
        marginTop: 12,
        color: theme.colors.textOnDark,
        fontSize: 20,
        lineHeight: 24,
        fontWeight: "900",
        textAlign: "center",
    },
    railMeta: {
        marginTop: 8,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
        lineHeight: 18,
        textAlign: "center",
    },
    railSubtitle: {
        marginTop: 14,
        color: "rgba(255,255,255,0.82)",
        fontSize: 14,
        lineHeight: 19,
        textAlign: "center",
    },
    railFooterBadge: {
        marginTop: 16,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(214,180,79,0.34)",
        backgroundColor: "rgba(12,14,18,0.26)",
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    railFooterBadgeText: {
        color: theme.colors.textOnDark,
        fontSize: 12,
        fontWeight: "900",
        textAlign: "center",
    },
    insightStack: {
        gap: 14,
    },
    insightCard: {
        borderRadius: 26,
        overflow: "hidden",
    },
    insightSurface: {
        minHeight: 216,
        borderRadius: 26,
        paddingHorizontal: 18,
        paddingVertical: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    insightHeroRow: {
        flexDirection: "row",
        gap: 14,
        alignItems: "flex-start",
    },
    insightCopyBlock: {
        flex: 1,
    },
    insightEyebrow: {
        color: "rgba(255,255,255,0.62)",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    insightMediaSpacer: {
        width: 94,
        minHeight: 86,
    },
    insightTitle: {
        marginTop: 12,
        color: theme.colors.textOnDark,
        fontSize: 24,
        lineHeight: 28,
        fontWeight: "900",
    },
    insightMeta: {
        marginTop: 8,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 14,
        lineHeight: 19,
    },
    insightChipRow: {
        marginTop: 14,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    insightChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        borderRadius: 999,
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    insightChipDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
    },
    insightChipText: {
        fontSize: 12,
        fontWeight: "900",
    },
    insightScoreRow: {
        marginTop: 18,
        flexDirection: "row",
        alignItems: "baseline",
        gap: 10,
    },
    insightScoreValue: {
        color: theme.colors.textOnDark,
        fontSize: 28,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
    },
    insightScoreMeta: {
        color: "rgba(255,255,255,0.84)",
        fontSize: 14,
        fontWeight: "800",
    },
    insightSummary: {
        marginTop: 10,
        color: "rgba(255,255,255,0.84)",
        fontSize: 14,
        lineHeight: 20,
    },
    activityStack: {
        gap: 12,
    },
    activityCard: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(12,15,20,0.68)",
        padding: 14,
    },
    activityScoreBoard: {
        width: 102,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(20,23,32,0.94)",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    activityScoreLabel: {
        color: "rgba(255,255,255,0.58)",
        fontSize: 10,
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: 0.9,
    },
    activityScoreValue: {
        marginTop: 4,
        color: theme.colors.textOnDark,
        fontSize: 24,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
    },
    activityScoreMeta: {
        marginTop: 4,
        color: "rgba(255,255,255,0.72)",
        fontSize: 11,
        lineHeight: 14,
        fontWeight: "800",
        textAlign: "center",
    },
    activityBody: {
        flex: 1,
        justifyContent: "center",
    },
    activityTitle: {
        color: theme.colors.textOnDark,
        fontSize: 18,
        fontWeight: "900",
    },
    activityMeta: {
        marginTop: 4,
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
    },
    activitySummary: {
        marginTop: 8,
        color: "rgba(255,255,255,0.80)",
        fontSize: 13,
        lineHeight: 18,
    },
    loadingWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 18,
        paddingHorizontal: 4,
    },
    loadingText: {
        color: theme.colors.textOnDarkSecondary,
        fontSize: 13,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
});
