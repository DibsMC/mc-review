// app/(tabs)/reviews/index.tsx

import { CinematicCard } from "../../../components/ui/CinematicCard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Animated,
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
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "../../../lib/theme";
import { getAsyncStorage, getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";
import { buildCommunityNotesSummary, type CommunityNotesSummary } from "../../../lib/communityNotes";
import { dedupeCatalogueProducts } from "../../../lib/catalogueDedupe";

const budImg = require("../../../assets/icons/bud.png");
const flowersBg = require("../../../assets/images/flowers-bg.png");
const REVIEWS_SORT_STORAGE_KEY = "@mc/reviews/sortKey/v1";

type Product = {
  id: string;
  name: string;
  maker: string;
  variant?: string | null;
  strainType?: string | null; // "indica" | "sativa" | "hybrid"
  productType?: string | null; // backward compat
  thcPct?: number | null;
  cbdPct?: number | null;
  terpenes?: string | null; // "limonene:major|caryophyllene:major|linalool:minor"
  availabilityStatus?: string | null;
  updatedAtMs?: number | null;
};

type Review = {
  id: string;
  productId: string;
  rating: number;
  score?: number | null;
  text?: string | null;
  createdAtMs?: number | null;
  moderationStatus?: "active" | "under_review" | "removed_auto" | "removed_admin" | null;
  helpfulCount?: number | null;
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

type EffectFilterKey =
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

type Stat = {
  count: number;
  avg: number;
  weightedScore: number;
  helpfulTotal: number;
  latestReviewAtMs?: number;
};

type EffectAggregate = Record<EffectFilterKey, { count: number; sum: number; perfect: number }>;

type FavoriteSlot = "general" | "daytime" | "afternoon" | "night";
type FavoriteSlots = Record<FavoriteSlot, boolean>;

type SortKey =
  | "mostReviewed"
  | "recentReviews"
  | "highestRated"
  | "thcHighLow"
  | "thcLowHigh"
  | "maker"
  | "atoz";

const STRAIN_META: Record<"sativa" | "indica" | "hybrid", { label: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string }> = {
  sativa: { label: "Sativa", icon: "sun", color: "rgba(255,212,123,0.98)" },
  indica: { label: "Indica", icon: "moon", color: "rgba(147,172,255,0.96)" },
  hybrid: { label: "Hybrid", icon: "shuffle", color: "rgba(166,233,182,0.98)" },
};

const SORT_META: Record<SortKey, { icon: React.ComponentProps<typeof Feather>["name"]; color: string }> = {
  mostReviewed: { icon: "message-circle", color: "rgba(255,202,128,0.98)" },
  recentReviews: { icon: "clock", color: "rgba(151,214,255,0.98)" },
  highestRated: { icon: "award", color: "rgba(255,226,150,0.98)" },
  thcHighLow: { icon: "trending-up", color: "rgba(255,170,132,0.98)" },
  thcLowHigh: { icon: "trending-down", color: "rgba(189,216,255,0.98)" },
  maker: { icon: "briefcase", color: "rgba(208,193,255,0.98)" },
  atoz: { icon: "type", color: "rgba(178,235,199,0.98)" },
};

const SORT_MENU_KEYS: SortKey[] = ["recentReviews", "mostReviewed", "highestRated", "thcHighLow", "thcLowHigh", "maker", "atoz"];

const EMPTY_SLOTS: FavoriteSlots = {
  general: false,
  daytime: false,
  afternoon: false,
  night: false,
};

const FAVORITE_SLOT_META: Array<{ key: FavoriteSlot; label: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string }> = [
  { key: "general", label: "Favourite", icon: "star", color: "rgba(201,88,108,0.98)" },
  { key: "daytime", label: "Daytime", icon: "sun", color: "rgba(229,189,72,0.98)" },
  { key: "afternoon", label: "Afternoon", icon: "clock", color: "rgba(231,152,85,0.98)" },
  { key: "night", label: "Night", icon: "moon", color: "rgba(122,155,255,0.98)" },
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

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return `${n}%`;
}

function safeLower(v: any) {
  return typeof v === "string" ? v.toLowerCase() : "";
}

function toMillisMaybe(raw: any): number | null {
  if (!raw) return null;
  if (typeof raw?.toDate === "function") {
    const ms = raw.toDate()?.getTime?.();
    return typeof ms === "number" && Number.isFinite(ms) ? ms : null;
  }
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1e12) return raw;
    if (raw > 1e9) return raw * 1000;
    return raw;
  }
  if (typeof raw === "string") {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "object" && typeof raw.seconds === "number") {
    return raw.seconds * 1000;
  }
  return null;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
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

function computeRobustReviewScore(input: { rating: number; effectsMean: number | null; highEffectsCount: number }) {
  const rating = Number.isFinite(input.rating) ? input.rating : 0;
  if (!input.effectsMean) return round1(clamp(rating, 1, 5));

  const eDelta = clamp((input.effectsMean - 3) / 2, -1, 1);
  const effectsBoost = eDelta * 0.25;
  const superPenalty = clamp(input.highEffectsCount >= 4 ? 0.06 * (input.highEffectsCount - 3) : 0, 0, 0.18);

  return round1(clamp(rating + effectsBoost - superPenalty, 1, 5));
}

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

function toScore(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 1 || n > 5) return null;
  return n;
}

