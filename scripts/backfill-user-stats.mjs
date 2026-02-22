#!/usr/bin/env node

import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "review-budz";
const dryRun = process.argv.includes("--dry-run");

function asNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ensureFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
  return admin.firestore();
}

async function main() {
  const db = ensureFirebaseAdmin();
  console.log(`Stats backfill start (project=${projectId}, dryRun=${dryRun})`);

  const [usersSnap, reviewsSnap, helpfulSnap, favoritesSnap, favouritesSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("reviews").get(),
    db.collectionGroup("helpful").get(),
    db.collectionGroup("favorites").get(),
    db.collectionGroup("favourites").get(),
  ]);

  const reviewsWrittenByUid = {};
  const helpfulReceivedByUid = {};

  reviewsSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const uid = typeof data.userId === "string" ? data.userId : "";
    if (!uid || uid.startsWith("deleted:")) return;

    reviewsWrittenByUid[uid] = (reviewsWrittenByUid[uid] || 0) + 1;
    helpfulReceivedByUid[uid] =
      (helpfulReceivedByUid[uid] || 0) + asNonNegativeNumber(data.helpfulCount);
  });

  const helpfulGivenByUid = {};
  helpfulSnap.docs.forEach((doc) => {
    const uid = doc.ref.parent?.parent?.id || "";
    if (!uid) return;
    helpfulGivenByUid[uid] = (helpfulGivenByUid[uid] || 0) + 1;
  });

  const favoritesSetByUid = {};
  const addFavoriteDoc = (doc) => {
    const uid = doc.ref.parent?.parent?.id || "";
    if (!uid) return;
    if (!favoritesSetByUid[uid]) favoritesSetByUid[uid] = new Set();
    favoritesSetByUid[uid].add(doc.id);
  };
  favoritesSnap.docs.forEach(addFavoriteDoc);
  favouritesSnap.docs.forEach(addFavoriteDoc);

  let docsScanned = 0;
  let docsUpdated = 0;
  let reviewsWrittenTotal = 0;
  let helpfulReceivedTotal = 0;
  let helpfulGivenTotal = 0;
  let favoritesTotal = 0;

  const nowMs = Date.now();
  const updates = [];

  usersSnap.docs.forEach((doc) => {
    docsScanned += 1;
    const data = doc.data() || {};
    const uid = doc.id;

    const reviewsWritten = Math.max(
      reviewsWrittenByUid[uid] || 0,
      asNonNegativeNumber(data.reviewsWritten),
      asNonNegativeNumber(data.reviewCount)
    );

    const helpfulReceived = Math.max(
      helpfulReceivedByUid[uid] || 0,
      asNonNegativeNumber(data.helpfulReceived)
    );

    const helpfulGiven = Math.max(
      helpfulGivenByUid[uid] || 0,
      asNonNegativeNumber(data.helpfulGiven)
    );

    const favoriteIdsLength = Array.isArray(data.favoriteProductIds) ? data.favoriteProductIds.length : 0;
    const favoritesCount = Math.max(
      favoritesSetByUid[uid] ? favoritesSetByUid[uid].size : 0,
      favoriteIdsLength,
      asNonNegativeNumber(data.favoritesCount),
      asNonNegativeNumber(data.favouritesCount)
    );

    const changed =
      asNonNegativeNumber(data.reviewsWritten) !== reviewsWritten ||
      asNonNegativeNumber(data.helpfulReceived) !== helpfulReceived ||
      asNonNegativeNumber(data.helpfulGiven) !== helpfulGiven ||
      asNonNegativeNumber(data.favoritesCount) !== favoritesCount;

    if (!changed) return;

    reviewsWrittenTotal += reviewsWritten;
    helpfulReceivedTotal += helpfulReceived;
    helpfulGivenTotal += helpfulGiven;
    favoritesTotal += favoritesCount;

    updates.push({
      ref: doc.ref,
      patch: {
        reviewsWritten,
        helpfulReceived,
        helpfulGiven,
        favoritesCount,
        statsBackfilledAtMs: nowMs,
        statsBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  });

  docsUpdated = updates.length;

  if (!dryRun && updates.length) {
    const batches = chunk(updates, 400);
    for (const group of batches) {
      const batch = db.batch();
      group.forEach(({ ref, patch }) => batch.set(ref, patch, { merge: true }));
      await batch.commit();
    }
  }

  console.log("Stats backfill done");
  console.log(
    JSON.stringify(
      {
        docsScanned,
        docsUpdated,
        reviewsWrittenTotal,
        helpfulReceivedTotal,
        helpfulGivenTotal,
        favoritesTotal,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Stats backfill failed", err?.message || err);
  process.exitCode = 1;
});

