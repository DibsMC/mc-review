import type { View as RNView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { theme } from "../../../lib/theme";

const budImg = require("../../../assets/icons/bud.png");

type Product = {
    id: string;
    name: string;
    maker: string;
    variant?: string | null;
    type: string;
    thcPct?: number | null;
    cbdPct?: number | null;
};

type Review = {
    id: string;
    productId: string;
    userId: string;

    rating: number;
    score?: number | null;

    text?: string | null;
    createdAt?: any;

    sleepy?: number | null;
    calm?: number | null;
    daytime?: number | null;
    clarity?: number | null;
};

type UserProfile = {
    displayName?: string | null;
};

type SortMode = "recent" | "high" | "low";

function formatPct(n: number | null | undefined) {
    if (n === null || n === undefined) return "-";
    return `${n}%`;
}

function safeName(v: any) {
    return typeof v === "string" && v.trim() ? v.trim() : "";
}

function getCreatedAtMs(r: Review) {
    const c = (r as any).createdAt;
    if (!c) return 0;
    if (typeof c?.toMillis === "function") return c.toMillis();
    if (typeof c?.seconds === "number") return c.seconds * 1000;
    if (typeof c === "number") return c;
    return 0;
}

function round1(n: number) {
    return Math.round(n * 10) / 10;
}

function avgNumbers(vals: Array<number | null | undefined>) {
    const xs = vals.filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v)
    );
    if (xs.length === 0) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// 75% overall rating, 25% effects average (only if any effects exist)
function computeHeadlineScore(input: {
    rating: number;
    daytime?: number | null;
    sleepy?: number | null;
    calm?: number | null;
    clarity?: number | null;
}) {
    const rating = Number.isFinite(input.rating) ? input.rating : 0;
    const effects = avgNumbers([
        input.daytime,
        input.sleepy,
        input.calm,
        input.clarity,
    ]);
    if (!effects) return round1(rating);
    return round1(rating * 0.75 + effects * 0.25);
}

// Bud rating with partial fill + theme tint (no white boxes)
function BudRating({
    value,
    size = 18,
}: {
    value: number;
    size?: number;
}) {
    const safe = Number.isFinite(value)
        ? Math.max(0, Math.min(5, value))
        : 0;

    const filledTint = theme.colors.budFilled;
    const emptyTint = theme.colors.budEmpty;

    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const rawFill = Math.max(0, Math.min(1, safe - i));
                const fill = Math.round(rawFill * 10) / 10;
                const px = Math.round(size * fill);

                return (
                    <View
                        key={`bud-${i}`}
                        style={{
                            width: size,
                            height: size,
                            marginRight: i === 4 ? 0 : 6,
                        }}
                    >
                        {/* empty bud */}
                        <Image
                            source={budImg}
                            resizeMode="contain"
                            style={{
                                width: size,
                                height: size,
                            }}
                        />

                        {/* filled portion */}
                        {fill > 0 && (
                            <View
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: px,
                                    height: size,
                                    overflow: "hidden",
                                }}
                            >
                                <Image
                                    source={budImg}
                                    resizeMode="contain"
                                    style={{
                                        width: size,
                                        height: size,
                                    }}
                                />
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
}


function RatingRow({
    label,
    value,
    onChange,
    disabled,
}: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    disabled: boolean;
}) {
    return (
        <View style={{ marginTop: 10 }}>
            <Text style={{ marginBottom: 6, color: theme.colors.textOnLightSecondary }}>
                {label}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                        key={`${label}-${n}`}
                        onPress={() => {
                            if (disabled) return;
                            onChange(n);
                        }}
                        disabled={disabled}
                        style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor:
                                value === n
                                    ? "rgba(0,0,0,0.85)"
                                    : "rgba(0,0,0,0.12)",
                            backgroundColor:
                                value === n ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)",
                            opacity: disabled ? 0.6 : 1,
                            marginRight: 8,
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                color: value === n ? "#fff" : "rgba(0,0,0,0.9)",
                                fontWeight: "800",
                            }}
                        >
                            {n}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

