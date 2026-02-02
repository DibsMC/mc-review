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
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { theme } from "../../../lib/theme";

const budImg = require("../../../assets/icons/bud.png");

type Product = {
    id: string;
    name: string;
    maker: string;
    variant?: string | null;
    type: string; // "flower" etc
    thcPct?: number | null;
    cbdPct?: number | null;
    terpenes?: string | null;
};

type Review = {
    id: string;
    productId: string;
    userId: string;

    rating: number;
    score?: number | null;

    text?: string | null;
    createdAt?: FirebaseFirestoreTypes.Timestamp | number | null;

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

function safeName(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : "";
}

function getCreatedAtMs(r: Review) {
    const c = r.createdAt;
    if (!c) return 0;
    if (typeof c === "number") return c;
    // Firestore Timestamp
    if (typeof (c as any)?.toMillis === "function") return (c as any).toMillis();
    if (typeof (c as any)?.seconds === "number") return (c as any).seconds * 1000;
    return 0;
}

function round1(n: number) {
    return Math.round(n * 10) / 10;
}

function avgNumbers(vals: Array<number | null | undefined>) {
    const xs = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
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
    const effects = avgNumbers([input.daytime, input.sleepy, input.calm, input.clarity]);
    if (!effects) return round1(rating);
    return round1(rating * 0.75 + effects * 0.25);
}

/* -------------------- Terpenes parsing -------------------- */

function prettyTerpeneName(raw: string) {
    const s = raw.trim().replace(/_/g, " ").replace(/-/g, " ");
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function parseTerpenes(input: string | null | undefined) {
    if (!input) return [];
    // "limonene:major|caryophyllene:major|linalool:major"
    return input
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const [nameRaw, strengthRaw] = part.split(":").map((x) => (x ?? "").trim());
            const name = prettyTerpeneName(nameRaw);
            const strength = strengthRaw ? strengthRaw.toLowerCase() : "";
            return { name, strength };
        })
        .filter((t) => t.name);
}

/* -------------------- Metallic chip theme -------------------- */

function hashStringToInt(input: string) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
        h = (h << 5) - h + input.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

type MetalTheme = {
    colors: [string, string, string];
    border: string;
    text: string;
    subText: string;
};

const METAL_THEMES: MetalTheme[] = [
    {
        colors: ["rgba(212,175,55,0.95)", "rgba(240,214,120,0.95)", "rgba(170,130,30,0.95)"],
        border: "rgba(255,240,190,0.28)",
        text: "rgba(12,12,14,0.96)",
        subText: "rgba(20,20,24,0.78)",
    },
    {
        colors: ["rgba(190,195,205,0.92)", "rgba(235,238,245,0.92)", "rgba(150,155,170,0.92)"],
        border: "rgba(255,255,255,0.24)",
        text: "rgba(12,12,14,0.96)",
        subText: "rgba(20,20,24,0.78)",
    },
    {
        colors: ["rgba(70,75,88,0.92)", "rgba(120,128,145,0.92)", "rgba(52,56,66,0.92)"],
        border: "rgba(255,255,255,0.16)",
        text: "rgba(250,250,252,0.96)",
        subText: "rgba(235,235,240,0.74)",
    },
    {
        colors: ["rgba(170,92,60,0.92)", "rgba(245,175,125,0.92)", "rgba(120,60,40,0.92)"],
        border: "rgba(255,220,200,0.20)",
        text: "rgba(12,12,14,0.96)",
        subText: "rgba(20,20,24,0.78)",
    },
    {
        colors: ["rgba(70,150,120,0.92)", "rgba(160,240,210,0.92)", "rgba(40,90,76,0.92)"],
        border: "rgba(210,255,240,0.20)",
        text: "rgba(8,10,12,0.96)",
        subText: "rgba(20,22,26,0.78)",
    },
    {
        colors: ["rgba(120,95,185,0.92)", "rgba(210,190,255,0.92)", "rgba(75,60,130,0.92)"],
        border: "rgba(240,230,255,0.22)",
        text: "rgba(12,12,14,0.96)",
        subText: "rgba(20,20,24,0.78)",
    },
];

function metalThemeForKey(key: string): MetalTheme {
    const idx = hashStringToInt(key.trim().toLowerCase()) % METAL_THEMES.length;
    return METAL_THEMES[idx];
}

/* -------------------- BudRating -------------------- */

