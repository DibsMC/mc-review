import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  Image,
  Modal,
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

  // strain type eg sativa/indica/hybrid
  strainType?: string | null;

  // product type eg flower/vape/oil/edible (optional in your data)
  productType?: string | null;

  thcPct?: number | null;
  cbdPct?: number | null;
};

type Review = {
  id: string;
  productId: string;
  rating: number;
  score?: number | null;
};

type Stats = { count: number; avg: number };

type SortKey = "mostReviewed" | "highestRated" | "thcDesc" | "thcAsc" | "az" | "maker";

type Filters = {
  makers: string[];
  strainTypes: string[];
  productTypes: string[];
  minRating: number; // 0 to 5
  hasReviewsOnly: boolean;
};

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

function normalizeStrainType(v: any): string {
  const s = normStr(v);
  if (!s) return "unknown";
  if (s.includes("sativa")) return "sativa";
  if (s.includes("indica")) return "indica";
  if (s.includes("hybrid")) return "hybrid";
  return s;
}

function normalizeProductType(v: any): string {
  const s = normStr(v);
  if (!s) return "";
  // common normalizations
  if (s.includes("flower")) return "flower";
  if (s.includes("vape") || s.includes("cart")) return "vape";
  if (s.includes("oil") || s.includes("tinct")) return "oil";
  if (s.includes("edible") || s.includes("gummy")) return "edible";
  return s;
}

function BudRating({ value, size = 18 }: { value: number; size?: number }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;

  // tuned for the darker "glass" cards on the reviews list
  const EMPTY_TINT = "rgba(255,255,255,0.14)"; // darker empties = more pop
  const GLOW = "rgba(160,255,210,0.75)";
  // brighter mint glow
  const SCALE = 1.1; // extra punch

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const rawFill = Math.max(0, Math.min(1, safe - i));
        const fill = Math.round(rawFill * 4) / 4; // quarter steps
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
            {/* Empty bud = dim silhouette */}
            <Image
              source={budImg}
              style={{
                width: size,
                height: size,
                tintColor: EMPTY_TINT,
                opacity: 1,
              }}
              resizeMode="contain"
            />

            {/* Filled overlay */}
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
                {/* Soft glow (shadow-only, no background tile) */}
                <>
                  {/* Outer glow (bigger, softer) */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: -3,
                      top: -3,
                      width: size + 6,
                      height: size + 6,
                      borderRadius: 999,
                      shadowColor: GLOW,
                      shadowOpacity: 0.85,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 12,
                    }}
                  />

                  {/* Inner glow (tighter, brighter) */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: -1,
                      top: -1,
                      width: size + 2,
                      height: size + 2,
                      borderRadius: 999,
                      shadowColor: GLOW,
                      shadowOpacity: 1,
                      shadowRadius: 7,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 8,
                    }}
                  />
                </>


                {/* Full-colour bud */}
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

function Divider() {
  return <View style={{ height: 1, backgroundColor: theme.colors.dividerOnDark, marginTop: theme.spacing.lg }} />;
}

