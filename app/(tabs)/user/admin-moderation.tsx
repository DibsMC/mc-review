import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { summarizeReviewsForIdentity } from "../../../lib/reviewOwnership";
import { theme } from "../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

type AdminUserRow = {
    id: string;
    displayName: string;
    email: string;
    isAdmin: boolean;
    isModerator: boolean;
    accountBanned: boolean;
    banReason: string | null;
    accountDisabled: boolean;
    reviewRestrictionLevel: number;
    reviewRestrictionUntilMs: number | null;
    reviewRestrictionManual: boolean;
    followerCount: number;
    followingCount: number;
    helpfulCount: number;
    helpfulGivenCount: number;
    sessionCount: number;
    appOpenCount: number;
    lastActiveAtMs: number;
    lastOpenedAtMs: number;
    createdAtMs: number;
    analyticsEventCounts: Record<string, number>;
    reportedReviewMeta: Record<string, unknown>;
};

type AdminReviewRow = {
    id: string;
    userId: string;
    uid: string;
    authorUid: string;
    displayName: string;
    authorName: string;
    userName: string;
    email: string;
    authorEmail: string;
    userEmail: string;
    productId: string;
    moderationStatus: string;
    reportCount: number;
    helpfulCount: number;
    createdAtMs: number;
    text: string;
    authorDeleted: boolean;
    anonymisedAtMs: number | null;
};

type ReportEventRow = {
    id: string;
    path: string;
    source: "subcollection" | "user_doc";
    reviewId: string;
    productId: string;
    targetUserId: string;
    reporterUid: string;
    reporterDisplayName: string;
    reporterEmail: string;
    reviewTextPreview: string;
    createdAtMs: number;
};

type FlaggedReviewRow = {
    review: AdminReviewRow | null;
    reviewId: string;
    productId: string;
    authorUid: string;
    authorUser: AdminUserRow | null;
    authorName: string;
    authorEmail: string;
    reportCount: number;
    newestReportAtMs: number;
    reports: ReportEventRow[];
    text: string;
    moderationStatus: string;
};

type AdminSection = "members" | "admins" | "locked" | "flagged";
type ChartPoint = { label: string; value: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000;

function toMs(value: any): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return 0;
}

function formatDateTime(ms: number) {
    if (!ms) return "n/a";
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return "n/a";
    }
}

