type DedupeProduct = {
  id: string;
  name?: string | null;
  maker?: string | null;
  thcPct?: number | null;
  cbdPct?: number | null;
  variant?: string | null;
  productType?: string | null;
  strainType?: string | null;
  terpenes?: string | null;
  genetics?: string | null;
  producerNotes?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  updatedAtMs?: number | null;
  updatedAt?: number | { toMillis?: () => number } | null;
};

function safeLower(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeName(value: string | null | undefined) {
  return safeLower(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMillis(value: DedupeProduct["updatedAt"] | DedupeProduct["updatedAtMs"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

function productScore(item: DedupeProduct) {
  return [
    item.sourceName && item.sourceUrl ? 40 : 0,
    item.terpenes ? 18 : 0,
    item.genetics ? 10 : 0,
    item.producerNotes ? 10 : 0,
    item.strainType ? 8 : 0,
    item.productType ? 5 : 0,
    item.variant ? 2 : 0,
    toMillis(item.updatedAtMs ?? item.updatedAt) / 1_000_000_000_000,
  ].reduce((sum, part) => sum + part, 0);
}

export function dedupeCatalogueProducts<T extends DedupeProduct>(items: T[]) {
  const chosen = new Map<string, T>();

  for (const item of items) {
    const key = [
      normalizeName(item.name),
      normalizeName(item.maker),
      normalizeNumber(item.thcPct) ?? "",
      normalizeNumber(item.cbdPct) ?? "",
      normalizeName(item.variant),
    ].join("|");

    const current = chosen.get(key);
    if (!current || productScore(item) > productScore(current)) {
      chosen.set(key, item);
    }
  }

  return Array.from(chosen.values());
}
