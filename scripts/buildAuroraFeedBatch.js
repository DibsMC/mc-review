/* scripts/buildAuroraFeedBatch.js
   Usage:
     node scripts/buildAuroraFeedBatch.js /tmp/aurora_products.json data/live_products_catalogue.csv data/catalogue_seed_batch_010.csv
*/

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCsv(filePath) {
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

function csvEscape(value) {
  const s = (value ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stripHtml(html) {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTitle(value) {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractPlantType(tags) {
  const tag = (tags || []).find((entry) => entry.startsWith("plant_type::"));
  if (!tag) return "";
  return tag.split("::")[1]?.trim().toLowerCase() || "";
}

function extractTerpenes(bodyText) {
  const match = bodyText.match(/(?:main|dominant)\s+terpenes?\s+(?:include|are)?\s*[:\-]?\s*([^.]+)/i);
  if (!match) return "";
  const knownTerpenes = [
    "myrcene",
    "limonene",
    "linalool",
    "caryophyllene",
    "pinene",
    "terpinolene",
    "ocimene",
    "humulene",
    "farnesene",
    "bisabolol",
    "nerolidol",
    "camphene",
    "eucalyptol",
    "terpineol",
  ];

  const parts = match[1]
    .split(/,| and /i)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\.$/, ""))
    .map((item) => item.toLowerCase())
    .map((item) => item.replace(/\bcontent of\b/g, "").trim())
    .map((item) => item.split(/\bgives\b/i)[0].trim())
    .filter((item) => knownTerpenes.some((terpene) => item.includes(terpene)));

  return parts
    .map((name) => `${name}:major`)
    .join("|");
}

function extractUseCases(bodyText) {
  const snippets = [];
  const rules = [
    { pattern: /\bsleep\b/i, value: "sleep" },
    { pattern: /\bnight\b/i, value: "nighttime" },
    { pattern: /\bcalm\b/i, value: "calm" },
    { pattern: /\bfocus\b/i, value: "focus" },
    { pattern: /\bclarity\b/i, value: "clarity" },
    { pattern: /\brelax/i, value: "relaxation" },
    { pattern: /\buplift/i, value: "uplift" },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(bodyText)) {
      snippets.push(rule.value);
    }
  }

  return Array.from(new Set(snippets)).join("|");
}

function isFlowerProduct(product) {
  const productType = (product.product_type || "").toLowerCase();
  const title = (product.title || "").toLowerCase();
  const handle = (product.handle || "").toLowerCase();
  const tags = product.tags || [];
  const isDeclaredFlower =
    productType.includes("dried cannabis") ||
    productType.includes("flower") ||
    tags.includes("subcategory::flower");

  if (!isDeclaredFlower) {
    return false;
  }

  const blockedTerms = [
    "oil",
    "vape",
    "pre-roll",
    "pre roll",
    "jar of js",
    "concentrate",
    "capsule",
    "drops",
    "tablet",
    "gumm",
    "soft chew",
    "softchew",
    "bath bomb",
    "seltzer",
    "cream",
    "balm",
    "stick",
    "topical",
    "disposable",
    "all-in-one",
    "all in one",
    "aio",
    "510",
    "calendar",
    "j’s",
    "j's",
    " j s",
  ];

  const haystack = `${productType} ${title} ${handle}`;
  if (blockedTerms.some((term) => haystack.includes(term))) {
    return false;
  }
  if (handle.startsWith("lab-") || title.startsWith("lab ")) {
    return false;
  }
  return tags.some((tag) => tag.startsWith("plant_type::"));
}

function main() {
  const feedPathArg = process.argv[2];
  const liveCsvArg = process.argv[3];
  const outputArg = process.argv[4] || "data/catalogue_seed_batch_010.csv";

  if (!feedPathArg || !liveCsvArg) {
    console.error("Usage: node scripts/buildAuroraFeedBatch.js /tmp/aurora_products.json data/live_products_catalogue.csv [output.csv]");
    process.exit(1);
  }

  const feedPath = path.isAbsolute(feedPathArg) ? feedPathArg : path.join(process.cwd(), feedPathArg);
  const liveCsvPath = path.isAbsolute(liveCsvArg) ? liveCsvArg : path.join(process.cwd(), liveCsvArg);
  const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(process.cwd(), outputArg);

  const feed = readJson(feedPath);
  const liveRows = readCsv(liveCsvPath);

  const existingIds = new Set(liveRows.map((row) => row.id).filter(Boolean));
  const existingNames = new Set(liveRows.map((row) => normalizeTitle(row.name)).filter(Boolean));

  const headers = [
    "id",
    "name",
    "maker",
    "variant",
    "type",
    "productType",
    "strainType",
    "thcPct",
    "cbdPct",
    "terpenes",
    "genetics",
    "countryOfOrigin",
    "irradiationStatus",
    "producerUseCases",
    "producerNotes",
    "sourceName",
    "sourceUrl",
    "sourceType",
    "sourceCheckedAt",
    "sourceLicense",
    "sourceNotes",
    "availabilityStatus",
    "availabilityConfidence",
    "availabilityCheckedAt",
    "availabilitySourceName",
    "availabilitySourceUrl",
    "availabilityNotes",
    "availabilitySignals",
  ];

  const rows = [];
  for (const product of feed.products || []) {
    if (!isFlowerProduct(product)) continue;

    const name = (product.title || "").trim();
    const normalizedName = normalizeTitle(name);
    const id = `aurora-medical-${slugify(product.handle || name)}-flower`;

    if (!name || existingIds.has(id) || existingNames.has(normalizedName)) {
      continue;
    }

    const bodyText = stripHtml(product.body_html || "");
    const tags = product.tags || [];
    const strainType = extractPlantType(tags);
    const terpenes = extractTerpenes(bodyText);
    const producerUseCases = extractUseCases(bodyText);

    rows.push({
      id,
      name,
      maker: "Aurora Medical",
      variant: "",
      type: strainType,
      productType: "flower",
      strainType,
      thcPct: "",
      cbdPct: "",
      terpenes,
      genetics: "",
      countryOfOrigin: "Canada",
      irradiationStatus: "",
      producerUseCases,
      producerNotes: "",
      sourceName: "Aurora Medical",
      sourceUrl: `https://www.auroramedical.com/products/${product.handle}`,
      sourceType: "official manufacturer product feed",
      sourceCheckedAt: new Date().toISOString(),
      sourceLicense: "",
      sourceNotes: "Added from Aurora's official public product feed.",
      availabilityStatus: "available",
      availabilityConfidence: "high",
      availabilityCheckedAt: new Date().toISOString(),
      availabilitySourceName: "Aurora Medical",
      availabilitySourceUrl: `https://www.auroramedical.com/products/${product.handle}`,
      availabilityNotes: "Listed on Aurora's official public product feed on the review date.",
      availabilitySignals: "official-listing|product-feed",
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ];
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rows.length} Aurora candidate rows to ${outputPath}`);
}

main();