function Pill({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function ReviewsIndex() {
  const router = useRouter();

  const [items, setItems] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [statsByProductId, setStatsByProductId] = useState<Record<string, Stats>>({});

  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("mostReviewed");

  const [filters, setFilters] = useState<Filters>({
    makers: [],
    strainTypes: [],
    productTypes: [],
    minRating: 0,
    hasReviewsOnly: false,
  });

  useEffect(() => {
    setLoadingProducts(true);
    setErrorMsg(null);

    const unsub = firestore()
      .collection("products")
      .onSnapshot(
        (snapshot) => {
          const list: Product[] = snapshot.docs.map((doc) => {
            const data = doc.data() as any;

            return {
              id: doc.id,
              name: typeof data?.name === "string" ? data.name : "",
              maker: typeof data?.maker === "string" ? data.maker : "",
              variant: data?.variant ?? null,

              // your existing field (data.type) mapped into strainType
              strainType: typeof data?.type === "string" ? data.type : null,

              // optional new field (data.productType) if you add it later
              productType: typeof data?.productType === "string" ? data.productType : null,

              thcPct: typeof data?.thcPct === "number" ? data.thcPct : null,
              cbdPct: typeof data?.cbdPct === "number" ? data.cbdPct : null,
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

  useEffect(() => {
    setLoadingReviews(true);

    const unsub = firestore()
      .collection("reviews")
      .onSnapshot(
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

          const map: Record<string, Stats> = {};

          for (const r of rows) {
            if (!r.productId) continue;

            const val =
              typeof r.score === "number" && Number.isFinite(r.score)
                ? r.score
                : r.rating;

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

  const sortLabel =
    sortKey === "mostReviewed"
      ? "Most reviewed"
      : sortKey === "highestRated"
        ? "Highest rated"
        : sortKey === "thcDesc"
          ? "THC high"
          : sortKey === "thcAsc"
            ? "THC low"
            : sortKey === "maker"
              ? "Maker"
              : "A to Z";

  const makerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) {
      if (p.maker) set.add(p.maker);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const productTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) {
      const t = normalizeProductType(p.productType);
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const strainTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) {
      set.add(normalizeStrainType(p.strainType));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const activeFilterCount =
    (filters.makers.length ? 1 : 0) +
    (filters.strainTypes.length ? 1 : 0) +
    (filters.productTypes.length ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.hasReviewsOnly ? 1 : 0);

  const visibleItems = useMemo(() => {
    const list = [...items];

    const filtered = list.filter((p) => {
      const stat = statsByProductId[p.id];
      const count = stat?.count ?? 0;
      const avg = stat?.avg ?? 0;

      const makerOk =
        !filters.makers.length || (p.maker && filters.makers.includes(p.maker));

      const strainNorm = normalizeStrainType(p.strainType);
      const strainOk =
        !filters.strainTypes.length || filters.strainTypes.includes(strainNorm);

      const typeNorm = normalizeProductType(p.productType);
      const typeOk =
        !filters.productTypes.length || (typeNorm && filters.productTypes.includes(typeNorm));

      const ratingOk = filters.minRating <= 0 || avg >= filters.minRating;
      const reviewsOk = !filters.hasReviewsOnly || count > 0;

      return makerOk && strainOk && typeOk && ratingOk && reviewsOk;
    });

    filtered.sort((a, b) => {
      const aStat = statsByProductId[a.id];
      const bStat = statsByProductId[b.id];

      const aCount = aStat?.count ?? 0;
      const bCount = bStat?.count ?? 0;

      const aAvg = aStat?.avg ?? 0;
      const bAvg = bStat?.avg ?? 0;

      const aThc = a.thcPct ?? 0;
      const bThc = b.thcPct ?? 0;

      if (sortKey === "mostReviewed") return bCount - aCount;
      if (sortKey === "highestRated") return bAvg - aAvg;
      if (sortKey === "thcDesc") return bThc - aThc;
      if (sortKey === "thcAsc") return aThc - bThc;

      if (sortKey === "maker") {
        const am = safeLower(a.maker);
        const bm = safeLower(b.maker);
        if (am !== bm) return am < bm ? -1 : 1;
        const an = safeLower(a.name);
        const bn = safeLower(b.name);
        if (an !== bn) return an < bn ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      }

      // az
      const an = safeLower(a.name);
      const bn = safeLower(b.name);
      if (an !== bn) return an < bn ? -1 : 1;

      const av = safeLower(a.variant);
      const bv = safeLower(b.variant);
      if (av !== bv) return av < bv ? -1 : 1;

      return a.id < b.id ? -1 : 1;
    });

    return filtered;
  }, [items, filters, sortKey, statsByProductId]);

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
          Couldnt load products
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
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={{
            padding: theme.spacing.xl,
            paddingBottom: theme.spacing.xxl,
            backgroundColor: "transparent",
          }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListHeaderComponent={
            <View style={{ marginBottom: theme.spacing.md, backgroundColor: "transparent" }}>
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
                }}
              >
                Browse products and see community ratings.
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: theme.spacing.md, gap: 10 }}>
                <Pill label={`Sort: ${sortLabel}`} onPress={() => setSortOpen(true)} />
                <Pill
                  label={activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}
                  onPress={() => setFilterOpen(true)}
                />
              </View>

              <Divider />
            </View>
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 40, backgroundColor: "transparent" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.textOnDark }}>
                No products found
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  color: theme.colors.textOnDarkSecondary,
                  ...theme.typography.body,
                }}
              >
                Your Firestore "products" collection might be empty.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const stat = statsByProductId[item.id];
            const hasRatings = !!stat && stat.count > 0;
            const avg = hasRatings ? stat.avg : 0;

            const strain = normalizeStrainType(item.strainType);
            const ptype = normalizeProductType(item.productType);

            const metaBits: string[] = [];
            metaBits.push(item.maker || "Unknown maker");
            if (strain) metaBits.push(strain);
            if (ptype) metaBits.push(ptype);
            metaBits.push(`THC ${formatPct(item.thcPct)}`);
            metaBits.push(`CBD ${formatPct(item.cbdPct)}`);

            return (
              <Pressable
                onPress={() => router.push(`/reviews/${item.id}`)}
                style={({ pressed }) => [
                  {
                    borderRadius: 22,
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.16)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                    opacity: pressed ? 0.96 : 1,
                    ...theme.shadow.card,
                  },
                ]}
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
                    }}
                    numberOfLines={1}
                  >
                    {metaBits.join("  ")}
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
                      <Text style={{ fontWeight: "800", color: theme.colors.textOnDarkSecondary }}>
                        No ratings yet{loadingReviews ? " (loading...)" : ""}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>

      {/* SORT MODAL */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSortOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => { }}>
            <Text style={styles.modalTitle}>Sort</Text>
            <Text style={styles.modalSub}>Choose how the list is ordered.</Text>

            {[
              ["mostReviewed", "Most reviewed"],
              ["highestRated", "Highest rated"],
              ["thcDesc", "THC high to low"],
              ["thcAsc", "THC low to high"],
              ["maker", "Maker"],
              ["az", "A to Z"],
            ].map(([key, label]) => {
              const selected = sortKey === (key as SortKey);

              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSortKey(key as SortKey);
                    setSortOpen(false);
                  }}
                  style={[
                    styles.row,
                    selected && {
                      backgroundColor: "rgba(255,255,255,0.14)",
                      borderColor: "rgba(255,255,255,0.26)",
                    },
                  ]}
                >
                  <View>
                    <Text style={styles.rowText}>{label}</Text>
                    {selected ? <Text style={styles.rowSub}>Selected</Text> : null}
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "900" }}>
                    {selected ? "" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* FILTERS MODAL */}
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => { }}>
            <Text style={styles.modalTitle}>Filters</Text>
            <Text style={styles.modalSub}>Narrow the list down to what you want.</Text>

            {productTypeOptions.length ? (
              <>
                <Text style={styles.sectionTitle}>Product type</Text>
                <View style={styles.chipWrap}>
                  {productTypeOptions.map((t) => {
                    const on = filters.productTypes.includes(t);
                    return (
                      <Chip
                        key={t}
                        label={t}
                        on={on}
                        onPress={() => {
                          setFilters((prev) => ({
                            ...prev,
                            productTypes: on ? prev.productTypes.filter((x) => x !== t) : [...prev.productTypes, t],
                          }));
                        }}
                      />
                    );
                  })}
                </View>
                <View style={{ height: 14 }} />
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Strain type</Text>
            <View style={styles.chipWrap}>
              {strainTypeOptions.map((t) => {
                const on = filters.strainTypes.includes(t);
                return (
                  <Chip
                    key={t}
                    label={t}
                    on={on}
                    onPress={() => {
                      setFilters((prev) => ({
                        ...prev,
                        strainTypes: on ? prev.strainTypes.filter((x) => x !== t) : [...prev.strainTypes, t],
                      }));
                    }}
                  />
                );
              })}
            </View>

            <View style={{ height: 14 }} />

            <Text style={styles.sectionTitle}>Grower</Text>
            <View style={styles.chipWrap}>
              {makerOptions.slice(0, 16).map((m) => {
                const on = filters.makers.includes(m);
                return (
                  <Chip
                    key={m}
                    label={m}
                    on={on}
                    onPress={() => {
                      setFilters((prev) => ({
                        ...prev,
                        makers: on ? prev.makers.filter((x) => x !== m) : [...prev.makers, m],
                      }));
                    }}
                  />
                );
              })}
            </View>

            <View style={{ height: 14 }} />

            <Pressable
              onPress={() => setFilters((prev) => ({ ...prev, hasReviewsOnly: !prev.hasReviewsOnly }))}
              style={styles.row}
            >
              <View>
                <Text style={styles.rowText}>Has reviews only</Text>
                <Text style={styles.rowSub}>Hide products with no reviews yet</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.80)", fontWeight: "900" }}>
                {filters.hasReviewsOnly ? "On" : "Off"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  minRating: prev.minRating >= 5 ? 0 : prev.minRating + 1,
                }))
              }
              style={styles.row}
            >
              <View>
                <Text style={styles.rowText}>Minimum rating</Text>
                <Text style={styles.rowSub}>Tap to cycle 0 to 5</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.80)", fontWeight: "900" }}>
                {filters.minRating.toFixed(0)}
              </Text>
            </Pressable>

            <View style={styles.footerRow}>
              <Pressable
                onPress={() => {
                  setFilters({
                    makers: [],
                    strainTypes: [],
                    productTypes: [],
                    minRating: 0,
                    hasReviewsOnly: false,
                  });
                }}
                style={styles.btn}
              >
                <Text style={styles.btnText}>Reset</Text>
              </Pressable>

              <Pressable onPress={() => setFilterOpen(false)} style={styles.btn}>
                <Text style={styles.btnText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = {
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillText: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "900" as const,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end" as const,
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(18,18,22,0.92)",
    padding: 16,
  },
  modalTitle: { color: "white", fontSize: 18, fontWeight: "900" as const },
  modalSub: { color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 12 },

  sectionTitle: { color: "white", fontWeight: "900" as const, marginBottom: 8 },

  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: 10,
  },
  rowText: { color: "white", fontWeight: "900" as const },
  rowSub: { color: "rgba(255,255,255,0.6)", marginTop: 2, fontSize: 12 },

  chipWrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chipOn: {
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  chipText: { color: "rgba(255,255,255,0.9)", fontWeight: "900" as const, fontSize: 12 },

  footerRow: { flexDirection: "row" as const, gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center" as const,
  },
  btnText: { color: "white", fontWeight: "900" as const },
};
