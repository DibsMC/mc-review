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

async function main() {
  const ids = process.argv.slice(2).filter(Boolean);
  if (!ids.length) {
    console.error("Usage: node scripts/deleteProductsById.js <productId> [<productId>...]");
    process.exit(1);
  }

  let deleted = 0;
  for (const id of ids) {
    await db.collection("products").doc(id).delete();
    deleted += 1;
    console.log(`Deleted ${id} (${deleted}/${ids.length})`);
  }
  console.log(`Deleted ${deleted} product docs.`);
}

main().catch((error) => {
  console.error("Delete failed:", error);
  process.exit(1);
});
