/* scripts/exportProductsCatalog.js
   Usage:
     node scripts/exportProductsCatalog.js
     node scripts/exportProductsCatalog.js data/live_products_catalogue.csv
*/

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Missing serviceAccountKey.json. Put it at scripts/serviceAccountKey.json");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

function csvEscape(value) {
  const s = (value ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function joinPipe(values) {
  if (!Array.isArray(values) || !values.length) return "";
  return values
    .map((value) => (value ?? "").toString().trim())
    .filter(Boolean)
    .join("|");
}

function formatSourceCheckedAt(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

async function main() {
  const outputArg = process.argv[2] || "data/live_products_catalogue.csv";
  const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(process.cwd(), outputArg);

  const snapshot = await db.collection("products").get();

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

  const rows = snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      const source = data.catalogueSource || {};
      const availability = data.availabilityReview || {};
      return {
        id: doc.id,
        name: data.name || "",
        maker: data.maker || "",
        variant: data.variant || "",
        type: data.type || "",
        productType: data.productType || "",
        strainType: data.strainType || "",
        thcPct: data.thcPct ?? "",
        cbdPct: data.cbdPct ?? "",
        terpenes: data.terpenes || "",
        genetics: data.genetics || "",
        countryOfOrigin: data.countryOfOrigin || "",
        irradiationStatus: data.irradiationStatus || "",
        producerUseCases: joinPipe(data.producerUseCases),
        producerNotes: data.producerNotes || "",
        sourceName: source.name || "",
        sourceUrl: source.url || "",
        sourceType: source.type || "",
        sourceCheckedAt: formatSourceCheckedAt(source.checkedAt),
        sourceLicense: source.license || "",
        sourceNotes: source.notes || "",
        availabilityStatus: availability.status || data.availabilityStatus || "",
        availabilityConfidence: availability.confidence || "",
        availabilityCheckedAt: formatSourceCheckedAt(availability.checkedAt || data.availabilityCheckedAt),
        availabilitySourceName: availability.sourceName || "",
        availabilitySourceUrl: availability.sourceUrl || "",
        availabilityNotes: availability.notes || "",
        availabilitySignals: joinPipe(availability.signals),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Exported ${rows.length} products to ${outputPath}`);
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
