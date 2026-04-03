/* scripts/generateTerpeneEnrichmentWorklist.js
   Usage:
     node scripts/generateTerpeneEnrichmentWorklist.js
     node scripts/generateTerpeneEnrichmentWorklist.js data/flowers_master.csv data/terpene_enrichment_worklist.csv
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

function main() {
  const inputArg = process.argv[2] || "data/flowers_master.csv";
  const outputArg = process.argv[3] || "data/terpene_enrichment_worklist.csv";

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
  ];

  const worklistRows = rows.filter((row) => !`${row.terpenes ?? ""}`.trim());
  const lines = [
    headers.join(","),
    ...worklistRows.map((row) =>
      headers
        .map((header) => {
          if (header === "sourceNotes") {
            return csvEscape(
              row.sourceNotes ||
                "Use only publicly accessible manufacturer, grower, or pharmacy pages where reuse is permitted. Do not copy editorial prose or images."
            );
          }
          return csvEscape(row[header] ?? "");
        })
        .join(",")
    ),
  ];

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${worklistRows.length} rows to ${outputPath}`);
}

main();
