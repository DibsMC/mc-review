const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

console.log("Starting flower import...");

const serviceAccount = require("./serviceAccountKey.json");
const flowers = JSON.parse(
    fs.readFileSync(path.join(__dirname, "flowers_seed.json"), "utf8")
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

(async function run() {
    console.log(`Loaded ${flowers.length} flowers`);

    for (const f of flowers) {
        console.log("Importing:", f.id);

        await db.collection("flowers").doc(f.id).set(
            {
                name: f.name ?? f.id,
                brand: f.brand ?? null,
                type: f.type ?? null,
                productType: "flower",

                thcPct: f.thcPct ?? null,
                cbdPct: f.cbdPct ?? null,
                priceGBP: f.priceGBP ?? null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }

    console.log("✅ Flower import complete");
    process.exit(0);
})().catch((err) => {
    console.error("❌ Import failed:", err);
    process.exit(1);
});
