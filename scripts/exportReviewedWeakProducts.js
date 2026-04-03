/* scripts/exportReviewedWeakProducts.js
   Usage:
     node scripts/exportReviewedWeakProducts.js
     node scripts/exportReviewedWeakProducts.js data/reviewed_weak_products.csv
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

function terpeneCount(raw) {
  const s = (raw ?? "").toString().trim();
  if (!s) return 0;
  return s.split("|").map((part) => part.trim()).filter(Boolean).length;
}

function sortWeakness(a, b) {
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
  if (a.hasTerpenes !== b.hasTerpenes) return Number(a.hasTerpenes) - Number(b.hasTerpenes);
  if (a.hasProducerInfo !== b.hasProducerInfo) return Number(a.hasProducerInfo) - Number(b.hasProducerInfo);
  return a.name.localeCompare(b.name, "en-GB");
}

async function main() {
  const outputArg = process.argv[2] || "data/reviewed_weak_products.csv";
  const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(process.cwd(), outputArg);

  const [productsSnap, reviewsSnap] = await Promise.all([
    db.collection("products").get(),
    db.collection("reviews").get(),
  ]);

  const reviewCounts = new Map();
  for (const doc of reviewsSnap.docs) {
    const data = doc.data() || {};
    const productId = (data.productId || "").toString().trim();
    if (!productId) continue;
    if (data.authorDeleted === true) continue;
    if (data.moderationStatus === "removed_admin" || data.moderationStatus === "removed_auto") continue;
    reviewCounts.set(productId, (reviewCounts.get(productId) || 0) + 1);
  }

  const rows = productsSnap.docs
    .map((doc) => {
      const data = doc.data() || {};
      const productId = doc.id;
      const reviewCount = reviewCounts.get(productId) || 0;
      const terpenes = (data.terpenes || "").toString().trim();
      const producerNotes = (data.producerNotes || "").toString().trim();
      const genetics = (data.genetics || "").toString().trim();
      const sourceName = ((data.catalogueSource || {}).name || "").toString().trim();
      const sourceUrl = ((data.catalogueSource || {}).url || "").toString().trim();
      const strainType = (data.strainType || data.type || "").toString().trim();
      const maker = (data.maker || "").toString().trim();

      return {
        id: productId,
        name: (data.name || "").toString().trim(),
        maker,
        strainType,
        reviewCount,
        terpenes,
        terpeneCount: terpeneCount(terpenes),
        genetics,
        producerNotes,
        sourceName,
        sourceUrl,
        hasTerpenes: Boolean(terpenes),
        hasProducerInfo: Boolean(producerNotes || genetics || maker || strainType),
      };
    })
    .filter((row) => row.reviewCount > 0)
    .filter((row) => !row.hasTerpenes || !row.hasProducerInfo)
    .sort(sortWeakness);

  const headers = [
    "id",
    "name",
    "maker",
    "strainType",
    "reviewCount",
    "terpenes",
    "terpeneCount",
    "genetics",
    "producerNotes",
    "sourceName",
    "sourceUrl",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Exported ${rows.length} reviewed weak products to ${outputPath}`);
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
