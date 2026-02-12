/* scripts/purgeCommunityData.js
   Purges community/user-generated Firestore data while keeping Firebase Auth accounts.

   What it removes:
   - reviews
   - reviewReports
   - badgeAwards
   - reviewHelpfulVotes (legacy if present)
   - users/*/favorites
   - users/*/favourites
   - users/*/helpful
   - users/*/reportedReviews

   What it resets on users docs:
   - favoriteProductIds / favouriteProductIds
   - favorites / favourites
   - displayName / avatarId / photoURL / bio

   Usage:
     node scripts/purgeCommunityData.js --confirm
*/

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("Missing serviceAccountKey.json. Put it at scripts/serviceAccountKey.json");
  process.exit(1);
}

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm");
  console.error("Run: node scripts/purgeCommunityData.js --confirm");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

async function deleteByQuery(query, label) {
  let total = 0;
  while (true) {
    const snap = await query.limit(300).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    total += snap.size;
    console.log(`${label}: deleted ${total}`);
    if (snap.size < 300) break;
  }
  return total;
}

async function resetUsers() {
  let total = 0;
  const fieldDelete = admin.firestore.FieldValue.delete();
  let cursor = null;

  while (true) {
    let query = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          favoriteProductIds: fieldDelete,
          favouriteProductIds: fieldDelete,
          favorites: fieldDelete,
          favourites: fieldDelete,
          displayName: fieldDelete,
          avatarId: fieldDelete,
          photoURL: fieldDelete,
          bio: fieldDelete,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    total += snap.size;
    console.log(`users: reset ${total}`);

    if (snap.size < 300) break;
    cursor = snap.docs[snap.docs.length - 1].id;
  }
}

async function main() {
  console.log("Starting Firestore purge...");

  await deleteByQuery(db.collection("reviews"), "reviews");
  await deleteByQuery(db.collection("reviewReports"), "reviewReports");
  await deleteByQuery(db.collection("badgeAwards"), "badgeAwards");
  await deleteByQuery(db.collection("reviewHelpfulVotes"), "reviewHelpfulVotes");

  await deleteByQuery(db.collectionGroup("favorites"), "users/*/favorites");
  await deleteByQuery(db.collectionGroup("favourites"), "users/*/favourites");
  await deleteByQuery(db.collectionGroup("helpful"), "users/*/helpful");
  await deleteByQuery(db.collectionGroup("reportedReviews"), "users/*/reportedReviews");

  await resetUsers();

  console.log("Purge complete. Firebase Auth accounts were not deleted.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Purge failed:", e);
  process.exit(1);
});
