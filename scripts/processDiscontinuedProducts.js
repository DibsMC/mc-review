/* scripts/processDiscontinuedProducts.js
   Usage:
     node scripts/processDiscontinuedProducts.js --dry-run <productId> [<productId>...]
     node scripts/processDiscontinuedProducts.js <productId> [<productId>...]

   Behavior:
     - if a product has active reviews, keep it and mark it discontinued
     - if a product has no active reviews, delete it from products
*/

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

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

async function activeReviewCount(productId) {
  const snap = await db.collection("reviews").where("productId", "==", productId).get();
  let count = 0;
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (data.authorDeleted === true) return;
    if (data.moderationStatus === "removed_admin" || data.moderationStatus === "removed_auto") return;
    count += 1;
  });
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ids = args.filter((arg) => arg !== "--dry-run");

  if (!ids.length) {
    console.error("Usage: node scripts/processDiscontinuedProducts.js [--dry-run] <productId> [<productId>...]");
    process.exit(1);
  }

  const results = [];

  for (const id of ids) {
    const reviewCount = await activeReviewCount(id);
    if (reviewCount > 0) {
      const payload = {
        availabilityStatus: "discontinued",
        availabilityCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        availabilityReview: {
          status: "discontinued",
          confidence: "high",
          checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          sourceName: "Legacy catalogue audit",
          notes: "Marked discontinued during legacy catalogue cleanup because the product appeared on the discontinued audit list, but it was retained because community reviews still exist.",
          signals: ["legacy-discontinued-audit-list", "reviewed-product-retained"],
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!dryRun) {
        await db.collection("products").doc(id).set(payload, { merge: true });
      }
      results.push({ id, action: "marked_discontinued", reviewCount });
    } else {
      if (!dryRun) {
        await db.collection("products").doc(id).delete();
      }
      results.push({ id, action: "deleted", reviewCount });
    }
  }

  console.log(JSON.stringify({ dryRun, results }, null, 2));
}

main().catch((error) => {
  console.error("Process failed:", error);
  process.exit(1);
});
