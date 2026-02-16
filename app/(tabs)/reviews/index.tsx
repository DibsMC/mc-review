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
import { useRouter } from "expo-router";
import { theme } from "../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

const budImg = require("../../../assets/icons/bud.png");
const flowersBg = require("../../../assets/images/flowers-bg.png");

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
};

type Review = {
  id: string;
  productId: string;
  rating: number;
  score?: number | null;
  createdAtMs?: number | null;
};

type Stat = { count: number; avg: number; latestReviewAtMs?: number };

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

function round1(n: number) {
  return Math.round(n * 10) / 10;
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

function sortLabel(k: SortKey) {
  switch (k) {
    case "mostReviewed":
      return "Most reviewed";
    case "recentReviews":
      return "Recent reviews";
    case "highestRated":
      return "Highest rated";
    case "thcHighLow":
      return "THC high to low";
    case "thcLowHigh":
      return "THC low to high";
    case "maker":
      return "Maker";
    case "atoz":
    default:
      return "A to Z";
  }
}

function chipOnDark(selected: boolean) {
  return {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: selected ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)",
    backgroundColor: selected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
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
  const SCALE = 1.1;

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
              style={{ width: size, height: size, opacity: 0.22 }}
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
                    opacity: 0.9,
                  }}
                />
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
  const router = useRouter();
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

  // Auth + favourites
  const [currentUid, setCurrentUid] = useState<string>(() => {
    try {
      return auth().currentUser?.uid ?? "";
    } catch {
      return "";
    }
  });
  const [legacyFavoriteProductIds, setLegacyFavoriteProductIds] = useState<string[]>([]);
  const [favoriteSlotsByProductId, setFavoriteSlotsByProductId] = useState<Record<string, FavoriteSlots>>({});

  const searchInputRef = useRef<TextInput | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("atoz");

  const [strainFilter, setStrainFilter] = useState<"sativa" | "indica" | "hybrid" | null>(null);
  const [makerFilter, setMakerFilter] = useState<string | null>(null);
  const [terpeneFilter, setTerpeneFilter] = useState<string[]>([]);

  // Saved favourites filters (applied)
  const [favoriteFilterAny, setFavoriteFilterAny] = useState(false);
  const [favoriteFilterSlots, setFavoriteFilterSlots] = useState<FavoriteSlot[]>([]);

  // Modal open
  const [panelOpen, setPanelOpen] = useState(false);

  // Draft values inside modal
  const [draftSortKey, setDraftSortKey] = useState<SortKey>("atoz");
  const [draftStrainFilter, setDraftStrainFilter] = useState<"sativa" | "indica" | "hybrid" | null>(null);
  const [draftMakerFilter, setDraftMakerFilter] = useState<string | null>(null);
  const [draftTerpeneFilter, setDraftTerpeneFilter] = useState<string[]>([]);
  const [draftFavoriteFilterAny, setDraftFavoriteFilterAny] = useState(false);
  const [draftFavoriteFilterSlots, setDraftFavoriteFilterSlots] = useState<FavoriteSlot[]>([]);

  const [sortOpen, setSortOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const [terpeneOpen, setTerpeneOpen] = useState(false);

  const headerOpacity = useRef(new Animated.Value(1)).current;
  const [headerH, setHeaderH] = useState(170);

  // Back-to-top button state
  const [showTop, setShowTop] = useState(false);

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

  const scrollToTop = useCallback(() => {
    (listRef.current as any)?.scrollToOffset?.({ offset: 0, animated: true });
  }, []);

  useEffect(() => {
    try {
      setCurrentUid(auth().currentUser?.uid ?? "");
    } catch {
      setCurrentUid("");
    }
  }, [auth]);

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
            null;

          const norm = normalizeStrainType(rawStrain);
          const strainType = norm === "unknown" ? null : norm;

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
          };
        });

        setItems(list);
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
          const createdAtRaw = data?.createdAt ?? null;
          let createdAtMs: number | null = null;
          if (createdAtRaw?.toDate) createdAtMs = createdAtRaw.toDate().getTime();
          else if (typeof createdAtRaw === "number") createdAtMs = createdAtRaw;

          return {
            id: d.id,
            productId: typeof data?.productId === "string" ? data.productId : "",
            rating,
            score,
            createdAtMs,
          };
        });

        const map: Record<string, Stat> = {};

        for (const r of rows) {
          if (!r.productId) continue;

          const val = typeof r.score === "number" && Number.isFinite(r.score) ? r.score : r.rating;
          if (val < 1 || val > 5) continue;

          const existing = map[r.productId];
          if (!existing) {
            map[r.productId] = { count: 1, avg: val, latestReviewAtMs: r.createdAtMs ?? 0 };
          } else {
            const newCount = existing.count + 1;
            const newAvg = (existing.avg * existing.count + val) / newCount;
            map[r.productId] = {
              count: newCount,
              avg: newAvg,
              latestReviewAtMs: Math.max(existing.latestReviewAtMs ?? 0, r.createdAtMs ?? 0),
            };
          }
        }

        setStatsByProductId(map);
        setLoadingReviews(false);
      },
      (err) => {
        console.log("reviews snapshot error:", err);
        setLoadingReviews(false);
      }
    );

    return () => unsub();
  }, []);

  const makers = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.maker) set.add(it.maker);
    }
    return Array.from(set).sort((a, b) => (safeLower(a) < safeLower(b) ? -1 : 1));
  }, [items]);

  const terpeneOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const terps = parseTerpenes(it.terpenes);
      terps
        .filter((t) => t.strength === "major")
        .forEach((t) => set.add(t.name));
    }
    return Array.from(set).sort((a, b) => (safeLower(a) < safeLower(b) ? -1 : 1));
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (favoriteFilterAny) n += 1;
    if (favoriteFilterSlots.length > 0) n += 1;
    if (strainFilter) n += 1;
    if (makerFilter) n += 1;
    if (terpeneFilter.length > 0) n += 1;
    return n;
  }, [strainFilter, makerFilter, terpeneFilter, favoriteFilterAny, favoriteFilterSlots]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (favoriteFilterAny) labels.push("Any favourite");
    if (favoriteFilterSlots.length > 0) labels.push(`Favourite tags: ${favoriteFilterSlots.join(", ")}`);
    if (strainFilter) labels.push(`Strain: ${strainFilter}`);
    if (makerFilter) labels.push(`Maker: ${makerFilter}`);
    if (terpeneFilter.length > 0) labels.push(`Terpenes: ${terpeneFilter.join(", ")}`);
    return labels;
  }, [strainFilter, makerFilter, terpeneFilter, favoriteFilterAny, favoriteFilterSlots]);

  const displayItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = items.filter((it) => {
      if (q) {
        const hay = `${it.name} ${it.variant ?? ""} ${it.maker}`.toLowerCase();
        if (!hay.includes(q)) return false;
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

      if (sortKey === "mostReviewed") {
        if (countA !== countB) return countB - countA;
      } else if (sortKey === "recentReviews") {
        const ra = sa?.latestReviewAtMs ?? 0;
        const rb = sb?.latestReviewAtMs ?? 0;
        if (ra !== rb) return rb - ra;
      } else if (sortKey === "highestRated") {
        if (avgA !== avgB) return avgB - avgA;
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
    items,
    statsByProductId,
    query,
    sortKey,
    strainFilter,
    makerFilter,
    terpeneFilter,
    favoriteFilterAny,
    favoriteFilterSlots,
    getSlotsForProduct,
  ]);

  const onChangeSearch = useCallback((text: string) => {
    setQueryInput(text);
  }, []);

  const openFilters = () => {
    setDraftSortKey(sortKey);
    setDraftStrainFilter(strainFilter);
    setDraftMakerFilter(makerFilter);
    setDraftTerpeneFilter(terpeneFilter);
    setDraftFavoriteFilterAny(favoriteFilterAny);
    setDraftFavoriteFilterSlots(favoriteFilterSlots);

    setSortOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
    setPanelOpen(true);
  };

  const closeAndSaveFilters = () => {
    setSortKey(draftSortKey);
    setStrainFilter(draftStrainFilter);
    setMakerFilter(draftMakerFilter);
    setTerpeneFilter(draftTerpeneFilter);
    setFavoriteFilterAny(draftFavoriteFilterAny);
    setFavoriteFilterSlots(draftFavoriteFilterSlots);

    setSortOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
    setPanelOpen(false);
  };

  const resetDraft = () => {
    setDraftSortKey("atoz");
    setDraftStrainFilter(null);
    setDraftMakerFilter(null);
    setDraftTerpeneFilter([]);
    setDraftFavoriteFilterAny(false);
    setDraftFavoriteFilterSlots([]);
    setSortOpen(false);
    setMakerOpen(false);
    setTerpeneOpen(false);
  };

  const windowH = Dimensions.get("window").height;
  const bgShift = Math.round(windowH * 0.18);
  const bgScale = 1.12;
  const floatingSize = 46;
  const floatingTop = Math.max(insets.top + 68, Math.round(windowH * 0.2));
  const toTopBottom = Math.max(insets.bottom + 18, 24);

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
                searchInputRef.current?.blur();
                Keyboard.dismiss();
              }}
              scrollEventThrottle={16}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              data={displayItems}
              keyExtractor={(item) => item.id}
              style={{ flex: 1, backgroundColor: "transparent" }}
              contentContainerStyle={{ paddingBottom: theme.spacing.xxl + insets.bottom + 120 }}
              ListHeaderComponent={<View style={{ height: headerH + 14 }} />}
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
                const avg = hasRatings ? stat.avg : 0;

                const maker = item.maker?.trim() ? item.maker.trim() : "Unknown maker";
                const parts = [`${maker}`, `THC ${formatPct(item.thcPct)}`, `CBD ${formatPct(item.cbdPct)}`].filter(Boolean);
                const metaLine = parts.join(" · ");

                const favSlots = getSlotsForProduct(item.id);
                const activeFavSlots = FAVORITE_SLOT_META.filter((s) => !!favSlots[s.key]);

                return (
                  <CinematicCard
                    onPress={() => {
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

                      <View style={{ marginTop: 12 }}>
                        {hasRatings ? (
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <BudRating value={avg} size={16} />
                            <Text style={{ fontWeight: "900", marginLeft: 10, color: theme.colors.textOnDark }}>
                              {round1(avg).toFixed(1)} ({stat.count})
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
                      </View>
                    </View>
                  </CinematicCard>
                );
              }}
            />

            {showTop ? (
              <Pressable onPress={scrollToTop} hitSlop={12} style={[styles.toTop, { bottom: toTopBottom }]}>
                <Text style={styles.toTopText}>Top</Text>
              </Pressable>
            ) : null}

            <LinearGradient
              pointerEvents="none"
              colors={["rgba(10,11,15,0.92)", "rgba(10,11,15,0.72)", "rgba(10,11,15,0.00)"]}
              locations={[0, 0.55, 1]}
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
                  paddingTop: insets.top + theme.spacing.md,
                  paddingBottom: theme.spacing.lg,
                  backgroundColor: "rgba(10,11,15,0.82)",
                  borderBottomWidth: 0,
                  borderBottomColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Text style={{ ...theme.typography.title, color: theme.colors.accent, marginBottom: theme.spacing.xs }}>
                  Reviews
                </Text>

                <Text
                  style={{
                    ...theme.typography.caption,
                    color: theme.colors.textOnDarkSecondary,
                    marginBottom: theme.spacing.md,
                  }}
                >
                  Browse products and see community ratings.
                </Text>

                <View
                  style={{
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.14)",
                    paddingHorizontal: 14,
                    paddingVertical: Platform.OS === "ios" ? 12 : 8,
                  }}
                >
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
                    placeholder="Search by name or maker"
                    placeholderTextColor="rgba(255,255,255,0.40)"
                    style={{ color: theme.colors.textOnDark, fontSize: 15, fontWeight: "600" }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    blurOnSubmit
                  />
                </View>

                <View style={{ marginTop: theme.spacing.sm }}>
                  <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "700", fontSize: 12 }}>
                    Sorting by: {sortLabel(sortKey)}
                    {activeFilterCount > 0 ? ` | Filters: ${activeFilterCount}` : ""}
                  </Text>

                  {activeFilterCount > 0 ? (
                    <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 }}>
                      {activeFilterLabels.join(" | ")}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Animated.View>

            {/* Floating filters button */}
            <Animated.View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                right: theme.spacing.xl,
                top: floatingTop,
                opacity: headerOpacity,
                zIndex: 60,
                elevation: 60,
              }}
            >
              <Pressable
                onPress={openFilters}
                style={({ pressed }) => ({
                  width: floatingSize,
                  height: floatingSize,
                  borderRadius: floatingSize / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.88 : 1,
                  backgroundColor: "rgba(235,237,240,0.96)",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.08)",
                  shadowColor: "rgba(0,0,0,0.35)",
                  shadowOpacity: 0.45,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 12,
                })}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: floatingSize + 10,
                    height: floatingSize + 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.28)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: floatingSize - 6,
                    height: floatingSize - 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.10)",
                  }}
                />

                <Feather name="sliders" size={22} color="rgba(12,12,12,0.95)" />

                {activeFilterCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 6,
                      borderRadius: 999,
                      backgroundColor: "rgba(12,12,12,0.95)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.22)",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "rgba(0,0,0,0.35)",
                      shadowOpacity: 0.35,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "900", color: "rgba(235,237,240,0.98)" }}>
                      {activeFilterCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>

            {/* Filters modal */}
            <Modal visible={panelOpen} transparent animationType="fade" onRequestClose={closeAndSaveFilters}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Pressable
                  onPress={closeAndSaveFilters}
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.40)" }]}
                />

                <View
                  style={{
                    backgroundColor: "rgba(20,22,28,0.94)",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    overflow: "hidden",
                  }}
                >
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={24}
                  >
                    <ScrollView
                      style={{ maxHeight: Dimensions.get("window").height * 0.82 }}
                      contentContainerStyle={{ padding: 18, paddingBottom: Math.max(insets.bottom, 18) + 18 }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.textOnDark, flex: 1 }}>
                          Filters
                        </Text>

                        <Pressable
                          onPress={resetDraft}
                          style={({ pressed }) => ({
                            borderRadius: 999,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(190,72,96,0.24)",
                            borderWidth: 1,
                            borderColor: "rgba(255,150,170,0.44)",
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ color: "rgba(255,214,224,0.98)", fontWeight: "900", fontSize: 13 }}>Reset</Text>
                        </Pressable>
                      </View>

                      <Text
                        style={{
                          marginTop: 8,
                          color: theme.colors.textOnDarkSecondary,
                          ...theme.typography.caption,
                          lineHeight: 18,
                        }}
                      >
                        Pick what matters most and keep the list focused.
                      </Text>

                      {(draftFavoriteFilterAny ||
                        draftFavoriteFilterSlots.length > 0 ||
                        draftStrainFilter ||
                        !!draftMakerFilter ||
                        draftTerpeneFilter.length > 0) ? (
                        <View
                          style={{
                            marginTop: 12,
                            borderRadius: 16,
                            padding: 12,
                            backgroundColor: "rgba(255,255,255,0.09)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.16)",
                          }}
                        >
                          <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Active</Text>
                          <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                            {[
                              draftFavoriteFilterAny ? "Any favourite" : "",
                              draftFavoriteFilterSlots.length > 0 ? `Favourite tags: ${draftFavoriteFilterSlots.join(", ")}` : "",
                              draftStrainFilter ? `Strain: ${draftStrainFilter}` : "",
                              draftTerpeneFilter.length > 0 ? `Terpenes: ${draftTerpeneFilter.join(", ")}` : "",
                              draftMakerFilter ? `Maker: ${draftMakerFilter}` : "",
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </Text>
                        </View>
                      ) : null}

                      {/* Favourites quick filter */}
                      <Text style={{ marginTop: 18, fontSize: 13, letterSpacing: 0.8, fontWeight: "900", color: "rgba(255,255,255,0.68)", textTransform: "uppercase" }}>
                        Favourite filters
                      </Text>

                      <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        <Pressable
                          onPress={() => setDraftFavoriteFilterAny((v) => !v)}
                          style={({ pressed }) => ({
                            ...chipOnDark(draftFavoriteFilterAny),
                            opacity: pressed ? 0.85 : 1,
                            flexDirection: "row",
                            alignItems: "center",
                          })}
                        >
                          <Feather
                            name="star"
                            size={14}
                            color={draftFavoriteFilterAny ? "rgba(185,70,95,0.98)" : "rgba(255,255,255,0.55)"}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Any favourite</Text>
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
                              style={({ pressed }) => ({
                                ...chipOnDark(selected),
                                opacity: pressed ? 0.85 : 1,
                                flexDirection: "row",
                                alignItems: "center",
                              })}
                            >
                              <Feather name={slot.icon} size={13} color={selected ? slot.color : "rgba(255,255,255,0.55)"} style={{ marginRight: 8 }} />
                              <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>{slot.label}</Text>
                            </Pressable>
                          );
                        })}

                        {!currentUid ? (
                          <Text
                            style={{
                              color: "rgba(255,255,255,0.55)",
                              fontWeight: "700",
                              fontSize: 12,
                              alignSelf: "center",
                            }}
                          >
                            Sign in to use favourite tags.
                          </Text>
                        ) : null}
                      </View>

                      {/* Sort */}
                      <Text style={{ marginTop: 22, fontSize: 13, letterSpacing: 0.8, fontWeight: "900", color: "rgba(255,255,255,0.68)", textTransform: "uppercase" }}>
                        Sort
                      </Text>

                      <Pressable
                        onPress={() => setSortOpen((v) => !v)}
                        style={({ pressed }) => ({
                          marginTop: 10,
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          backgroundColor: "rgba(255,255,255,0.10)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                          {sortLabel(draftSortKey)}
                        </Text>
                        <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                          Tap to change
                        </Text>
                      </Pressable>

                      {sortOpen ? (
                        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                          {(["mostReviewed", "recentReviews", "highestRated", "thcHighLow", "thcLowHigh", "maker", "atoz"] as SortKey[]).map(
                            (k) => {
                              const selected = draftSortKey === k;
                              return (
                                <Pressable
                                  key={k}
                                  onPress={() => {
                                    setDraftSortKey(k);
                                    setSortOpen(false);
                                  }}
                                  style={({ pressed }) => ({
                                    alignSelf: "flex-start",
                                    borderRadius: 999,
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    backgroundColor: selected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                                    borderWidth: 1,
                                    borderColor: selected ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.12)",
                                    opacity: pressed ? 0.9 : 1,
                                  })}
                                >
                                  <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>{sortLabel(k)}</Text>
                                </Pressable>
                              );
                            }
                          )}
                        </View>
                      ) : null}

                      {/* Filters */}
                      <Text style={{ marginTop: 22, fontSize: 13, letterSpacing: 0.8, fontWeight: "900", color: "rgba(255,255,255,0.68)", textTransform: "uppercase" }}>
                        Filters
                      </Text>

                      {/* Strain */}
                      <Text
                        style={{
                          marginTop: 12,
                          color: theme.colors.textOnDarkSecondary,
                          ...theme.typography.caption,
                          fontWeight: "800",
                        }}
                      >
                        Strain type
                      </Text>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                        {(["sativa", "indica", "hybrid"] as const).map((v) => {
                          const selected = draftStrainFilter === v;
                          return (
                            <Pressable
                              key={v}
                              onPress={() => setDraftStrainFilter(selected ? null : v)}
                              style={({ pressed }) => ({ ...chipOnDark(selected), opacity: pressed ? 0.85 : 1 })}
                            >
                              <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>{v}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Terpenes */}
                      <Text
                        style={{
                          marginTop: 16,
                          color: theme.colors.textOnDarkSecondary,
                          ...theme.typography.caption,
                          fontWeight: "800",
                        }}
                      >
                        Terpenes (major)
                      </Text>

                      <Pressable
                        onPress={() => setTerpeneOpen((v) => !v)}
                        style={({ pressed }) => ({
                          marginTop: 10,
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          backgroundColor: "rgba(255,255,255,0.10)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                          {draftTerpeneFilter.length > 0 ? `${draftTerpeneFilter.length} selected` : "Choose terpenes"}
                        </Text>
                        <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                          {terpeneOpen ? "Tap to collapse" : "Tap to expand"}
                        </Text>
                      </Pressable>

                      {terpeneOpen ? (
                        <View
                          style={{
                            marginTop: 12,
                            maxHeight: 220,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.12)",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            padding: 10,
                          }}
                        >
                          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                              {terpeneOptions.length === 0 ? (
                                <Text style={{ color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                                  No terpene data found yet.
                                </Text>
                              ) : (
                                terpeneOptions.map((t) => {
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
                                      style={({ pressed }) => ({ ...chipOnDark(selected), opacity: pressed ? 0.85 : 1 })}
                                    >
                                      <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>{t}</Text>
                                    </Pressable>
                                  );
                                })
                              )}
                            </View>
                          </ScrollView>
                        </View>
                      ) : null}

                      {draftTerpeneFilter.length >= 3 ? (
                        <Text style={{ marginTop: 6, color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 }}>
                          Max 3 terpenes selected.
                        </Text>
                      ) : null}

                      {/* Maker */}
                      <Text
                        style={{
                          marginTop: 16,
                          color: theme.colors.textOnDarkSecondary,
                          ...theme.typography.caption,
                          fontWeight: "800",
                        }}
                      >
                        Maker
                      </Text>

                      <Pressable
                        onPress={() => setMakerOpen((v) => !v)}
                        style={({ pressed }) => ({
                          marginTop: 10,
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          backgroundColor: "rgba(255,255,255,0.10)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
                          {draftMakerFilter ? draftMakerFilter : "All makers"}
                        </Text>
                        <Text style={{ marginTop: 4, color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                          Tap to change
                        </Text>
                      </Pressable>

                      {makerOpen ? (
                        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                          <Pressable
                            onPress={() => {
                              setDraftMakerFilter(null);
                              setMakerOpen(false);
                            }}
                            style={({ pressed }) => ({
                              alignSelf: "flex-start",
                              borderRadius: 999,
                              paddingVertical: 10,
                              paddingHorizontal: 14,
                              backgroundColor: !draftMakerFilter ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                              borderWidth: 1,
                              borderColor: !draftMakerFilter ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.12)",
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>All makers</Text>
                          </Pressable>

                          {makers.slice(0, 40).map((m) => {
                            const selected = !!draftMakerFilter && safeLower(draftMakerFilter) === safeLower(m);

                            return (
                              <Pressable
                                key={m}
                                onPress={() => {
                                  setDraftMakerFilter(selected ? null : m);
                                  setMakerOpen(false);
                                }}
                                style={({ pressed }) => ({
                                  alignSelf: "flex-start",
                                  borderRadius: 999,
                                  paddingVertical: 10,
                                  paddingHorizontal: 14,
                                  backgroundColor: selected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                                  borderWidth: 1,
                                  borderColor: selected ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.12)",
                                  opacity: pressed ? 0.9 : 1,
                                  maxWidth: "100%",
                                })}
                              >
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }} numberOfLines={1}>
                                  {m}
                                </Text>
                              </Pressable>
                            );
                          })}

                          {makers.length > 40 ? (
                            <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, ...theme.typography.caption }}>
                              More makers coming next (we will add maker search in this panel).
                            </Text>
                          ) : null}
                        </View>
                      ) : null}

                      <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
                        <Pressable
                          onPress={closeAndSaveFilters}
                          style={({ pressed }) => ({
                            flex: 1,
                            borderRadius: 16,
                            paddingVertical: 14,
                            alignItems: "center",
                            backgroundColor: "rgba(255,255,255,0.09)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.18)",
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>Close</Text>
                        </Pressable>

                        <Pressable
                          onPress={closeAndSaveFilters}
                          style={({ pressed }) => ({
                            flex: 1.15,
                            borderRadius: 16,
                            paddingVertical: 14,
                            alignItems: "center",
                            backgroundColor: "rgba(255,255,255,0.18)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.24)",
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>Apply</Text>
                        </Pressable>
                      </View>
                    </ScrollView>
                  </KeyboardAvoidingView>
                </View>
              </View>
            </Modal>
          </>
        )}

        <LinearGradient
          pointerEvents="none"
          colors={["rgba(10,11,15,0.00)", "rgba(10,11,15,0.60)", "rgba(10,11,15,0.82)"]}
          locations={[0, 0.55, 1]}
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
    bottom: 0,
    height: 90,
  },

  topUiMask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },

  bgWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
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

  toTop: {
    position: "absolute",
    right: 16,
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
});