function formatCompact(value: number) {
    try {
        return new Intl.NumberFormat(undefined, {
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(value);
    } catch {
        return String(value);
    }
}

function formatLastSeen(ms: number) {
    if (!ms) return "No activity yet";
    const diff = Date.now() - ms;
    if (diff < 60 * 1000) return "Active just now";
    if (diff < 60 * 60 * 1000) return `Active ${Math.max(1, Math.round(diff / (60 * 1000)))}m ago`;
    if (diff < DAY_MS) return `Active ${Math.max(1, Math.round(diff / (60 * 60 * 1000)))}h ago`;
    return `Active ${Math.max(1, Math.round(diff / DAY_MS))}d ago`;
}

function reporterSummary(reports: ReportEventRow[]) {
    if (reports.length === 0) return "No reporters";
    const labels = Array.from(
        new Set(
            reports.map((report) => report.reporterDisplayName || report.reporterEmail || report.reporterUid).filter(Boolean)
        )
    );
    if (labels.length <= 2) return labels.join(" · ");
    return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2} more`;
}

function uniqueReporterDetails(reports: ReportEventRow[]) {
    const byUid = new Map<
        string,
        {
            uid: string;
            name: string;
            email: string;
        }
    >();

    reports.forEach((report) => {
        const uid = report.reporterUid?.trim() || "";
        if (!uid) return;
        if (byUid.has(uid)) return;
        byUid.set(uid, {
            uid,
            name: report.reporterDisplayName?.trim() || "Unknown reporter",
            email: report.reporterEmail?.trim().toLowerCase() || "",
        });
    });

    return Array.from(byUid.values());
}

function reportsFromUserDoc(user: AdminUserRow): ReportEventRow[] {
    const rawMeta = user.reportedReviewMeta;
    if (!rawMeta || typeof rawMeta !== "object") return [];

    return Object.entries(rawMeta).flatMap(([reviewId, rawValue]) => {
        if (!reviewId.trim() || !rawValue || typeof rawValue !== "object") return [];

        const value = rawValue as Record<string, unknown>;
        const createdAtMs =
            typeof value.createdAtMs === "number" && Number.isFinite(value.createdAtMs)
                ? value.createdAtMs
                : toMs(value.createdAt);

        return [
            {
                id: `${user.id}_${reviewId}`,
                path: `users/${user.id}`,
                source: "user_doc",
                reviewId:
                    typeof value.reviewId === "string" && value.reviewId.trim() ? value.reviewId.trim() : reviewId,
                productId: typeof value.productId === "string" ? value.productId : "",
                targetUserId: typeof value.targetUserId === "string" ? value.targetUserId : "",
                reporterUid: user.id,
                reporterDisplayName:
                    typeof value.reporterDisplayName === "string" && value.reporterDisplayName.trim()
                        ? value.reporterDisplayName.trim()
                        : user.displayName,
                reporterEmail:
                    typeof value.reporterEmail === "string" && value.reporterEmail.trim()
                        ? value.reporterEmail.trim().toLowerCase()
                        : user.email,
                reviewTextPreview:
                    typeof value.reviewTextPreview === "string" ? value.reviewTextPreview.trim() : "",
                createdAtMs,
            } satisfies ReportEventRow,
        ];
    });
}

function startOfLocalDay(ms: number) {
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function buildTrailingSeries(values: number[], days: number = 7): ChartPoint[] {
    const counts = new Map<number, number>();
    values.forEach((ms) => {
        if (!ms) return;
        const bucket = startOfLocalDay(ms);
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    });

    const today = startOfLocalDay(Date.now());
    return Array.from({ length: days }, (_, index) => {
        const bucket = today - (days - 1 - index) * DAY_MS;
        const label = new Date(bucket)
            .toLocaleDateString(undefined, { weekday: "short" })
            .slice(0, 3)
            .toUpperCase();
        return {
            label,
            value: counts.get(bucket) ?? 0,
        };
    });
}

function MetricTile({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <View
            style={{
                flexBasis: "47%",
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: 14,
            }}
        >
            <Text style={{ color: theme.colors.textOnDark, fontSize: 21, fontWeight: "900" }}>
                {value}
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
                {label}
            </Text>
            {hint ? (
                <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 6, lineHeight: 18, fontSize: 12 }}>
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}

function MiniChart({
    eyebrow,
    title,
    points,
    accentColor,
    hint,
}: {
    eyebrow: string;
    title: string;
    points: ChartPoint[];
    accentColor: string;
    hint?: string;
}) {
    const maxValue = Math.max(...points.map((point) => point.value), 1);

    return (
        <View
            style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                backgroundColor: "rgba(255,255,255,0.04)",
                padding: 14,
                marginTop: 12,
            }}
        >
            <Text
                style={{
                    color: "rgba(255,255,255,0.62)",
                    fontSize: 11,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                }}
            >
                {eyebrow}
            </Text>
            <Text style={{ color: theme.colors.textOnDark, fontSize: 18, fontWeight: "900", marginTop: 6 }}>
                {title}
            </Text>
            {hint ? (
                <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 18, marginTop: 4 }}>
                    {hint}
                </Text>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 14 }}>
                {points.map((point) => {
                    const barHeight = Math.max(8, Math.round((point.value / maxValue) * 72));
                    return (
                        <View key={`${eyebrow}-${point.label}`} style={{ flex: 1, alignItems: "center" }}>
                            <View
                                style={{
                                    width: "100%",
                                    height: 84,
                                    borderRadius: 14,
                                    backgroundColor: "rgba(255,255,255,0.04)",
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.08)",
                                    justifyContent: "flex-end",
                                    paddingHorizontal: 5,
                                    paddingBottom: 5,
                                }}
                            >
                                <View
                                    style={{
                                        height: barHeight,
                                        borderRadius: 10,
                                        backgroundColor: accentColor,
                                    }}
                                />
                            </View>
                            <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "800", fontSize: 11, marginTop: 8 }}>
                                {point.value}
                            </Text>
                            <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 10, marginTop: 2 }}>
                                {point.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

function GlassCard({
    children,
    borderTint,
}: {
    children: React.ReactNode;
    borderTint?: string;
}) {
    return (
        <View
            style={{
                borderRadius: 22,
                padding: 16,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: borderTint ?? "rgba(255,255,255,0.14)",
                backgroundColor: "rgba(11,15,22,0.80)",
            }}
        >
            {children}
        </View>
    );
}

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            style={{
                color: "rgba(255,255,255,0.60)",
                fontSize: 12,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 10,
            }}
        >
            {children}
        </Text>
    );
}

function roleLabel(user: AdminUserRow) {
    if (user.isAdmin) return "Admin";
    if (user.isModerator) return "Moderator";
    return "Member";
}

export default function AdminModerationScreen() {
    const router = useRouter();
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();

    const [gateResolved, setGateResolved] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
    const [reports, setReports] = useState<ReportEventRow[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSection, setActiveSection] = useState<AdminSection>("members");
    const [busyUserId, setBusyUserId] = useState<string | null>(null);
    const [busyReviewId, setBusyReviewId] = useState<string | null>(null);

    useEffect(() => {
        if (!auth || !firestore) return;
        const currentUid = auth().currentUser?.uid ?? "";
        if (!currentUid) {
            setIsAdmin(false);
            setUsers([]);
            setReviews([]);
            setReports([]);
            setGateResolved(true);
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(currentUid)
            .onSnapshot(
                (doc) => {
                    setIsAdmin(!!doc.data()?.isAdmin);
                    setGateResolved(true);
                },
                () => {
                    setIsAdmin(false);
                    setGateResolved(true);
                }
            );

        return () => unsub();
    }, [auth, firestore]);

    useEffect(() => {
        if (!firestore || !isAdmin) return;

        setLoadingUsers(true);
        const unsub = firestore()
            .collection("users")
            .onSnapshot(
                (snapshot) => {
                    const next = snapshot.docs.map((doc) => {
                        const data = (doc.data() as any) ?? {};
                        return {
                            id: doc.id,
                            displayName:
                                typeof data?.displayName === "string" && data.displayName.trim()
                                    ? data.displayName.trim()
                                    : "Member",
                            email: typeof data?.email === "string" ? data.email.trim().toLowerCase() : "",
                            isAdmin: !!data?.isAdmin,
                            isModerator: !!data?.isModerator,
                            accountBanned: !!data?.accountBanned,
                            banReason:
                                typeof data?.banReason === "string" && data.banReason.trim()
                                    ? data.banReason.trim()
                                    : null,
                            accountDisabled: !!data?.accountDisabled,
                            reviewRestrictionLevel:
                                typeof data?.reviewRestrictionLevel === "number" ? data.reviewRestrictionLevel : 0,
                            reviewRestrictionUntilMs:
                                typeof data?.reviewRestrictionUntilMs === "number" ? data.reviewRestrictionUntilMs : null,
                            reviewRestrictionManual: !!data?.reviewRestrictionManual,
                            followerCount:
                                typeof data?.followerCount === "number"
                                    ? Math.max(0, data.followerCount)
                                    : typeof data?.followersCount === "number"
                                        ? Math.max(0, data.followersCount)
                                        : 0,
                            followingCount:
                                typeof data?.followingCount === "number"
                                    ? Math.max(0, data.followingCount)
                                    : 0,
                            helpfulCount:
                                typeof data?.helpfulCount === "number"
                                    ? Math.max(0, data.helpfulCount)
                                    : typeof data?.helpfulReceivedCount === "number"
                                        ? Math.max(0, data.helpfulReceivedCount)
                                        : 0,
                            helpfulGivenCount:
                                typeof data?.helpfulGiven === "number"
                                    ? Math.max(0, data.helpfulGiven)
                                    : typeof data?.helpfulGivenCount === "number"
                                        ? Math.max(0, data.helpfulGivenCount)
                                        : 0,
                            sessionCount:
                                typeof data?.sessionCount === "number"
                                    ? Math.max(0, data.sessionCount)
                                    : 0,
                            appOpenCount:
                                typeof data?.appOpenCount === "number"
                                    ? Math.max(0, data.appOpenCount)
                                    : 0,
                            lastActiveAtMs: toMs(data?.lastActiveAt ?? data?.lastOpenedAt),
                            lastOpenedAtMs: toMs(data?.lastOpenedAt),
                            createdAtMs: toMs(data?.createdAt ?? data?.created_at),
                            analyticsEventCounts:
                                data?.analyticsEventCounts && typeof data.analyticsEventCounts === "object"
                                    ? (data.analyticsEventCounts as Record<string, number>)
                                    : {},
                            reportedReviewMeta:
                                data?.reportedReviewMeta && typeof data.reportedReviewMeta === "object"
                                    ? (data.reportedReviewMeta as Record<string, unknown>)
                                    : {},
                        } satisfies AdminUserRow;
                    });

                    next.sort((a, b) => a.displayName.localeCompare(b.displayName));
                    setUsers(next);
                    setLoadingUsers(false);
                },
                () => {
                    setUsers([]);
                    setLoadingUsers(false);
                }
            );

        return () => unsub();
    }, [firestore, isAdmin]);

    useEffect(() => {
        if (!firestore || !isAdmin) return;

        setLoadingReviews(true);
        const unsub = firestore()
            .collection("reviews")
            .onSnapshot(
                (snapshot) => {
                    const next = snapshot.docs.map((doc) => {
                        const data = (doc.data() as any) ?? {};
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
                            moderationStatus: typeof data?.moderationStatus === "string" ? data.moderationStatus : "active",
                            reportCount: typeof data?.reportCount === "number" ? Math.max(0, data.reportCount) : 0,
                            helpfulCount: typeof data?.helpfulCount === "number" ? Math.max(0, data.helpfulCount) : 0,
                            createdAtMs: toMs(data?.createdAt),
                            text: typeof data?.text === "string" ? data.text.trim() : "",
                            authorDeleted: !!data?.authorDeleted,
                            anonymisedAtMs: typeof data?.anonymisedAtMs === "number" ? data.anonymisedAtMs : null,
                        } satisfies AdminReviewRow;
                    });

                    next.sort((a, b) => {
                        const reportDiff = b.reportCount - a.reportCount;
                        if (reportDiff !== 0) return reportDiff;
                        return b.createdAtMs - a.createdAtMs;
                    });

                    setReviews(next);
                    setLoadingReviews(false);
                },
                () => {
                    setReviews([]);
                    setLoadingReviews(false);
                }
            );

        return () => unsub();
    }, [firestore, isAdmin]);

    useEffect(() => {
        if (!firestore || !isAdmin) return;

        const unsub = firestore()
            .collectionGroup("reportedReviews")
            .onSnapshot(
                (snapshot) => {
                    const next = snapshot.docs.map((doc) => {
                        const data = (doc.data() as any) ?? {};
                        return {
                            id: doc.id,
                            path: doc.ref.path,
                            source: "subcollection",
                            reviewId:
                                typeof data?.reviewId === "string" && data.reviewId.trim()
                                    ? data.reviewId.trim()
                                    : doc.id,
                            productId: typeof data?.productId === "string" ? data.productId : "",
                            targetUserId: typeof data?.targetUserId === "string" ? data.targetUserId : "",
                            reporterUid: doc.ref.parent.parent?.id ?? "",
                            reporterDisplayName:
                                typeof data?.reporterDisplayName === "string" ? data.reporterDisplayName.trim() : "",
                            reporterEmail:
                                typeof data?.reporterEmail === "string" ? data.reporterEmail.trim().toLowerCase() : "",
                            reviewTextPreview:
                                typeof data?.reviewTextPreview === "string" ? data.reviewTextPreview.trim() : "",
                            createdAtMs: Math.max(
                                toMs(data?.createdAt),
                                typeof data?.createdAtMs === "number" && Number.isFinite(data.createdAtMs)
                                    ? data.createdAtMs
                                    : 0
                            ),
                        } satisfies ReportEventRow;
                    });

                    next.sort((a, b) => b.createdAtMs - a.createdAtMs);
                    setReports(next);
                },
                () => {
                    setReports([]);
                }
            );

        return () => unsub();
    }, [firestore, isAdmin]);

    const memberCount = users.length;
    const userById = useMemo(
        () =>
            Object.fromEntries(users.map((user) => [user.id, user] satisfies [string, AdminUserRow])) as Record<string, AdminUserRow>,
        [users]
    );
    const reviewById = useMemo(
        () =>
            Object.fromEntries(reviews.map((review) => [review.id, review] satisfies [string, AdminReviewRow])) as Record<string, AdminReviewRow>,
        [reviews]
    );
    const elevatedMembers = useMemo(() => users.filter((user) => user.isAdmin || user.isModerator), [users]);
    const docReports = useMemo(() => users.flatMap((user) => reportsFromUserDoc(user)), [users]);
    const allReports = useMemo(() => {
        const merged = new Map<string, ReportEventRow>();

        [...reports, ...docReports].forEach((report) => {
            if (!report.reviewId || !report.reporterUid) return;
            const key = `${report.reporterUid}:${report.reviewId}`;
            const current = merged.get(key);
            if (!current || report.createdAtMs >= current.createdAtMs) {
                merged.set(key, report);
            }
        });

        return Array.from(merged.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
    }, [docReports, reports]);
    const lockedMembers = useMemo(
        () =>
            users.filter(
                (user) =>
                    user.accountBanned ||
                    user.accountDisabled ||
                    user.reviewRestrictionManual ||
                    user.reviewRestrictionLevel >= 3 ||
                    ((user.reviewRestrictionUntilMs ?? 0) > Date.now())
            ),
        [users]
    );
    const flaggedReviews = useMemo<FlaggedReviewRow[]>(() => {
        const grouped = new Map<string, ReportEventRow[]>();
        allReports.forEach((report) => {
            if (!report.reviewId) return;
            const current = grouped.get(report.reviewId) ?? [];
            current.push(report);
            grouped.set(report.reviewId, current);
        });

        const candidateReviewIds = new Set<string>(grouped.keys());
        reviews.forEach((review) => {
            const shouldInclude =
                review.reportCount > 0 ||
                review.moderationStatus === "under_review" ||
                review.moderationStatus === "removed_auto" ||
                review.moderationStatus === "removed_admin";
            if (shouldInclude) {
                candidateReviewIds.add(review.id);
            }
        });

        const next: FlaggedReviewRow[] = [];

        Array.from(candidateReviewIds).forEach((reviewId) => {
                const reviewReports = grouped.get(reviewId) ?? [];
                const review = reviewById[reviewId] ?? null;
                const authorUid = review?.userId || reviewReports[0]?.targetUserId || "";
                const authorUser = authorUid ? userById[authorUid] ?? null : null;
                const authorName =
                    authorUser?.displayName ||
                    review?.displayName ||
                    review?.authorName ||
                    review?.userName ||
                    "Member";
                const authorEmail =
                    authorUser?.email ||
                    review?.email ||
                    review?.authorEmail ||
                    review?.userEmail ||
                    "";

                const reportCount = Math.max(review?.reportCount ?? 0, reviewReports.length);
                const moderationStatus = review?.moderationStatus || "under_review";
                const shouldKeep =
                    reportCount > 0 ||
                    moderationStatus === "removed_auto" ||
                    moderationStatus === "removed_admin";

                if (!shouldKeep) {
                    return;
                }

                next.push({
                    review,
                    reviewId,
                    productId: review?.productId || reviewReports[0]?.productId || "",
                    authorUid,
                    authorUser,
                    authorName,
                    authorEmail,
                    reportCount,
                    newestReportAtMs: reviewReports.reduce(
                        (latest, report) => Math.max(latest, report.createdAtMs),
                        review?.createdAtMs ?? 0
                    ),
                    reports: [...reviewReports].sort((a, b) => b.createdAtMs - a.createdAtMs),
                    text: review?.text || reviewReports[0]?.reviewTextPreview || "",
                    moderationStatus,
                });
            });

        return next.sort((a, b) => {
                const reportDiff = b.reportCount - a.reportCount;
                if (reportDiff !== 0) return reportDiff;
                return b.newestReportAtMs - a.newestReportAtMs;
            });
    }, [allReports, reviewById, userById]);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredUsers = useMemo(() => {
        if (!normalizedQuery) return users;
        return users.filter((user) => {
            const haystack = `${user.displayName} ${user.email} ${roleLabel(user)} ${user.accountBanned ? "banned" : ""} ${user.accountDisabled ? "locked" : ""} ${user.banReason ?? ""}`.toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [normalizedQuery, users]);

    const filteredAdmins = useMemo(
        () => elevatedMembers.filter((user) => !normalizedQuery || `${user.displayName} ${user.email}`.toLowerCase().includes(normalizedQuery)),
        [elevatedMembers, normalizedQuery]
    );

    const filteredLockedMembers = useMemo(
        () => lockedMembers.filter((user) => !normalizedQuery || `${user.displayName} ${user.email}`.toLowerCase().includes(normalizedQuery)),
        [lockedMembers, normalizedQuery]
    );

    const filteredFlaggedReviews = useMemo(
        () =>
            flaggedReviews.filter((review) => {
                if (!normalizedQuery) return true;
                const haystack = `${review.reviewId} ${review.authorUid} ${review.authorName} ${review.authorEmail} ${review.productId} ${review.text} ${reporterSummary(review.reports)}`.toLowerCase();
                return haystack.includes(normalizedQuery);
            }),
        [flaggedReviews, normalizedQuery]
    );

    const reviewSummaryByUser = useMemo(() => {
        const summaries: Record<string, { reviewCount: number; productCount: number; helpfulTotal: number }> = {};

        users.forEach((user) => {
            const summary = summarizeReviewsForIdentity(reviews, {
                uid: user.id,
                displayName: user.displayName,
                email: user.email,
            });

            summaries[user.id] = {
                reviewCount: summary.reviewCount,
                productCount: summary.productCount,
                helpfulTotal: summary.helpfulTotal,
            };
        });

        return summaries;
    }, [reviews, users]);

    const analyticsSummary = useMemo(() => {
        const todayStartMs = startOfLocalDay(Date.now());
        const totalReviews = reviews.length;
        const deletedReviews = reviews.filter(
            (review) =>
                review.authorDeleted ||
                review.userId.startsWith("deleted:") ||
                review.moderationStatus === "removed_auto" ||
                review.moderationStatus === "removed_admin"
        ).length;
        const underReviewCount = flaggedReviews.length;
        const totalReports = allReports.length;
        const helpfulTotal = users.reduce(
            (sum, user) => sum + Math.max(user.helpfulCount, reviewSummaryByUser[user.id]?.helpfulTotal ?? 0),
            0
        );
        const followersTotal = users.reduce((sum, user) => sum + user.followerCount, 0);
        const helpfulGivenTotal = users.reduce((sum, user) => sum + user.helpfulGivenCount, 0);
        const followingTotal = users.reduce((sum, user) => sum + user.followingCount, 0);
        const sessionsTotal = users.reduce(
            (sum, user) => sum + Math.max(user.sessionCount, user.appOpenCount),
            0
        );
        const appOpensTotal = users.reduce((sum, user) => sum + user.appOpenCount, 0);
        const activeNowCount = users.filter(
            (user) => user.lastActiveAtMs > 0 && Date.now() - user.lastActiveAtMs <= ACTIVE_NOW_WINDOW_MS
        ).length;
        const activeTodayCount = users.filter(
            (user) => user.lastActiveAtMs > 0 && user.lastActiveAtMs >= todayStartMs
        ).length;
        const signInCount = users.reduce(
            (sum, user) => sum + (user.analyticsEventCounts.sign_in_complete ?? 0),
            0
        );
        const reviewSubmitCount = users.reduce(
            (sum, user) => sum + (user.analyticsEventCounts.review_submit ?? 0),
            0
        );
        const helpfulTapCount = users.reduce(
            (sum, user) => sum + (user.analyticsEventCounts.review_helpful_added ?? 0),
            0
        );

        return {
            totalReviews,
            deletedReviews,
            underReviewCount,
            totalReports,
            helpfulTotal,
            followersTotal,
            helpfulGivenTotal,
            followingTotal,
            sessionsTotal,
            appOpensTotal,
            activeNowCount,
            activeTodayCount,
            signInCount,
            reviewSubmitCount,
            helpfulTapCount,
            reviewSeries: buildTrailingSeries(reviews.map((review) => review.createdAtMs).filter(Boolean)),
            memberSeries: buildTrailingSeries(users.map((user) => user.createdAtMs).filter(Boolean)),
            activitySeries: buildTrailingSeries(users.map((user) => user.lastActiveAtMs).filter(Boolean)),
        };
    }, [allReports.length, flaggedReviews.length, reviewSummaryByUser, reviews, users]);

    const setUserRole = async (user: AdminUserRow, nextRole: "member" | "moderator" | "admin") => {
        if (!firestore) return;
        try {
            setBusyUserId(user.id);
            await firestore()
                .collection("users")
                .doc(user.id)
                .set(
                    {
                        isAdmin: nextRole === "admin",
                        isModerator: nextRole === "moderator",
                    },
                    { merge: true }
                );
        } catch (error: any) {
            Alert.alert("Could not update role", error?.message ?? "Unknown error");
        } finally {
            setBusyUserId(null);
        }
    };

    const unlockMember = async (user: AdminUserRow) => {
        if (!firestore) return;
        try {
            setBusyUserId(user.id);
            await firestore()
                .collection("users")
                .doc(user.id)
                .set(
                    {
                        accountDisabled: false,
                        reviewRestrictionManual: false,
                        reviewRestrictionLevel: 0,
                        reviewRestrictionUntilMs: null,
                    },
                    { merge: true }
                );
        } catch (error: any) {
            Alert.alert("Could not unlock member", error?.message ?? "Unknown error");
        } finally {
            setBusyUserId(null);
        }
    };

    const banMember = async (user: AdminUserRow) => {
        if (!firestore) return;
        try {
            setBusyUserId(user.id);
            await firestore()
                .collection("users")
                .doc(user.id)
                .set(
                    {
                        accountBanned: true,
                        accountDisabled: true,
                        banReason: user.banReason ?? "Banned by admin",
                        reviewRestrictionManual: true,
                    },
                    { merge: true }
                );
        } catch (error: any) {
            Alert.alert("Could not ban member", error?.message ?? "Unknown error");
        } finally {
            setBusyUserId(null);
        }
    };

    const liftBan = async (user: AdminUserRow) => {
        if (!firestore) return;
        try {
            setBusyUserId(user.id);
            await firestore()
                .collection("users")
                .doc(user.id)
                .set(
                    {
                        accountBanned: false,
                        accountDisabled: false,
                        banReason: null,
                    },
                    { merge: true }
                );
        } catch (error: any) {
            Alert.alert("Could not lift ban", error?.message ?? "Unknown error");
        } finally {
            setBusyUserId(null);
        }
    };

    const clearReviewFlag = async (review: FlaggedReviewRow) => {
        if (!firestore) return;
        try {
            setBusyReviewId(review.reviewId);

            const legacyReports = review.reports.filter((report) => report.source === "subcollection" && report.path);
            for (let index = 0; index < legacyReports.length; index += 200) {
                const chunk = legacyReports.slice(index, index + 200);
                const batch = firestore().batch();
                chunk.forEach((report) => batch.delete(firestore().doc(report.path)));
                await batch.commit();
            }

            const reporterIds = Array.from(new Set(review.reports.map((report) => report.reporterUid).filter(Boolean)));
            if (reporterIds.length > 0) {
                const batch = firestore().batch();
                reporterIds.forEach((reporterUid) => {
                    const userRef = firestore().collection("users").doc(reporterUid);
                    batch.set(
                        userRef,
                        {
                            [`reportedReviewIds.${review.reviewId}`]: firestore.FieldValue.delete(),
                            [`reportedReviewMeta.${review.reviewId}`]: firestore.FieldValue.delete(),
                        },
                        { merge: true }
                    );
                });
                await batch.commit();
            }

            if (review.review) {
                await firestore()
                    .collection("reviews")
                    .doc(review.reviewId)
                    .set(
                        {
                            reportCount: 0,
                            moderationStatus: "active",
                        },
                        { merge: true }
                    );
            }
        } catch (error: any) {
            Alert.alert("Could not update review", error?.message ?? "Unknown error");
        } finally {
            setBusyReviewId(null);
        }
    };

    const deleteReview = async (review: FlaggedReviewRow) => {
        if (!firestore || !review.review) return;
        try {
            setBusyReviewId(review.reviewId);

            const legacyReports = review.reports.filter((report) => report.source === "subcollection" && report.path);
            for (let index = 0; index < legacyReports.length; index += 200) {
                const chunk = legacyReports.slice(index, index + 200);
                const batch = firestore().batch();
                chunk.forEach((report) => batch.delete(firestore().doc(report.path)));
                await batch.commit();
            }

            const reporterIds = Array.from(new Set(review.reports.map((report) => report.reporterUid).filter(Boolean)));
            if (reporterIds.length > 0) {
                const batch = firestore().batch();
                reporterIds.forEach((reporterUid) => {
                    const userRef = firestore().collection("users").doc(reporterUid);
                    batch.set(
                        userRef,
                        {
                            [`reportedReviewIds.${review.reviewId}`]: firestore.FieldValue.delete(),
                            [`reportedReviewMeta.${review.reviewId}`]: firestore.FieldValue.delete(),
                        },
                        { merge: true }
                    );
                });
                await batch.commit();
            }

            await firestore()
                .collection("reviews")
                .doc(review.reviewId)
                .set(
                    {
                        reportCount: 0,
                        moderationStatus: "removed_admin",
                        removedAtMs: Date.now(),
                    },
                    { merge: true }
                );
        } catch (error: any) {
            Alert.alert("Could not remove review", error?.message ?? "Unknown error");
        } finally {
            setBusyReviewId(null);
        }
    };

    if (!auth || !firestore) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
                <Text style={{ color: theme.colors.textOnDark, fontSize: 20, fontWeight: "900" }}>
                    Admin unavailable
                </Text>
                <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 8, textAlign: "center" }}>
                    Required modules did not load. Please close and reopen the app.
                </Text>
            </SafeAreaView>
        );
    }

    if (!gateResolved) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
            </SafeAreaView>
        );
    }

    if (!isAdmin) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
                <Text style={{ color: theme.colors.textOnDark, fontSize: 20, fontWeight: "900" }}>
                    Admin only
                </Text>
                <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 8, textAlign: "center" }}>
                    This screen is only available on admin accounts.
                </Text>
            </SafeAreaView>
        );
    }

    const overviewCards: Array<{ key: AdminSection; label: string; value: string }> = [
        { key: "members", label: "Members", value: String(memberCount) },
        { key: "admins", label: "Admins", value: String(elevatedMembers.length) },
        { key: "locked", label: "Locked", value: String(lockedMembers.length) },
        { key: "flagged", label: "Flagged reviews", value: String(flaggedReviews.length) },
    ];

    const renderUserRow = (user: AdminUserRow, showUnlock: boolean) => {
        const reviewSummary = reviewSummaryByUser[user.id] ?? {
            reviewCount: 0,
            productCount: 0,
            helpfulTotal: 0,
        };
        const helpfulReceived = Math.max(user.helpfulCount, reviewSummary.helpfulTotal);
        const statusLine = user.accountBanned
            ? `Banned${user.banReason ? ` · ${user.banReason}` : ""}`
            : user.accountDisabled
                ? "Locked account"
                : user.reviewRestrictionManual || user.reviewRestrictionLevel >= 3
                    ? "Posting restricted"
                    : null;

        return (
            <View
                key={user.id}
                style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255,255,255,0.08)",
                }}
            >
                <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                    {user.displayName}
                </Text>
                <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4, lineHeight: 19 }}>
                    {user.email || user.id}
                </Text>
                <Text style={{ color: "rgba(255,230,190,0.90)", marginTop: 4, lineHeight: 19 }}>
                    {roleLabel(user)} · {reviewSummary.reviewCount} reviews · {reviewSummary.productCount} flowers · {helpfulReceived} helpfuls · {user.followerCount} followers
                </Text>
                <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4, lineHeight: 18 }}>
                    {formatCompact(Math.max(user.sessionCount, user.appOpenCount))} sessions · {user.helpfulGivenCount} helpfuls given · {user.followingCount} following
                </Text>
                <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4, lineHeight: 18 }}>
                    {formatLastSeen(user.lastActiveAtMs)}
                </Text>
                {statusLine ? (
                    <Text style={{ color: "rgba(255,183,183,0.90)", marginTop: 4, lineHeight: 18 }}>
                        {statusLine}
                    </Text>
                ) : null}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {(["member", "moderator", "admin"] as const).map((role) => {
                        const active =
                            (role === "member" && !user.isAdmin && !user.isModerator) ||
                            (role === "moderator" && user.isModerator) ||
                            (role === "admin" && user.isAdmin);

                        return (
                            <Pressable
                                key={`${user.id}-${role}`}
                                onPress={() => {
                                    void setUserRole(user, role);
                                }}
                                disabled={busyUserId === user.id}
                                style={({ pressed }) => ({
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: active ? "rgba(120,190,140,0.28)" : "rgba(255,255,255,0.12)",
                                    backgroundColor: active ? "rgba(27,68,48,0.72)" : "rgba(255,255,255,0.06)",
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    opacity: busyUserId === user.id ? 0.6 : pressed ? 0.82 : 1,
                                })}
                            >
                                <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                                    {role === "member" ? "Member" : role === "moderator" ? "Moderator" : "Admin"}
                                </Text>
                            </Pressable>
                        );
                    })}

                    {showUnlock ? (
                        <Pressable
                            onPress={() => {
                                void unlockMember(user);
                            }}
                            disabled={busyUserId === user.id || user.accountBanned}
                            style={({ pressed }) => ({
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: "rgba(255,212,123,0.26)",
                                backgroundColor: "rgba(84,62,22,0.58)",
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                opacity: busyUserId === user.id || user.accountBanned ? 0.45 : pressed ? 0.82 : 1,
                            })}
                        >
                            <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                                Unlock
                            </Text>
                        </Pressable>
                    ) : null}

                    <Pressable
                        onPress={() => {
                            if (user.accountBanned) {
                                void liftBan(user);
                                return;
                            }
                            void banMember(user);
                        }}
                        disabled={busyUserId === user.id}
                        style={({ pressed }) => ({
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: user.accountBanned ? "rgba(120,190,140,0.28)" : "rgba(233,126,126,0.26)",
                            backgroundColor: user.accountBanned ? "rgba(27,68,48,0.68)" : "rgba(94,37,37,0.58)",
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            opacity: busyUserId === user.id ? 0.6 : pressed ? 0.82 : 1,
                        })}
                    >
                        <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                            {user.accountBanned ? "Lift ban" : "Ban"}
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    const currentSectionTitle =
        activeSection === "members"
            ? "All members"
            : activeSection === "admins"
                ? "Admins and moderators"
                : activeSection === "locked"
                    ? "Locked and banned accounts"
                    : "Flagged reviews";

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(8,10,15,0.35)" }}>
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 22,
                    paddingBottom: 24,
                }}
                showsVerticalScrollIndicator={false}
            >
                <GlassCard borderTint="rgba(120,190,140,0.24)">
                    <SectionLabel>Admin overview</SectionLabel>
                    <Text style={{ color: theme.colors.textOnDark, fontSize: 24, fontWeight: "900", marginBottom: 8 }}>
                        Review Budz admin panel
                    </Text>
                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                        Search members, change roles, ban or unlock accounts, and clear flagged reviews from one place.
                    </Text>
                </GlassCard>

                <GlassCard borderTint="rgba(255,214,122,0.24)">
                    <SectionLabel>Community analytics</SectionLabel>
                    <Text style={{ color: theme.colors.textOnDark, fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
                        Live totals and activity
                    </Text>
                    <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                        Active now is based on signed-in members seen in the last 5 minutes. Active today resets at local midnight. Sessions are all-time tracked foreground starts, with app opens shown separately where available.
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                        <MetricTile label="Active now" value={String(analyticsSummary.activeNowCount)} hint="Seen in the last 5 minutes" />
                        <MetricTile label="Active today" value={String(analyticsSummary.activeTodayCount)} hint="Seen since midnight" />
                        <MetricTile label="Sessions" value={formatCompact(analyticsSummary.sessionsTotal)} hint={`${formatCompact(analyticsSummary.appOpensTotal)} app opens recorded overall`} />
                        <MetricTile label="Reviews total" value={formatCompact(analyticsSummary.totalReviews)} hint={`${analyticsSummary.underReviewCount} in the moderation queue`} />
                        <MetricTile label="Removed or anonymised" value={formatCompact(analyticsSummary.deletedReviews)} hint="Deleted-account and removed review records" />
                        <MetricTile label="Helpfuls received" value={formatCompact(analyticsSummary.helpfulTotal)} hint={`${formatCompact(analyticsSummary.helpfulGivenTotal)} helpfuls given`} />
                        <MetricTile label="Followers total" value={formatCompact(analyticsSummary.followersTotal)} hint={`${formatCompact(analyticsSummary.followingTotal)} following links`} />
                        <MetricTile label="Reports raised" value={formatCompact(analyticsSummary.totalReports)} hint={`${flaggedReviews.length} currently needing attention`} />
                    </View>

                    <Text style={{ color: "rgba(255,230,190,0.90)", marginTop: 14, lineHeight: 19 }}>
                        Tracked events: {formatCompact(analyticsSummary.signInCount)} sign-ins · {formatCompact(analyticsSummary.reviewSubmitCount)} review submissions · {formatCompact(analyticsSummary.helpfulTapCount)} helpful taps
                    </Text>

                    <MiniChart
                        eyebrow="Trend"
                        title="Reviews shared"
                        points={analyticsSummary.reviewSeries}
                        accentColor="rgba(231,194,97,0.96)"
                        hint="Daily review activity over the last 7 days."
                    />
                    <MiniChart
                        eyebrow="Trend"
                        title="New members"
                        points={analyticsSummary.memberSeries}
                        accentColor="rgba(95,188,148,0.96)"
                        hint="Accounts created over the last 7 days."
                    />
                    <MiniChart
                        eyebrow="Trend"
                        title="Member activity"
                        points={analyticsSummary.activitySeries}
                        accentColor="rgba(111,155,246,0.96)"
                        hint="Members last seen on each of the last 7 days."
                    />
                </GlassCard>

                <GlassCard>
                    <SectionLabel>Search</SectionLabel>
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search users or flagged reviews"
                        placeholderTextColor="rgba(255,255,255,0.42)"
                        style={{
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.12)",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            color: theme.colors.textOnDark,
                            fontSize: 15,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </GlassCard>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                    {overviewCards.map((stat) => (
                        <Pressable
                            key={stat.key}
                            onPress={() => setActiveSection(stat.key)}
                            style={({ pressed }) => ({
                                flexBasis: "47%",
                                borderRadius: 18,
                                borderWidth: 1,
                                borderColor:
                                    activeSection === stat.key ? "rgba(120,190,140,0.28)" : "rgba(255,255,255,0.14)",
                                backgroundColor:
                                    activeSection === stat.key ? "rgba(18,44,33,0.82)" : "rgba(11,15,22,0.78)",
                                overflow: "hidden",
                                padding: 14,
                                opacity: pressed ? 0.82 : 1,
                            })}
                        >
                            <Text style={{ color: theme.colors.textOnDark, fontSize: 18, fontWeight: "900" }}>
                                {loadingUsers || loadingReviews ? "..." : stat.value}
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
                        </Pressable>
                    ))}
                </View>

                <GlassCard>
                    <SectionLabel>{currentSectionTitle}</SectionLabel>

                    {activeSection === "members" ? (
                        loadingUsers ? (
                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                        ) : filteredUsers.length === 0 ? (
                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                No matching members found.
                            </Text>
                        ) : (
                            filteredUsers.map((user) => renderUserRow(user, false))
                        )
                    ) : null}

                    {activeSection === "admins" ? (
                        loadingUsers ? (
                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                        ) : filteredAdmins.length === 0 ? (
                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                No admins or moderators match that search.
                            </Text>
                        ) : (
                            filteredAdmins.map((user) => renderUserRow(user, false))
                        )
                    ) : null}

                    {activeSection === "locked" ? (
                        loadingUsers ? (
                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                        ) : filteredLockedMembers.length === 0 ? (
                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                No locked or restricted members right now.
                            </Text>
                        ) : (
                            filteredLockedMembers.map((user) => renderUserRow(user, true))
                        )
                    ) : null}

                    {activeSection === "flagged" ? (
                        loadingReviews ? (
                            <ActivityIndicator color={theme.colors.textOnDarkSecondary} />
                        ) : filteredFlaggedReviews.length === 0 ? (
                            <Text style={{ color: theme.colors.textOnDarkSecondary, lineHeight: 20 }}>
                                Nothing is flagged right now.
                            </Text>
                        ) : (
                            filteredFlaggedReviews.map((review) => (
                                <View
                                    key={review.reviewId}
                                    style={{
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: "rgba(255,255,255,0.08)",
                                    }}
                                >
                                    <Text style={{ color: theme.colors.textOnDark, fontWeight: "900", fontSize: 16 }}>
                                        {review.authorName}
                                    </Text>
                                    <Text style={{ color: "rgba(255,255,255,0.58)", marginTop: 4, lineHeight: 17, fontSize: 12 }}>
                                        Review author
                                    </Text>
                                    <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4 }}>
                                        Product: {review.productId || "Unknown"} · Review: {review.reviewId.slice(0, 8)}
                                    </Text>
                                    <Text style={{ color: "rgba(255,230,190,0.90)", marginTop: 4 }}>
                                        {review.reportCount} reports · {review.moderationStatus} · {formatDateTime(review.newestReportAtMs)}
                                    </Text>
                                    {review.authorEmail ? (
                                        <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 4, lineHeight: 18 }}>
                                            {review.authorEmail}
                                        </Text>
                                    ) : null}
                                    <Text style={{ color: "rgba(255,255,255,0.52)", marginTop: 4, lineHeight: 17, fontSize: 12 }}>
                                        Member UID: {review.authorUid || "missing"}
                                    </Text>
                                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, lineHeight: 18 }}>
                                        Reported by {reporterSummary(review.reports)}
                                    </Text>
                                    {uniqueReporterDetails(review.reports).length > 0 ? (
                                        uniqueReporterDetails(review.reports).map((reporter) => (
                                            <View key={reporter.uid} style={{ marginTop: 4 }}>
                                                <Text style={{ color: "rgba(255,255,255,0.82)", lineHeight: 18, fontSize: 13 }}>
                                                    {reporter.name}
                                                </Text>
                                                {reporter.email ? (
                                                    <Text style={{ color: "rgba(255,255,255,0.58)", lineHeight: 17, fontSize: 12 }}>
                                                        {reporter.email}
                                                    </Text>
                                                ) : null}
                                                <Text style={{ color: "rgba(255,255,255,0.52)", lineHeight: 17, fontSize: 12 }}>
                                                    Reporter UID: {reporter.uid}
                                                </Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={{ color: "rgba(255,255,255,0.52)", marginTop: 4, lineHeight: 17, fontSize: 12 }}>
                                            Reporter details unavailable for this older flag.
                                        </Text>
                                    )}
                                    {review.text ? (
                                        <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, lineHeight: 19 }} numberOfLines={3}>
                                            {review.text}
                                        </Text>
                                    ) : null}

                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                                        {review.authorUid ? (
                                            <Pressable
                                                onPress={() => router.push(`/(tabs)/user/profile/${encodeURIComponent(review.authorUid)}`)}
                                                style={({ pressed }) => ({
                                                    borderRadius: 999,
                                                    borderWidth: 1,
                                                    borderColor: "rgba(160,198,255,0.24)",
                                                    backgroundColor: "rgba(33,48,76,0.58)",
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 8,
                                                    opacity: pressed ? 0.82 : 1,
                                                })}
                                            >
                                                <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                                                    Open member
                                                </Text>
                                            </Pressable>
                                        ) : null}

                                        <Pressable
                                            onPress={() => {
                                                void clearReviewFlag(review);
                                            }}
                                            disabled={busyReviewId === review.reviewId}
                                            style={({ pressed }) => ({
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: "rgba(255,212,123,0.26)",
                                                backgroundColor: "rgba(84,62,22,0.58)",
                                                paddingHorizontal: 10,
                                                paddingVertical: 8,
                                                opacity: busyReviewId === review.reviewId ? 0.6 : pressed ? 0.82 : 1,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                                                {busyReviewId === review.reviewId ? "Updating..." : "Clear report"}
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => {
                                                void deleteReview(review);
                                            }}
                                            disabled={busyReviewId === review.reviewId || !review.review}
                                            style={({ pressed }) => ({
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: "rgba(233,126,126,0.26)",
                                                backgroundColor: "rgba(94,37,37,0.58)",
                                                paddingHorizontal: 10,
                                                paddingVertical: 8,
                                                opacity: busyReviewId === review.reviewId || !review.review ? 0.45 : pressed ? 0.82 : 1,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                                                Delete review
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => {
                                                if (review.authorUser) {
                                                    void banMember(review.authorUser);
                                                }
                                            }}
                                            disabled={busyReviewId === review.reviewId || !review.authorUser}
                                            style={({ pressed }) => ({
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: "rgba(233,126,126,0.26)",
                                                backgroundColor: "rgba(94,37,37,0.48)",
                                                paddingHorizontal: 10,
                                                paddingVertical: 8,
                                                opacity: busyReviewId === review.reviewId || !review.authorUser ? 0.45 : pressed ? 0.82 : 1,
                                            })}
                                        >
                                            <Text style={{ color: theme.colors.textOnDark, fontSize: 12, fontWeight: "800" }}>
                                                Ban member
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        )
                    ) : null}
                </GlassCard>
            </ScrollView>
        </SafeAreaView>
    );
}
