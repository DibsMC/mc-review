const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function run() {
  const snap = await db.collection("products").get();
  console.log("Products found:", snap.size);

  let updated = 0;
  let skipped = 0;

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};

    if (typeof data.productType === "string" && data.productType.trim()) {
      skipped++;
      continue;
    }

    batch.update(doc.ref, { productType: "flower" });
    updated++;
    batchCount++;

    // Firestore batch limit is 500 ops. Keep it safe at 450.
    if (batchCount >= 450) {
      await batch.commit();
      console.log("Committed batch of", batchCount);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log("Committed final batch of", batchCount);
  }

  console.log("Done.");
  console.log("Updated:", updated);
  console.log("Skipped (already set):", skipped);
}

run().catch((e) => {
  console.error("Patch failed:", e);
  process.exit(1);
});
