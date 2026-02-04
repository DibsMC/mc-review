import { CinematicCard } from "../../../components/ui/CinematicCard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
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
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { theme } from "../../../lib/theme";

const budImg = require("../../../assets/icons/bud.png");

type Product = {
  id: string;
  name: string;
  maker: string;
  variant?: string | null;
  strainType?: string | null; // "indica" | "sativa" | "hybrid"
  productType?: string | null; // kept for backward compat in DB, but we don't filter on it now
  thcPct?: number | null;
  cbdPct?: number | null;
  terpenes?: string | null; // "limonene:major|caryophyllene:major|linalool:minor"
};

type Review = {
  id: string;
  productId: string;
  rating: number;
  score?: number | null;
};

type Stat = { count: number; avg: number };

type SortKey =
  | "mostReviewed"
  | "highestRated"
  | "thcHighLow"
  | "thcLowHigh"
  | "maker"
  | "atoz";

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

function normStr(v: any) {
  if (typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

function normalizeStrainType(v: any): "sativa" | "indica" | "hybrid" | "unknown" {
  const s = normStr(v);
  if (!s) return "unknown";
  if (s.includes("sativa")) return "sativa";
  if (s.includes("indica")) return "indica";
  if (s.includes("hybrid")) return "hybrid";
  return "unknown";
}

function sortLabel(k: SortKey) {
  switch (k) {
    case "mostReviewed":
      return "Most reviewed";
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
  // "limonene:major|caryophyllene:major|linalool:minor"
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
              style={{
                width: size,
                height: size,
                opacity: 0.22,
              }}
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
                    shadowColor: "rgba(130, 255, 210, 0.9)",
                    shadowOpacity: 1,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 6,
                    opacity: 0.9,
                  }}
                />
                <Image
                  source={budImg}
                  style={{
                    width: size,
                    height: size,
                    opacity: 1,
                    transform: [{ scale: SCALE }],
                  }}
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [statsByProductId, setStatsByProductId] = useState<Record<string, Stat>>({});

  // Search + applied sort/filters (what the list actually uses)
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("atoz");

  // Strain: only sativa/indica/hybrid, null means "no strain filter"
  const [strainFilter, setStrainFilter] = useState<"sativa" | "indica" | "hybrid" | null>(null);

  // Maker
  const [makerFilter, setMakerFilter] = useState<string | null>(null);

  // Terpenes: multi-select, majors only for now
  const [terpeneFilter, setTerpeneFilter] = useState<string[]>([]);

  // Modal open
  const [panelOpen, setPanelOpen] = useState(false);

  // Draft values inside the modal (close with X saves these to applied state)
  const [draftSortKey, setDraftSortKey] = useState<SortKey>("atoz");
  const [draftStrainFilter, setDraftStrainFilter] = useState<"sativa" | "indica" | "hybrid" | null>(null);
  const [draftMakerFilter, setDraftMakerFilter] = useState<string | null>(null);
  const [draftTerpeneFilter, setDraftTerpeneFilter] = useState<string[]>([]);

  // Expand sections in modal
  const [sortOpen, setSortOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);

  // Header is static (always visible)
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const [headerH, setHeaderH] = useState(170);

  // Products
  useEffect(() => {
    setLoadingProducts(true);
    setErrorMsg(null);

    const unsub = firestore().collection("products").onSnapshot(
      (snapshot) => {
        const list: Product[] = snapshot.docs.map((doc) => {
          const data = doc.data() as any;

          return {
            id: doc.id,
            name: typeof data?.name === "string" ? data.name : "",
            maker: typeof data?.maker === "string" ? data.maker : "",
            variant: data?.variant ?? null,
            strainType: typeof data?.type === "string" ? data.type : null,
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

          return {
            id: d.id,
            productId: typeof data?.productId === "string" ? data.productId : "",
            rating,
            score,
          };
        });

        const map: Record<string, Stat> = {};

        for (const r of rows) {
          if (!r.productId) continue;

          const val = typeof r.score === "number" && Number.isFinite(r.score) ? r.score : r.rating;
          if (val < 1 || val > 5) continue;

          const existing = map[r.productId];
          if (!existing) {
            map[r.productId] = { count: 1, avg: val };
          } else {
            const newCount = existing.count + 1;
            const newAvg = (existing.avg * existing.count + val) / newCount;
            map[r.productId] = { count: newCount, avg: newAvg };
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
      // majors only for now
      terps
        .filter((t) => t.strength === "major")
        .forEach((t) => set.add(t.name));
    }

    return Array.from(set).sort((a, b) => (safeLower(a) < safeLower(b) ? -1 : 1));
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (strainFilter) n += 1;
    if (makerFilter) n += 1;
    if (terpeneFilter.length > 0) n += 1;
    return n;
  }, [strainFilter, makerFilter, terpeneFilter]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (strainFilter) labels.push(`Strain: ${strainFilter}`);
    if (makerFilter) labels.push(`Maker: ${makerFilter}`);
    if (terpeneFilter.length > 0) labels.push(`Terpenes: ${terpeneFilter.join(", ")}`);
    return labels;
  }, [strainFilter, makerFilter, terpeneFilter]);

  const displayItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = items.filter((it) => {
      // Search
      if (q) {
        const hay = `${it.name} ${it.variant ?? ""} ${it.maker}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Strain
      if (strainFilter) {
        const st = normalizeStrainType(it.strainType);
        if (st !== strainFilter) return false;
      }

      // Maker
      if (makerFilter) {
        if (safeLower(it.maker) !== safeLower(makerFilter)) return false;
      }

      // Terpenes (majors only)
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

      // Tie-break: A to Z
      const an = safeLower(a.name);
      const bn = safeLower(b.name);
      if (an !== bn) return an < bn ? -1 : 1;

      const av = safeLower(a.variant);
      const bv = safeLower(b.variant);
      if (av !== bv) return av < bv ? -1 : 1;

      return a.id < b.id ? -1 : 1;
    });

    return copy;
  }, [items, statsByProductId, query, sortKey, strainFilter, makerFilter, terpeneFilter]);

  const openFilters = () => {
    // Copy applied -> draft
    setDraftSortKey(sortKey);
    setDraftStrainFilter(strainFilter);
    setDraftMakerFilter(makerFilter);
    setDraftTerpeneFilter(terpeneFilter);

    setSortOpen(false);
    setMakerOpen(false);
    setPanelOpen(true);
  };

  const closeAndSaveFilters = () => {
    // Apply draft -> applied
    setSortKey(draftSortKey);
    setStrainFilter(draftStrainFilter);
    setMakerFilter(draftMakerFilter);
    setTerpeneFilter(draftTerpeneFilter);

    setSortOpen(false);
    setMakerOpen(false);
    setPanelOpen(false);
  };

  const resetDraft = () => {
    setDraftSortKey("atoz");
    setDraftStrainFilter(null);
    setDraftMakerFilter(null);
    setDraftTerpeneFilter([]);
    setSortOpen(false);
    setMakerOpen(false);
  };

  const windowH = Dimensions.get("window").height;

  // Floating button position (higher up, smaller)
  const floatingSize = 46;
  const floatingTop = Math.max(insets.top + 68, Math.round(windowH * 0.2));

  if (loadingProducts) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "transparent",
          padding: theme.spacing.xl,
        }}
      >
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
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "transparent",
          padding: theme.spacing.xl,
        }}
      >
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
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <Animated.FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
          ListHeaderComponent={<View style={{ height: headerH + 14 }} />}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={{ paddingTop: 26, paddingHorizontal: theme.spacing.xl }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: theme.colors.textOnDark,
                }}
              >
                No matches
              </Text>
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

            // Build a clean meta line: "Maker · THC 20% · CBD 0.1%"
            const parts = [maker, `THC ${formatPct(item.thcPct)}`, `CBD ${formatPct(item.cbdPct)}`].filter(Boolean);
            const metaLine = parts.join(" · ");

            return (
              <CinematicCard
                onPress={() => router.push(`/reviews/${item.id}`)}
                style={{
                  marginHorizontal: theme.spacing.xl,
                  overflow: "hidden",
                }}
              >
                <View style={{ padding: 18 }}>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "900",
                      color: theme.colors.textOnDark,
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
                        <Text
                          style={{
                            fontWeight: "900",
                            marginLeft: 10,
                            color: theme.colors.textOnDark,
                          }}
                        >
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
                      <Text
                        style={{
                          fontWeight: "800",
                          color: theme.colors.textOnDarkSecondary,
                        }}
                      >
                        No ratings yet{loadingReviews ? " (loading...)" : ""}
                      </Text>
                    )}
                  </View>
                </View>
              </CinematicCard>
            );
          }}
        />

        {/* Overlay header (appears when not scrolling) */}
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
          {/* Opaque mask so list content can't show through behind search */}
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View style={{ flex: 1, backgroundColor: "rgba(10,11,15,0.96)" }} />
          </View>

          <View
            style={{
              paddingHorizontal: theme.spacing.xl,
              paddingTop: insets.top + theme.spacing.md,
              paddingBottom: theme.spacing.lg,
              backgroundColor: "rgba(10,11,15,0.92)",
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Text
              style={{
                ...theme.typography.title,
                color: theme.colors.accent,
                marginBottom: theme.spacing.xs,
              }}
            >
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
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or maker"
                placeholderTextColor="rgba(255,255,255,0.40)"
                style={{
                  color: theme.colors.textOnDark,
                  fontSize: 15,
                  fontWeight: "600",
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            <View style={{ marginTop: theme.spacing.sm }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                Sort: {sortLabel(sortKey)}
                {activeFilterCount > 0 ? ` | Filters: ${activeFilterCount}` : ""}
              </Text>

              {activeFilterCount > 0 ? (
                <Text
                  style={{
                    marginTop: 4,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
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
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: "rgba(235,237,240,0.98)",
                  }}
                >
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>

        {/* Filters modal (tap backdrop or X saves draft) */}
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
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}>
                <ScrollView
                  style={{ maxHeight: Dimensions.get("window").height * 0.82 }}
                  contentContainerStyle={{
                    padding: 18,
                    paddingBottom: Math.max(insets.bottom, 18) + 18,
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Header row + X (saves) */}
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 26,
                        fontWeight: "900",
                        color: theme.colors.textOnDark,
                        flex: 1,
                      }}
                    >
                      Filters
                    </Text>

                    <Pressable
                      onPress={closeAndSaveFilters}
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
                      <Text
                        style={{
                          color: theme.colors.textOnDark,
                          fontWeight: "900",
                          fontSize: 16,
                        }}
                      >
                        ✕
                      </Text>
                    </Pressable>
                  </View>

                  {/* Reset */}
                  <Pressable
                    onPress={resetDraft}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.12)",
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Reset</Text>
                  </Pressable>

                  {/* Active (draft) summary */}
                  {(draftStrainFilter || !!draftMakerFilter || draftTerpeneFilter.length > 0) ? (
                    <View
                      style={{
                        marginTop: 12,
                        borderRadius: 16,
                        padding: 12,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)",
                      }}
                    >
                      <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>Active</Text>
                      <Text
                        style={{
                          marginTop: 6,
                          color: theme.colors.textOnDarkSecondary,
                          ...theme.typography.caption,
                        }}
                      >
                        {[
                          draftStrainFilter ? `Strain: ${draftStrainFilter}` : "",
                          draftTerpeneFilter.length > 0 ? `Terpenes: ${draftTerpeneFilter.join(", ")}` : "",
                          draftMakerFilter ? `Maker: ${draftMakerFilter}` : "",
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </Text>
                    </View>
                  ) : null}

                  {/* Sort */}
                  <Text
                    style={{
                      marginTop: 18,
                      fontSize: 16,
                      fontWeight: "900",
                      color: theme.colors.textOnDark,
                    }}
                  >
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
                    <Text
                      style={{
                        marginTop: 4,
                        color: theme.colors.textOnDarkSecondary,
                        ...theme.typography.caption,
                      }}
                    >
                      Tap to change
                    </Text>
                  </Pressable>

                  {sortOpen ? (
                    <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {(["mostReviewed", "highestRated", "thcHighLow", "thcLowHigh", "maker", "atoz"] as SortKey[]).map((k) => {
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
                      })}
                    </View>
                  ) : null}

                  {/* Filters */}
                  <Text
                    style={{
                      marginTop: 22,
                      fontSize: 16,
                      fontWeight: "900",
                      color: theme.colors.textOnDark,
                    }}
                  >
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
                          style={({ pressed }) => ({
                            ...chipOnDark(selected),
                            opacity: pressed ? 0.85 : 1,
                          })}
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

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
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

                                // max 3 selections (remove this block if you want unlimited)
                                if (prev.length >= 3) return prev;

                                return [...prev, t];
                              });
                            }}
                            style={({ pressed }) => ({
                              ...chipOnDark(selected),
                              opacity: pressed ? 0.85 : 1,
                            })}
                          >
                            <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>{t}</Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>

                  {draftTerpeneFilter.length >= 3 ? (
                    <Text
                      style={{
                        marginTop: 6,
                        color: "rgba(255,255,255,0.55)",
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
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
                    <Text
                      style={{
                        color: theme.colors.textOnDark,
                        fontWeight: "900",
                        fontSize: 16,
                      }}
                      numberOfLines={1}
                    >
                      {draftMakerFilter ? draftMakerFilter : "All makers"}
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        color: theme.colors.textOnDarkSecondary,
                        ...theme.typography.caption,
                      }}
                    >
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
                        const selected = draftMakerFilter && safeLower(draftMakerFilter) === safeLower(m);
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
                        <Text
                          style={{
                            marginTop: 6,
                            color: theme.colors.textOnDarkSecondary,
                            ...theme.typography.caption,
                          }}
                        >
                          More makers coming next (we will add maker search in this panel).
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