export default function FlowerDetail() {
    const router = useRouter();
    const { flowerId } = useLocalSearchParams<{ flowerId: string }>();
    const productId = typeof flowerId === "string" ? flowerId : "";

    const [product, setProduct] = useState<Product | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    const [nameMap, setNameMap] = useState<Record<string, string>>({});

    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [sortOpen, setSortOpen] = useState(false);

    const sortBtnRef = useRef<RNView | null>(null);
    const [sortAnchor, setSortAnchor] = useState<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);

    const [reviewOpen, setReviewOpen] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

    const [rating, setRating] = useState<number>(5);
    const [text, setText] = useState<string>("");

    const [daytime, setDaytime] = useState<number>(3);
    const [sleepy, setSleepy] = useState<number>(3);
    const [calm, setCalm] = useState<number>(3);
    const [clarity, setClarity] = useState<number>(3);

    const [submitting, setSubmitting] = useState(false);

    const COOLDOWN_MS = 10_000;
    const [cooldownUntil, setCooldownUntil] = useState<number>(0);
    const [thankYouVisible, setThankYouVisible] = useState(false);
    const thankYouTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [nowTick, setNowTick] = useState(Date.now());
    const isCooldown = nowTick < cooldownUntil;

    const secondsLeft = useMemo(() => {
        if (!isCooldown) return 0;
        const msLeft = cooldownUntil - nowTick;
        return Math.max(1, Math.ceil(msLeft / 1000));
    }, [cooldownUntil, isCooldown, nowTick]);

    const currentUser = auth().currentUser;
    const currentUid = currentUser?.uid ?? "";
    const meName = safeName(currentUser?.displayName) || "You";

    const getReviewScore = (r: Review) => {
        if (typeof r.score === "number" && Number.isFinite(r.score)) return r.score;
        if (typeof r.rating === "number" && Number.isFinite(r.rating)) return r.rating;
        return 0;
    };

    const myLastReview = useMemo(() => {
        if (!currentUid) return null;
        const mine = reviews.filter((r) => r.userId === currentUid);
        if (mine.length === 0) return null;
        return [...mine].sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a))[0];
    }, [currentUid, reviews]);

    const avgOverall = useMemo(() => {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, r) => acc + getReviewScore(r), 0);
        return sum / reviews.length;
    }, [reviews]);

    const effectsSummary = useMemo(() => {
        const sleepyAvg = avgNumbers(reviews.map((r) => r.sleepy));
        const calmAvg = avgNumbers(reviews.map((r) => r.calm));
        const daytimeAvg = avgNumbers(reviews.map((r) => r.daytime));
        const clarityAvg = avgNumbers(reviews.map((r) => r.clarity));

        const withAnySub = reviews.filter(
            (r) =>
                typeof r.sleepy === "number" ||
                typeof r.calm === "number" ||
                typeof r.daytime === "number" ||
                typeof r.clarity === "number"
        ).length;

        return { sleepyAvg, calmAvg, daytimeAvg, clarityAvg, withAnySub };
    }, [reviews]);

    const sortedReviews = useMemo(() => {
        const list = [...reviews];

        if (sortMode === "recent")
            return list.sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));

        if (sortMode === "high") {
            return list.sort((a, b) => {
                const d = getReviewScore(b) - getReviewScore(a);
                if (d !== 0) return d;
                return getCreatedAtMs(b) - getCreatedAtMs(a);
            });
        }

        return list.sort((a, b) => {
            const d = getReviewScore(a) - getReviewScore(b);
            if (d !== 0) return d;
            return getCreatedAtMs(b) - getCreatedAtMs(a);
        });
    }, [reviews, sortMode]);

    useEffect(() => {
        return () => {
            if (thankYouTimer.current) clearTimeout(thankYouTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!isCooldown) return;
        const t = setInterval(() => setNowTick(Date.now()), 250);
        return () => clearInterval(t);
    }, [isCooldown]);

    useEffect(() => {
        if (!productId) return;

        setLoadingProduct(true);
        const unsub = firestore()
            .collection("products")
            .doc(productId)
            .onSnapshot(
                (doc) => {
                    if (!doc.exists) {
                        setProduct(null);
                        setLoadingProduct(false);
                        return;
                    }

                    const data = doc.data() as any;
                    setProduct({
                        id: doc.id,
                        name: typeof data?.name === "string" ? data.name : "",
                        maker: typeof data?.maker === "string" ? data.maker : "",
                        variant: data?.variant ?? null,
                        type: typeof data?.type === "string" ? data.type : "flower",
                        thcPct: typeof data?.thcPct === "number" ? data.thcPct : null,
                        cbdPct: typeof data?.cbdPct === "number" ? data.cbdPct : null,
                    });
                    setLoadingProduct(false);
                },
                (err) => {
                    console.log("product load error:", err);
                    setProduct(null);
                    setLoadingProduct(false);
                }
            );

        return () => unsub();
    }, [productId]);

    useEffect(() => {
        if (!productId) return;

        setLoadingReviews(true);
        const unsub = firestore()
            .collection("reviews")
            .where("productId", "==", productId)
            .orderBy("createdAt", "desc")
            .onSnapshot(
                (snapshot) => {
                    const list: Review[] = snapshot.docs.map((d) => {
                        const data = d.data() as any;

                        const ratingFromDb = typeof data.rating === "number" ? data.rating : 0;

                        const sleepyFromDb = typeof data.sleepy === "number" ? data.sleepy : null;
                        const calmFromDb = typeof data.calm === "number" ? data.calm : null;
                        const daytimeFromDb = typeof data.daytime === "number" ? data.daytime : null;
                        const clarityFromDb = typeof data.clarity === "number" ? data.clarity : null;

                        const scoreFromDb = typeof data.score === "number" ? data.score : null;

                        const computedScore = computeHeadlineScore({
                            rating: ratingFromDb,
                            daytime: daytimeFromDb,
                            sleepy: sleepyFromDb,
                            calm: calmFromDb,
                            clarity: clarityFromDb,
                        });

                        return {
                            id: d.id,
                            productId: typeof data.productId === "string" ? data.productId : "",
                            userId: typeof data.userId === "string" ? data.userId : "",
                            rating: ratingFromDb,
                            score: scoreFromDb ?? computedScore,
                            text: data.text ?? null,
                            createdAt: data.createdAt,
                            sleepy: sleepyFromDb,
                            calm: calmFromDb,
                            daytime: daytimeFromDb,
                            clarity: clarityFromDb,
                        };
                    });

                    setReviews(list);
                    setLoadingReviews(false);
                },
                (err) => {
                    console.log("reviews load error:", err);
                    setLoadingReviews(false);
                }
            );

        return () => unsub();
    }, [productId]);

    useEffect(() => {
        const uids = Array.from(new Set(reviews.map((r) => r.userId).filter(Boolean)));
        if (uids.length === 0) return;

        const missing = uids.filter((uid) => !nameMap[uid]);
        if (missing.length === 0) return;

        let cancelled = false;

        (async () => {
            try {
                const chunks: string[][] = [];
                for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));

                const updates: Record<string, string> = {};

                for (const chunk of chunks) {
                    const snap = await firestore()
                        .collection("users")
                        .where(firestore.FieldPath.documentId(), "in", chunk)
                        .get();

                    snap.docs.forEach((doc) => {
                        const data = doc.data() as UserProfile;
                        const dn = safeName(data?.displayName);
                        if (dn) updates[doc.id] = dn;
                    });
                }

                if (!cancelled && Object.keys(updates).length > 0) {
                    setNameMap((prev) => ({ ...prev, ...updates }));
                }
            } catch (e) {
                console.log("user name fetch error:", e);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviews]);

    const startCooldown = () => {
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        setNowTick(Date.now());

        setThankYouVisible(true);
        if (thankYouTimer.current) clearTimeout(thankYouTimer.current);

        thankYouTimer.current = setTimeout(() => {
            setThankYouVisible(false);
        }, COOLDOWN_MS);
    };

    const openWriteNewReview = () => {
        if (isCooldown) return;
        setEditingReviewId(null);
        setText("");
        setRating(5);
        setSleepy(3);
        setCalm(3);
        setDaytime(3);
        setClarity(3);
        setReviewOpen(true);
        setSortOpen(false);
    };

    const openEditLastReview = () => {
        if (isCooldown) return;

        if (!myLastReview) {
            openWriteNewReview();
            return;
        }

        setEditingReviewId(myLastReview.id);

        setRating(typeof myLastReview.rating === "number" ? myLastReview.rating : 5);
        setText(typeof myLastReview.text === "string" ? myLastReview.text : "");

        setDaytime(typeof myLastReview.daytime === "number" ? myLastReview.daytime : 3);
        setSleepy(typeof myLastReview.sleepy === "number" ? myLastReview.sleepy : 3);
        setCalm(typeof myLastReview.calm === "number" ? myLastReview.calm : 3);
        setClarity(typeof myLastReview.clarity === "number" ? myLastReview.clarity : 3);

        setReviewOpen(true);
        setSortOpen(false);
    };

    const submitReview = async () => {
        if (submitting || isCooldown) return;

        const user = auth().currentUser;
        if (!user) {
            Alert.alert("Not signed in", "Please sign in to leave a review.");
            return;
        }

        if (!productId) {
            Alert.alert("Missing product id", "Go back and open the product again.");
            return;
        }

        const ratingInt = parseInt(String(rating), 10);
        const sleepyInt = parseInt(String(sleepy), 10);
        const calmInt = parseInt(String(calm), 10);
        const daytimeInt = parseInt(String(daytime), 10);
        const clarityInt = parseInt(String(clarity), 10);

        if (!Number.isFinite(ratingInt) || ratingInt < 1 || ratingInt > 5) {
            Alert.alert("Rating must be 1 to 5");
            return;
        }

        const score = computeHeadlineScore({
            rating: ratingInt,
            daytime: daytimeInt,
            sleepy: sleepyInt,
            calm: calmInt,
            clarity: clarityInt,
        });

        setSubmitting(true);

        try {
            if (editingReviewId) {
                await firestore().collection("reviews").doc(editingReviewId).update({
                    rating: ratingInt,
                    score,
                    text: text.trim() ? text.trim() : null,
                    sleepy: sleepyInt,
                    calm: calmInt,
                    daytime: daytimeInt,
                    clarity: clarityInt,
                    editedAt: firestore.FieldValue.serverTimestamp(),
                });
            } else {
                await firestore().collection("reviews").add({
                    productId: String(productId),
                    userId: user.uid,
                    rating: ratingInt,
                    score,
                    text: text.trim() ? text.trim() : null,
                    sleepy: sleepyInt,
                    calm: calmInt,
                    daytime: daytimeInt,
                    clarity: clarityInt,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });
            }

            Keyboard.dismiss();

            setText("");
            setRating(5);
            setSleepy(3);
            setCalm(3);
            setDaytime(3);
            setClarity(3);

            startCooldown();
            setReviewOpen(false);
            setEditingReviewId(null);
        } catch (e: any) {
            console.log("submit review error:", e);
            Alert.alert("Couldnt save review", e?.message ?? "Unknown error");
        } finally {
            setSubmitting(false);
        }
    };

    const displayNameForUid = (uid: string) => {
        if (!uid) return "Member";
        if (uid === currentUid) return `${meName} (you)`;
        const mapped = nameMap[uid];
        return mapped ? mapped : "Member";
    };

    const primaryButtonLabel = myLastReview ? "Edit last review" : "Write a review";
    const sortLabel =
        sortMode === "recent" ? "Most recent" : sortMode === "high" ? "Highest" : "Lowest";

    const openSortMenu = () => {
        Keyboard.dismiss();
        setSortOpen(true);

        requestAnimationFrame(() => {
            sortBtnRef.current?.measureInWindow((x, y, w, h) => {
                setSortAnchor({ x, y, w, h });
            });
        });
    };

    if (loadingProduct) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingTop: 72,
                    backgroundColor: "transparent",
                }}
            >

                <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary }}>
                    Loading product...
                </Text>
            </SafeAreaView>
        );
    }

    if (!product) {
        return (
            <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: "transparent" }}>


                <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 16, color: theme.colors.textOnDark }}>
                    Product not found
                </Text>
                <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary }}>
                    That product id doesnt exist in Firestore.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
            {/* Header (Back only) */}

            {/* Sort menu Modal */}
            <Modal
                visible={sortOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setSortOpen(false)}
            >
                <Pressable
                    onPress={() => setSortOpen(false)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.10)" }}
                >
                    <View pointerEvents="box-none" style={{ flex: 1 }}>
                        <View
                            pointerEvents="box-none"
                            style={{
                                position: "absolute",
                                left: sortAnchor ? Math.max(12, sortAnchor.x + sortAnchor.w - 190) : 12,
                                top: sortAnchor ? sortAnchor.y + sortAnchor.h + 8 : 120,
                                width: 190,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.18)",
                                backgroundColor: "rgba(246,247,248,0.14)",
                                borderRadius: 14,
                                overflow: "hidden",
                                elevation: 12,
                            }}
                        >
                            {[
                                { key: "recent" as const, label: "Most recent" },
                                { key: "high" as const, label: "Highest" },
                                { key: "low" as const, label: "Lowest" },
                            ].map((opt) => (
                                <Pressable
                                    key={opt.key}
                                    onPress={() => {
                                        setSortMode(opt.key);
                                        setSortOpen(false);
                                    }}
                                    style={{
                                        paddingVertical: 12,
                                        paddingHorizontal: 12,
                                        backgroundColor:
                                            sortMode === opt.key
                                                ? "rgba(255,255,255,0.14)"
                                                : "rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <Text style={{ fontWeight: "900", color: theme.colors.textOnDark }}>
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Modal>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
                <FlatList
                    removeClippedSubviews={false}
                    data={sortedReviews}
                    keyExtractor={(r) => r.id}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={() => {
                        Keyboard.dismiss();
                        setSortOpen(false);
                    }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListHeaderComponent={
                        <View style={{ padding: 16 }}>
                            {/* HERO glass card */}
                            <View
                                style={{
                                    borderRadius: 22,
                                    padding: 16,
                                    backgroundColor: "rgba(246,247,248,0.14)",
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.16)",
                                    overflow: "hidden",
                                }}
                            >

                                <Text
                                    style={{
                                        fontSize: 34,
                                        fontWeight: "900",
                                        lineHeight: 38,
                                        color: theme.colors.textOnDark,
                                    }}
                                >
                                    {product.name}
                                    {product.variant ? ` (${product.variant})` : ""}
                                </Text>

                                <Text
                                    style={{
                                        marginTop: 10,
                                        fontSize: 15,
                                        opacity: 0.95,
                                        color: theme.colors.textOnDarkSecondary,
                                    }}
                                >
                                    {product.maker || "Unknown maker"}  {product.type}  THC{" "}
                                    {formatPct(product.thcPct)}  CBD {formatPct(product.cbdPct)}
                                </Text>

                                {/* Headline rating */}
                                <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center" }}>
                                    {reviews.length ? (
                                        <>
                                            <BudRating value={avgOverall} size={18} />
                                            <Text
                                                style={{
                                                    fontSize: 22,
                                                    fontWeight: "900",
                                                    marginLeft: 10,
                                                    color: theme.colors.textOnDark,
                                                }}
                                            >
                                                {round1(avgOverall).toFixed(1)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.textOnDarkSecondary }}>
                                            No ratings yet
                                        </Text>
                                    )}
                                </View>

                                <Text style={{ marginTop: 6, color: theme.colors.textOnDarkSecondary, opacity: 0.95 }}>
                                    {reviews.length
                                        ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}`
                                        : "Be the first to review this"}
                                </Text>

                                {/* Coming next */}
                                <View
                                    style={{
                                        marginTop: 16,
                                        padding: 14,
                                        borderRadius: 18,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.18)",
                                        backgroundColor: "rgba(246,247,248,0.14)",
                                        overflow: "hidden",
                                    }}
                                >

                                    <Text style={{ color: theme.colors.textOnDarkSecondary, opacity: 0.95 }}>
                                        Coming next: user uploaded photos for this product.
                                    </Text>
                                </View>

                                {/* Summary of effects */}
                                <View
                                    style={{
                                        marginTop: 16,
                                        padding: 14,
                                        borderRadius: 18,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.18)",
                                        backgroundColor: "rgba(246,247,248,0.14)",
                                        overflow: "hidden",
                                    }}
                                >

                                    <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.textOnDark }}>
                                        Summary of effects
                                    </Text>

                                    {effectsSummary.withAnySub === 0 ? (
                                        <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary }}>
                                            No effect ratings yet. Be the first to add them.
                                        </Text>
                                    ) : (
                                        <View style={{ marginTop: 10 }}>
                                            {[
                                                { label: "Daytime suitability", avg: effectsSummary.daytimeAvg },
                                                { label: "Sleepiness", avg: effectsSummary.sleepyAvg },
                                                { label: "Calm", avg: effectsSummary.calmAvg },
                                                { label: "Mental clarity", avg: effectsSummary.clarityAvg },
                                            ].map((row) => (
                                                <View
                                                    key={row.label}
                                                    style={{
                                                        flexDirection: "row",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        paddingVertical: 8,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontWeight: "800",
                                                            color: theme.colors.textOnDarkSecondary,
                                                            flex: 1,
                                                            marginRight: 12,
                                                        }}
                                                    >
                                                        {row.label}
                                                    </Text>

                                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                                        <BudRating value={row.avg} size={16} />
                                                        <Text
                                                            style={{
                                                                marginLeft: 10,
                                                                fontWeight: "900",
                                                                color: theme.colors.textOnDark,
                                                                minWidth: 44,
                                                                textAlign: "right",
                                                            }}
                                                        >
                                                            {round1(row.avg).toFixed(1)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}

                                            <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, opacity: 0.95 }}>
                                                Based on {effectsSummary.withAnySub} review{effectsSummary.withAnySub === 1 ? "" : "s"} with effect ratings.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Write / Edit controls */}
                            {!reviewOpen ? (
                                <View style={{ marginTop: 16 }}>
                                    <Pressable
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setSortOpen(false);
                                            if (isCooldown) return;
                                            if (myLastReview) openEditLastReview();
                                            else openWriteNewReview();
                                        }}
                                        disabled={submitting || isCooldown}
                                        style={{
                                            paddingVertical: 14,
                                            borderRadius: 14,
                                            backgroundColor: theme.colors.accent, // gold
                                            alignItems: "center",
                                            overflow: "hidden",
                                            opacity: submitting || isCooldown ? 0.75 : 1,
                                            borderWidth: 1,
                                            borderColor: "rgba(255,255,255,0.18)",
                                        }}
                                    >
                                        {/* shine */}
                                        <View
                                            pointerEvents="none"
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: 22,
                                                backgroundColor: "rgba(255,255,255,0.18)",
                                            }}
                                        />

                                        <Text style={{ color: "#111", fontWeight: "900" }}>
                                            {isCooldown ? `You can edit again in ${secondsLeft}s` : primaryButtonLabel}
                                        </Text>
                                    </Pressable>

                                    {myLastReview ? (
                                        <Pressable
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setSortOpen(false);
                                                if (isCooldown) return;
                                                openWriteNewReview();
                                            }}
                                            disabled={submitting || isCooldown}
                                            style={{
                                                marginTop: 10,
                                                paddingVertical: 12,
                                                borderRadius: 14,
                                                backgroundColor: theme.colors.budFilled, // green
                                                alignItems: "center",
                                                overflow: "hidden",
                                                opacity: submitting || isCooldown ? 0.6 : 1,
                                                borderWidth: 1,
                                                borderColor: "rgba(255,255,255,0.18)",
                                            }}
                                        >
                                            {/* shine */}
                                            <View
                                                pointerEvents="none"
                                                style={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: 20,
                                                    backgroundColor: "rgba(255,255,255,0.16)",
                                                }}
                                            />

                                            <Text style={{ fontWeight: "900", color: "#0b0f0d" }}>
                                                Write a new review
                                            </Text>
                                        </Pressable>

                                    ) : null}
                                </View>
                            ) : (
                                <View
                                    style={{
                                        marginTop: 16,
                                        padding: 14,
                                        borderRadius: 18,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.18)",
                                        backgroundColor: "rgba(246,247,248,0.88)",
                                    }}
                                >
                                    <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.textOnLight }}>
                                        {editingReviewId ? "Edit last review" : "Write a review"}
                                    </Text>

                                    <RatingRow label="Overall rating" value={rating} onChange={setRating} disabled={submitting} />

                                    <Text style={{ marginTop: 8, color: theme.colors.textOnLightSecondary, lineHeight: 18 }}>
                                        Overall is your satisfaction score. The effect ratings softly shape the final score.
                                    </Text>

                                    <View style={{ marginTop: 6 }}>
                                        <RatingRow label="Daytime suitability" value={daytime} onChange={setDaytime} disabled={submitting} />
                                        <RatingRow label="Sleepiness" value={sleepy} onChange={setSleepy} disabled={submitting} />
                                        <RatingRow label="Calm" value={calm} onChange={setCalm} disabled={submitting} />
                                        <RatingRow label="Mental clarity" value={clarity} onChange={setClarity} disabled={submitting} />
                                    </View>

                                    <Text style={{ marginTop: 14, marginBottom: 6, fontWeight: "900", color: theme.colors.textOnLight }}>
                                        Notes
                                    </Text>

                                    <TextInput
                                        value={text}
                                        onChangeText={setText}
                                        editable={!submitting}
                                        placeholder="What stood out? Effects, taste/smell, onset, buds, anything unexpected..."
                                        placeholderTextColor="rgba(0,0,0,0.35)"
                                        multiline
                                        scrollEnabled
                                        returnKeyType="default"
                                        textAlignVertical="top"
                                        style={{
                                            minHeight: 90,
                                            maxHeight: 160,
                                            borderWidth: 1,
                                            borderColor: "rgba(0,0,0,0.12)",
                                            borderRadius: 14,
                                            paddingHorizontal: 12,
                                            paddingTop: 12,
                                            paddingBottom: 12,
                                            fontSize: 16,
                                            lineHeight: 22,
                                            marginBottom: 12,
                                            opacity: submitting ? 0.7 : 1,
                                            backgroundColor: "rgba(255,255,255,0.85)",
                                            color: theme.colors.textOnLight,
                                        }}
                                    />

                                    <View style={{ flexDirection: "row" }}>
                                        <Pressable
                                            onPress={async () => {
                                                Keyboard.dismiss();
                                                await submitReview();
                                            }}
                                            disabled={submitting || isCooldown}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                borderRadius: 14,
                                                backgroundColor: submitting || isCooldown ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.85)",
                                                alignItems: "center",
                                                opacity: submitting || isCooldown ? 0.8 : 1,
                                                marginRight: 10,
                                            }}
                                        >
                                            <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}>
                                                {submitting ? "Saving..." : editingReviewId ? "Save changes" : "Submit review"}
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setReviewOpen(false);
                                                setEditingReviewId(null);
                                            }}
                                            disabled={submitting}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                borderRadius: 14,
                                                borderWidth: 1,
                                                borderColor: "rgba(0,0,0,0.12)",
                                                backgroundColor: "rgba(255,255,255,0.85)",
                                                alignItems: "center",
                                                opacity: submitting ? 0.75 : 1,
                                            }}
                                        >
                                            <Text style={{ fontWeight: "900", textAlign: "center", color: theme.colors.textOnLight }}>
                                                Close
                                            </Text>
                                        </Pressable>
                                    </View>

                                    {thankYouVisible ? (
                                        <View style={{ alignItems: "center", marginTop: 12 }}>
                                            <View
                                                style={{
                                                    backgroundColor: "rgba(0,0,0,0.75)",
                                                    borderRadius: 14,
                                                    paddingVertical: 12,
                                                    paddingHorizontal: 14,
                                                    width: "100%",
                                                    maxWidth: 340,
                                                }}
                                            >
                                                <Text style={{ color: "#fff", textAlign: "center" }}>
                                                    <Text style={{ fontWeight: "900" }}>Saved.</Text> Your review is live.
                                                </Text>
                                            </View>

                                            <Text
                                                style={{
                                                    marginTop: 10,
                                                    fontSize: 14,
                                                    color: "rgba(0,0,0,0.65)",
                                                    textAlign: "center",
                                                    width: "100%",
                                                    maxWidth: 340,
                                                    lineHeight: 20,
                                                }}
                                            >
                                                If your experience changes over time, you can post another review.
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            )}

                            {/* Reviews header + sort button */}
                            <View style={{ marginTop: 22 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.textOnDark }}>
                                        Reviews
                                    </Text>

                                    <View
                                        ref={(n) => {
                                            sortBtnRef.current = n;
                                        }}
                                        collapsable={false}
                                    >
                                        <Pressable
                                            onPress={() => {
                                                if (sortOpen) setSortOpen(false);
                                                else openSortMenu();
                                            }}
                                            style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderRadius: 14,
                                                borderWidth: 1,
                                                borderColor: "rgba(255,255,255,0.18)",
                                                backgroundColor: "rgba(246,247,248,0.14)",
                                            }}
                                        >
                                            <Text style={{ fontWeight: "900", color: theme.colors.textOnDark }}>
                                                {sortLabel}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            {loadingReviews ? (
                                <View style={{ marginTop: 10 }}>
                                    <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                                    <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary }}>
                                        Loading reviews...
                                    </Text>
                                </View>
                            ) : null}

                            {!loadingReviews && reviews.length === 0 ? (
                                <Text style={{ marginTop: 10, color: theme.colors.textOnDarkSecondary }}>
                                    No reviews yet.
                                </Text>
                            ) : null}
                        </View>
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                    renderItem={({ item }) => {
                        const displayName = displayNameForUid(item.userId);
                        const score = getReviewScore(item);
                        const dateMs = getCreatedAtMs(item);

                        return (
                            <View
                                style={{
                                    marginHorizontal: 16,
                                    padding: 14,
                                    borderRadius: 18,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.16)",
                                    backgroundColor: "rgba(246,247,248,0.14)",
                                    overflow: "hidden",
                                }}
                            >
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={[
                                        "rgba(255,255,255,0.10)",
                                        "rgba(255,255,255,0.03)",
                                        "rgba(0,0,0,0.08)",
                                    ]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                    }}
                                />



                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text style={{ fontWeight: "900", fontSize: 16, flexShrink: 1, marginRight: 10, color: theme.colors.textOnDark }}>
                                        {displayName}
                                    </Text>

                                    <Text style={{ color: theme.colors.textOnDarkSecondary, fontSize: 12 }}>
                                        {dateMs ? new Date(dateMs).toLocaleDateString() : ""}
                                    </Text>
                                </View>

                                <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
                                    <BudRating value={score} size={18} />
                                    <Text style={{ fontWeight: "900", marginLeft: 10, color: theme.colors.textOnDark }}>
                                        {round1(score).toFixed(1)}
                                    </Text>
                                </View>

                                {item.text ? (
                                    <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 20, color: theme.colors.textOnDarkSecondary }}>
                                        {item.text}
                                    </Text>
                                ) : null}
                            </View>
                        );
                    }}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
