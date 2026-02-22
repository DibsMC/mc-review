#!/usr/bin/env node

import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "review-budz";
const dryRun = process.argv.includes("--dry-run");

function toMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ensureFirebaseAdmin() {
  if (!admin.apps.length) {
    // Uses GOOGLE_APPLICATION_CREDENTIALS when present.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
  return {
    auth: admin.auth(),
    db: admin.firestore(),
  };
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken = undefined;
  do {
    // 1000 is Firebase Auth max page size.
    const res = await auth.listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const { auth, db } = ensureFirebaseAdmin();

  console.log(`Backfill start (project=${projectId}, dryRun=${dryRun})`);
  const authUsers = await listAllAuthUsers(auth);
  console.log(`Auth users fetched: ${authUsers.length}`);

  let docsTouched = 0;
  let emailsWritten = 0;
  let docsCreated = 0;
  let disabledSynced = 0;
  let errors = 0;

  const batches = chunk(authUsers, 200);

  for (const group of batches) {
    const refs = group.map((u) => db.collection("users").doc(u.uid));
    const snaps = await db.getAll(...refs);
    const snapById = new Map(snaps.map((s) => [s.id, s]));

    const writeBatch = db.batch();
    let pendingWrites = 0;

    for (const user of group) {
      try {
        const ref = db.collection("users").doc(user.uid);
        const snap = snapById.get(user.uid);
        const exists = !!snap?.exists;
        const data = (snap?.data() || {});

        const email = normalizeEmail(user.email);
        const patch = {
          email: email || data.email || "",
          emailVerified: !!user.emailVerified,
          accountDisabled: !!user.disabled,
          // Keep existing displayName unless blank.
          displayName:
            (typeof data.displayName === "string" && data.displayName.trim()) ||
            (typeof user.displayName === "string" && user.displayName.trim()) ||
            "New Member",
          isAdmin: !!data.isAdmin,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAuthSyncAtMs: Date.now(),
          createdAtMs:
            (typeof data.createdAtMs === "number" && data.createdAtMs) ||
            toMs(user.metadata?.creationTime) ||
            null,
          lastSignInAtMs: toMs(user.metadata?.lastSignInTime),
        };

        // If there is no email in Auth and no email in doc, don't force empty.
        if (!email && !data.email) {
          delete patch.email;
        }

        if (!exists) {
          patch.createdAt = admin.firestore.FieldValue.serverTimestamp();
          docsCreated += 1;
        }

        if (!dryRun) {
          writeBatch.set(ref, patch, { merge: true });
          pendingWrites += 1;
        }

        docsTouched += 1;
        if (email) emailsWritten += 1;
        if (user.disabled) disabledSynced += 1;
      } catch (err) {
        errors += 1;
        console.error(`Failed processing uid=${user.uid}`, err?.message || err);
      }
    }

    if (!dryRun && pendingWrites > 0) {
      await writeBatch.commit();
    }
  }

  console.log("Backfill done");
  console.log(
    JSON.stringify(
      {
        docsTouched,
        emailsWritten,
        docsCreated,
        disabledSynced,
        errors,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Backfill failed", err?.message || err);
  process.exitCode = 1;
});

