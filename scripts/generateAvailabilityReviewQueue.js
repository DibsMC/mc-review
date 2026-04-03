/* scripts/generateAvailabilityReviewQueue.js
   Usage:
     node scripts/generateAvailabilityReviewQueue.js
     node scripts/generateAvailabilityReviewQueue.js data/live_products_catalogue.csv data/live_availability_review_queue.csv
*/

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function csvEscape(value) {
  const s = (value ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toTimestamp(value) {
  const s = (value ?? "").toString().trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function shouldReview(row, staleAfterDays) {
  const status = `${row.availabilityStatus ?? ""}`.trim();
  const checkedAtMs = toTimestamp(row.availabilityCheckedAt);
  if (!status || !checkedAtMs) return true;
  const ageMs = Date.now() - checkedAtMs;
  return ageMs >= staleAfterDays * 24 * 60 * 60 * 1000;
}

function main() {
  const inputArg = process.argv[2] || "data/live_products_catalogue.csv";
  const outputArg = process.argv[3] || "data/live_availability_review_queue.csv";
  const staleAfterDays = Number(process.argv[4] || "10");

  const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(process.cwd(), inputArg);
  const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(process.cwd(), outputArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input CSV not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const headers = [
    "id",
    "name",
    "maker",
    "variant",
    "productType",
    "strainType",
    "thcPct",
    "cbdPct",
    "availabilityStatus",
    "availabilityConfidence",
    "availabilityCheckedAt",
    "availabilitySourceName",
    "availabilitySourceUrl",
    "availabilityNotes",
    "availabilitySignals",
    "reviewAction",
  ];

  const queueRows = rows
    .filter((row) => shouldReview(row, staleAfterDays))
    .sort((a, b) => {
      const makerDiff = `${a.maker ?? ""}`.localeCompare(`${b.maker ?? ""}`, "en-GB");
      if (makerDiff !== 0) return makerDiff;
      return `${a.name ?? ""}`.localeCompare(`${b.name ?? ""}`, "en-GB");
    });

  const lines = [
    headers.join(","),
    ...queueRows.map((row) =>
      headers
        .map((header) => {
          if (header === "reviewAction") {
            return csvEscape(
              "Check approved public manufacturer, grower, or pharmacy pages and set available, possibly_unavailable, discontinued, or unknown."
            );
          }
          if (header === "availabilityNotes") {
            return csvEscape(
              row.availabilityNotes ||
                "Prefer explicit producer or public pharmacy wording. Only mark discontinued when a public source clearly states it."
            );
          }
          return csvEscape(row[header] ?? "");
        })
        .join(",")
    ),
  ];

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${queueRows.length} rows to ${outputPath}`);
}

main();
