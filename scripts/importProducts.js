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

function parsePipeList(v) {
    const s = (v ?? "").toString().trim();
    if (!s) return null;
    const parts = s
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.length ? parts : null;
}

function parseDateToTimestamp(v) {
    const s = (v ?? "").toString().trim();
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return admin.firestore.Timestamp.fromDate(d);
}

function normalizeAvailabilityStatus(v) {
    const s = (v ?? "").toString().trim().toLowerCase();
    if (!s) return null;
    if (["available", "listed", "in_stock", "in-stock", "live"].includes(s)) {
        return "available";
    }
    if (
        [
            "possibly_unavailable",
            "possibly-unavailable",
            "possibly unavailable",
            "out_of_stock",
            "out-of-stock",
            "out of stock",
            "temporarily_unavailable",
            "temporarily-unavailable",
            "temporarily unavailable",
        ].includes(s)
    ) {
        return "possibly_unavailable";
    }
    if (["discontinued", "retired", "archived", "removed"].includes(s)) {
        return "discontinued";
    }
    if (["unknown", "unverified"].includes(s)) {
        return "unknown";
    }
    return null;
}

function normalizeProductType(v) {
    const s = (v ?? "").toString().trim().toLowerCase();
    if (!s) return null;
    if (s.includes("flower")) return "flower";
    if (s.includes("vape") || s.includes("cart")) return "vape";
    if (s.includes("oil") || s.includes("tinct") || s.includes("sublingual")) {
        return "oil";
    }
    if (s.includes("edible") || s.includes("gummy")) return "edible";
    if (s.includes("topical") || s.includes("cream")) return "topical";
    return null;
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

function buildCatalogueSource(row) {
    const sourceName = toNullIfBlank(row.sourceName);
    const sourceUrl = toNullIfBlank(row.sourceUrl);
    const sourceType = toNullIfBlank(row.sourceType);
    const sourceCheckedAt = parseDateToTimestamp(row.sourceCheckedAt);
    const sourceNotes = toNullIfBlank(row.sourceNotes);
    const sourceLicense = toNullIfBlank(row.sourceLicense);

    if (!sourceName && !sourceUrl && !sourceType && !sourceCheckedAt && !sourceNotes && !sourceLicense) {
        return null;
    }

    const source = {};
    if (sourceName) source.name = sourceName;
    if (sourceUrl) source.url = sourceUrl;
    if (sourceType) source.type = sourceType;
    if (sourceCheckedAt) source.checkedAt = sourceCheckedAt;
    if (sourceNotes) source.notes = sourceNotes;
    if (sourceLicense) source.license = sourceLicense;
    return source;
}

function buildAvailabilityReview(row) {
    const status = normalizeAvailabilityStatus(row.availabilityStatus);
    const confidence = toNullIfBlank(row.availabilityConfidence);
    const checkedAt = parseDateToTimestamp(row.availabilityCheckedAt);
    const sourceName = toNullIfBlank(row.availabilitySourceName);
    const sourceUrl = toNullIfBlank(row.availabilitySourceUrl);
    const notes = toNullIfBlank(row.availabilityNotes);
    const signals = parsePipeList(row.availabilitySignals);

    if (!status && !confidence && !checkedAt && !sourceName && !sourceUrl && !notes && !signals) {
        return null;
    }

    const review = {
        status: status ?? "unknown",
    };
    if (confidence) review.confidence = confidence;
    if (checkedAt) review.checkedAt = checkedAt;
    if (sourceName) review.sourceName = sourceName;
    if (sourceUrl) review.sourceUrl = sourceUrl;
    if (notes) review.notes = notes;
    if (signals) review.signals = signals;
    return review;
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
        relax_column_count: true,
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

            const legacyType = toNullIfBlank(row.type);
            const productType =
                normalizeProductType(row.productType) ??
                normalizeProductType(legacyType) ??
                "flower";
            const strainType =
                toNullIfBlank(row.strainType) ??
                (normalizeProductType(legacyType) ? null : legacyType);
            const availabilityReview = buildAvailabilityReview(row);

            const doc = {
                name: toNullIfBlank(row.name) ?? "",
                maker: toNullIfBlank(row.maker) ?? "",
                variant: toNullIfBlank(row.variant),
                productType,
                thcPct: toNumberOrNull(row.thcPct),
                cbdPct: toNumberOrNull(row.cbdPct),
                terpenes: toNullIfBlank(row.terpenes),
                genetics: toNullIfBlank(row.genetics),
                countryOfOrigin: toNullIfBlank(row.countryOfOrigin),
                irradiationStatus: toNullIfBlank(row.irradiationStatus),
                producerUseCases: parsePipeList(row.producerUseCases),
                producerNotes: toNullIfBlank(row.producerNotes),
                catalogueSource: buildCatalogueSource(row),
                factualDataDisclaimer:
                    "Product names and factual fields are compiled from publicly accessible sources where permitted. Reviews, ratings, tags, notes, and scoring are original or user-generated within Review Budz.",
                isActive: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (strainType) {
                doc.type = strainType;
            }
            if (availabilityReview) {
                doc.availabilityReview = availabilityReview;
                doc.availabilityStatus = availabilityReview.status;
                if (availabilityReview.checkedAt) {
                    doc.availabilityCheckedAt = availabilityReview.checkedAt;
                }
            }

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
