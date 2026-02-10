// hooks/useProfileStats.ts
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

type ProfileStats = {
    reviewCount: number;
    helpfulGiven: number;
    helpfulReceived: number;
    loading: boolean;
    error: string | null;
};

export function useProfileStats(uid: string | null | undefined): ProfileStats {
    const safeUid = typeof uid === "string" && uid.trim() ? uid.trim() : "";

    const [reviewCount, setReviewCount] = useState(0);
    const [helpfulGiven, setHelpfulGiven] = useState(0);
    const [helpfulReceived, setHelpfulReceived] = useState(0);

    const [loadingA, setLoadingA] = useState(true);
    const [loadingB, setLoadingB] = useState(true);
    const [loadingC, setLoadingC] = useState(true);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setReviewCount(0);
        setHelpfulGiven(0);
        setHelpfulReceived(0);
        setError(null);

        if (!safeUid) {
            setLoadingA(false);
            setLoadingB(false);
            setLoadingC(false);
            return;
        }

        // A) Reviews written (count)
        setLoadingA(true);
        const unsubReviews = firestore()
            .collection("reviews")
            .where("userId", "==", safeUid)
            .onSnapshot(
                (snap) => {
                    setReviewCount(snap.size);

                    // Helpful received (sum helpfulCount across those reviews)
                    let sum = 0;
                    snap.docs.forEach((d) => {
                        const data = d.data() as any;
                        const n = typeof data?.helpfulCount === "number" ? data.helpfulCount : 0;
                        if (Number.isFinite(n) && n > 0) sum += n;
                    });
                    setHelpfulReceived(sum);

                    setLoadingA(false);
                    setLoadingC(false);
                },
                (e) => {
                    console.log("useProfileStats reviews listener error:", e);
                    setError(e?.message ?? "Failed to load reviews");
                    setLoadingA(false);
                    setLoadingC(false);
                }
            );

        // B) Helpful given (count of users/{uid}/helpful/*)
        setLoadingB(true);
        const unsubHelpful = firestore()
            .collection("users")
            .doc(safeUid)
            .collection("helpful")
            .onSnapshot(
                (snap) => {
                    setHelpfulGiven(snap.size);
                    setLoadingB(false);
                },
                (e) => {
                    console.log("useProfileStats helpful listener error:", e);
                    setError(e?.message ?? "Failed to load helpful votes");
                    setLoadingB(false);
                }
            );

        return () => {
            unsubReviews();
            unsubHelpful();
        };
    }, [safeUid]);

    const loading = useMemo(() => loadingA || loadingB || loadingC, [loadingA, loadingB, loadingC]);

    return { reviewCount, helpfulGiven, helpfulReceived, loading, error };
}
