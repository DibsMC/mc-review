// @ts-nocheck
/* scripts/importProducts.js
   Usage:
     node scripts/importProducts.js data/flowers_master.csv
     node scripts/importProducts.js data/flowers_master.csv --dry-run
*/

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { parse } = require("csv-parse/sync");


function normalizeStrainType(v) {
  if (!v) return null;
  const s = String(v).toLowerCase().trim();
  if (s.includes("sativa")) return "sativa";
  if (s.includes("indica")) return "indica";
  if (s.includes("hybrid")) return "hybrid";
  if (s.startsWith("sat")) return "sativa";
  if (s.startsWith("ind")) return "indica";
  if (s.startsWith("hyb")) return "hybrid";
  return null;
}


const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
    console.error(
        "Missing serviceAccountKey.json. Put it at scripts/serviceAccountKey.json"
    );
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

function toNullIfBlank(v) {
    const s = (v ?? "").toString().trim();
    return s === "" ? null : s;
}

function toNumberOrNull(v) {
    const s = (v ?? "").toString().trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
function parseTerpenes(v) {
    const s = (v ?? "").toString().trim();
    if (!s) return null;

    // Accept formats like:
    // "myrcene:major|limonene:minor"
    // "a-pinene:2.95%|beta-pinene:3.67%"
    const parts = s.split("|").map(p => p.trim()).filter(Boolean);
    if (!parts.length) return null;

    return parts.map((p) => {
        const [nameRaw, valueRaw] = p.split(":");
        const name = (nameRaw ?? "").trim();
        const value = (valueRaw ?? "").trim();

        if (!name) return null;

        // value can be "major/minor" OR "2.95%" OR empty
        const pct = value.endsWith("%") ? Number(value.replace("%", "").trim()) : null;
        const pctValue = Number.isFinite(pct) ? pct : null;

        return {
            name,                         // e.g. "myrcene" or "a-pinene"
            level: pctValue === null ? (value || null) : null,  // "major"/"minor"
            pct: pctValue,                // 2.95 (number) if percent
        };
    }).filter(Boolean);
}

async function main() {
    const args = process.argv.slice(2);
    const csvPathArg = args.find((a) => !a.startsWith("--"));
    const dryRun = args.includes("--dry-run");

    if (!csvPathArg) {
        console.error("Provide a CSV path, e.g. data/flowers_master.csv");
        process.exit(1);
    }

    const csvPath = path.isAbsolute(csvPathArg)
        ? csvPathArg
        : path.join(process.cwd(), csvPathArg);

    if (!fs.existsSync(csvPath)) {
        console.error("CSV not found:", csvPath);
        process.exit(1);
    }

    const raw = fs.readFileSync(csvPath, "utf8");

    const records = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    if (!records.length) {
        console.log("No rows found in CSV.");
        return;
    }

    const BATCH_SIZE = 400;
    console.log(
        `Loaded ${records.length} rows from ${path.basename(csvPath)} ${dryRun ? "(DRY RUN)" : ""
        }`
    );

    let totalWritten = 0;
    let totalSkipped = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const row of chunk) {
            const id = toNullIfBlank(row.id);
            if (!id) {
                totalSkipped += 1;
                continue;
            }

            const doc = {
                name: toNullIfBlank(row.name) ?? "",
                maker: toNullIfBlank(row.maker) ?? "",
                variant: toNullIfBlank(row.variant),
                type: (toNullIfBlank(row.type) || "flower").toLowerCase(),
                
            strainType: normalizeStrainType(row.strainType),
thcPct: toNumberOrNull(row.thcPct),
                cbdPct: toNumberOrNull(row.cbdPct),
                terpenes: toNullIfBlank(row.terpenes),
                isActive: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            const ref = db.collection("products").doc(id);
            if (!dryRun) batch.set(ref, doc, { merge: true });
            totalWritten += 1;
        }

        if (!dryRun) await batch.commit();
        console.log(
            `Processed ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`
        );
    }

    console.log(
        `Done. ${totalWritten} upserts${dryRun ? " (dry-run)" : ""}. Skipped ${totalSkipped
        }.`
    );
}

main().catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
});
