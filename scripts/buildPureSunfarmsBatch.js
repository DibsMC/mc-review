/* scripts/buildPureSunfarmsBatch.js
   Usage:
     node scripts/buildPureSunfarmsBatch.js data/live_products_catalogue.csv data/catalogue_seed_batch_011.csv /tmp/alien-pebbles.html /tmp/big-white.html
*/

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

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

function decodeHtml(value) {
  return (value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-");
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

function extractFirstMatch(html, regex) {
  const match = html.match(regex);
  return match ? decodeHtml(stripHtml(match[1])) : "";
}

function extractPercentFloor(html, label) {
  const regex = new RegExp(`<b>${label}</b>\\s*([0-9]+)(?:\\s*-\\s*[0-9]+)?%`, "i");
  const match = html.match(regex);
  return match ? Number(match[1]) : "";
}

function extractTerpenes(html) {
  const raw = extractFirstMatch(
    html,
    /<div class="h5 grey mt-0">Terpene Profile<\/div>\s*<div class="profiles">([\s\S]*?)<\/div>/i
  );
  if (!raw) return "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `${item}:major`)
    .join("|");
}

function main() {
  const liveCsvArg = process.argv[2];
  const outputArg = process.argv[3];
  const pageArgs = process.argv.slice(4);

  if (!liveCsvArg || !outputArg || pageArgs.length === 0) {
    console.error(
      "Usage: node scripts/buildPureSunfarmsBatch.js data/live_products_catalogue.csv data/catalogue_seed_batch_011.csv /tmp/alien-pebbles.html ..."
    );
    process.exit(1);
  }

  const liveCsvPath = path.isAbsolute(liveCsvArg) ? liveCsvArg : path.join(process.cwd(), liveCsvArg);
  const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(process.cwd(), outputArg);
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

  const now = new Date().toISOString();
  const rows = [];

  for (const pageArg of pageArgs) {
    const pagePath = path.isAbsolute(pageArg) ? pageArg : path.join(process.cwd(), pageArg);
    const html = fs.readFileSync(pagePath, "utf8");
    const name = extractFirstMatch(html, /<div class="entry-title h2">\s*([\s\S]*?)\s*<\/div>/i);
    if (!name) continue;

    const normalizedName = normalizeTitle(name);
    const slug = slugify(name);
    const id = `pure-sunfarms-${slug}-flower`;
    if (existingIds.has(id) || existingNames.has(normalizedName)) continue;

    const strainType = extractFirstMatch(html, /<span class="tag style ([^"]+)">/i).toLowerCase();
    const thcPct = extractPercentFloor(html, "THC");
    const cbdPct = extractPercentFloor(html, "CBD");
    const genetics = extractFirstMatch(
      html,
      /<div class="h5 grey mt-0">Lineage<\/div>\s*<div class="origin">\s*([\s\S]*?)\s*<\/div>/i
    );
    const terpenes = extractTerpenes(html);
    const producerNotes = extractFirstMatch(html, /<div class="description medium">\s*([\s\S]*?)<\/div>/i);
    const sourceUrl = `https://puresunfarms.com/strains/${slug}/`;

    rows.push({
      id,
      name,
      maker: "Pure Sunfarms",
      variant: "",
      type: strainType,
      productType: "flower",
      strainType,
      thcPct,
      cbdPct,
      terpenes,
      genetics,
      countryOfOrigin: "Canada",
      irradiationStatus: "",
      producerUseCases: "",
      producerNotes,
      sourceName: "Pure Sunfarms",
      sourceUrl,
      sourceType: "official producer strain page",
      sourceCheckedAt: now,
      sourceLicense: "",
      sourceNotes: "Added from the official Pure Sunfarms public strain page.",
      availabilityStatus: "",
      availabilityConfidence: "",
      availabilityCheckedAt: "",
      availabilitySourceName: "",
      availabilitySourceUrl: "",
      availabilityNotes: "",
      availabilitySignals: "",
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ];
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rows.length} Pure Sunfarms candidate rows to ${outputPath}`);
}

main();
