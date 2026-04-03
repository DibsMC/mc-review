import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { theme } from "../../../lib/theme";
import { AVATARS } from "../../../lib/avatarOptions";
import { buildOwnUserDocCreatePayload } from "../../../lib/userProfileDoc";
import BrandedScreenBackground from "../../../components/BrandedScreenBackground";
import ProfileAvatar from "../../../components/user/ProfileAvatar";
import { summarizeReviewsForIdentity } from "../../../lib/reviewOwnership";

const userBg = require("../../../assets/images/user-bg.png");

function Divider() {
    return (
        <View
            style={{
                height: 1,
                backgroundColor: theme.colors.dividerOnDark,
                opacity: 0.9,
            }}
        />
    );
}

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            style={{
                fontSize: 13,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.60)",
                marginBottom: 10,
                fontWeight: "800",
            }}
        >
            {children}
        </Text>
    );
}

function GlassCard({
    children,
    style,
    borderTint,
}: {
    children: React.ReactNode;
    style?: any;
    borderTint?: string;
}) {
    return (
        <View
            style={[
                {
                    backgroundColor: "rgba(11,15,22,0.74)",
                    borderColor: borderTint ?? "rgba(255,255,255,0.16)",
                    borderWidth: 1,
                    borderRadius: 22,
                    overflow: "hidden",
                },
                style,
            ]}
        >
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(255,255,255,0.12)",
                    "rgba(255,255,255,0.06)",
                    "rgba(0,0,0,0.10)",
                ]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View style={{ padding: 16 }}>{children}</View>
        </View>
    );
}

function MenuRow({
    title,
    subtitle,
    onPress,
    danger,
    rightLabel,
    locked,
}: {
    title: string;
    subtitle?: string;
    onPress?: () => void;
    danger?: boolean;
    rightLabel?: string;
    locked?: boolean;
}) {
    return (
        <Pressable
            disabled={!onPress}
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: 14,
                opacity: !onPress ? 1 : pressed ? 0.75 : 1,
            })}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "900",
                            color: danger ? "rgba(255,110,110,1)" : theme.colors.textOnDark,
                            marginBottom: subtitle ? 4 : 0,
                        }}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text
                            style={{
                                fontSize: 14,
                                lineHeight: 20,
                                color: theme.colors.textOnDarkSecondary,
                                opacity: 0.95,
                            }}
                        >
                            {subtitle}
                        </Text>
                    ) : null}
                </View>

                {rightLabel ? (
                    <View
                        style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,255,255,0.10)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.14)",
                            marginRight: 10,
                        }}
                    >
                        <Text
                            style={{
                                color: theme.colors.textOnDark,
                                fontWeight: "900",
                                fontSize: 12,
                            }}
                        >
                            {rightLabel}
                        </Text>
                    </View>
                ) : null}

                {locked ? (
                    <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color="rgba(255,255,255,0.55)"
                    />
                ) : (
                    <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.55)" }}>›</Text>
                )}
            </View>
        </Pressable>
    );
}

function BadgeItem({
    title,
    subtitle,
    achieved,
    icon,
    palette,
}: {
    title: string;
    subtitle: string;
    achieved: boolean;
    icon: keyof typeof Ionicons.glyphMap;
    palette: [string, string, string];
}) {
    return (
        <View
            style={{
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: achieved ? "rgba(212,175,55,0.28)" : "rgba(255,255,255,0.12)",
                backgroundColor: achieved ? "rgba(212,175,55,0.08)" : "rgba(11,15,22,0.72)",
                marginBottom: 10,
            }}
        >
            <LinearGradient
                pointerEvents="none"
                colors={
                    achieved
                        ? ["rgba(255,255,255,0.14)", "rgba(212,175,55,0.06)", "rgba(0,0,0,0.16)"]
                        : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.14)"]
                }
                start={{ x: 0.18, y: 0 }}
                end={{ x: 0.82, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />

            <View
                style={{
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <LinearGradient
                    colors={
                        achieved
                            ? palette
                            : ["rgba(88,95,110,0.92)", "rgba(47,53,66,0.94)", "rgba(23,27,36,0.94)"]
                    }
                    start={{ x: 0.08, y: 0 }}
                    end={{ x: 0.92, y: 1 }}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: achieved ? "rgba(255,240,190,0.28)" : "rgba(255,255,255,0.14)",
                        shadowColor: achieved ? palette[1] : "rgba(0,0,0,0.28)",
                        shadowOpacity: achieved ? 0.22 : 0.14,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 5 },
                        elevation: achieved ? 4 : 2,
                    }}
                >
                    <Ionicons
                        name={icon}
                        size={22}
                        color={achieved ? "rgba(20,16,8,0.96)" : "rgba(255,255,255,0.78)"}
                    />
                </LinearGradient>

                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            color: theme.colors.textOnDark,
                            fontWeight: "900",
                            fontSize: 16,
                            marginBottom: 4,
                        }}
                    >
                        {achieved ? "Earned badge" : "In progress"}
                    </Text>
                    <Text
                        style={{
                            color: theme.colors.textOnDark,
                            fontWeight: "900",
                            fontSize: 16,
                            marginTop: 3,
                            marginBottom: 4,
                        }}
                    >
                        {title}
                    </Text>
                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                            fontSize: 13,
                            fontWeight: "700",
                        }}
                    >
                        {subtitle}
                    </Text>
                </View>

                <View
                    style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: achieved ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.08)",
                        borderWidth: 1,
                        borderColor: achieved ? "rgba(212,175,55,0.28)" : "rgba(255,255,255,0.12)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "900",
                            color: achieved ? "rgba(255,235,190,0.98)" : "rgba(255,255,255,0.62)",
                            letterSpacing: 0.2,
                        }}
                    >
                        {achieved ? "Unlocked" : "Locked"}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function maskEmail(email: string) {
    const parts = email.split("@");
    if (parts.length !== 2) return "";
    const name = parts[0] ?? "";
    const domain = parts[1] ?? "";
    const first = name.slice(0, 1);
    return `${first}***@${domain}`;
}

type DirectoryUser = {
    id: string;
    displayName: string;
    avatarId: string | null;
    photoURL: string | null;
    isAdmin: boolean;
    isModerator: boolean;
};

type BadgeDefinition = {
    key: string;
    title: string;
    subtitle: string;
    achieved: boolean;
    icon: keyof typeof Ionicons.glyphMap;
    palette: [string, string, string];
};

type ReviewStatRecord = {
    id: string;
    productId: string;
    rating: number;
    score: number | null;
    text: string | null;
    helpfulCount: number;
    createdAtMs: number;
};

type HelpfulVoteRecord = {
    reviewId: string;
    productId: string;
    targetUserId: string;
    createdAtMs: number;
};

type ProductMeta = {
    name: string;
    maker: string;
    variant: string | null;
};

type ReviewStatPreview = ReviewStatRecord & {
    productName: string;
    maker: string;
    variant: string | null;
    authorName?: string | null;
};

type FollowerPreview = DirectoryUser & {
    createdAtMs: number;
};

type StatSheetKind = "reviews" | "helpful_received" | "helpful_given" | "followers";

