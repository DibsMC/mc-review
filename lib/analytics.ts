import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { Platform } from "react-native";
import { ensureUserProfileDoc } from "./userProfileDoc";

const VISIT_COUNT_KEY = "@review_budz/visit_count";
const LAST_VISIT_AT_KEY = "@review_budz/last_visit_at";
const DAY_MS = 24 * 60 * 60 * 1000;
const PRESENCE_THROTTLE_MS = 60 * 1000;

let lastPresenceWriteAt = 0;
let lastSessionUid: string | null = null;

type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsValue = AnalyticsPrimitive | AnalyticsPrimitive[];
type AnalyticsParams = Record<string, AnalyticsValue | undefined>;

function sanitizeEventName(name: string) {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function sanitizeParams(params: AnalyticsParams = {}) {
    const entries = Object.entries(params).flatMap(([key, value]) => {
        if (value === undefined) return [];

        if (Array.isArray(value)) {
            const clean = value.filter(
                (item): item is AnalyticsPrimitive => item !== undefined
            );
            return [[key, clean]];
        }

        return [[key, value]];
    });

    return Object.fromEntries(entries);
}

async function writeEvent(name: string, params: AnalyticsParams = {}) {
    try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;
        await ensureUserProfileDoc({
            uid,
            email: auth().currentUser?.email ?? null,
            displayName: auth().currentUser?.displayName ?? null,
            touchLastActive: true,
        });

        const eventName = sanitizeEventName(name);
        await firestore().collection("users").doc(uid).set(
            {
                analytics: {
                    lastEventName: name,
                    lastEventParams: sanitizeParams(params),
                    lastEventPlatform: Platform.OS,
                    lastEventAt: firestore.FieldValue.serverTimestamp(),
                },
                [`analyticsEventCounts.${eventName}`]: firestore.FieldValue.increment(1),
            },
            { merge: true }
        );
    } catch (error) {
        console.log("analytics write failed:", error);
    }
}

export async function trackEvent(name: string, params: AnalyticsParams = {}) {
    await writeEvent(name, params);
}

export async function recordUserSessionStart() {
    try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;
        if (lastSessionUid === uid) return;
        lastSessionUid = uid;
        await ensureUserProfileDoc({
            uid,
            email: auth().currentUser?.email ?? null,
            displayName: auth().currentUser?.displayName ?? null,
            touchLastActive: true,
            touchLastOpened: true,
        });

        await firestore().collection("users").doc(uid).set(
            {
                sessionCount: firestore.FieldValue.increment(1),
                lastSessionStartedAt: firestore.FieldValue.serverTimestamp(),
                lastOpenedAt: firestore.FieldValue.serverTimestamp(),
                lastActiveAt: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        await writeEvent("session_start", {
            platform: Platform.OS,
        });
    } catch (error) {
        console.log("session start failed:", error);
    }
}

export async function recordAppPresence(reason: string = "heartbeat") {
    try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;

        const now = Date.now();
        if (reason === "heartbeat" && now - lastPresenceWriteAt < PRESENCE_THROTTLE_MS) {
            return;
        }
        lastPresenceWriteAt = now;
        await ensureUserProfileDoc({
            uid,
            email: auth().currentUser?.email ?? null,
            displayName: auth().currentUser?.displayName ?? null,
            touchLastActive: true,
        });

        await firestore().collection("users").doc(uid).set(
            {
                lastActiveAt: firestore.FieldValue.serverTimestamp(),
                analytics: {
                    lastPresenceReason: reason,
                    lastPresencePlatform: Platform.OS,
                    lastPresenceAt: firestore.FieldValue.serverTimestamp(),
                },
            },
            { merge: true }
        );
    } catch (error) {
        console.log("presence write failed:", error);
    }
}

export async function recordAppOpen() {
    try {
        const pairs = await AsyncStorage.multiGet([VISIT_COUNT_KEY, LAST_VISIT_AT_KEY]);
        const countRaw = pairs[0]?.[1] ?? "0";
        const lastVisitRaw = pairs[1]?.[1] ?? "";

        const nextCount = Math.max(0, Number(countRaw) || 0) + 1;
        const lastVisitAt = Number(lastVisitRaw);
        const daysSinceLastVisit =
            Number.isFinite(lastVisitAt) && lastVisitAt > 0
                ? Math.round(((Date.now() - lastVisitAt) / DAY_MS) * 10) / 10
                : null;

        await AsyncStorage.multiSet([
            [VISIT_COUNT_KEY, String(nextCount)],
            [LAST_VISIT_AT_KEY, String(Date.now())],
        ]);

        const uid = auth().currentUser?.uid;
        if (uid) {
            await ensureUserProfileDoc({
                uid,
                email: auth().currentUser?.email ?? null,
                displayName: auth().currentUser?.displayName ?? null,
                touchLastActive: true,
                touchLastOpened: true,
            });
            await firestore().collection("users").doc(uid).set(
                {
                    appOpenCount: nextCount,
                    daysSinceLastVisit,
                    lastActiveAt: firestore.FieldValue.serverTimestamp(),
                    lastOpenedAt: firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        }

        await writeEvent("app_open", {
            open_count: nextCount,
            days_since_last_visit: daysSinceLastVisit,
        });

        return { openCount: nextCount, daysSinceLastVisit };
    } catch (error) {
        console.log("record app open failed:", error);
        return { openCount: null, daysSinceLastVisit: null };
    }
}
