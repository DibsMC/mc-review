import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";

type UseReviewCountResult = {
    count: number;
    loading: boolean;
    error: string | null;
};

export function useReviewCount(uid: string | null | undefined): UseReviewCountResult {
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!uid) {
                setCount(0);
                setLoading(false);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Prefer users/{uid}.reviewCount if it exists
                const userSnap = await firestore().collection("users").doc(uid).get();
                const userData = userSnap.data() as { reviewCount?: unknown } | undefined;

                const stored = userData?.reviewCount;
                if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0) {
                    if (!cancelled) {
                        setCount(stored);
                        setLoading(false);
                    }
                    return;
                }

                // Fallback: count reviews where userId == uid (OK short-term)
                const reviewsSnap = await firestore()
                    .collection("reviews")
                    .where("userId", "==", uid)
                    .get();

                if (!cancelled) {
                    setCount(reviewsSnap.size);
                    setLoading(false);
                }
            } catch (e: any) {
                if (!cancelled) {
                    setCount(0);
                    setLoading(false);
                    setError(typeof e?.message === "string" ? e.message : "Failed to load review count");
                }
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [uid]);

    return { count, loading, error };
}