function toMillis(value: any) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return 0;
}

async function loadProductMetaMap(productIds: string[]) {
    const ids = Array.from(new Set(productIds.filter(Boolean)));
    if (ids.length === 0) return {} as Record<string, ProductMeta>;

    const next: Record<string, ProductMeta> = {};
    for (let index = 0; index < ids.length; index += 10) {
        const chunk = ids.slice(index, index + 10);
        const snapshot = await firestore()
            .collection("products")
            .where(firestore.FieldPath.documentId(), "in", chunk)
            .get();

        snapshot.docs.forEach((doc) => {
            const data = (doc.data() as Record<string, any> | undefined) ?? {};
            next[doc.id] = {
                name: typeof data?.name === "string" ? data.name : "Flower",
                maker: typeof data?.maker === "string" ? data.maker : "Unknown maker",
                variant: typeof data?.variant === "string" ? data.variant : null,
            };
        });
    }

    return next;
}

export default function UserMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [authUser, setAuthUser] = useState<FirebaseAuthTypes.User | null | undefined>(undefined);
    const authReady = authUser !== undefined;
    const user = authReady ? authUser : null;
    const uid = user?.uid ?? "";
    const guestMode = !uid;
    const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

    const displayName = profileDisplayName?.trim()
        ? profileDisplayName
        : user?.displayName?.trim()
            ? user.displayName
        : guestMode
            ? "Guest mode"
            : "Anonymous";
    const emailVerified = user?.emailVerified ?? false;

    const photoURL = user?.photoURL ?? null;
    const emailMasked = user?.email ? maskEmail(user.email) : "";

    const [avatarId, setAvatarId] = useState<string | null>(null);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Optional, future-ready: stats stored on the user doc
    const [joinYear, setJoinYear] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState<number | null>(null);
    const [productCount, setProductCount] = useState<number | null>(null);
    const [lastActiveLabel, setLastActiveLabel] = useState<string | null>(null);
    const [followerCount, setFollowerCount] = useState<number>(0);
    const [helpfulCount, setHelpfulCount] = useState<number>(0);
    const [helpfulReceivedLive, setHelpfulReceivedLive] = useState<number>(0);
    const [helpfulGivenProfile, setHelpfulGivenProfile] = useState<number>(0);
    const [helpfulGivenVotes, setHelpfulGivenVotes] = useState<number>(0);
    const [matchedReviews, setMatchedReviews] = useState<ReviewStatRecord[]>([]);
    const [reviewPreviews, setReviewPreviews] = useState<ReviewStatPreview[]>([]);
    const [helpfulVotes, setHelpfulVotes] = useState<HelpfulVoteRecord[]>([]);
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
    const [statSheetOpen, setStatSheetOpen] = useState(false);
    const [statSheetKind, setStatSheetKind] = useState<StatSheetKind>("reviews");
    const [statSheetLoading, setStatSheetLoading] = useState(false);
    const [statSheetReviews, setStatSheetReviews] = useState<ReviewStatPreview[]>([]);
    const [statSheetFollowers, setStatSheetFollowers] = useState<FollowerPreview[]>([]);
    const [verificationBusy, setVerificationBusy] = useState(false);
    const [signOutBusy, setSignOutBusy] = useState(false);
    const scrollRef = useRef<ScrollView | null>(null);
    const scrollOffsetRef = useRef(0);

    useEffect(() => {
        const unsub = auth().onAuthStateChanged((nextUser) => {
            setAuthUser(nextUser);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        if (!uid) {
            setAvatarId(null);
            setIsAdmin(false);
            setJoinYear(null);
            setReviewCount(null);
            setProductCount(null);
            setLastActiveLabel(null);
            setFollowerCount(0);
            setHelpfulCount(0);
            setHelpfulReceivedLive(0);
            setHelpfulGivenProfile(0);
            setHelpfulGivenVotes(0);
            setMatchedReviews([]);
            setReviewPreviews([]);
            setHelpfulVotes([]);
            setProfileDisplayName(null);
            setStatSheetOpen(false);
            setAvatarPickerOpen(false);
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(uid)
            .onSnapshot(
                (doc) => {
                    const data = (doc.data() as any) ?? {};
                    const nextDisplayName =
                        typeof data?.displayName === "string" && data.displayName.trim()
                            ? data.displayName.trim()
                            : null;
                    setProfileDisplayName(nextDisplayName);
                    const v = typeof data?.avatarId === "string" ? data.avatarId : null;
                    setAvatarId(v);
                    setIsAdmin(!!data?.isAdmin);

                    const createdAt: any = data?.createdAt ?? data?.created_at ?? null;
                    if (createdAt?.toDate) {
                        setJoinYear(createdAt.toDate().getFullYear());
                    } else if (typeof createdAt === "number") {
                        setJoinYear(new Date(createdAt).getFullYear());
                    } else {
                        setJoinYear(null);
                    }

                    // Keep this simple for now. If you later store lastActive as a timestamp, format it here.
                    const la =
                        typeof data?.lastActiveLabel === "string"
                            ? data.lastActiveLabel
                            : null;
                    setLastActiveLabel(la);

                    const nextFollowers =
                        typeof data?.followerCount === "number"
                            ? data.followerCount
                            : typeof data?.followersCount === "number"
                                ? data.followersCount
                                : 0;
                    const nextHelpful =
                        typeof data?.helpfulCount === "number"
                            ? data.helpfulCount
                            : typeof data?.helpfulReceivedCount === "number"
                                ? data.helpfulReceivedCount
                                : 0;
                    const nextHelpfulGiven =
                        typeof data?.helpfulGiven === "number"
                            ? data.helpfulGiven
                            : typeof data?.helpfulGivenCount === "number"
                                ? data.helpfulGivenCount
                                : 0;

                    setFollowerCount(Math.max(0, nextFollowers));
                    setHelpfulCount(Math.max(0, nextHelpful));
                    setHelpfulGivenProfile(Math.max(0, nextHelpfulGiven));
                },
                () => {
                    // ignore
                }
            );

        return () => unsub();
    }, [uid]);

    useEffect(() => {
        if (!uid) return;

        const unsub = firestore()
            .collection("users")
            .doc(uid)
            .collection("helpful")
            .onSnapshot(
                (snapshot) => {
                    setHelpfulGivenVotes(snapshot.size);
                    setHelpfulVotes(
                        snapshot.docs
                            .map((doc) => {
                                const data = (doc.data() as Record<string, any> | undefined) ?? {};
                                return {
                                    reviewId: typeof data?.reviewId === "string" && data.reviewId ? data.reviewId : doc.id,
                                    productId: typeof data?.productId === "string" ? data.productId : "",
                                    targetUserId: typeof data?.targetUserId === "string" ? data.targetUserId : "",
                                    createdAtMs: toMillis(data?.createdAt),
                                } satisfies HelpfulVoteRecord;
                            })
                            .sort((a, b) => b.createdAtMs - a.createdAtMs)
                    );
                },
                () => {
                    setHelpfulGivenVotes(0);
                    setHelpfulVotes([]);
                }
            );

        return () => unsub();
    }, [uid]);

    const helpfulGiven = useMemo(
        () => Math.max(helpfulGivenProfile, helpfulGivenVotes),
        [helpfulGivenProfile, helpfulGivenVotes]
    );
    const helpfulReceived = useMemo(
        () => Math.max(helpfulCount, helpfulReceivedLive),
        [helpfulCount, helpfulReceivedLive]
    );

    useEffect(() => {
        let cancelled = false;

        if (matchedReviews.length === 0) {
            setReviewPreviews([]);
            return () => {
                cancelled = true;
            };
        }

        (async () => {
            try {
                const productMap = await loadProductMetaMap(matchedReviews.map((review) => review.productId));
                if (cancelled) return;

                setReviewPreviews(
                    matchedReviews.map((review) => {
                        const product = productMap[review.productId];
                        return {
                            ...review,
                            productName: product?.name ?? "Flower",
                            maker: product?.maker ?? "Unknown maker",
                            variant: product?.variant ?? null,
                        };
                    })
                );
            } catch {
                if (!cancelled) {
                    setReviewPreviews(
                        matchedReviews.map((review) => ({
                            ...review,
                            productName: "Flower",
                            maker: "Unknown maker",
                            variant: null,
                        }))
                    );
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [matchedReviews]);

    useEffect(() => {
        if (!uid) return;

        const unsub = firestore()
            .collection("reviews")
            .onSnapshot(
                (snapshot) => {
                    const reviews = snapshot.docs.map((doc) => {
                        const data = (doc.data() as Record<string, any> | undefined) ?? {};
                        const rating = typeof data?.rating === "number" ? data.rating : 0;
                        return {
                            id: doc.id,
                            userId: typeof data?.userId === "string" ? data.userId : "",
                            uid: typeof data?.uid === "string" ? data.uid : "",
                            authorUid: typeof data?.authorUid === "string" ? data.authorUid : "",
                            displayName: typeof data?.displayName === "string" ? data.displayName : "",
                            authorName: typeof data?.authorName === "string" ? data.authorName : "",
                            userName: typeof data?.userName === "string" ? data.userName : "",
                            email: typeof data?.email === "string" ? data.email : "",
                            authorEmail: typeof data?.authorEmail === "string" ? data.authorEmail : "",
                            userEmail: typeof data?.userEmail === "string" ? data.userEmail : "",
                            productId: typeof data?.productId === "string" ? data.productId : "",
                            helpfulCount: typeof data?.helpfulCount === "number" ? Math.max(0, data.helpfulCount) : 0,
                            rating,
                            score: typeof data?.score === "number" ? data.score : rating,
                            text: typeof data?.text === "string" ? data.text.trim() : null,
                            createdAtMs: toMillis(data?.createdAt),
                        };
                    });
                    const summary = summarizeReviewsForIdentity(reviews, {
                        uid,
                        displayName: user?.displayName ?? null,
                        email: user?.email ?? null,
                    });

                    setReviewCount(summary.reviewCount);
                    setProductCount(summary.productCount);
                    setHelpfulReceivedLive(summary.helpfulTotal);
                    setMatchedReviews(
                        summary.matched
                            .map((review) => ({
                                id: review.id,
                                productId: review.productId,
                                helpfulCount: review.helpfulCount,
                                rating: review.rating,
                                score: review.score,
                                text: review.text,
                                createdAtMs: review.createdAtMs,
                            }))
                            .sort((a, b) => b.createdAtMs - a.createdAtMs)
                    );
                },
                () => {
                    setReviewCount(0);
                    setProductCount(0);
                    setHelpfulReceivedLive(0);
                    setMatchedReviews([]);
                }
            );

        return () => unsub();
    }, [uid, user?.displayName, user?.email]);

    useFocusEffect(
        useCallback(() => {
            const frame = requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({
                    y: scrollOffsetRef.current,
                    animated: false,
                });
            });

            return () => cancelAnimationFrame(frame);
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            void refreshCurrentAuthUser();
        }, [refreshCurrentAuthUser])
    );

    const directoryUserMap = useMemo(
        () =>
            Object.fromEntries(
                directoryUsers.map((entry) => [entry.id, entry] satisfies [string, DirectoryUser])
            ) as Record<string, DirectoryUser>,
        [directoryUsers]
    );

    const statSheetMeta = useMemo(
        () => ({
            reviews: {
                title: "Reviews given",
                subtitle: "Every review you have shared so far.",
                empty: "No reviews shared yet.",
            },
            helpful_received: {
                title: "Helpfuls received",
                subtitle: "Reviews that other members found useful.",
                empty: "No helpfuls received yet.",
            },
            helpful_given: {
                title: "Helpfuls given",
                subtitle: "Reviews you marked as helpful.",
                empty: "You have not marked any reviews helpful yet.",
            },
            followers: {
                title: "Followers",
                subtitle: "Members currently following your updates.",
                empty: "No followers yet.",
            },
        }),
        []
    );

    const formatStatDate = useCallback((value: number) => {
        if (!value) return "Undated";
        return new Date(value).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }, []);

    const openStatSheet = useCallback(
        async (kind: StatSheetKind) => {
            if (!uid) return;

            setStatSheetKind(kind);
            setStatSheetOpen(true);
            setStatSheetFollowers([]);
            setStatSheetLoading(true);

            try {
                if (kind === "reviews") {
                    setStatSheetReviews(reviewPreviews);
                    return;
                }

                if (kind === "helpful_received") {
                    setStatSheetReviews(
                        reviewPreviews
                            .filter((review) => review.helpfulCount > 0)
                            .sort((a, b) => b.helpfulCount - a.helpfulCount || b.createdAtMs - a.createdAtMs)
                    );
                    return;
                }

                if (kind === "helpful_given") {
                    const reviewIds = Array.from(new Set(helpfulVotes.map((vote) => vote.reviewId).filter(Boolean)));
                    if (reviewIds.length === 0) {
                        setStatSheetReviews([]);
                        return;
                    }

                    const reviewsById: Record<string, ReviewStatPreview> = {};
                    for (let index = 0; index < reviewIds.length; index += 10) {
                        const chunk = reviewIds.slice(index, index + 10);
                        const snapshot = await firestore()
                            .collection("reviews")
                            .where(firestore.FieldPath.documentId(), "in", chunk)
                            .get();

                        const rawReviews = snapshot.docs.map((doc) => {
                            const data = (doc.data() as Record<string, any> | undefined) ?? {};
                            const rating = typeof data?.rating === "number" ? data.rating : 0;
                            return {
                                id: doc.id,
                                productId: typeof data?.productId === "string" ? data.productId : "",
                                helpfulCount: typeof data?.helpfulCount === "number" ? Math.max(0, data.helpfulCount) : 0,
                                rating,
                                score: typeof data?.score === "number" ? data.score : rating,
                                text: typeof data?.text === "string" ? data.text.trim() : null,
                                createdAtMs: toMillis(data?.createdAt),
                                authorName:
                                    typeof data?.displayName === "string" && data.displayName.trim()
                                        ? data.displayName.trim()
                                        : typeof data?.authorName === "string" && data.authorName.trim()
                                          ? data.authorName.trim()
                                          : typeof data?.userName === "string" && data.userName.trim()
                                            ? data.userName.trim()
                                            : null,
                            };
                        });

                        const productMap = await loadProductMetaMap(rawReviews.map((review) => review.productId));
                        rawReviews.forEach((review) => {
                            const product = productMap[review.productId];
                            reviewsById[review.id] = {
                                ...review,
                                productName: product?.name ?? "Flower",
                                maker: product?.maker ?? "Unknown maker",
                                variant: product?.variant ?? null,
                            };
                        });
                    }

                    const helpfulGivenPreviews: ReviewStatPreview[] = [];
                    helpfulVotes.forEach((vote) => {
                        const review = reviewsById[vote.reviewId];
                        if (!review) return;

                        helpfulGivenPreviews.push({
                            ...review,
                            createdAtMs: vote.createdAtMs || review.createdAtMs,
                            authorName:
                                review.authorName ??
                                directoryUserMap[vote.targetUserId]?.displayName ??
                                "Member",
                        });
                    });

                    setStatSheetReviews(helpfulGivenPreviews);
                    return;
                }

                const followerSnapshot = await firestore()
                    .collectionGroup("following")
                    .where("uid", "==", uid)
                    .get();

                const followers = followerSnapshot.docs
                    .map((doc) => {
                        const followerId = doc.ref.parent.parent?.id ?? "";
                        const userEntry = directoryUserMap[followerId];
                        if (!followerId || !userEntry) return null;
                        const data = (doc.data() as Record<string, any> | undefined) ?? {};
                        return {
                            ...userEntry,
                            createdAtMs: toMillis(data?.createdAt),
                        } satisfies FollowerPreview;
                    })
                    .filter((entry): entry is FollowerPreview => !!entry)
                    .sort((a, b) => b.createdAtMs - a.createdAtMs || a.displayName.localeCompare(b.displayName));

                setStatSheetFollowers(followers);
            } finally {
                setStatSheetLoading(false);
            }
        },
        [directoryUserMap, helpfulVotes, reviewPreviews, uid]
    );

    const saveAvatar = async (next: string | null) => {
        if (!uid) return;
        try {
            const userRef = firestore().collection("users").doc(uid);
            const snap = await userRef.get();

            if (!snap.exists) {
                await userRef.set(
                    buildOwnUserDocCreatePayload({
                        email: auth().currentUser?.email ?? null,
                        displayName: auth().currentUser?.displayName ?? null,
                        emailVerified: auth().currentUser?.emailVerified ?? false,
                        extra: {
                            avatarId: next ?? null,
                        },
                    }),
                    { merge: false }
                );
            } else {
                await userRef.update({
                    avatarId: next ?? null,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
            }
            setAvatarId(next);
        } catch (e: any) {
            Alert.alert("Could not save avatar", e?.message ?? "Unknown error");
        }
    };

    async function refreshCurrentAuthUser() {
        const current = auth().currentUser;
        if (!current) return;

        try {
            await current.reload();
        } catch {
            // keep the current auth snapshot if refresh fails
        }

        setAuthUser(auth().currentUser);
    }

    const resendVerificationEmail = useCallback(async () => {
        const current = auth().currentUser;
        if (!current?.email) {
            Alert.alert("No email found", "We could not find the email address for this account.");
            return;
        }

        try {
            setVerificationBusy(true);
            await current.reload();
            const freshUser = auth().currentUser ?? current;

            if (freshUser.emailVerified) {
                setAuthUser(freshUser);
                Alert.alert("Already verified", "This email address is already verified.");
                return;
            }

            await freshUser.sendEmailVerification();
            setAuthUser(freshUser);
            Alert.alert("Check your inbox", `We sent a verification email to ${freshUser.email}.`);
        } catch (e: any) {
            Alert.alert("Could not send verification email", e?.message ?? "Unknown error");
        } finally {
            setVerificationBusy(false);
            await refreshCurrentAuthUser();
        }
    }, []);

    const clearToGuestState = () => {
        setAuthUser(null);
        setAvatarId(null);
        setIsAdmin(false);
        setJoinYear(null);
        setReviewCount(null);
        setProductCount(null);
        setLastActiveLabel(null);
        setFollowerCount(0);
        setHelpfulCount(0);
        setHelpfulReceivedLive(0);
        setHelpfulGivenProfile(0);
        setHelpfulGivenVotes(0);
        setMatchedReviews([]);
        setReviewPreviews([]);
        setHelpfulVotes([]);
        setUserSearchQuery("");
        setDirectoryUsers([]);
        setStatSheetOpen(false);
        setAvatarPickerOpen(false);
        setProfileDisplayName(null);
        router.replace("/(tabs)/user");
    };

    const handleSignOut = async () => {
        if (signOutBusy) return;

        const currentUser = auth().currentUser;
        if (!currentUser) {
            clearToGuestState();
            return;
        }

        try {
            setSignOutBusy(true);
            await auth().signOut();
            clearToGuestState();
        } catch (e: any) {
            const code = typeof e?.code === "string" ? e.code : "";
            const message = typeof e?.message === "string" ? e.message : "";
            const alreadySignedOut =
                code.includes("no-current-user")
                || code.includes("user-not-found")
                || /no current user/i.test(message)
                || /user.*not found/i.test(message);

            if (alreadySignedOut || !auth().currentUser) {
                clearToGuestState();
                return;
            }

            Alert.alert("Sign out failed", message || "Unknown error");
        } finally {
            setSignOutBusy(false);
        }
    };

    const headerBorder = theme.colors.goldGlassBorder;
    const headerBg = "rgba(24,18,10,0.82)";
    const editRightLabel = guestMode ? "Locked" : "Edit";
    const goToAuth = () => {
        router.push(`/auth?returnTo=${encodeURIComponent("/(tabs)/user")}`);
    };
    const goToCreateAccount = () => {
        router.push(`/auth?mode=create&returnTo=${encodeURIComponent("/(tabs)/user")}`);
    };

    const headerOneLiner = guestMode
        ? "Sign in to unlock the full review catalog, profile tools, private notes, and your saved activity."
        : joinYear
            ? `Part of the community since ${joinYear}`
            : "Sharing honest experiences with the community";

    const statsBits: string[] = [];
    if (typeof reviewCount === "number") statsBits.push(`${reviewCount} reviews`);
    if (typeof productCount === "number") statsBits.push(`${productCount} flowers`);
    if (lastActiveLabel) statsBits.push(`Last active ${lastActiveLabel}`);
    const statsLine = statsBits.length ? statsBits.join(" · ") : null;
    const badges = useMemo<BadgeDefinition[]>(
        () => [
            {
                key: "first-review",
                title: "Contributor",
                subtitle: "Posted your first review",
                achieved: (reviewCount ?? 0) >= 1,
                icon: "sparkles",
                palette: ["rgba(255,229,150,0.98)", "rgba(214,173,67,0.96)", "rgba(131,94,24,0.94)"] as [string, string, string],
            },
            {
                key: "regular",
                title: "Regular",
                subtitle: "Shared 5 or more reviews",
                achieved: (reviewCount ?? 0) >= 5,
                icon: "ribbon",
                palette: ["rgba(247,210,126,0.98)", "rgba(201,144,49,0.96)", "rgba(118,79,26,0.94)"] as [string, string, string],
            },
            {
                key: "catalog-scout",
                title: "Catalog scout",
                subtitle: "Reviewed 10 different flowers",
                achieved: (productCount ?? 0) >= 10,
                icon: "compass",
                palette: ["rgba(170,255,214,0.96)", "rgba(76,178,136,0.94)", "rgba(29,94,77,0.92)"] as [string, string, string],
            },
            {
                key: "helpful",
                title: "Helpful",
                subtitle: "Received 10 helpfuls",
                achieved: helpfulReceived >= 10,
                icon: "thumbs-up",
                palette: ["rgba(180,215,255,0.96)", "rgba(88,142,235,0.94)", "rgba(34,66,122,0.92)"] as [string, string, string],
            },
            {
                key: "connector",
                title: "Connector",
                subtitle: "Built momentum with followers or helpfuls given",
                achieved: followerCount >= 5 || helpfulGiven >= 10,
                icon: "people",
                palette: ["rgba(239,196,255,0.96)", "rgba(177,101,227,0.94)", "rgba(88,46,126,0.92)"] as [string, string, string],
            },
        ],
        [followerCount, helpfulGiven, helpfulReceived, productCount, reviewCount]
    );

    useEffect(() => {
        const unsub = firestore()
            .collection("users")
            .onSnapshot(
                (snapshot) => {
                    const next = snapshot.docs.map((doc) => {
                        const data = (doc.data() as Record<string, any> | undefined) ?? {};
                        return {
                            id: doc.id,
                            displayName:
                                typeof data?.displayName === "string" && data.displayName.trim()
                                    ? data.displayName.trim()
                                    : "Member",
                            avatarId: typeof data?.avatarId === "string" ? data.avatarId : null,
                            photoURL: typeof data?.photoURL === "string" ? data.photoURL : null,
                            isAdmin: !!data?.isAdmin,
                            isModerator: !!data?.isModerator,
                        } satisfies DirectoryUser;
                    });

                    next.sort((a, b) => a.displayName.localeCompare(b.displayName));
                    setDirectoryUsers(next);
                },
                () => {
                    setDirectoryUsers([]);
                }
            );

        return () => unsub();
    }, []);

    const filteredUsers = useMemo(() => {
        const query = userSearchQuery.trim().toLowerCase();
        if (!query) return [];

        return directoryUsers
            .filter((entry) => {
                if (entry.id === uid) return false;
                return entry.displayName.toLowerCase().includes(query);
            })
            .slice(0, 6);
    }, [directoryUsers, uid, userSearchQuery]);

    return (
        <BrandedScreenBackground
            source={userBg}
            gradientColors={[
                "rgba(20,12,6,0.18)",
                "rgba(9,12,18,0.52)",
                "rgba(6,8,12,0.94)",
            ]}
            scrimColor="rgba(5,7,11,0.24)"
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 10,
                        paddingBottom: Math.max(118, insets.bottom + 94),
                    }}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
                    }}
                >
                {/* Profile Header */}
                <View
                    style={{
                        borderRadius: 24,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: headerBorder,
                        marginBottom: 14,
                    }}
                >
                    <LinearGradient
                        colors={[
                            "rgba(212,175,55,0.18)",
                            "rgba(255,255,255,0.06)",
                            "rgba(0,0,0,0.10)",
                        ]}
                        start={{ x: 0.05, y: 0 }}
                        end={{ x: 0.95, y: 1 }}
                        style={{
                            padding: 16,
                            backgroundColor: headerBg,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Pressable
                                onPress={() => {
                                    setAvatarPickerOpen(true);
                                }}
                                style={({ pressed }) => ({
                                    opacity: pressed ? 0.8 : 1,
                                    marginRight: 14,
                                })}
                            >
                                <ProfileAvatar avatarId={avatarId} photoURL={photoURL} size={64} />
                            </Pressable>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontSize: 20,
                                        fontWeight: "800",
                                        letterSpacing: -0.2,
                                        color: theme.colors.textOnDark,
                                        lineHeight: 25,
                                    }}
                                >
                                    {displayName}
                                </Text>

                                <Text
                                    style={{
                                        marginTop: 6,
                                        fontSize: 14,
                                        lineHeight: 20,
                                        color: "rgba(244,245,247,0.82)",
                                        opacity: 0.95,
                                    }}
                                >
                                    {headerOneLiner}
                                </Text>

                                {statsLine ? (
                                    <Text
                                        style={{
                                            marginTop: 8,
                                            fontSize: 13,
                                            color: "rgba(255,255,255,0.74)",
                                            fontWeight: "700",
                                        }}
                                    >
                                        {statsLine}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {!guestMode ? (
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 10,
                            marginBottom: 14,
                        }}
                    >
                        {[
                            { label: "Reviews given", value: String(reviewCount ?? 0), kind: "reviews" as const },
                            { label: "Helpfuls received", value: String(helpfulReceived), kind: "helpful_received" as const },
                            { label: "Helpfuls given", value: String(helpfulGiven), kind: "helpful_given" as const },
                            { label: "Followers", value: String(followerCount), kind: "followers" as const },
                        ].map((stat) => (
                            <Pressable
                                key={stat.label}
                                onPress={() => {
                                    void openStatSheet(stat.kind);
                                }}
                                style={({ pressed }) => ({
                                    flexBasis: "47%",
                                    borderRadius: 18,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.14)",
                                    backgroundColor: "rgba(11,15,22,0.78)",
                                    overflow: "hidden",
                                    opacity: pressed ? 0.82 : 1,
                                })}
                            >
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={[
                                        "rgba(255,255,255,0.10)",
                                        "rgba(255,255,255,0.04)",
                                        "rgba(0,0,0,0.12)",
                                    ]}
                                    start={{ x: 0.1, y: 0 }}
                                    end={{ x: 0.9, y: 1 }}
                                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                                />

                                <View style={{ padding: 14 }}>
                                    <Text
                                        style={{
                                            color: theme.colors.textOnDark,
                                            fontSize: 18,
                                            fontWeight: "800",
                                            letterSpacing: -0.2,
                                        }}
                                    >
                                        {stat.value}
                                    </Text>
                                    <Text
                                        style={{
                                            marginTop: 4,
                                            color: "rgba(255,255,255,0.68)",
                                            fontSize: 12,
                                            fontWeight: "800",
                                            textTransform: "uppercase",
                                            letterSpacing: 0.6,
                                        }}
                                    >
                                        {stat.label}
                                    </Text>
                                    <Text
                                        style={{
                                            marginTop: 8,
                                            color: "rgba(255,255,255,0.46)",
                                            fontSize: 11,
                                            fontWeight: "800",
                                        }}
                                    >
                                        Tap to open
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                ) : null}

                {guestMode ? (
                    <GlassCard style={{ marginBottom: 14 }} borderTint="rgba(120,190,140,0.28)">
                        <SectionLabel>Unlock the full app</SectionLabel>

                        <Text
                            style={{
                                color: theme.colors.textOnDark,
                                fontWeight: "800",
                                fontSize: 17,
                                marginBottom: 6,
                            }}
                        >
                            Sign in to unlock the full catalog
                        </Text>

                        <Text
                            style={{
                                color: theme.colors.textOnDarkSecondary,
                                lineHeight: 18,
                            }}
                        >
                            Guests can browse the homepage, open shared flower pages, and read the review guide.
                            The full reviews catalog, account tools, and community features open once you join.
                        </Text>

                        <View style={{ marginTop: 16, gap: 10 }}>
                            <Pressable
                                onPress={goToAuth}
                                style={({ pressed }) => ({
                                    minHeight: 50,
                                    borderRadius: 18,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: "rgba(244,245,247,0.94)",
                                    opacity: pressed ? 0.86 : 1,
                                })}
                            >
                                <Text style={{ color: "#11161E", fontWeight: "900", fontSize: 15 }}>Sign in</Text>
                            </Pressable>

                            <Pressable
                                onPress={goToCreateAccount}
                                style={({ pressed }) => ({
                                    minHeight: 50,
                                    borderRadius: 18,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderWidth: 1,
                                    borderColor: "rgba(212,175,55,0.30)",
                                    backgroundColor: "rgba(212,175,55,0.10)",
                                    opacity: pressed ? 0.86 : 1,
                                })}
                            >
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 15 }}>
                                    Create account
                                </Text>
                            </Pressable>
                        </View>
                    </GlassCard>
                ) : null}

                {!guestMode ? (
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Find members</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                            marginBottom: 10,
                        }}
                    >
                        Search for other people and open their public profile with reviews, followers, and helpful stats.
                    </Text>

                    <TextInput
                        value={userSearchQuery}
                        onChangeText={setUserSearchQuery}
                        placeholder="Search users"
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        style={{
                            backgroundColor: "rgba(0,0,0,0.18)",
                            borderColor: "rgba(255,255,255,0.16)",
                            borderWidth: 1,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            color: "white",
                            fontSize: 15,
                            marginBottom: userSearchQuery.trim() ? 12 : 0,
                        }}
                        returnKeyType="search"
                        autoCapitalize="words"
                        autoCorrect={false}
                    />

                    {userSearchQuery.trim().length > 0 ? (
                        filteredUsers.length > 0 ? (
                            filteredUsers.map((member, index) => (
                                <Pressable
                                    key={member.id}
                                    onPress={() => {
                                        if (member.id === uid) {
                                            router.push("/(tabs)/user");
                                            return;
                                        }
                                        router.push(`/(tabs)/user/profile/${encodeURIComponent(member.id)}`);
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingTop: index === 0 ? 0 : 12,
                                        paddingBottom: 12,
                                        borderTopWidth: index === 0 ? 0 : 1,
                                        borderTopColor: "rgba(255,255,255,0.08)",
                                        opacity: pressed ? 0.82 : 1,
                                    })}
                                >
                                    <ProfileAvatar avatarId={member.avatarId} photoURL={member.photoURL} size={46} />

                                    <View style={{ flex: 1, marginLeft: 12, paddingRight: 10 }}>
                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 15 }}>
                                            {member.displayName}
                                        </Text>
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4, lineHeight: 18 }}>
                                            {member.isAdmin ? "Admin" : member.isModerator ? "Moderator" : "Member profile"}
                                        </Text>
                                    </View>

                                    <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.55)" }}>›</Text>
                                </Pressable>
                            ))
                        ) : (
                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                No matching members yet.
                            </Text>
                        )
                    ) : null}
                </GlassCard>
                ) : null}

                <GlassCard style={{ marginBottom: 14 }}>
                    <MenuRow
                        title="Reviews and scale"
                        subtitle="How the bud score works, what the sliders mean, and why detailed reviews help other members."
                        onPress={() => router.push("/(tabs)/user/reviews-info")}
                    />
                </GlassCard>

                {!guestMode ? (
                    <GlassCard style={{ marginBottom: 14 }} borderTint="rgba(212,175,55,0.22)">
                        <SectionLabel>Badges</SectionLabel>

                        <Text
                            style={{
                                color: theme.colors.textOnDarkSecondary,
                                lineHeight: 18,
                                marginBottom: 12,
                            }}
                        >
                            These now unlock from your real community activity. We can still polish the artwork further, but the progression is live and much clearer.
                        </Text>

                        {badges.map((badge) => (
                            <BadgeItem
                                key={badge.key}
                                title={badge.title}
                                subtitle={badge.subtitle}
                                achieved={badge.achieved}
                                icon={badge.icon}
                                palette={badge.palette}
                            />
                        ))}
                    </GlassCard>
                ) : null}

                {/* Preferences & Personalisation */}
                {!guestMode ? (
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Preferences</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                            marginBottom: 10,
                        }}
                    >
                        {guestMode
                            ? "Preview avatar styles now. Profile editing unlocks once you create an account."
                            : "These help personalise what you see in the app. More personalisation options are coming."}
                    </Text>

                    <MenuRow
                        title="Edit profile name"
                        subtitle="Update the name shown on your profile and reviews."
                        rightLabel={editRightLabel}
                        locked={guestMode}
                        onPress={() => {
                            if (guestMode) {
                                goToAuth();
                                return;
                            }
                            router.push("/(tabs)/user/edit-profile");
                        }}
                    />

                    <Divider />

                    <MenuRow
                        title="Change avatar"
                        subtitle="Pick the avatar style shown on your profile."
                        rightLabel={guestMode ? "Locked" : "Open"}
                        locked={guestMode}
                        onPress={() => {
                            if (guestMode) {
                                goToAuth();
                                return;
                            }
                            setAvatarPickerOpen(true);
                        }}
                    />
                </GlassCard>
                ) : null}

                {!guestMode && isAdmin ? (
                    <GlassCard style={{ marginBottom: 14 }} borderTint="rgba(120,190,140,0.28)">
                        <SectionLabel>Admin</SectionLabel>

                        <MenuRow
                            title="Admin panel"
                            subtitle="Moderation, flagged reviews, and member checks."
                            rightLabel="Admin"
                            onPress={() => router.push("/(tabs)/user/admin-moderation")}
                        />
                    </GlassCard>
                ) : null}

                {/* Feedback & App Direction */}
                {!guestMode ? (
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>Help shape the app</SectionLabel>

                    <Text
                        style={{
                            color: theme.colors.textOnDarkSecondary,
                            lineHeight: 18,
                            marginBottom: 10,
                        }}
                    >
                        This app is evolving. Your feedback helps shape what comes next.
                    </Text>

                    <MenuRow
                        title="Send feedback"
                        subtitle="Bugs, ideas, features, new products. Anything welcome."
                        locked={guestMode}
                        rightLabel={guestMode ? "Locked" : undefined}
                        onPress={() => {
                            if (guestMode) {
                                goToAuth();
                                return;
                            }
                            router.push("/(tabs)/user/feedback");
                        }}
                    />
                </GlassCard>
                ) : null}

                {/* Account & Security */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <SectionLabel>{guestMode ? "Legal" : "Account"}</SectionLabel>

                    {!guestMode ? (
                        <>
                            <View style={{ marginBottom: 10 }}>
                                <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 12, fontWeight: "900" }}>
                                    Email
                                </Text>
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>
                                    {emailMasked || "Not available"}
                                </Text>
                            </View>

                            <Divider />

                            <View style={{ marginVertical: 10 }}>
                                <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 12, fontWeight: "900" }}>
                                    Verification
                                </Text>
                                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", marginTop: 4 }}>
                                    {emailVerified ? "Email verified" : "Pending verification"}
                                </Text>
                                {!emailVerified ? (
                                    <Text
                                        style={{
                                            color: theme.colors.textOnDarkSecondary,
                                            marginTop: 6,
                                            lineHeight: 18,
                                        }}
                                    >
                                        We can resend the verification email from here whenever you need it.
                                    </Text>
                                ) : null}
                            </View>

                            {!emailVerified ? (
                                <>
                                    <Divider />

                                    <MenuRow
                                        title="Resend verification email"
                                        subtitle="Send another verification email to the address on this account."
                                        rightLabel={verificationBusy ? "Sending..." : "Send"}
                                        onPress={verificationBusy ? undefined : resendVerificationEmail}
                                    />

                                    <Divider />
                                </>
                            ) : (
                                <Divider />
                            )}

                            <>
                                <MenuRow
                                    title="Change email"
                                    subtitle="Update the email you use to sign in."
                                    onPress={() => router.push("/(tabs)/user/change-email")}
                                />

                                <Divider />
                            </>
                        </>
                    ) : null}

                    <MenuRow
                        title="Terms and legal"
                        subtitle="Privacy, terms, and the sensible bits."
                        onPress={() => router.push("/(tabs)/user/legal")}
                    />

                    <Divider />

                    <MenuRow
                        title="Terpenes made simple"
                        subtitle="A plain-English guide to the main terpene profiles and what they often feel like."
                        onPress={() => router.push("/(tabs)/user/terpenes-info")}
                    />

                    {!guestMode ? (
                        <>
                            <Divider />

                            <MenuRow
                                title="Delete account"
                                subtitle="This is permanent. No tricks."
                                danger
                                onPress={() => router.push("/(tabs)/user/delete-account")}
                            />
                        </>
                    ) : null}
                </GlassCard>

                {/* Sign out */}
                {!guestMode ? (
                <GlassCard>
                    <MenuRow
                        title="Sign out"
                        subtitle="Sign out of this account on this device."
                        danger
                        onPress={() => {
                            Alert.alert("Sign out", "Are you sure you want to sign out?", [
                                { text: "Cancel", style: "cancel" },
                                { text: "Sign out", style: "destructive", onPress: handleSignOut },
                            ]);
                        }}
                    />
                </GlassCard>
                ) : null}

                <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                        Built with the community, improved by feedback.
                    </Text>
                </View>
                </ScrollView>

                <Modal
                    visible={statSheetOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setStatSheetOpen(false)}
                >
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "flex-end",
                            padding: 16,
                        }}
                    >
                        <Pressable
                            onPress={() => setStatSheetOpen(false)}
                            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.42)" }]}
                        />
                        <View
                            style={{
                                maxHeight: "78%",
                                borderRadius: 24,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.18)",
                                backgroundColor: "rgba(20,24,32,0.94)",
                            }}
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(212,175,55,0.14)",
                                    "rgba(255,255,255,0.06)",
                                    "rgba(0,0,0,0.18)",
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ padding: 18 }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text
                                            style={{
                                                fontSize: 22,
                                                fontWeight: "900",
                                                color: theme.colors.textOnDark,
                                            }}
                                        >
                                            {statSheetMeta[statSheetKind].title}
                                        </Text>
                                        <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                            {statSheetMeta[statSheetKind].subtitle}
                                        </Text>
                                    </View>

                                    <Pressable
                                        onPress={() => setStatSheetOpen(false)}
                                        style={({ pressed }) => ({
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: "rgba(255,255,255,0.10)",
                                            borderWidth: 1,
                                            borderColor: "rgba(255,255,255,0.14)",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            opacity: pressed ? 0.8 : 1,
                                        })}
                                    >
                                        <Ionicons name="close" size={20} color={theme.colors.textOnDark} />
                                    </Pressable>
                                </View>

                                <ScrollView
                                    style={{ marginTop: 16, maxHeight: 460 }}
                                    contentContainerStyle={{ paddingBottom: 10 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {statSheetLoading ? (
                                        <ActivityIndicator color={theme.colors.textOnDarkSecondary} style={{ marginVertical: 28 }} />
                                    ) : statSheetKind === "followers" ? (
                                        statSheetFollowers.length > 0 ? (
                                            statSheetFollowers.map((entry, index) => (
                                                <Pressable
                                                    key={entry.id}
                                                    onPress={() => {
                                                        setStatSheetOpen(false);
                                                        if (entry.id === uid) {
                                                            router.push("/(tabs)/user");
                                                            return;
                                                        }
                                                        router.push(`/(tabs)/user/profile/${encodeURIComponent(entry.id)}`);
                                                    }}
                                                    style={({ pressed }) => ({
                                                        flexDirection: "row",
                                                        alignItems: "center",
                                                        paddingTop: index === 0 ? 0 : 12,
                                                        paddingBottom: 12,
                                                        borderTopWidth: index === 0 ? 0 : 1,
                                                        borderTopColor: "rgba(255,255,255,0.08)",
                                                        opacity: pressed ? 0.82 : 1,
                                                    })}
                                                >
                                                    <ProfileAvatar avatarId={entry.avatarId} photoURL={entry.photoURL} size={46} />

                                                    <View style={{ flex: 1, marginLeft: 12, paddingRight: 10 }}>
                                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 15 }}>
                                                            {entry.displayName}
                                                        </Text>
                                                        <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4, lineHeight: 18 }}>
                                                            {entry.isAdmin ? "Admin" : entry.isModerator ? "Moderator" : "Member"}
                                                            {entry.createdAtMs ? ` · Followed ${formatStatDate(entry.createdAtMs)}` : ""}
                                                        </Text>
                                                    </View>

                                                    <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.55)" }}>›</Text>
                                                </Pressable>
                                            ))
                                        ) : (
                                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                                {statSheetMeta[statSheetKind].empty}
                                            </Text>
                                        )
                                    ) : statSheetReviews.length > 0 ? (
                                        statSheetReviews.map((review, index) => (
                                            <Pressable
                                                key={`${statSheetKind}-${review.id}-${index}`}
                                                onPress={() => {
                                                    setStatSheetOpen(false);
                                                    if (review.productId) {
                                                        router.push(`/(tabs)/reviews/${encodeURIComponent(review.productId)}`);
                                                    }
                                                }}
                                                style={({ pressed }) => ({
                                                    paddingTop: index === 0 ? 0 : 14,
                                                    paddingBottom: 14,
                                                    borderTopWidth: index === 0 ? 0 : 1,
                                                    borderTopColor: "rgba(255,255,255,0.08)",
                                                    opacity: pressed ? 0.82 : 1,
                                                })}
                                            >
                                                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 17 }}>
                                                            {review.productName}
                                                            {review.variant ? ` (${review.variant})` : ""}
                                                        </Text>
                                                        <Text style={{ marginTop: 5, color: theme.colors.textOnDarkSecondary, lineHeight: 19 }}>
                                                            {review.maker} · {formatStatDate(review.createdAtMs)}
                                                            {statSheetKind === "helpful_given" && review.authorName ? ` · ${review.authorName}` : ""}
                                                        </Text>
                                                    </View>

                                                    <View
                                                        style={{
                                                            borderRadius: 999,
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 6,
                                                            borderWidth: 1,
                                                            borderColor: "rgba(255,255,255,0.12)",
                                                            backgroundColor: "rgba(255,255,255,0.06)",
                                                        }}
                                                    >
                                                        <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "900" }}>
                                                            {(typeof review.score === "number" ? review.score : review.rating).toFixed(1)}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {statSheetKind !== "reviews" || review.helpfulCount > 0 ? (
                                                    <Text
                                                        style={{
                                                            marginTop: 8,
                                                            color: "rgba(255,255,255,0.62)",
                                                            fontSize: 12,
                                                            fontWeight: "800",
                                                        }}
                                                    >
                                                        {review.helpfulCount} helpful{review.helpfulCount === 1 ? "" : "s"}
                                                        {statSheetKind === "helpful_given" ? " · You marked this one helpful" : ""}
                                                    </Text>
                                                ) : null}

                                                {review.text ? (
                                                    <Text
                                                        style={{
                                                            marginTop: 8,
                                                            color: theme.colors.textOnDarkSecondary,
                                                            lineHeight: 20,
                                                        }}
                                                        numberOfLines={3}
                                                    >
                                                        {review.text}
                                                    </Text>
                                                ) : (
                                                    <Text
                                                        style={{
                                                            marginTop: 8,
                                                            color: theme.colors.textOnDarkSecondary,
                                                            lineHeight: 20,
                                                        }}
                                                    >
                                                        Open this flower to read the full review.
                                                    </Text>
                                                )}
                                            </Pressable>
                                        ))
                                    ) : (
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                            {statSheetMeta[statSheetKind].empty}
                                        </Text>
                                    )}
                                </ScrollView>
                            </LinearGradient>
                        </View>
                    </View>
                </Modal>

                {/* Avatar Picker */}
                <Modal
                    visible={avatarPickerOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setAvatarPickerOpen(false)}
                >
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "flex-end",
                            padding: 16,
                        }}
                    >
                        <Pressable
                            onPress={() => setAvatarPickerOpen(false)}
                            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.42)" }]}
                        />
                        <View
                            style={{
                                maxHeight: "82%",
                                borderRadius: 24,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.18)",
                                backgroundColor: "rgba(20,24,32,0.94)",
                            }}
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(212,175,55,0.14)",
                                    "rgba(255,255,255,0.06)",
                                    "rgba(0,0,0,0.18)",
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ padding: 18 }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text
                                            style={{
                                                fontSize: 22,
                                                fontWeight: "900",
                                                color: theme.colors.textOnDark,
                                            }}
                                        >
                                            {guestMode ? "Preview avatars" : "Pick an avatar"}
                                        </Text>
                                        <Text style={{ marginTop: 8, color: theme.colors.textOnDarkSecondary, lineHeight: 18 }}>
                                            {guestMode
                                                ? "These are the starter avatar styles. Sign in if you want to actually pick one."
                                                : "Choose a cleaner cropped avatar for your profile and reviews."}
                                        </Text>
                                    </View>

                                    <Pressable
                                        onPress={() => setAvatarPickerOpen(false)}
                                        style={({ pressed }) => ({
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: "rgba(255,255,255,0.10)",
                                            borderWidth: 1,
                                            borderColor: "rgba(255,255,255,0.14)",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            opacity: pressed ? 0.8 : 1,
                                        })}
                                    >
                                        <Ionicons name="close" size={20} color={theme.colors.textOnDark} />
                                    </Pressable>
                                </View>

                                <ScrollView
                                    style={{ marginTop: 16, maxHeight: 420 }}
                                    contentContainerStyle={{ paddingBottom: 10 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
                                        {AVATARS.map((a) => {
                                            const active = !guestMode && avatarId === a.id;
                                            return (
                                                <Pressable
                                                    key={a.id}
                                                    disabled={guestMode}
                                                    onPress={async () => {
                                                        if (guestMode) return;
                                                        await saveAvatar(a.id);
                                                        setAvatarPickerOpen(false);
                                                    }}
                                                    style={({ pressed }) => ({
                                                        width: "25%",
                                                        padding: 4,
                                                        opacity: guestMode ? 1 : pressed ? 0.8 : 1,
                                                    })}
                                                >
                                                    <View
                                                        style={{
                                                            borderRadius: 18,
                                                            padding: 6,
                                                            backgroundColor: active
                                                                ? "rgba(212,175,55,0.20)"
                                                                : "rgba(255,255,255,0.06)",
                                                            borderWidth: 1,
                                                            borderColor: active
                                                                ? "rgba(212,175,55,0.55)"
                                                                : "rgba(255,255,255,0.14)",
                                                        }}
                                                    >
                                                        <View
                                                            style={{
                                                                aspectRatio: 1,
                                                                borderRadius: 16,
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                overflow: "hidden",
                                                                backgroundColor: "rgba(255,255,255,0.06)",
                                                            }}
                                                        >
                                                            {a.image ? (
                                                                <Image
                                                                    source={a.image}
                                                                    resizeMode="cover"
                                                                    style={{
                                                                        width: "114%",
                                                                        height: "114%",
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
                                                            )}
                                                        </View>
                                                        <Text
                                                            numberOfLines={2}
                                                            style={{
                                                                marginTop: 8,
                                                                minHeight: 30,
                                                                color: theme.colors.textOnDark,
                                                                fontSize: 11,
                                                                lineHeight: 14,
                                                                fontWeight: active ? "900" : "700",
                                                                textAlign: "center",
                                                            }}
                                                        >
                                                            {a.label}
                                                        </Text>
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </ScrollView>

                                <Pressable
                                    onPress={async () => {
                                        if (guestMode) {
                                            setAvatarPickerOpen(false);
                                            goToAuth();
                                            return;
                                        }
                                        await saveAvatar(null);
                                        setAvatarPickerOpen(false);
                                    }}
                                    style={({ pressed }) => ({
                                        marginTop: 14,
                                        paddingVertical: 12,
                                        borderRadius: 14,
                                        alignItems: "center",
                                        backgroundColor: "rgba(255,255,255,0.10)",
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.14)",
                                        opacity: pressed ? 0.8 : 1,
                                    })}
                                >
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900" }}>
                                        {guestMode ? "Sign in to choose one" : "Use default bud"}
                                    </Text>
                                </Pressable>
                            </LinearGradient>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </BrandedScreenBackground>
    );
}