function BudRating({ value, size = 18 }: { value: number; size?: number }) {
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;

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
                            marginRight: i === 4 ? 0 : 8,
                        }}
                    >
                        <Image
                            source={budImg}
                            resizeMode="contain"
                            style={{
                                width: size,
                                height: size,
                                opacity: 0.22,
                            }}
                        />

                        {fill > 0 ? (
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
                                        opacity: 1,
                                    }}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

/* -------------------- RatingRow -------------------- */

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
        <View style={{ marginTop: 14 }}>
            <Text style={{ marginBottom: 10, color: "rgba(255,255,255,0.78)", fontWeight: "800" }}>
                {label}
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {[1, 2, 3, 4, 5].map((n) => {
                    const selected = value === n;

                    return (
                        <Pressable
                            key={`${label}-${n}`}
                            onPress={() => {
                                if (disabled) return;
                                onChange(n);
                            }}
                            disabled={disabled}
                            style={[
                                styles.ratingDot,
                                selected ? styles.ratingDotSelected : styles.ratingDotUnselected,
                                disabled ? { opacity: 0.6 } : null,
                            ]}
                        >
                            <Image
                                source={budImg}
                                resizeMode="contain"
                                style={{ width: 18, height: 18, opacity: selected ? 1 : 0.22 }}
                            />
                            {selected ? <View pointerEvents="none" style={styles.ratingRing} /> : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

/* -------------------- BlingButton -------------------- */

function BlingButton({
    label,
    onPress,
    disabled,
    variant,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    variant: "gold" | "green";
}) {
    const gold = ["rgba(212,175,55,0.98)", "rgba(228,198,92,0.94)", "rgba(246,228,140,0.92)"] as const;
    const green = ["rgba(120,190,140,0.98)", "rgba(150,215,168,0.95)", "rgba(185,235,200,0.92)"] as const;

    const border = variant === "gold" ? "rgba(212,175,55,0.45)" : "rgba(150,215,168,0.40)";
    const textColor = "rgba(10,12,14,0.92)";

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[styles.blingBtnOuter, { borderColor: border, opacity: disabled ? 0.65 : 1 }]}
        >
            <LinearGradient
                pointerEvents="none"
                colors={variant === "gold" ? [...gold] : [...green]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
            />

            <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.blingGloss}
            />

            <View pointerEvents="none" style={styles.blingInnerGlow} />

            <Text style={[styles.blingBtnText, { color: textColor }]}>{label}</Text>
        </Pressable>
    );
}

/* ==================== SCREEN ==================== */

export default function FlowerDetail() {
    const { flowerId } = useLocalSearchParams<{ flowerId?: string }>();
    const productId = typeof flowerId === "string" ? flowerId : "";

    const [product, setProduct] = useState<Product | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    const [nameMap, setNameMap] = useState<Record<string, string>>({});

    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [sortOpen, setSortOpen] = useState(false);

    const sortBtnRef = useRef<View | null>(null);
    const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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

        if (sortMode === "recent") return list.sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));

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

    // Product listener
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
                        terpenes: typeof data?.terpenes === "string" ? data.terpenes : null,
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

    // Reviews listener
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
                            text: typeof data.text === "string" ? data.text : null,
                            createdAt: (data.createdAt ?? null) as any,
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

    // Fetch user names for review list
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
    const sortLabel = sortMode === "recent" ? "Most recent" : sortMode === "high" ? "Highest" : "Lowest";

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
            <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 72, backgroundColor: "transparent" }}>
                <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                <Text style={{ marginTop: 12, color: theme.colors.textOnDarkSecondary }}>Loading product...</Text>
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

    const terps = parseTerpenes(product.terpenes);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
            {/* Sort menu Modal */}
            <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
                <Pressable onPress={() => setSortOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.10)" }}>
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
                                        backgroundColor: sortMode === opt.key ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <Text style={{ fontWeight: "900", color: theme.colors.textOnDark }}>{opt.label}</Text>
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
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
                                <Text style={{ fontSize: 34, fontWeight: "900", lineHeight: 38, color: theme.colors.textOnDark }}>
                                    {product.name}
                                    {product.variant ? ` (${product.variant})` : ""}
                                </Text>

                                {/* Meta line */}
                                <Text style={{ marginTop: 10, fontSize: 15, opacity: 0.95, color: theme.colors.textOnDarkSecondary }}>
                                    {(product.maker || "Unknown maker") +
                                        " · " +
                                        (product.type || "flower") +
                                        " · THC " +
                                        formatPct(product.thcPct) +
                                        " · CBD " +
                                        formatPct(product.cbdPct)}
                                </Text>

                                {/* Terpenes */}
                                {terps.length > 0 ? (
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={{ fontWeight: "900", color: theme.colors.textOnDarkSecondary, marginBottom: 8 }}>
                                            Terpenes
                                        </Text>

                                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                            {terps.map((t) => {
                                                const chip = metalThemeForKey(t.name);

                                                return (
                                                    <LinearGradient
                                                        key={`${t.name}-${t.strength}`}
                                                        colors={chip.colors}
                                                        start={{ x: 0, y: 0.35 }}
                                                        end={{ x: 1, y: 0.65 }}
                                                        style={{
                                                            paddingVertical: 9,
                                                            paddingHorizontal: 14,
                                                            borderRadius: 999,
                                                            borderWidth: 1,
                                                            borderColor: chip.border,
                                                            overflow: "hidden",
                                                            shadowColor: "rgba(0,0,0,0.35)",
                                                            shadowOpacity: 0.30,
                                                            shadowRadius: 10,
                                                            shadowOffset: { width: 0, height: 8 },
                                                            elevation: 10,
                                                        }}
                                                    >
                                                        <LinearGradient
                                                            pointerEvents="none"
                                                            colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0.00)"]}
                                                            start={{ x: 0.5, y: 0 }}
                                                            end={{ x: 0.5, y: 1 }}
                                                            style={{
                                                                position: "absolute",
                                                                left: 0,
                                                                right: 0,
                                                                top: 0,
                                                                height: 16,
                                                                opacity: 0.85,
                                                            }}
                                                        />

                                                        <Text style={{ color: chip.text, fontWeight: "900", fontSize: 13 }}>
                                                            {t.name}
                                                            {t.strength ? (
                                                                <Text style={{ color: chip.subText, fontWeight: "900" }}> {t.strength}</Text>
                                                            ) : null}
                                                        </Text>
                                                    </LinearGradient>
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                                {/* Headline rating */}
                                <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center" }}>
                                    {reviews.length ? (
                                        <>
                                            <BudRating value={avgOverall} size={18} />
                                            <Text style={{ fontSize: 22, fontWeight: "900", marginLeft: 10, color: theme.colors.textOnDark }}>
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
                                    {reviews.length ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "Be the first to review this"}
                                </Text>

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

                                {/* Write / Edit controls */}
                                {!reviewOpen ? (
                                    <View style={{ marginTop: 16 }}>
                                        <BlingButton
                                            variant="gold"
                                            label={isCooldown ? `You can edit again in ${secondsLeft}s` : primaryButtonLabel}
                                            disabled={submitting || isCooldown}
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setSortOpen(false);
                                                if (isCooldown) return;
                                                if (myLastReview) openEditLastReview();
                                                else openWriteNewReview();
                                            }}
                                        />

                                        {myLastReview ? (
                                            <View style={{ marginTop: 12 }}>
                                                <BlingButton
                                                    variant="green"
                                                    label="Write a new review"
                                                    disabled={submitting || isCooldown}
                                                    onPress={() => {
                                                        Keyboard.dismiss();
                                                        setSortOpen(false);
                                                        if (isCooldown) return;
                                                        openWriteNewReview();
                                                    }}
                                                />
                                            </View>
                                        ) : null}
                                    </View>
                                ) : (
                                    <View style={styles.reviewCard}>
                                        <Text style={{ fontSize: 26, fontWeight: "900", color: theme.colors.textOnDark }}>
                                            {editingReviewId ? "Edit last review" : "Write a review"}
                                        </Text>

                                        <RatingRow label="Overall rating" value={rating} onChange={setRating} disabled={submitting} />

                                        <Text style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 18 }}>
                                            Overall is your satisfaction score. The effect ratings softly shape the final score.
                                        </Text>

                                        <RatingRow label="Daytime suitability" value={daytime} onChange={setDaytime} disabled={submitting} />
                                        <RatingRow label="Sleepiness" value={sleepy} onChange={setSleepy} disabled={submitting} />
                                        <RatingRow label="Calm" value={calm} onChange={setCalm} disabled={submitting} />
                                        <RatingRow label="Mental clarity" value={clarity} onChange={setClarity} disabled={submitting} />

                                        <Text style={{ marginTop: 18, marginBottom: 10, fontWeight: "900", color: theme.colors.textOnDark }}>
                                            Notes
                                        </Text>

                                        <TextInput
                                            value={text}
                                            onChangeText={setText}
                                            editable={!submitting}
                                            placeholder="What stood out? Effects, taste/smell, onset, buds, anything unexpected..."
                                            placeholderTextColor="rgba(255,255,255,0.35)"
                                            multiline
                                            scrollEnabled
                                            returnKeyType="default"
                                            textAlignVertical="top"
                                            style={styles.notesInput}
                                        />

                                        <View style={{ flexDirection: "row", marginTop: 12 }}>
                                            <Pressable
                                                onPress={async () => {
                                                    Keyboard.dismiss();
                                                    await submitReview();
                                                }}
                                                disabled={submitting || isCooldown}
                                                style={[styles.formBtn, { marginRight: 10, opacity: submitting || isCooldown ? 0.7 : 1 }]}
                                            >
                                                <Text style={styles.formBtnText}>
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
                                                style={[styles.formBtnAlt, { opacity: submitting ? 0.7 : 1 }]}
                                            >
                                                <Text style={[styles.formBtnText, { color: theme.colors.textOnDark }]}>Close</Text>
                                            </Pressable>
                                        </View>

                                        {thankYouVisible ? (
                                            <View style={{ alignItems: "center", marginTop: 14 }}>
                                                <View style={styles.toast}>
                                                    <Text style={{ color: "#fff", textAlign: "center" }}>
                                                        <Text style={{ fontWeight: "900" }}>Saved.</Text> Your review is live.
                                                    </Text>
                                                </View>

                                                <Text style={styles.toastHint}>
                                                    If your experience changes over time, you can post another review.
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}

                                {/* Reviews header + sort button */}
                                <View style={{ marginTop: 24 }}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={{ fontSize: 34, fontWeight: "900", color: theme.colors.textOnDark }}>
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
                                                style={styles.sortPill}
                                            >
                                                <Text style={{ fontWeight: "900", color: theme.colors.textOnDark, includeFontPadding: false }}>
                                                    {sortLabel}
                                                </Text>
                                            </Pressable>
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
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const displayName = displayNameForUid(item.userId);
                        const score = getReviewScore(item);
                        const dateMs = getCreatedAtMs(item);

                        return (
                            <View style={styles.reviewItem}>
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.03)", "rgba(0,0,0,0.08)"]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text
                                        style={{
                                            fontWeight: "900",
                                            fontSize: 16,
                                            flexShrink: 1,
                                            marginRight: 10,
                                            color: theme.colors.textOnDark,
                                        }}
                                    >
                                        {displayName}
                                    </Text>

                                    <Text style={{ color: theme.colors.textOnDarkSecondary, fontSize: 12 }}>
                                        {dateMs ? new Date(dateMs).toLocaleDateString() : ""}
                                    </Text>
                                </View>

                                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}>
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

const styles = StyleSheet.create({
    blingBtnOuter: {
        height: 58,
        borderRadius: 20,
        borderWidth: 1,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    blingBtnText: {
        fontWeight: "900",
        fontSize: 18,
        lineHeight: 20,
        textAlign: "center",
        includeFontPadding: false,
        textAlignVertical: "center",
    },
    blingGloss: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 22,
        opacity: 0.9,
    },
    blingInnerGlow: {
        position: "absolute",
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.10)",
        opacity: 0.35,
    },

    sortPill: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(246,247,248,0.14)",
    },

    reviewItem: {
        marginHorizontal: 16,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(246,247,248,0.14)",
        overflow: "hidden",
    },

    reviewCard: {
        marginTop: 18,
        padding: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(246,247,248,0.14)",
        overflow: "hidden",
    },

    notesInput: {
        minHeight: 110,
        maxHeight: 190,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
        fontSize: 16,
        lineHeight: 22,
        backgroundColor: "rgba(0,0,0,0.22)",
        color: theme.colors.textOnDark,
    },

    formBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.70)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnAlt: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
    },
    formBtnText: {
        fontWeight: "900",
        textAlign: "center",
        color: "#fff",
        includeFontPadding: false,
    },

    toast: {
        backgroundColor: "rgba(0,0,0,0.75)",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        width: "100%",
        maxWidth: 340,
    },
    toastHint: {
        marginTop: 10,
        fontSize: 14,
        color: "rgba(255,255,255,0.62)",
        textAlign: "center",
        width: "100%",
        maxWidth: 340,
        lineHeight: 20,
    },

    ratingDot: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    ratingDotUnselected: {
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    ratingDotSelected: {
        borderColor: "rgba(212,175,55,0.85)",
        backgroundColor: "rgba(212,175,55,0.12)",
    },
    ratingRing: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: "rgba(212,175,55,0.75)",
    },
});
