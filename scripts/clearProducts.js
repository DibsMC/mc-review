// scripts/clearProducts.js
// Usage:
//   node scripts/clearProducts.js --dry-run
//   node scripts/clearProducts.js

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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const col = db.collection("products");
  const pageSize = 400;

  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = col.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    if (dryRun) {
      total += snap.size;
      console.log(`Would delete ${snap.size} docs (running total ${total})`);
    } else {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
      console.log(`Deleted ${snap.size} docs (running total ${total})`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`${dryRun ? "DRY RUN" : "DONE"}: ${dryRun ? "Would delete" : "Deleted"} ${total} docs from products.`);
}

main().catch((e) => {
  console.error("Clear failed:", e);
  process.exit(1);
});
