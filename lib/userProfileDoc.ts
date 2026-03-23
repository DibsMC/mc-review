import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

type EnsureUserProfileDocOptions = {
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    emailVerified?: boolean | null;
    touchLastActive?: boolean;
    touchLastOpened?: boolean;
    markUpdated?: boolean;
    isNewAccount?: boolean;
    extra?: Record<string, unknown>;
};

function cleanString(value: string | null | undefined) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function guessDisplayName(email?: string | null, displayName?: string | null) {
    const explicit = cleanString(displayName);
    if (explicit) return explicit;

    const normalizedEmail = cleanString(email)?.toLowerCase() ?? "";
    const localPart = normalizedEmail.split("@")[0]?.trim();
    return localPart || "Member";
}

function compactObject(input: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function buildOwnUserDocCreatePayload(options: {
    email?: string | null;
    displayName?: string | null;
    emailVerified?: boolean | null;
    extra?: Record<string, unknown>;
}) {
    const email = cleanString(options.email)?.toLowerCase() ?? null;
    const explicitDisplayName = cleanString(options.displayName);
    const displayName = guessDisplayName(email, explicitDisplayName);
    const nowMs = Date.now();

    return compactObject({
        isAdmin: false,
        isModerator: false,
        accountDisabled: false,
        reviewRestrictionLevel: null,
        reviewRestrictionUntilMs: null,
        reviewRestrictionManual: null,
        lastEscalationRemovedTotal: null,
        helpfulCount: 0,
        helpfulGiven: 0,
        followerCount: 0,
        followingCount: 0,
        appOpenCount: 0,
        sessionCount: 0,
        favoriteProductIds: [],
        email,
        displayName,
        emailVerified: options.emailVerified ?? false,
        createdAtMs: nowMs,
        lastAuthSyncAtMs: nowMs,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        ...(options.extra ?? {}),
    });
}

export async function ensureUserProfileDoc(options: EnsureUserProfileDocOptions = {}) {
    const currentUser = auth().currentUser;
    const uid = options.uid ?? currentUser?.uid ?? null;
    if (!uid) return;

    const email = cleanString(options.email ?? currentUser?.email ?? null)?.toLowerCase() ?? null;
    const explicitDisplayName = cleanString(options.displayName ?? currentUser?.displayName ?? null);
    const displayName = guessDisplayName(email, explicitDisplayName);
    const userRef = firestore().collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists()) {
        const createPayload = buildOwnUserDocCreatePayload({
            email,
            displayName,
            emailVerified: options.emailVerified ?? currentUser?.emailVerified ?? false,
            extra: options.extra,
        });

        await userRef.set(createPayload, { merge: false });
        return;
    }

    const data = (snap.data() as Record<string, unknown> | undefined) ?? {};
    const needsHydration =
        typeof data.email !== "string" ||
        !String(data.email).trim() ||
        typeof data.displayName !== "string" ||
        !String(data.displayName).trim() ||
        typeof data.emailVerified !== "boolean";

    if (needsHydration) {
        await userRef.set(
            compactObject({
                email,
                displayName,
                emailVerified: options.emailVerified ?? currentUser?.emailVerified ?? false,
                updatedAt: firestore.FieldValue.serverTimestamp(),
                lastAuthSyncAtMs: Date.now(),
            }),
            { merge: true }
        );
    }
}

export async function upsertOwnUserDocFields(options: {
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    emailVerified?: boolean | null;
    fields: Record<string, unknown>;
}) {
    const currentUser = auth().currentUser;
    const uid = options.uid ?? currentUser?.uid ?? null;
    if (!uid) return;

    const email = cleanString(options.email ?? currentUser?.email ?? null)?.toLowerCase() ?? null;
    const explicitDisplayName = cleanString(options.displayName ?? currentUser?.displayName ?? null);
    const displayName = guessDisplayName(email, explicitDisplayName);
    const userRef = firestore().collection("users").doc(uid);
    const nowMs = Date.now();
    const snap = await userRef.get();

    if (snap.exists()) {
        await userRef.set(
            compactObject({
                ...options.fields,
                updatedAt: firestore.FieldValue.serverTimestamp(),
                lastAuthSyncAtMs: nowMs,
                email,
                displayName,
                emailVerified: options.emailVerified ?? currentUser?.emailVerified ?? false,
            }),
            { merge: true }
        );
        return;
    }

    const createPayload = buildOwnUserDocCreatePayload({
        email,
        displayName,
        emailVerified: options.emailVerified ?? currentUser?.emailVerified ?? false,
        extra: {
            ...options.fields,
            lastAuthSyncAtMs: nowMs,
        },
    });

    await userRef.set(createPayload, { merge: false });
}
