/* scripts/patchStrainTypeOverrides.js
   Usage:
     node scripts/patchStrainTypeOverrides.js data/strainType_overrides.csv
   Notes:
     - Uses firebase-admin + serviceAccountKey.json (same as importProducts.js)
     - Merge-only: does NOT wipe other fields
*/

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { parse } = require("csv-parse/sync");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("Missing serviceAccountKey.json. Put it at scripts/serviceAccountKey.json");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

function toNullIfBlank(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Provide a CSV path, e.g. data/strainType_overrides.csv");
    process.exit(1);
  }

  const abs = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const text = fs.readFileSync(abs, "utf8");

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (!rows.length) {
    console.log("No rows found in overrides CSV. Nothing to do.");
    return;
  }

  const BATCH = 400;
  let done = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const batch = db.batch();

    for (const r of chunk) {
      const id = (r.id ?? "").toString().trim();
      if (!id) continue;

      const strainType = toNullIfBlank(r.strainType);
      const ref = db.collection("products").doc(id);

      batch.set(ref, { strainType }, { merge: true });
    }

    await batch.commit();
    done += chunk.length;
    console.log(`Patched ${done}/${rows.length}`);
  }

  console.log("Done. strainType applied with merge:true.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