function avgPresent(values: Array<number | null>) {
  const xs = values.filter((v): v is number => typeof v === "number");
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

const EFFECT_KEYS: EffectFilterKey[] = [
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

const EFFECT_META: Record<
  EffectFilterKey,
  { label: string; short: string; icon: string; color: string; aliases: string[] }
> = {
  sleepy: {
    label: "Couch lock / sleepy",
    short: "Couch lock",
    icon: "🌙",
    color: "rgba(147,172,255,0.96)",
    aliases: ["sleepy", "sleep", "night", "insomnia", "couch lock", "couchlock", "sedating", "sedation"],
  },
  calming: {
    label: "Calming",
    short: "Calm",
    icon: "🧘",
    color: "rgba(146,220,174,0.96)",
    aliases: ["calm", "calming", "chill", "relax"],
  },
  uplifting: {
    label: "Uplifting",
    short: "Uplift",
    icon: "⚡",
    color: "rgba(255,212,123,0.98)",
    aliases: ["uplift", "uplifting", "daytime", "awake", "energy"],
  },
  painRelief: {
    label: "Pain Relief",
    short: "Pain",
    icon: "💥",
    color: "rgba(255,160,132,0.98)",
    aliases: ["pain", "relief", "ache", "back pain", "joint pain"],
  },
  focusAdhd: {
    label: "Focus / ADHD",
    short: "Focus",
    icon: "🧠",
    color: "rgba(152,205,255,0.98)",
    aliases: ["focus", "adhd", "clarity", "concentrate"],
  },
  anxiety: {
    label: "Anxiety",
    short: "Anxiety",
    icon: "🛡️",
    color: "rgba(189,216,255,0.98)",
    aliases: ["anxiety", "stress", "panic"],
  },
  moodBalance: {
    label: "Mood balance",
    short: "Mood",
    icon: "🙂",
    color: "rgba(181,236,170,0.98)",
    aliases: ["mood", "balance", "stable", "mood balance"],
  },
  appetite: {
    label: "Munchies",
    short: "Munchies",
    icon: "🍽️",
    color: "rgba(255,203,134,0.98)",
    aliases: ["appetite", "munchies", "hunger"],
  },
  femaleHealth: {
    label: "Female health",
    short: "Female",
    icon: "🌸",
    color: "rgba(255,172,214,0.98)",
    aliases: ["female", "women", "perimenopause", "menopause", "period"],
  },
  muscleRelaxation: {
    label: "Muscle relaxation",
    short: "Muscle",
    icon: "💪",
    color: "rgba(199,211,255,0.98)",
    aliases: ["muscle", "body", "tension", "spasm"],
  },
  creativity: {
    label: "Creativity",
    short: "Creative",
    icon: "🎨",
    color: "rgba(223,196,255,0.98)",
    aliases: ["creative", "creativity", "ideas", "flow"],
  },
};

const EFFECT_THRESHOLD_MIN_COUNT = 2;
const EFFECT_THRESHOLD_MIN_PERFECT = 2;
const EFFECT_THRESHOLD_MIN_AVG = 3.5;

function inferEffectIntent(query: string): EffectFilterKey[] {
  const q = safeLower(query).trim();
  if (!q) return [];
  return EFFECT_KEYS.filter((k) => EFFECT_META[k].aliases.some((a) => q.includes(a)));
}

function deriveEffectScoresFromReview(review: Review): Partial<Record<EffectFilterKey, number>> {
  const sleepy = toScore(review.sleepy);
  const calming = toScore(review.calm);
  const uplifting = toScore(review.uplifting) ?? toScore(review.daytime);

  const painRelief = toScore(review.painRelief) ??
    avgPresent([toScore(review.backPain), toScore(review.jointPain), toScore(review.legPain), toScore(review.headacheRelief)]);

  const focusAdhd = toScore(review.focusAdhd) ?? avgPresent([toScore(review.clarity), toScore(review.racingThoughts)]);
  const anxiety = toScore(review.anxiety) ?? avgPresent([toScore(review.calm), toScore(review.racingThoughts)]);
  const moodBalance = toScore(review.moodBalance) ?? avgPresent([toScore(review.calm), toScore(review.uplifting), toScore(review.anxiety)]);
  const appetite = toScore(review.appetite);
  const femaleHealth = toScore(review.femaleHealth);
  const muscleRelaxation = toScore(review.muscleRelaxation) ??
    avgPresent([toScore(review.backPain), toScore(review.jointPain), toScore(review.legPain)]);
  const creativity = toScore(review.creativity) ?? toScore(review.daytime);

  const out: Partial<Record<EffectFilterKey, number>> = {};
  const maybeAssign = (key: EffectFilterKey, val: number | null) => {
    if (typeof val === "number") out[key] = val;
  };

  maybeAssign("sleepy", sleepy);
  maybeAssign("calming", calming);
  maybeAssign("uplifting", uplifting);
  maybeAssign("painRelief", painRelief);
  maybeAssign("focusAdhd", focusAdhd);
  maybeAssign("anxiety", anxiety);
  maybeAssign("moodBalance", moodBalance);
  maybeAssign("appetite", appetite);
  maybeAssign("femaleHealth", femaleHealth);
  maybeAssign("muscleRelaxation", muscleRelaxation);
  maybeAssign("creativity", creativity);

  return out;
}

function makeEmptyEffectAggregate(): EffectAggregate {
  return EFFECT_KEYS.reduce((acc, key) => {
    acc[key] = { count: 0, sum: 0, perfect: 0 };
    return acc;
  }, {} as EffectAggregate);
}

function normalizeStrainType(v: any): "sativa" | "indica" | "hybrid" | "unknown" {
  if (v === null || v === undefined) return "unknown";

  const s = String(v).toLowerCase().trim();
  if (!s) return "unknown";

  // direct matches
  if (s.includes("sativa")) return "sativa";
  if (s.includes("indica")) return "indica";
  if (s.includes("hybrid")) return "hybrid";

  // common phrasing
  if (s.includes("dominant") && (s.includes("sat") || s.includes("sativa"))) return "sativa";
  if (s.includes("dominant") && (s.includes("ind") || s.includes("indica"))) return "indica";

  // abbreviations / sloppy values
  if (s.startsWith("sat") || s === "s") return "sativa";
  if (s.startsWith("ind") || s === "i") return "indica";
  if (s.startsWith("hyb") || s === "h") return "hybrid";

  return "unknown";
}

function formatStrainType(v: string | null | undefined) {
  const norm = normalizeStrainType(v);
  if (norm === "unknown") return null;
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}

function isFlowerProduct(product: Product) {
  const raw = `${product.productType ?? product.strainType ?? ""}`.toLowerCase().trim();
  return raw.length === 0 || raw.includes("flower") || raw === "sativa" || raw === "indica" || raw === "hybrid";
}

function sortLabel(k: SortKey) {
  switch (k) {
    case "mostReviewed":
      return "Most reviewed";
    case "recentReviews":
      return "Recent reviews";
    case "highestRated":
      return "Highest rated";
    case "thcHighLow":
      return "High THC";
    case "thcLowHigh":
      return "Low THC";
    case "maker":
      return "Maker";
    case "atoz":
    default:
      return "A to Z";
  }
}

function sortButtonLabel(k: SortKey) {
  switch (k) {
    case "mostReviewed":
      return "Most reviewed";
    case "recentReviews":
      return "Recent reviews";
    case "highestRated":
      return "Top rated";
    case "thcHighLow":
      return "High THC";
    case "thcLowHigh":
      return "Low THC";
    case "maker":
      return "Maker";
    case "atoz":
      return "A-Z";
    default:
      return "Recent reviews";
  }
}

function normalizeSortMenuKey(k: SortKey): SortKey {
  return SORT_MENU_KEYS.includes(k) ? k : "recentReviews";
}

function isSortKey(v: unknown): v is SortKey {
  return (
    v === "mostReviewed" ||
    v === "recentReviews" ||
    v === "highestRated" ||
    v === "thcHighLow" ||
    v === "thcLowHigh" ||
    v === "maker" ||
    v === "atoz"
  );
}

function rgbaWithAlpha(color: string, alpha: number) {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return color;
  const [r = "255", g = "255", b = "255"] = match[1].split(",").map((part) => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chipOnDark(selected: boolean, accent = "rgba(255,255,255,0.96)") {
  return {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: selected ? rgbaWithAlpha(accent, 0.42) : "rgba(255,255,255,0.12)",
    backgroundColor: selected ? rgbaWithAlpha(accent, 0.18) : "rgba(255,255,255,0.08)",
    shadowColor: accent,
    shadowOpacity: selected ? 0.18 : 0,
    shadowRadius: selected ? 12 : 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: selected ? 3 : 0,
  };
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

/* -------------------- BudRating -------------------- */

function BudRating({ value, size = 18 }: { value: number; size?: number }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  const glowEnabled = Platform.OS !== "android";
  const SCALE = Platform.OS === "android" ? 1 : 1.08;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const rawFill = Math.max(0, Math.min(1, safe - i));
        const fill = Math.round(rawFill * 4) / 4;
        const px = Math.round(size * fill);

        return (
          <View
            key={`bud-${i}`}
            style={{
              width: size,
              height: size,
              position: "relative",
              marginRight: i === 4 ? 0 : 6,
            }}
          >
            <Image
              source={budImg}
              style={{ width: size, height: size, opacity: 0.28 }}
              resizeMode="contain"
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
                  style={{ width: size, height: size, opacity: 1, transform: [{ scale: SCALE }] }}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function ReviewsIndex() {
  const firestore = getFirebaseFirestore();
  const auth = getFirebaseAuth();
  const AsyncStorage = getAsyncStorage();
  const router = useRouter();
  const params = useLocalSearchParams<{ terpenePreset?: string | string[]; terpenePresetLabel?: string | string[]; terpenePresetStamp?: string | string[] }>();
  const insets = useSafeAreaInsets();

  if (!firestore || !auth) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <ImageBackground source={flowersBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ color: "white", fontSize: 18, fontWeight: "900", textAlign: "center" }}>
            Reviews unavailable
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 8, textAlign: "center" }}>
            Please close and reopen the app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const listRef = useRef<FlatList<Product> | null>(null);

  const [items, setItems] = useState<Product[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [statsByProductId, setStatsByProductId] = useState<Record<string, Stat>>({});
  const [effectBadgesByProductId, setEffectBadgesByProductId] = useState<Record<string, EffectFilterKey[]>>({});
  const [communityNotesByProductId, setCommunityNotesByProductId] = useState<Record<string, CommunityNotesSummary>>({});

  // Auth + favourites
  const [currentUid, setCurrentUid] = useState<string>(() => {
    try {
      return auth().currentUser?.uid ?? "";
    } catch {
      return "";
    }
  });
  const [authResolved, setAuthResolved] = useState<boolean>(false);
  const [legacyFavoriteProductIds, setLegacyFavoriteProductIds] = useState<string[]>([]);
  const [favoriteSlotsByProductId, setFavoriteSlotsByProductId] = useState<Record<string, FavoriteSlots>>({});

  const searchInputRef = useRef<TextInput | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recentReviews");

  const [strainFilter, setStrainFilter] = useState<"sativa" | "indica" | "hybrid" | null>(null);
  const [makerFilter, setMakerFilter] = useState<string | null>(null);
  const [terpeneFilter, setTerpeneFilter] = useState<string[]>([]);
  const [effectFilter, setEffectFilter] = useState<EffectFilterKey[]>([]);

  // Saved favourites filters (applied)
  const [favoriteFilterAny, setFavoriteFilterAny] = useState(false);
  const [favoriteFilterSlots, setFavoriteFilterSlots] = useState<FavoriteSlot[]>([]);

  // Modal open
  const [panelOpen, setPanelOpen] = useState(false);

  // Draft values inside modal
  const [draftSortKey, setDraftSortKey] = useState<SortKey>("recentReviews");
  const [draftStrainFilter, setDraftStrainFilter] = useState<"sativa" | "indica" | "hybrid" | null>(null);
  const [draftMakerFilter, setDraftMakerFilter] = useState<string | null>(null);
  const [draftTerpeneFilter, setDraftTerpeneFilter] = useState<string[]>([]);
  const [draftEffectFilter, setDraftEffectFilter] = useState<EffectFilterKey[]>([]);
  const [draftFavoriteFilterAny, setDraftFavoriteFilterAny] = useState(false);
  const [draftFavoriteFilterSlots, setDraftFavoriteFilterSlots] = useState<FavoriteSlot[]>([]);

  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const [terpeneOpen, setTerpeneOpen] = useState(false);
  const [makerPanelQuery, setMakerPanelQuery] = useState("");
  const [terpenePanelQuery, setTerpenePanelQuery] = useState("");

  const headerOpacity = useRef(new Animated.Value(1)).current;
  const [headerH, setHeaderH] = useState(176);
  const [presetReviewedOnly, setPresetReviewedOnly] = useState(false);
  const appliedPresetKeyRef = useRef<string>("");

  // Back-to-top button state
  const [showTop, setShowTop] = useState(false);
  const sortHydratedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!AsyncStorage) {
        sortHydratedRef.current = true;
        return;
      }
      try {
        const saved = await AsyncStorage.getItem(REVIEWS_SORT_STORAGE_KEY);
        if (!mounted) return;
        if (isSortKey(saved)) {
          const normalized = normalizeSortMenuKey(saved);
          setSortKey(normalized);
          setDraftSortKey(normalized);
        }
      } catch {
        // no-op
      } finally {
        sortHydratedRef.current = true;
      }
    })();

    return () => {
      mounted = false;
    };
  }, [AsyncStorage]);

  useEffect(() => {
    if (!sortHydratedRef.current || !AsyncStorage) return;
    AsyncStorage.setItem(REVIEWS_SORT_STORAGE_KEY, sortKey).catch(() => {
      // no-op
    });
  }, [AsyncStorage, sortKey]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const trimmed = queryInput.trim();
    if (!trimmed) {
      setQuery("");
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      setQuery(queryInput);
      searchDebounceRef.current = null;
    }, 120);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [queryInput]);

  const onListScroll = useCallback(
    (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      if (y > 600 && !showTop) setShowTop(true);
      if (y <= 600 && showTop) setShowTop(false);
    },
    [showTop]
  );

  useEffect(() => {
    const unsub = auth().onAuthStateChanged((user) => {
      setCurrentUid(user?.uid ?? "");
      setAuthResolved(true);
    });

    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!authResolved || currentUid) return;
    router.replace("/(tabs)/user");
  }, [authResolved, currentUid, router]);

  useEffect(() => {
    const rawPreset = Array.isArray(params.terpenePreset) ? params.terpenePreset[0] : params.terpenePreset;
    const rawStamp = Array.isArray(params.terpenePresetStamp) ? params.terpenePresetStamp[0] : params.terpenePresetStamp;
    const presetKey = typeof rawPreset === "string" ? rawPreset.trim() : "";
    const presetSignature = `${presetKey}::${typeof rawStamp === "string" ? rawStamp : ""}`;
    if (!presetKey || appliedPresetKeyRef.current === presetSignature) return;

    const nextTerpenes = presetKey
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!nextTerpenes.length) return;

    appliedPresetKeyRef.current = presetSignature;

    setQueryInput("");
    setQuery("");
    setStrainFilter(null);
    setMakerFilter(null);
    setEffectFilter([]);
    setFavoriteFilterAny(false);
    setFavoriteFilterSlots([]);
    setTerpeneFilter(nextTerpenes);
    setPresetReviewedOnly(true);

    setDraftStrainFilter(null);
    setDraftMakerFilter(null);
    setDraftEffectFilter([]);
    setDraftFavoriteFilterAny(false);
    setDraftFavoriteFilterSlots([]);
    setDraftTerpeneFilter(nextTerpenes);

    setSortMenuOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
    setMakerPanelQuery("");
    setTerpenePanelQuery("");
    setPanelOpen(false);

    requestAnimationFrame(() => {
      scrollToTop(false);
    });
  }, [params.terpenePreset, params.terpenePresetStamp, scrollToTop]);

  useEffect(() => {
    if (!currentUid) {
      setLegacyFavoriteProductIds([]);
      setFavoriteSlotsByProductId({});
      return;
    }

    const unsubLegacy = firestore()
      .collection("users")
      .doc(currentUid)
      .onSnapshot(
        (doc) => {
          const data = (doc.data() as any) ?? {};
          const favs = Array.isArray(data?.favoriteProductIds)
            ? data.favoriteProductIds.filter((x: any) => typeof x === "string")
            : [];
          setLegacyFavoriteProductIds(favs);
        },
        () => setLegacyFavoriteProductIds([])
      );

    const unsubSlots = firestore()
      .collection("users")
      .doc(currentUid)
      .collection("favorites")
      .onSnapshot(
        (snap) => {
          const next: Record<string, FavoriteSlots> = {};
          snap.docs.forEach((d) => {
            const data = (d.data() as any) ?? {};
            next[d.id] = normalizeFavoriteSlots(data?.slots);
          });
          setFavoriteSlotsByProductId(next);
        },
        () => setFavoriteSlotsByProductId({})
      );

    return () => {
      unsubLegacy();
      unsubSlots();
    };
  }, [currentUid]);

  const legacyFavoriteSet = useMemo(() => new Set(legacyFavoriteProductIds), [legacyFavoriteProductIds]);

  const getSlotsForProduct = useCallback(
    (productId: string): FavoriteSlots => {
      const fromDoc = favoriteSlotsByProductId[productId];
      if (fromDoc) {
        // Keep backward compatibility: legacy array implies general favourite.
        if (legacyFavoriteSet.has(productId) && !fromDoc.general) {
          return { ...fromDoc, general: true };
        }
        return fromDoc;
      }
      return legacyFavoriteSet.has(productId)
        ? { ...EMPTY_SLOTS, general: true }
        : { ...EMPTY_SLOTS };
    },
    [favoriteSlotsByProductId, legacyFavoriteSet]
  );

  // Products
  useEffect(() => {
    setLoadingProducts(true);
    setErrorMsg(null);

    const unsub = firestore().collection("products").onSnapshot(
      (snapshot) => {
        const list: Product[] = snapshot.docs.map((doc) => {
          const data = doc.data() as any;

          const rawStrain =
            (data as any)?.strainType ??
            (data as any)?.strain ??
            (data as any)?.dominance ??
            (data as any)?.genetics ??
            (data as any)?.type ??
            (data as any)?.productType ??
            null;

          const norm = normalizeStrainType(rawStrain);
          const strainType = norm === "unknown" ? null : norm;
          const updatedAtMs = toMillisMaybe(
            data?.updatedAt ?? data?.updatedAtMs ?? data?.lastUpdated ?? data?.modifiedAt ?? data?.createdAt ?? null
          );

          return {
            id: doc.id,
            name: typeof data?.name === "string" ? data.name : "",
            maker: typeof data?.maker === "string" ? data.maker : "",
            variant: data?.variant ?? null,
            strainType,
            productType: typeof data?.productType === "string" ? data.productType : null,
            thcPct: typeof data?.thcPct === "number" ? data.thcPct : null,
            cbdPct: typeof data?.cbdPct === "number" ? data.cbdPct : null,
            terpenes: typeof data?.terpenes === "string" ? data.terpenes : null,
            availabilityStatus: typeof data?.availabilityStatus === "string" ? data.availabilityStatus : null,
            updatedAtMs,
          };
        });

        setItems(dedupeCatalogueProducts(list));
        setLoadingProducts(false);
      },
      (err) => {
        console.log("products snapshot error:", err);
        setErrorMsg(err?.message ?? "Failed to load products");
        setLoadingProducts(false);
      }
    );

    return () => unsub();
  }, []);

  // Reviews -> stats map
  useEffect(() => {
    setLoadingReviews(true);

    const unsub = firestore().collection("reviews").onSnapshot(
      (snapshot) => {
        const rows: Review[] = snapshot.docs.map((d) => {
          const data = d.data() as any;
          const rating = typeof data?.rating === "number" ? data.rating : 0;
          const score = typeof data?.score === "number" ? data.score : null;
          const helpfulCount = typeof data?.helpfulCount === "number" ? data.helpfulCount : 0;
          const createdAtRaw = data?.createdAt ?? null;
          let createdAtMs: number | null = null;
          if (createdAtRaw?.toDate) createdAtMs = createdAtRaw.toDate().getTime();
          else if (typeof createdAtRaw === "number") createdAtMs = createdAtRaw;

          return {
            id: d.id,
            productId: typeof data?.productId === "string" ? data.productId : "",
            rating,
            score,
            text: typeof data?.text === "string" ? data.text : null,
            helpfulCount,
            createdAtMs,
            moderationStatus: typeof data?.moderationStatus === "string" ? data.moderationStatus : "active",
            useCases: Array.isArray(data?.useCases) ? data.useCases.filter((value: unknown): value is string => typeof value === "string") : null,
            painTags: Array.isArray(data?.painTags) ? data.painTags.filter((value: unknown): value is string => typeof value === "string") : null,
            onsetLabel: typeof data?.onsetLabel === "string" ? data.onsetLabel : null,
            durationLabel: typeof data?.durationLabel === "string" ? data.durationLabel : null,
            sleepy: toScore(data?.sleepy),
            calm: toScore(data?.calm),
            daytime: toScore(data?.daytime),
            clarity: toScore(data?.clarity),
            backPain: toScore(data?.backPain),
            jointPain: toScore(data?.jointPain),
            legPain: toScore(data?.legPain),
            headacheRelief: toScore(data?.headacheRelief),
            racingThoughts: toScore(data?.racingThoughts),
            uplifting: toScore(data?.uplifting),
            painRelief: toScore(data?.painRelief),
            focusAdhd: toScore(data?.focusAdhd),
            anxiety: toScore(data?.anxiety),
            moodBalance: toScore(data?.moodBalance),
            appetite: toScore(data?.appetite),
            femaleHealth: toScore(data?.femaleHealth),
            muscleRelaxation: toScore(data?.muscleRelaxation),
            creativity: toScore(data?.creativity),
          };
        });

        const scoreBuckets: Record<
          string,
          {
            count: number;
            scores: number[];
            effectMeans: number[];
            latestReviewAtMs: number;
            helpfulTotal: number;
          }
        > = {};
        const effectBucketsByProductId: Record<string, EffectAggregate> = {};
        const reviewTextsByProductId: Record<string, string[]> = {};

        for (const r of rows) {
          if (!r.productId) continue;
          if (r.moderationStatus !== "active") continue;

          if (typeof r.text === "string") {
            const trimmed = r.text.trim();
            if (trimmed.length >= 8) {
              const bucket = reviewTextsByProductId[r.productId] ?? [];
              bucket.push(trimmed);
              if (r.useCases?.length) bucket.push(r.useCases.join(" "));
              if (r.painTags?.length) bucket.push(r.painTags.map((tag) => `${tag} pain relief`).join(" "));
              if (r.onsetLabel) bucket.push(`${r.onsetLabel} onset`);
              if (r.durationLabel) bucket.push(`${r.durationLabel} duration`);
              reviewTextsByProductId[r.productId] = bucket;
            }
          }

          const effectValues = getStructuredEffectValues(r);
          const effectMean = avgEffects(effectValues);
          const highEffectsCount = effectValues.filter(
            (v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5
          ).filter((v) => v >= 4.5).length;

          const reviewScore =
            typeof r.score === "number" && Number.isFinite(r.score)
              ? r.score
              : computeRobustReviewScore({
                  rating: r.rating,
                  effectsMean: effectMean,
                  highEffectsCount,
                });

          if (reviewScore < 1 || reviewScore > 5) continue;

          const prev = scoreBuckets[r.productId] ?? {
            count: 0,
            scores: [],
            effectMeans: [],
            latestReviewAtMs: 0,
            helpfulTotal: 0,
          };
          prev.count += 1;
          prev.scores.push(reviewScore);
          if (typeof effectMean === "number" && Number.isFinite(effectMean)) {
            prev.effectMeans.push(effectMean);
          }
          prev.latestReviewAtMs = Math.max(prev.latestReviewAtMs ?? 0, r.createdAtMs ?? 0);
          prev.helpfulTotal += typeof r.helpfulCount === "number" ? Math.max(0, r.helpfulCount) : 0;
          scoreBuckets[r.productId] = prev;

          const effectScores = deriveEffectScoresFromReview(r);
          const effectAgg = effectBucketsByProductId[r.productId] ?? makeEmptyEffectAggregate();
          EFFECT_KEYS.forEach((key) => {
            const effect = effectScores[key];
            if (typeof effect !== "number") return;
            effectAgg[key].count += 1;
            effectAgg[key].sum += effect;
            if (effect >= 5) effectAgg[key].perfect += 1;
          });
          effectBucketsByProductId[r.productId] = effectAgg;
        }

        const statsNext: Record<string, Stat> = {};
        const badgesNext: Record<string, EffectFilterKey[]> = {};
        const notesNext: Record<string, CommunityNotesSummary> = {};
        const globalMeanRating = 3.6;

        Object.keys(scoreBuckets).forEach((productId) => {
          const bucket = scoreBuckets[productId];
          const avg = bucket.count > 0 ? avgNumbers(bucket.scores) : 0;
          const effectAgg = effectBucketsByProductId[productId] ?? makeEmptyEffectAggregate();

          const qualifiedEffects: EffectFilterKey[] = [];

          EFFECT_KEYS.forEach((key) => {
            const e = effectAgg[key];
            if (e.count <= 0) return;
            const effectAvg = e.sum / e.count;
            if (
              e.count >= EFFECT_THRESHOLD_MIN_COUNT &&
              (e.perfect >= EFFECT_THRESHOLD_MIN_PERFECT || effectAvg >= EFFECT_THRESHOLD_MIN_AVG)
            ) {
              qualifiedEffects.push(key);
            }
          });

          const weightedScore = computeRobustProductScore({
            ratings: bucket.scores,
            effectsMeans: bucket.effectMeans,
            globalMeanRating,
          });

          statsNext[productId] = {
            count: bucket.count,
            avg,
            weightedScore,
            helpfulTotal: bucket.helpfulTotal,
            latestReviewAtMs: bucket.latestReviewAtMs,
          };
          badgesNext[productId] = qualifiedEffects;
        });

        Object.entries(reviewTextsByProductId).forEach(([productId, texts]) => {
          const summary = buildCommunityNotesSummary(texts);
          if (summary) notesNext[productId] = summary;
        });

        setStatsByProductId(statsNext);
        setEffectBadgesByProductId(badgesNext);
        setCommunityNotesByProductId(notesNext);
        setLoadingReviews(false);
      },
      (err) => {
        console.log("reviews snapshot error:", err);
        setEffectBadgesByProductId({});
        setCommunityNotesByProductId({});
        setLoadingReviews(false);
      }
    );

    return () => unsub();
  }, []);

  const catalogueItems = useMemo(() => items.filter(isFlowerProduct), [items]);

  const makers = useMemo(() => {
    const set = new Set<string>();
    for (const it of catalogueItems) {
      if (it.maker) set.add(it.maker);
    }
    return Array.from(set).sort((a, b) => (safeLower(a) < safeLower(b) ? -1 : 1));
  }, [catalogueItems]);

  const terpeneOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of catalogueItems) {
      const terps = parseTerpenes(it.terpenes);
      terps
        .filter((t) => t.strength === "major")
        .forEach((t) => set.add(t.name));
    }
    return Array.from(set).sort((a, b) => (safeLower(a) < safeLower(b) ? -1 : 1));
  }, [catalogueItems]);

  const filteredTerpeneOptions = useMemo(() => {
    const selectedFirst = draftTerpeneFilter
      .filter((name, index, arr) => arr.findIndex((entry) => safeLower(entry) === safeLower(name)) === index)
      .filter((name) => terpeneOptions.some((option) => safeLower(option) === safeLower(name)));

    const base = terpeneOptions.filter((option) => !selectedFirst.some((selected) => safeLower(selected) === safeLower(option)));

    return [...selectedFirst, ...base];
  }, [draftTerpeneFilter, terpeneOptions]);

  const filteredMakerOptions = useMemo(() => {
    const selectedFirst = draftMakerFilter && makers.some((maker) => safeLower(maker) === safeLower(draftMakerFilter))
      ? [draftMakerFilter, ...makers.filter((maker) => safeLower(maker) !== safeLower(draftMakerFilter))]
      : makers;

    return selectedFirst;
  }, [draftMakerFilter, makers]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (favoriteFilterAny) n += 1;
    if (favoriteFilterSlots.length > 0) n += 1;
    if (strainFilter) n += 1;
    if (makerFilter) n += 1;
    if (terpeneFilter.length > 0) n += 1;
    if (effectFilter.length > 0) n += 1;
    return n;
  }, [strainFilter, makerFilter, terpeneFilter, effectFilter, favoriteFilterAny, favoriteFilterSlots]);

  const activeFilterBadgeLabels = useMemo(() => {
    const labels: string[] = [];
    if (favoriteFilterAny) labels.push("Any favourite");
    favoriteFilterSlots.forEach((slot) => {
      const label = FAVORITE_SLOT_META.find((entry) => entry.key === slot)?.label;
      if (label) labels.push(label);
    });
    if (strainFilter) labels.push(STRAIN_META[strainFilter].label);
    if (effectFilter.length > 0) labels.push(...effectFilter.map((key) => EFFECT_META[key].short));
    if (terpeneFilter.length > 0) labels.push(...terpeneFilter.slice(0, 2));
    if (makerFilter) labels.push(makerFilter);
    return labels.slice(0, 6);
  }, [effectFilter, favoriteFilterAny, favoriteFilterSlots, makerFilter, strainFilter, terpeneFilter]);

  const draftActiveFilterCount = useMemo(() => {
    let n = 0;
    if (draftFavoriteFilterAny) n += 1;
    if (draftFavoriteFilterSlots.length > 0) n += 1;
    if (draftStrainFilter) n += 1;
    if (draftMakerFilter) n += 1;
    if (draftTerpeneFilter.length > 0) n += 1;
    if (draftEffectFilter.length > 0) n += 1;
    return n;
  }, [
    draftEffectFilter,
    draftFavoriteFilterAny,
    draftFavoriteFilterSlots,
    draftMakerFilter,
    draftStrainFilter,
    draftTerpeneFilter,
  ]);

  const draftFilterBadgeLabels = useMemo(() => {
    const labels: string[] = [];
    if (draftFavoriteFilterAny) labels.push("Any favourite");
    draftFavoriteFilterSlots.forEach((slot) => {
      const label = FAVORITE_SLOT_META.find((entry) => entry.key === slot)?.label;
      if (label) labels.push(label);
    });
    if (draftStrainFilter) labels.push(STRAIN_META[draftStrainFilter].label);
    if (draftEffectFilter.length > 0) labels.push(...draftEffectFilter.map((key) => EFFECT_META[key].short));
    if (draftTerpeneFilter.length > 0) labels.push(...draftTerpeneFilter.slice(0, 3));
    if (draftMakerFilter) labels.push(draftMakerFilter);
    return labels.slice(0, 8);
  }, [
    draftEffectFilter,
    draftFavoriteFilterAny,
    draftFavoriteFilterSlots,
    draftMakerFilter,
    draftStrainFilter,
    draftTerpeneFilter,
  ]);

  const displayItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const queryEffectIntent = inferEffectIntent(q);

    const filtered = catalogueItems.filter((it) => {
      const itemEffectBadges = effectBadgesByProductId[it.id] ?? [];
      const notesSummary = communityNotesByProductId[it.id];

      if (q) {
        const hay = `${it.name} ${it.variant ?? ""} ${it.maker} ${notesSummary?.searchText ?? ""}`.toLowerCase();
        const matchesText = hay.includes(q);
        const matchesEffectIntent =
          queryEffectIntent.length > 0 && queryEffectIntent.every((intent) => itemEffectBadges.includes(intent));
        if (!matchesText && !matchesEffectIntent) return false;
      }

      const slots = getSlotsForProduct(it.id);
      if (favoriteFilterAny && !hasAnyFavoriteSlot(slots)) {
        return false;
      }

      if (favoriteFilterSlots.length > 0) {
        const matchesSlot = favoriteFilterSlots.some((slot) => !!slots[slot]);
        if (!matchesSlot) return false;
      }

      if (strainFilter) {
        const s = it.strainType ? String(it.strainType).toLowerCase() : "";

        if (strainFilter === "hybrid") {
          if (!(s.includes("hybrid") || s.includes("hyb"))) return false;
        }

        if (strainFilter === "indica") {
          if (!(s.includes("indica") || s.startsWith("ind"))) return false;
        }

        if (strainFilter === "sativa") {
          if (!(s.includes("sativa") || s.startsWith("sat"))) return false;
        }
      }

      if (makerFilter) {
        if (safeLower(it.maker) !== safeLower(makerFilter)) return false;
      }

      if (terpeneFilter.length > 0) {
        const majors = parseTerpenes(it.terpenes)
          .filter((t) => t.strength === "major")
          .map((t) => safeLower(t.name));

        const hasAllSelected = terpeneFilter.every((sel) => majors.includes(safeLower(sel)));
        if (!hasAllSelected) return false;
      }

      if (effectFilter.length > 0) {
        const hasAllEffects = effectFilter.every((ef) => itemEffectBadges.includes(ef));
        if (!hasAllEffects) return false;
      }

      if (presetReviewedOnly && (statsByProductId[it.id]?.count ?? 0) <= 0) {
        return false;
      }

      return true;
    });

    const copy = [...filtered];

    copy.sort((a, b) => {
      const sa = statsByProductId[a.id];
      const sb = statsByProductId[b.id];

      const countA = sa?.count ?? 0;
      const countB = sb?.count ?? 0;
      const avgA = sa?.avg ?? 0;
      const avgB = sb?.avg ?? 0;
      const weightedA = sa?.weightedScore ?? avgA;
      const weightedB = sb?.weightedScore ?? avgB;

      if (sortKey === "mostReviewed") {
        if (countA !== countB) return countB - countA;
      } else if (sortKey === "recentReviews") {
        const ra = sa?.latestReviewAtMs ?? 0;
        const rb = sb?.latestReviewAtMs ?? 0;
        if (ra !== rb) return rb - ra;
      } else if (sortKey === "highestRated") {
        if (weightedA !== weightedB) return weightedB - weightedA;
        if (countA !== countB) return countB - countA;
      } else if (sortKey === "thcHighLow") {
        const ta = a.thcPct ?? -1;
        const tb = b.thcPct ?? -1;
        if (ta !== tb) return tb - ta;
      } else if (sortKey === "thcLowHigh") {
        const ta = a.thcPct ?? 9999;
        const tb = b.thcPct ?? 9999;
        if (ta !== tb) return ta - tb;
      } else if (sortKey === "maker") {
        const am = safeLower(a.maker);
        const bm = safeLower(b.maker);
        if (am !== bm) return am < bm ? -1 : 1;
      }

      const an = safeLower(a.name);
      const bn = safeLower(b.name);
      if (an !== bn) return an < bn ? -1 : 1;

      const av = safeLower(a.variant);
      const bv = safeLower(b.variant);
      if (av !== bv) return av < bv ? -1 : 1;

      return a.id < b.id ? -1 : 1;
    });

    return copy;
  }, [
    catalogueItems,
    statsByProductId,
    query,
    sortKey,
    strainFilter,
    makerFilter,
    terpeneFilter,
    effectFilter,
    favoriteFilterAny,
    favoriteFilterSlots,
    effectBadgesByProductId,
    communityNotesByProductId,
    getSlotsForProduct,
    presetReviewedOnly,
  ]);

  function scrollToTop(allowIndexJump = true) {
    const rawList = listRef.current as any;
    const scrollable = typeof rawList?.getNode === "function" ? rawList.getNode() : rawList;
    setShowTop(false);
    scrollable?.scrollToOffset?.({ offset: 0, animated: true });
    requestAnimationFrame(() => {
      scrollable?.scrollToOffset?.({ offset: 0, animated: true });
      if (allowIndexJump && displayItems.length > 0) {
        scrollable?.scrollToIndex?.({ index: 0, animated: true, viewPosition: 0 });
      }
    });
  }

  const onChangeSearch = useCallback((text: string) => {
    setQueryInput(text);
  }, []);

  const openFilters = () => {
    setDraftSortKey(sortKey);
    setDraftStrainFilter(strainFilter);
    setDraftMakerFilter(makerFilter);
    setDraftTerpeneFilter(terpeneFilter);
    setDraftEffectFilter(effectFilter);
    setDraftFavoriteFilterAny(favoriteFilterAny);
    setDraftFavoriteFilterSlots(favoriteFilterSlots);

    setSortMenuOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
    setMakerPanelQuery("");
    setTerpenePanelQuery("");
    setPanelOpen(true);
  };

  // Apply draft filter changes instantly while the filter sheet is open.
  useEffect(() => {
    if (!panelOpen) return;
    setSortKey(draftSortKey);
    setStrainFilter(draftStrainFilter);
    setMakerFilter(draftMakerFilter);
    setTerpeneFilter(draftTerpeneFilter);
    setEffectFilter(draftEffectFilter);
    setFavoriteFilterAny(draftFavoriteFilterAny);
    setFavoriteFilterSlots(draftFavoriteFilterSlots);
  }, [
    panelOpen,
    draftSortKey,
    draftStrainFilter,
    draftMakerFilter,
    draftTerpeneFilter,
    draftEffectFilter,
    draftFavoriteFilterAny,
    draftFavoriteFilterSlots,
  ]);

  const closeAndSaveFilters = () => {
    setSortMenuOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
    setMakerPanelQuery("");
    setTerpenePanelQuery("");
    setPanelOpen(false);
  };

  const resetDraft = () => {
    setDraftSortKey("recentReviews");
    setDraftStrainFilter(null);
    setDraftMakerFilter(null);
    setDraftTerpeneFilter([]);
    setDraftEffectFilter([]);
    setDraftFavoriteFilterAny(false);
    setDraftFavoriteFilterSlots([]);
    setPresetReviewedOnly(false);
    setSortMenuOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
    setMakerPanelQuery("");
    setTerpenePanelQuery("");
  };

  const windowH = Dimensions.get("window").height;
  const windowW = Dimensions.get("window").width;
  const compactHeader = windowW <= 390;
  const bgShift = Math.round(windowH * 0.18);
  const bgScale = 1.12;
  const toTopBottom = Math.max(insets.bottom + 18, 24);

  if (authResolved && !currentUid) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={flowersBg}
        resizeMode="cover"
        style={StyleSheet.absoluteFillObject}
        imageStyle={{ transform: [{ translateY: bgShift }, { scale: bgScale }] }}
      />
      <View pointerEvents="none" style={styles.bgWash} />

      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
        {loadingProducts ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
            <Text
              style={{
                marginTop: 12,
                color: theme.colors.textOnDarkSecondary,
                ...theme.typography.body,
              }}
            >
              Loading products...
            </Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.stateWrap}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                marginBottom: 8,
                color: theme.colors.textOnDark,
              }}
            >
              Could not load products
            </Text>
            <Text
              style={{
                marginBottom: 14,
                color: theme.colors.textOnDarkSecondary,
                ...theme.typography.body,
              }}
            >
              {errorMsg}
            </Text>
          </View>
        ) : (
          <>
            <Animated.FlatList
              ref={(r) => {
                listRef.current = r as any;
              }}
              onScroll={onListScroll}
              onScrollBeginDrag={() => {
                setSortMenuOpen(false);
                searchInputRef.current?.blur();
                Keyboard.dismiss();
              }}
              scrollEventThrottle={16}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              data={displayItems}
              keyExtractor={(item) => item.id}
              style={{ flex: 1, backgroundColor: "transparent" }}
              contentContainerStyle={{ paddingBottom: Math.max(theme.spacing.xl + insets.bottom + 104, insets.bottom + 118) }}
              ListHeaderComponent={<View style={{ height: Math.max(0, headerH + 14) }} />}
              ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              ListEmptyComponent={
                <View style={{ paddingTop: 26, paddingHorizontal: theme.spacing.xl }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.textOnDark }}>No matches</Text>
                  <Text
                    style={{
                      marginTop: 8,
                      color: theme.colors.textOnDarkSecondary,
                      ...theme.typography.body,
                    }}
                  >
                    Try clearing filters or changing your search.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const stat = statsByProductId[item.id];
                const hasRatings = !!stat && stat.count > 0;
                const weighted = hasRatings ? stat.weightedScore ?? stat.avg : 0;
                const effectBadges = effectBadgesByProductId[item.id] ?? [];
                const notesSummary = communityNotesByProductId[item.id];

                const maker = item.maker?.trim() ? item.maker.trim() : "Unknown maker";
                const strainLabel = formatStrainType(item.strainType);
                const parts = [maker, strainLabel, `THC ${formatPct(item.thcPct)}`, `CBD ${formatPct(item.cbdPct)}`].filter(Boolean);
                const metaLine = parts.join(" · ");
                const isDiscontinued = item.availabilityStatus === "discontinued";

                const favSlots = getSlotsForProduct(item.id);
                const activeFavSlots = FAVORITE_SLOT_META.filter((s) => !!favSlots[s.key]);

                return (
                  <CinematicCard
                    onPress={() => {
                      setSortMenuOpen(false);
                      searchInputRef.current?.blur();
                      Keyboard.dismiss();
                      router.push(`/(tabs)/reviews/${encodeURIComponent(item.id)}`);
                    }}
                    style={{ marginHorizontal: theme.spacing.xl, overflow: "hidden" }}
                  >
                    <View style={{ padding: 18 }}>
                      {activeFavSlots.length > 0 ? (
                        <View style={styles.favBadgeRow}>
                          {activeFavSlots.slice(0, 4).map((slot) => (
                            <View key={slot.key} style={[styles.favBadge, { backgroundColor: slot.color }]}>
                              <Feather name={slot.icon} size={12} color="rgba(255,255,255,0.98)" />
                            </View>
                          ))}
                        </View>
                      ) : null}

                      <Text
                        style={{
                          fontSize: 22,
                          fontWeight: "900",
                          color: theme.colors.textOnDark,
                          paddingRight: 34,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                        {item.variant ? ` (${item.variant})` : ""}
                      </Text>

                      <Text
                        style={{
                          marginTop: 6,
                          color: theme.colors.textOnDarkSecondary,
                          ...theme.typography.caption,
                          lineHeight: 18,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {metaLine}
                      </Text>

                      {isDiscontinued ? (
                        <View style={styles.discontinuedBadge}>
                          <Feather name="slash" size={12} color="rgba(255,214,214,0.96)" />
                          <Text style={styles.discontinuedBadgeText}>Discontinued</Text>
                        </View>
                      ) : null}

                      {effectBadges.length > 0 ? (
                        <View style={styles.effectBadgeRow}>
                          {effectBadges.slice(0, 3).map((key) => {
                            const meta = EFFECT_META[key];
                            return (
                              <View key={`${item.id}-${key}`} style={[styles.effectBadge, { borderColor: meta.color }]}>
                                <Text style={styles.effectBadgeIcon}>{meta.icon}</Text>
                                <Text style={[styles.effectBadgeText, { color: meta.color }]}>{meta.short}</Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      <View style={{ marginTop: 12 }}>
                        {hasRatings ? (
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <BudRating value={weighted} size={16} />
                            <Text style={{ fontWeight: "900", marginLeft: 10, color: theme.colors.textOnDark }}>
                              {round1(weighted).toFixed(1)} ({stat.count})
                            </Text>

                            {loadingReviews ? (
                              <Text
                                style={{
                                  marginLeft: 8,
                                  color: theme.colors.textOnDarkSecondary,
                                  ...theme.typography.caption,
                                }}
                              >
                                (loading...)
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <Text style={{ fontWeight: "800", color: theme.colors.textOnDarkSecondary }}>
                            No ratings yet{loadingReviews ? " (loading...)" : ""}
                          </Text>
                        )}

                        {notesSummary ? (
                          <Text style={styles.communityNotesLine} numberOfLines={2}>
                            {notesSummary.cardLine}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </CinematicCard>
                );
              }}
            />

            {showTop ? (
              <Pressable onPress={() => scrollToTop()} hitSlop={12} style={[styles.toTop, { bottom: toTopBottom }]}>
                <Text style={styles.toTopText}>Top</Text>
              </Pressable>
            ) : null}

            <LinearGradient
              pointerEvents="none"
              colors={["rgba(10,11,15,0.90)", "rgba(10,11,15,0.72)", "rgba(10,11,15,0.26)", "rgba(10,11,15,0.00)"]}
              locations={[0, 0.42, 0.8, 1]}
              style={styles.topUiMask}
            />

            {/* Overlay header */}
            <Animated.View
              onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                opacity: headerOpacity,
                zIndex: 50,
                elevation: 50,
              }}
            >
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <View style={{ flex: 1, backgroundColor: "rgba(10,11,15,0.00)" }} />
              </View>

              <View
                style={{
                  paddingHorizontal: theme.spacing.xl,
                  paddingTop: insets.top + 6,
                  paddingBottom: 8,
                  backgroundColor: "transparent",
                  borderBottomWidth: 0,
                  borderBottomColor: "rgba(255,255,255,0.10)",
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(8,10,14,0.99)", "rgba(8,10,14,0.96)", "rgba(8,10,14,0.84)", "rgba(8,10,14,0.32)", "rgba(8,10,14,0.00)"]}
                  locations={[0, 0.32, 0.58, 0.84, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                  <View style={styles.headerControlShell}>
                    <View style={styles.headerTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.headerTitle, compactHeader ? styles.headerTitleCompact : null]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.72}
                        >
                          Reviews
                        </Text>
                      </View>
                    </View>

                  <View style={styles.headerSearchShell}>
                    <Feather name="search" size={18} color="rgba(255,241,210,0.78)" />
                    <TextInput
                      ref={(r) => {
                        searchInputRef.current = r;
                      }}
                      value={queryInput}
                      onChangeText={onChangeSearch}
                      onSubmitEditing={() => {
                        searchInputRef.current?.blur();
                        Keyboard.dismiss();
                      }}
                      placeholder="Search by flower, maker, effect, terpene, or notes"
                      placeholderTextColor="rgba(255,255,255,0.54)"
                      style={styles.headerSearchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      blurOnSubmit
                    />

                    {queryInput.trim().length > 0 ? (
                      <Pressable
                        onPress={() => {
                          setQueryInput("");
                          setQuery("");
                        }}
                        style={({ pressed }) => [styles.headerSearchClear, pressed ? { opacity: 0.82 } : null]}
                      >
                        <Feather name="x" size={14} color="rgba(17,19,25,0.95)" />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.headerActionRow}>
                    <Pressable onPress={() => setSortMenuOpen((value) => !value)} style={styles.headerActionButton}>
                      {({ pressed }) => (
                        <View style={[styles.headerSortCard, pressed ? styles.cardPressed : null]}>
                          <LinearGradient
                            pointerEvents="none"
                            colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.00)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.headerButtonShine}
                          />
                          <Feather name={SORT_META[sortKey].icon} size={17} color={SORT_META[sortKey].color} />
                          <View style={styles.headerSortSummary}>
                            <Text style={styles.headerSortSummaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                              <Text style={styles.headerSortSummaryValue}>{sortButtonLabel(sortKey)}</Text>
                            </Text>
                          </View>
                          <Feather name={sortMenuOpen ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,255,255,0.64)" />
                        </View>
                      )}
                    </Pressable>

                    <Pressable onPress={openFilters} style={styles.headerActionButton}>
                      {({ pressed }) => (
                        <LinearGradient
                          colors={["rgba(255,234,185,0.98)", "rgba(231,194,97,0.98)", "rgba(197,147,48,0.98)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.headerFilterButton, styles.headerFilterButtonFill, pressed ? styles.cardPressed : null]}
                        >
                          <LinearGradient
                            pointerEvents="none"
                            colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0.00)", "rgba(255,255,255,0.12)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.headerButtonShine}
                          />
                          <View style={styles.headerFilterButtonContent}>
                            <Feather name="sliders" size={17} color="rgba(17,19,25,0.96)" />
                            <Text style={styles.headerFilterButtonTitle}>Filters</Text>
                          </View>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </View>

                  {sortMenuOpen ? (
                    <View style={styles.sortMenu}>
                      <View style={styles.sortMenuList}>
                        {SORT_MENU_KEYS.map((k) => {
                          const meta = SORT_META[k];
                          const selected = sortKey === k;
                          return (
                            <Pressable
                              key={k}
                              style={styles.sortMenuOptionPressable}
                              onPress={() => {
                                setSortKey(k);
                                setDraftSortKey(k);
                                setSortMenuOpen(false);
                              }}
                            >
                              {({ pressed }) => (
                                <View
                                  style={[
                                    styles.sortMenuTile,
                                    selected
                                      ? {
                                          backgroundColor: rgbaWithAlpha(meta.color, 0.16),
                                          borderColor: rgbaWithAlpha(meta.color, 0.46),
                                          shadowColor: meta.color,
                                          shadowOpacity: 0.16,
                                          shadowRadius: 10,
                                          shadowOffset: { width: 0, height: 6 },
                                          elevation: 4,
                                        }
                                      : null,
                                    pressed ? styles.cardPressed : null,
                                  ]}
                                >
                                  <LinearGradient
                                    pointerEvents="none"
                                    colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0.00)"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.headerButtonShine}
                                  />
                                  <Feather name={meta.icon} size={15} color={selected ? meta.color : "rgba(255,255,255,0.70)"} />
                                  <Text style={styles.sortMenuTileText}>{sortLabel(k)}</Text>
                                  {selected ? <Feather name="check" size={15} color={meta.color} /> : null}
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {activeFilterBadgeLabels.length > 0 ? (
                    <View style={styles.headerActiveFilterRow}>
                      {activeFilterBadgeLabels.map((label) => (
                        <View key={label} style={styles.headerActiveFilterChip}>
                          <Text style={styles.headerActiveFilterChipText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>

            {/* Filters modal */}
            <Modal visible={panelOpen} transparent animationType="fade" onRequestClose={closeAndSaveFilters}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Pressable
                  onPress={closeAndSaveFilters}
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.40)" }]}
                />

                <LinearGradient
                  colors={["rgba(20,22,30,0.98)", "rgba(29,20,33,0.98)", "rgba(12,15,22,0.99)"]}
                  start={{ x: 0.05, y: 0 }}
                  end={{ x: 0.95, y: 1 }}
                  style={styles.filterSheet}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(255,219,136,0.18)", "rgba(235,111,170,0.12)", "rgba(0,0,0,0.00)"]}
                    locations={[0, 0.38, 1]}
                    style={styles.filterSheetGlow}
                  />

                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={24}
                  >
                    <ScrollView
                      style={{ maxHeight: Dimensions.get("window").height * 0.84 }}
                      contentContainerStyle={[styles.filterScrollContent, { paddingBottom: Math.max(insets.bottom, 18) + 18 }]}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      stickyHeaderIndices={[0]}
                    >
                      <View style={styles.filterStickyHeader}>
                        <Text style={styles.filterTitle}>Filters</Text>

                        <Pressable onPress={closeAndSaveFilters} style={({ pressed }) => [styles.filterCloseButton, pressed ? styles.cardPressed : null]}>
                          <Feather name="x" size={20} color={theme.colors.textOnDark} />
                        </Pressable>
                      </View>

                      {draftFilterBadgeLabels.length > 0 ? (
                        <View style={styles.filterActiveRow}>
                          {draftFilterBadgeLabels.map((label, index) => (
                            <View key={`${label}-${index}`} style={styles.filterActiveChip}>
                              <Text style={styles.filterActiveChipText}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      <View style={styles.filterSectionCard}>
                        <Text style={styles.filterSectionEyebrow}>Quick picks</Text>
                        <Text style={styles.filterSectionTitle}>Favourites</Text>

                        <View style={styles.filterChipWrap}>
                          <Pressable
                            onPress={() => setDraftFavoriteFilterAny((v) => !v)}
                            style={({ pressed }) => [
                              styles.filterPill,
                              chipOnDark(draftFavoriteFilterAny, "rgba(201,88,108,0.98)"),
                              pressed ? styles.cardPressed : null,
                            ]}
                          >
                            <Feather
                              name="star"
                              size={14}
                              color={draftFavoriteFilterAny ? "rgba(201,88,108,0.98)" : "rgba(255,255,255,0.62)"}
                              style={styles.filterPillIcon}
                            />
                            <Text style={styles.filterPillText}>Any favourite</Text>
                          </Pressable>

                          {FAVORITE_SLOT_META.map((slot) => {
                            const selected = draftFavoriteFilterSlots.includes(slot.key);
                            return (
                              <Pressable
                                key={slot.key}
                                onPress={() => {
                                  setDraftFavoriteFilterSlots((prev) => {
                                    if (prev.includes(slot.key)) return prev.filter((x) => x !== slot.key);
                                    return [...prev, slot.key];
                                  });
                                }}
                                style={({ pressed }) => [
                                  styles.filterPill,
                                  chipOnDark(selected, slot.color),
                                  pressed ? styles.cardPressed : null,
                                ]}
                              >
                                <Feather name={slot.icon} size={13} color={selected ? slot.color : "rgba(255,255,255,0.62)"} style={styles.filterPillIcon} />
                                <Text style={styles.filterPillText}>{slot.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {!currentUid ? <Text style={styles.filterFootnote}>Sign in to use favourite tags.</Text> : null}
                      </View>

                      <View style={styles.filterSectionCard}>
                        <Text style={styles.filterSectionEyebrow}>Smart badges</Text>
                        <Text style={styles.filterSectionTitle}>Strain and effects</Text>

                        <Text style={styles.filterGroupLabel}>Strain type</Text>
                        <View style={styles.filterChipWrap}>
                          {(["sativa", "indica", "hybrid"] as const).map((v) => {
                            const meta = STRAIN_META[v];
                            const selected = draftStrainFilter === v;
                            return (
                              <Pressable
                                key={v}
                                onPress={() => setDraftStrainFilter(selected ? null : v)}
                                style={({ pressed }) => [
                                  styles.filterPill,
                                  chipOnDark(selected, meta.color),
                                  pressed ? styles.cardPressed : null,
                                ]}
                              >
                                <Feather name={meta.icon} size={14} color={selected ? meta.color : "rgba(255,255,255,0.62)"} style={styles.filterPillIcon} />
                                <Text style={styles.filterPillText}>{meta.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <Text style={[styles.filterGroupLabel, { marginTop: 16 }]}>Effects</Text>
                        <View style={styles.filterChipWrap}>
                          {EFFECT_KEYS.map((key) => {
                            const meta = EFFECT_META[key];
                            const selected = draftEffectFilter.includes(key);
                            return (
                              <Pressable
                                key={key}
                                onPress={() =>
                                  setDraftEffectFilter((prev) => {
                                    if (prev.includes(key)) return prev.filter((x) => x !== key);
                                    if (prev.length >= 4) return prev;
                                    return [...prev, key];
                                  })
                                }
                                style={({ pressed }) => [
                                  styles.filterPill,
                                  chipOnDark(selected, meta.color),
                                  pressed ? styles.cardPressed : null,
                                ]}
                              >
                                <Text style={styles.filterPillEmoji}>{meta.icon}</Text>
                                <Text style={styles.filterPillText}>{meta.short}</Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {draftEffectFilter.length >= 4 ? <Text style={styles.filterFootnote}>Max 4 effects selected.</Text> : null}
                      </View>

                      <View style={styles.filterSectionCard}>
                        <View style={styles.filterChooserHeader}>
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={styles.filterSectionEyebrow}>Aroma profile</Text>
                            <Text style={styles.filterSectionTitle}>Terpenes</Text>
                          </View>

                          <Pressable
                            onPress={() => setTerpeneOpen((v) => !v)}
                            style={({ pressed }) => [styles.filterChooserToggle, pressed ? styles.cardPressed : null]}
                          >
                            <Feather name={terpeneOpen ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,232,192,0.92)" />
                          </Pressable>
                        </View>

                        <Pressable
                          onPress={() => setTerpeneOpen((v) => !v)}
                          style={({ pressed }) => [styles.filterChooserCard, pressed ? styles.cardPressed : null]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.filterChooserTitle}>
                              {draftTerpeneFilter.length > 0 ? `${draftTerpeneFilter.length} terpene${draftTerpeneFilter.length === 1 ? "" : "s"} selected` : "Choose terpenes"}
                            </Text>
                            <Text style={styles.filterChooserText}>
                              {draftTerpeneFilter.length > 0 ? draftTerpeneFilter.join(" • ") : "Major aroma notes"}
                            </Text>
                          </View>
                          <Feather name={terpeneOpen ? "minus" : "plus"} size={16} color="rgba(255,255,255,0.76)" />
                        </Pressable>

                        {terpeneOpen ? (
                          <View style={styles.filterPickerPanel}>
                            <View style={styles.filterChipWrap}>
                              {filteredTerpeneOptions.length === 0 ? (
                                <Text style={styles.filterEmptyText}>No terpene data found yet.</Text>
                              ) : (
                                filteredTerpeneOptions.map((t) => {
                                  const selected = draftTerpeneFilter.some((x) => safeLower(x) === safeLower(t));
                                  return (
                                    <Pressable
                                      key={t}
                                      onPress={() => {
                                        setDraftTerpeneFilter((prev) => {
                                          const exists = prev.some((x) => safeLower(x) === safeLower(t));
                                          if (exists) return prev.filter((x) => safeLower(x) !== safeLower(t));
                                          if (prev.length >= 3) return prev;
                                          return [...prev, t];
                                        });
                                      }}
                                      style={({ pressed }) => [
                                        styles.filterPill,
                                        chipOnDark(selected, "rgba(167,231,193,0.98)"),
                                        pressed ? styles.cardPressed : null,
                                      ]}
                                    >
                                      <Text style={styles.filterPillText}>{t}</Text>
                                    </Pressable>
                                  );
                                })
                              )}
                            </View>
                          </View>
                        ) : null}

                        {draftTerpeneFilter.length >= 3 ? <Text style={styles.filterFootnote}>Max 3 terpenes selected.</Text> : null}
                      </View>

                      <View style={styles.filterSectionCard}>
                        <View style={styles.filterChooserHeader}>
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={styles.filterSectionEyebrow}>Brand browse</Text>
                            <Text style={styles.filterSectionTitle}>Makers</Text>
                          </View>

                          <Pressable
                            onPress={() => setMakerOpen((v) => !v)}
                            style={({ pressed }) => [styles.filterChooserToggle, pressed ? styles.cardPressed : null]}
                          >
                            <Feather name={makerOpen ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,232,192,0.92)" />
                          </Pressable>
                        </View>

                        <Pressable
                          onPress={() => setMakerOpen((v) => !v)}
                          style={({ pressed }) => [styles.filterChooserCard, pressed ? styles.cardPressed : null]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.filterChooserTitle} numberOfLines={1}>
                              {draftMakerFilter ? draftMakerFilter : "All makers"}
                            </Text>
                            <Text style={styles.filterChooserText}>
                              {draftMakerFilter ? "Maker filter active" : "Browse by brand"}
                            </Text>
                          </View>
                          <Feather name={makerOpen ? "minus" : "plus"} size={16} color="rgba(255,255,255,0.76)" />
                        </Pressable>

                        {makerOpen ? (
                          <View style={styles.filterPickerPanel}>
                            <View style={styles.filterChipWrap}>
                              <Pressable
                                onPress={() => setDraftMakerFilter(null)}
                                style={({ pressed }) => [
                                  styles.filterPill,
                                  chipOnDark(!draftMakerFilter, "rgba(214,195,255,0.98)"),
                                  pressed ? styles.cardPressed : null,
                                ]}
                              >
                                <Text style={styles.filterPillText}>All makers</Text>
                              </Pressable>

                              {filteredMakerOptions.length === 0 ? (
                                <Text style={styles.filterEmptyText}>No makers match that search yet.</Text>
                              ) : (
                                filteredMakerOptions.map((m) => {
                                  const selected = !!draftMakerFilter && safeLower(draftMakerFilter) === safeLower(m);
                                  return (
                                    <Pressable
                                      key={m}
                                      onPress={() => setDraftMakerFilter(selected ? null : m)}
                                      style={({ pressed }) => [
                                        styles.filterPill,
                                        chipOnDark(selected, "rgba(214,195,255,0.98)"),
                                        pressed ? styles.cardPressed : null,
                                      ]}
                                    >
                                      <Text style={styles.filterPillText}>{m}</Text>
                                    </Pressable>
                                  );
                                })
                              )}
                            </View>
                          </View>
                        ) : null}
                      </View>

                      <Pressable onPress={resetDraft} style={({ pressed }) => [styles.filterResetButton, pressed ? styles.cardPressed : null]}>
                        <LinearGradient
                          colors={["rgba(126,42,70,0.96)", "rgba(179,73,112,0.96)", "rgba(221,129,111,0.96)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.filterResetFill}
                        >
                          <Feather name="rotate-ccw" size={16} color="rgba(255,243,246,0.94)" />
                          <Text style={styles.filterResetText}>Reset filters</Text>
                        </LinearGradient>
                      </Pressable>
                    </ScrollView>
                  </KeyboardAvoidingView>
                </LinearGradient>
              </View>
            </Modal>
          </>
        )}

        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(10,11,15,0.00)",
            "rgba(10,11,15,0.06)",
            "rgba(10,11,15,0.14)",
            "rgba(10,11,15,0.30)",
            "rgba(10,11,15,0.52)",
            "rgba(10,11,15,0.82)",
            "rgba(10,11,15,0.98)",
          ]}
          locations={[0, 0.12, 0.26, 0.44, 0.66, 0.84, 1]}
          style={styles.bottomUiMask}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomUiMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 250,
  },

  topUiMask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 248,
  },

  bgWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },

  stateWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  favBadgeRow: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 6,
  },

  favBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  effectBadgeRow: {
    marginTop: 9,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  effectBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  effectBadgeIcon: {
    fontSize: 12,
    marginRight: 6,
  },

  effectBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    includeFontPadding: false,
  },

  discontinuedBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,128,128,0.30)",
    backgroundColor: "rgba(94,24,24,0.42)",
  },

  discontinuedBadgeText: {
    color: "rgba(255,232,232,0.96)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  communityNotesLine: {
    marginTop: 9,
    color: "rgba(225,236,255,0.82)",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
    minHeight: 36,
  },

  toTop: {
    position: "absolute",
    right: 16,
    zIndex: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  toTopText: {
    color: "white",
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  headerControlShell: {
    marginTop: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(10,12,17,0.78)",
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 6,
  },

  headerSearchShell: {
    marginTop: 6,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "rgba(15,18,24,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },

  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerTitle: {
    color: "rgba(252,243,222,0.98)",
    fontSize: 31,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  headerTitleCompact: {
    fontSize: 29,
    lineHeight: 31,
    letterSpacing: -0.7,
  },

  headerTitleCaption: {
    marginTop: 6,
    color: "rgba(232,236,244,0.70)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  headerCountBadge: {
    minWidth: 146,
    maxWidth: 154,
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginTop: -4,
  },
  headerCountBadgeCompact: {
    minWidth: 136,
    maxWidth: 142,
    minHeight: 56,
    paddingHorizontal: 10,
  },

  headerCountBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
  },

  headerCountBadgeValueInline: {
    color: "rgba(255,247,232,0.98)",
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "900",
  },
  headerCountBadgeValueCompact: {
    fontSize: 16,
    lineHeight: 18,
  },

  headerCountBadgeLabel: {
    marginTop: 2,
    color: "rgba(255,247,232,0.76)",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  headerSearchInput: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 0,
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    fontWeight: "700",
  },

  headerSearchClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,236,196,0.96)",
    marginLeft: 10,
  },

  headerSearchMeta: {
    flexDirection: "row",
    marginTop: 10,
    color: "rgba(223,228,237,0.68)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },

  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },

  headerActionRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },

  headerActionButton: {
    flex: 1,
  },

  headerSortCard: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(11,14,20,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },

  headerSortSummary: {
    flex: 1,
  },

  headerSortSummaryText: {
    color: "rgba(250,246,238,0.98)",
    fontSize: 12.25,
    lineHeight: 15,
    fontWeight: "800",
  },

  headerSortSummaryValue: {
    color: "rgba(250,246,238,0.98)",
    fontWeight: "900",
  },

  headerActionEyebrow: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  headerActionValue: {
    marginTop: 3,
    color: "rgba(250,246,238,0.98)",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
  },

  headerActionValueSingle: {
    flex: 1,
    color: "rgba(250,246,238,0.98)",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
  },

  headerFilterButton: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "rgba(236,189,92,0.72)",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  headerFilterButtonFill: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    overflow: "hidden",
  },

  headerFilterButtonContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  headerFilterButtonTitle: {
    color: "rgba(17,19,25,0.96)",
    fontSize: 14.5,
    fontWeight: "900",
  },

  headerButtonShine: {
    ...StyleSheet.absoluteFillObject,
  },

  headerActiveFilterRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  headerActiveFilterChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  headerActiveFilterChipText: {
    color: "rgba(255,241,210,0.90)",
    fontSize: 11,
    fontWeight: "800",
  },

  sortMenu: {
    marginTop: 8,
    borderRadius: 18,
    padding: 8,
    backgroundColor: "rgba(9,12,18,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },

  sortMenuList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-start",
  },
  sortMenuOptionPressable: {
    alignSelf: "flex-start",
  },

  sortMenuTile: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    alignSelf: "flex-start",
  },

  sortMenuTileText: {
    color: theme.colors.textOnDark,
    fontSize: 13,
    fontWeight: "900",
  },

  filterSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.46)",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },

  filterSheetGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 180,
  },

  filterScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 0,
  },

  filterStickyHeader: {
    marginHorizontal: -18,
    marginBottom: 10,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "rgba(22,22,29,0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    overflow: "visible",
    zIndex: 4,
  },

  filterTitle: {
    color: theme.colors.textOnDark,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 82,
  },

  filterSubtitle: {
    marginTop: 6,
    color: "rgba(220,224,233,0.72)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  filterCloseButton: {
    position: "absolute",
    right: 12,
    top: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  filterHeroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  filterHeroEyebrow: {
    color: "rgba(255,241,210,0.82)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  filterHeroTitle: {
    marginTop: 8,
    color: theme.colors.textOnDark,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },

  filterHeroText: {
    marginTop: 8,
    color: "rgba(233,236,242,0.74)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  filterHeroStat: {
    minWidth: 88,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(10,12,17,0.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  filterHeroStatValue: {
    color: "rgba(255,247,232,0.98)",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
  },

  filterHeroStatLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.56)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  filterActiveRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  filterActiveChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  filterActiveChipText: {
    color: "rgba(255,234,203,0.92)",
    fontSize: 12,
    fontWeight: "800",
  },

  filterSectionCard: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(9,11,16,0.46)",
    padding: 14,
  },

  filterSectionEyebrow: {
    color: "rgba(255,241,210,0.70)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },

  filterSectionTitle: {
    marginTop: 4,
    color: theme.colors.textOnDark,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
  },

  filterSectionText: {
    marginTop: 6,
    color: "rgba(220,224,233,0.72)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  filterChipWrap: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },

  filterPillIcon: {
    marginRight: 8,
  },

  filterPillEmoji: {
    marginRight: 8,
    fontSize: 15,
  },

  filterPillText: {
    color: theme.colors.textOnDark,
    fontSize: 13,
    fontWeight: "900",
  },

  filterFootnote: {
    marginTop: 10,
    color: "rgba(255,233,214,0.66)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  filterSortGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  filterSortTile: {
    width: "48%",
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  filterSortTileText: {
    flex: 1,
    color: theme.colors.textOnDark,
    fontSize: 14,
    fontWeight: "900",
  },

  filterGroupLabel: {
    marginTop: 12,
    color: "rgba(255,255,255,0.60)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  filterChooserHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  filterChooserToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  filterChooserCard: {
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  filterChooserTitle: {
    color: theme.colors.textOnDark,
    fontSize: 15,
    fontWeight: "900",
  },

  filterChooserText: {
    marginTop: 4,
    color: "rgba(220,224,233,0.66)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },

  filterPickerPanel: {
    marginTop: 10,
    borderRadius: 18,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  filterInlineSearch: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "rgba(12,14,19,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  filterInlineSearchInput: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 0,
    color: theme.colors.textOnDark,
    fontSize: 14,
    fontWeight: "700",
  },

  filterInlineClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,236,196,0.96)",
  },

  filterPanelHint: {
    marginTop: 10,
    color: "rgba(220,224,233,0.66)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  filterEmptyText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  filterResetButton: {
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 4,
  },

  filterResetFill: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  filterResetText: {
    color: "rgba(255,243,246,0.96)",
    fontSize: 16,
    fontWeight: "900",
  },
});
