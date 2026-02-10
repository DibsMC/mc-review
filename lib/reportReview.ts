import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

export type ReportReason = "spam" | "swearing" | "abuse" | "hate" | "other";

type ReportResult =
    | { ok: true; status: "reported" | "already_reported" }
    | { ok: false; error: string };

function getUid(): string | null {
    const u = auth().currentUser;
    return u?.uid ?? null;
}

function snapshotExists(snap: any): boolean {
    if (typeof snap?.exists === "boolean") return snap.exists;
    if (typeof snap?.exists === "function") return !!snap.exists();
    return false;
}

/**
 * Report a review (once per user)
 *
 * Writes:
 * - reviews/{reviewId}/reports/{uid}
 * Updates:
 * - reviews/{reviewId}.reportCount (+1)
 * - reviews/{reviewId}.hidden (true if >= 3)
 */
export async function reportReview(params: {
    reviewId: string;
    reason: ReportReason;
}): Promise<ReportResult> {
    const uid = getUid();
    if (!uid) return { ok: false, error: "You need to be signed in to report a review." };

    const reviewId = params.reviewId.trim();
    if (!reviewId) return { ok: false, error: "Missing review id." };

    try {
        const result = await firestore().runTransaction(async (tx) => {
            const reviewRef = firestore().collection("reviews").doc(reviewId);
            const reportRef = reviewRef.collection("reports").doc(uid);

            const reviewSnap = await tx.get(reviewRef);
            if (!snapshotExists(reviewSnap)) {
                throw new Error("That review no longer exists.");
            }

            const reviewData = reviewSnap.data() as any;

            // Block reporting your own review
            if (reviewData.userId === uid) {
                throw new Error("You can't report your own review.");
            }

            const reportSnap = await tx.get(reportRef);
            if (snapshotExists(reportSnap)) {
                return { status: "already_reported" as const };
            }

            const prevCount =
                typeof reviewData.reportCount === "number" ? reviewData.reportCount : 0;

            const nextCount = prevCount + 1;
            const shouldHide = nextCount >= 3;

            tx.set(reportRef, {
                reason: params.reason,
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            tx.update(reviewRef, {
                reportCount: nextCount,
                hidden: shouldHide,
                hiddenAt: shouldHide ? firestore.FieldValue.serverTimestamp() : null,
                updatedAt: firestore.FieldValue.serverTimestamp(),
            });

            return { status: "reported" as const };
        });

        return { ok: true, status: result.status };
    } catch (e: any) {
        return { ok: false, error: e?.message || "Failed to report review." };
    }
}
