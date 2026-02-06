/**
 * Usage:
 *   node scripts/patchStrainTypeOverrides.js data/strainType_overrides.csv
 *
 * CSV format:
 *   id,strainType
 *   curaleaf-tripoli-20-1-flower,indica
 */
const fs = require("fs");
const path = require("path");

// Reuse your existing firebase-admin setup pattern.
// Most projects like this already have serviceAccount/app default creds wired in other scripts.
// If this fails, paste the error back to me and I’ll adapt it to your repo’s exact setup.
const admin = require("firebase-admin");

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map((s) => s.trim());
  const idIdx = header.indexOf("id");
  const stIdx = header.indexOf("strainType");
  if (idIdx === -1 || stIdx === -1) {
    throw new Error(`CSV must have headers: id,strainType (got: ${header.join(",")})`);
  }
  const rows = [];
  for (const line of lines) {
    const cols = line.split(","); // simple CSV (your ids/names don't contain commas)
    const id = (cols[idIdx] || "").trim();
    const strainType = (cols[stIdx] || "").trim().toLowerCase();
    if (!id || !strainType) continue;
    if (!["sativa", "indica", "hybrid"].includes(strainType)) continue;
    rows.push({ id, strainType });
  }
  return rows;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Provide a CSV path, e.g. data/strainType_overrides.csv");
    process.exit(1);
  }

  const abs = path.resolve(csvPath);
  const text = fs.readFileSync(abs, "utf8");
  const rows = parseCSV(text);

  console.log(`Loaded ${rows.length} overrides from ${csvPath}`);

  try {
    admin.app();
  } catch {
    admin.initializeApp();
  }

  const db = admin.firestore();

  let updated = 0;
  const BATCH = 400; // keep under Firestore batch limit (500)

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const batch = db.batch();

    for (const r of chunk) {
      const ref = db.collection("products").doc(r.id);
      batch.set(ref, { strainType: r.strainType }, { merge: true }); // <-- IMPORTANT
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`Patched ${updated}/${rows.length}`);
  }

  console.log("Done. strainType overrides applied with merge:true (no field wiping).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
