import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";
import { theme } from "../../../lib/theme";

type ReviewStatus = "active" | "under_review" | "removed_auto" | "removed_admin";
type ReviewSort = "mostReported" | "recent";
type AdminTab = "members" | "flagged" | "banLog";
type MemberFilter = "all" | "banned" | "restricted";
type BanLogAction = "banned" | "unbanned";

type AdminUserRow = {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  createdAtMs: number;
  accountDisabled: boolean;
  reviewRestrictionLevel: number;
  reviewRestrictionUntilMs: number | null;
  reviewRestrictionManual: boolean;
};

type AdminReviewRow = {
  id: string;
  userId: string;
  productId: string;
  text: string;
  createdAtMs: number;
  reportCount: number;
  helpfulCount: number;
  moderationStatus: ReviewStatus;
};

type BanLogRow = {
  id: string;
  action: BanLogAction;
  targetUserId: string;
  targetEmail: string;
  targetDisplayName: string;
  actorUserId: string;
  actorEmail: string;
  createdAtMs: number;
};

type MemberStats = {
  reviewsCount: number;
  helpfulReceived: number;
  helpfulGiven: number;
  favoritesCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(value: any): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function formatDateTime(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms)) return "n/a";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "n/a";
  }
}

function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, "_");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  const q = normalizeText(query);
  if (!q) return true;
  return values.some((value) => normalizeText(value).includes(q));
}

function postingLockLabel(user: AdminUserRow) {
  if (user.reviewRestrictionManual || user.reviewRestrictionLevel >= 3) {
    return "Posting locked (manual unlock required)";
  }
  if (typeof user.reviewRestrictionUntilMs === "number" && user.reviewRestrictionUntilMs > Date.now()) {
    return `Posting locked until ${formatDateTime(user.reviewRestrictionUntilMs)}`;
  }
  return "Posting open";
}

function shortUid(uid: string) {
  if (!uid) return "n/a";
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}...${uid.slice(-4)}`;
}

function mapAdminUserDoc(doc: any): AdminUserRow {
  const data = (doc.data() as any) ?? {};
  const rawEmail = data.email;
  const email =
    typeof rawEmail === "string"
      ? rawEmail.trim().toLowerCase()
      : rawEmail != null
      ? String(rawEmail).trim().toLowerCase()
      : "";

  return {
    id: doc.id,
    displayName:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : "New Member",
    email,
    isAdmin: !!data.isAdmin,
    createdAtMs: toMs(data.createdAt ?? data.created_at),
    accountDisabled: !!data.accountDisabled,
    reviewRestrictionLevel:
      typeof data.reviewRestrictionLevel === "number" ? data.reviewRestrictionLevel : 0,
    reviewRestrictionUntilMs:
      typeof data.reviewRestrictionUntilMs === "number" ? data.reviewRestrictionUntilMs : null,
    reviewRestrictionManual: !!data.reviewRestrictionManual,
  };
}

function mapAdminReviewDoc(doc: any): AdminReviewRow {
  const data = (doc.data() as any) ?? {};
  const status = typeof data.moderationStatus === "string" ? data.moderationStatus : "active";

  return {
    id: doc.id,
    userId: typeof data.userId === "string" ? data.userId : "",
    productId: typeof data.productId === "string" ? data.productId : "",
    text: typeof data.text === "string" ? data.text : "",
    createdAtMs: toMs(data.createdAt),
    reportCount: typeof data.reportCount === "number" ? data.reportCount : 0,
    helpfulCount: typeof data.helpfulCount === "number" ? data.helpfulCount : 0,
    moderationStatus:
      status === "under_review" || status === "removed_auto" || status === "removed_admin"
        ? status
        : "active",
  };
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active ? styles.pillOn : null,
        { opacity: pressed ? 0.86 : 1 },
      ]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

function ActionPill({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionPill,
        danger ? styles.actionPillDanger : null,
        disabled ? styles.actionPillDisabled : null,
        { opacity: disabled ? 0.45 : pressed ? 0.86 : 1 },
      ]}
    >
      <Text style={[styles.actionPillText, danger ? styles.actionPillTextDanger : null]}>{label}</Text>
    </Pressable>
  );
}

function SearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

export default function AdminModerationScreen() {
  const auth = getFirebaseAuth();
  const firestore = getFirebaseFirestore();
  const router = useRouter();

  if (!auth || !firestore) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.title}>Admin moderation unavailable</Text>
          <Text style={styles.subtitle}>Required modules did not load. Please close and reopen the app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentUser = auth().currentUser;
  const currentUid = currentUser?.uid ?? "";
  const currentEmail = normalizeText(currentUser?.email ?? "");

  const [gateResolved, setGateResolved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("members");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [reviewSort, setReviewSort] = useState<ReviewSort>("mostReported");

  const [memberSearch, setMemberSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [banSearch, setBanSearch] = useState("");

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [banLogs, setBanLogs] = useState<BanLogRow[]>([]);
  const [memberStatsByUid, setMemberStatsByUid] = useState<Record<string, MemberStats>>({});
  const [usersLoading, setUsersLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [banLogsLoading, setBanLogsLoading] = useState(true);
  const [showFloatingTools, setShowFloatingTools] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const floatingVisibleRef = useRef(false);

  useEffect(() => {
    if (!currentUid) {
      setIsAdmin(false);
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
  }, [currentUid, firestore]);

  useEffect(() => {
    if (!isAdmin) {
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);
    let cancelled = false;
    const usersRef = firestore().collection("users");

    const applySnapshot = (snap: any) => {
      if (cancelled) return;
      const next: AdminUserRow[] = snap.docs.map((doc: any) => mapAdminUserDoc(doc));
      setUsers(next);
      setUsersLoading(false);
    };

    // Force a fresh server read so this screen doesn't stay on stale cached docs.
    usersRef
      .get({ source: "server" })
      .then(applySnapshot)
      .catch(() => {
        // Keep listener below as fallback for offline/cache.
      });

    const unsub = usersRef.onSnapshot(
      (snap) => applySnapshot(snap),
      () => setUsersLoading(false)
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [isAdmin, firestore]);

  useEffect(() => {
    if (!isAdmin) {
      setReviewsLoading(false);
      return;
    }

    setReviewsLoading(true);
    const unsub = firestore()
      .collection("reviews")
      .onSnapshot(
        (snap) => {
          const next: AdminReviewRow[] = snap.docs.map((doc) => {
            const data = (doc.data() as any) ?? {};
            const status = typeof data.moderationStatus === "string" ? data.moderationStatus : "active";
            return {
              id: doc.id,
              userId: typeof data.userId === "string" ? data.userId : "",
              productId: typeof data.productId === "string" ? data.productId : "",
              text: typeof data.text === "string" ? data.text : "",
              createdAtMs: toMs(data.createdAt),
              reportCount: typeof data.reportCount === "number" ? data.reportCount : 0,
              helpfulCount: typeof data.helpfulCount === "number" ? data.helpfulCount : 0,
              moderationStatus:
                status === "under_review" || status === "removed_auto" || status === "removed_admin"
                  ? status
                  : "active",
            };
          });
          setReviews(next);
          setReviewsLoading(false);
        },
        () => setReviewsLoading(false)
      );

    return () => unsub();
  }, [isAdmin, firestore]);

  useEffect(() => {
    if (!isAdmin) {
      setBanLogsLoading(false);
      return;
    }

    setBanLogsLoading(true);
    const unsub = firestore()
      .collection("adminBanLog")
      .orderBy("createdAtMs", "desc")
      .limit(300)
      .onSnapshot(
        (snap) => {
          const next: BanLogRow[] = snap.docs.map((doc) => {
            const data = (doc.data() as any) ?? {};
            return {
              id: doc.id,
              action: data.action === "unbanned" ? "unbanned" : "banned",
              targetUserId: typeof data.targetUserId === "string" ? data.targetUserId : "",
              targetEmail: typeof data.targetEmail === "string" ? data.targetEmail : "",
              targetDisplayName: typeof data.targetDisplayName === "string" ? data.targetDisplayName : "",
              actorUserId: typeof data.actorUserId === "string" ? data.actorUserId : "",
              actorEmail: typeof data.actorEmail === "string" ? data.actorEmail : "",
              createdAtMs:
                typeof data.createdAtMs === "number" ? data.createdAtMs : toMs(data.createdAt),
            };
          });
          setBanLogs(next);
          setBanLogsLoading(false);
        },
        () => setBanLogsLoading(false)
      );

    return () => unsub();
  }, [isAdmin, firestore]);

  useEffect(() => {
    if (!isAdmin) {
      setMemberStatsByUid({});
      return;
    }

    let cancelled = false;

    const collectCounts = async () => {
      try {
        const [helpfulSnap, favoritesSnap] = await Promise.all([
          firestore().collectionGroup("helpful").get(),
          firestore().collectionGroup("favorites").get(),
        ]);

        const helpfulGivenByUid: Record<string, number> = {};
        helpfulSnap.docs.forEach((doc) => {
          const uid = doc.ref.parent.parent?.id ?? "";
          if (!uid) return;
          helpfulGivenByUid[uid] = (helpfulGivenByUid[uid] ?? 0) + 1;
        });

        const favoritesByUid: Record<string, number> = {};
        favoritesSnap.docs.forEach((doc) => {
          const uid = doc.ref.parent.parent?.id ?? "";
          if (!uid) return;
          favoritesByUid[uid] = (favoritesByUid[uid] ?? 0) + 1;
        });

        if (cancelled) return;

        const next: Record<string, MemberStats> = {};
        users.forEach((user) => {
          next[user.id] = {
            reviewsCount: 0,
            helpfulReceived: 0,
            helpfulGiven: helpfulGivenByUid[user.id] ?? 0,
            favoritesCount: favoritesByUid[user.id] ?? 0,
          };
        });

        reviews.forEach((review) => {
          const uid = review.userId;
          if (!uid || uid.startsWith("deleted:")) return;
          if (!next[uid]) {
            next[uid] = {
              reviewsCount: 0,
              helpfulReceived: 0,
              helpfulGiven: helpfulGivenByUid[uid] ?? 0,
              favoritesCount: favoritesByUid[uid] ?? 0,
            };
          }
          next[uid].reviewsCount += 1;
          next[uid].helpfulReceived +=
            typeof review.helpfulCount === "number" && Number.isFinite(review.helpfulCount)
              ? Math.max(0, review.helpfulCount)
              : 0;
        });

        setMemberStatsByUid(next);
      } catch {
        if (!cancelled) {
          setMemberStatsByUid({});
        }
      }
    };

    collectCounts();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, firestore, reviews, users]);

  const usersById = useMemo(() => {
    const map: Record<string, AdminUserRow> = {};
    users.forEach((user) => {
      map[user.id] = user;
    });
    return map;
  }, [users]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.accountDisabled !== b.accountDisabled) return a.accountDisabled ? -1 : 1;
      return b.createdAtMs - a.createdAtMs;
    });
  }, [users]);

  const restrictedUsersCount = useMemo(() => {
    const now = Date.now();
    return users.filter(
      (user) =>
        user.reviewRestrictionManual ||
        (typeof user.reviewRestrictionUntilMs === "number" && user.reviewRestrictionUntilMs > now)
    ).length;
  }, [users]);

  const usersWithEmailCount = useMemo(() => {
    return users.filter((user) => !!normalizeText(user.email)).length;
  }, [users]);

  const filteredMembers = useMemo(() => {
    const now = Date.now();
    return sortedUsers.filter((user) => {
      const isRestricted =
        user.reviewRestrictionManual ||
        (typeof user.reviewRestrictionUntilMs === "number" && user.reviewRestrictionUntilMs > now);

      if (memberFilter === "banned" && !user.accountDisabled) return false;
      if (memberFilter === "restricted" && !isRestricted) return false;

      return matchesQuery(memberSearch, [user.displayName, user.email, user.id]);
    });
  }, [memberFilter, memberSearch, sortedUsers]);

  const flaggedReviews = useMemo(() => {
    const base = reviews.filter(
      (review) => review.reportCount > 0 || review.moderationStatus !== "active"
    );

    const sorted =
      reviewSort === "mostReported"
        ? base.sort((a, b) => {
            const byReports = b.reportCount - a.reportCount;
            if (byReports !== 0) return byReports;
            return b.createdAtMs - a.createdAtMs;
          })
        : base.sort((a, b) => b.createdAtMs - a.createdAtMs);

    return sorted.filter((review) => {
      const user = usersById[review.userId];
      return matchesQuery(reviewSearch, [
        review.id,
        review.userId,
        user?.displayName,
        user?.email,
        review.productId,
        review.text,
      ]);
    });
  }, [reviewSort, reviews, reviewSearch, usersById]);

  const currentBannedUsers = useMemo(() => {
    return users
      .filter((user) => user.accountDisabled)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .filter((user) => matchesQuery(banSearch, [user.displayName, user.email, user.id]));
  }, [banSearch, users]);

  const filteredBanLogs = useMemo(() => {
    return banLogs.filter((entry) =>
      matchesQuery(banSearch, [
        entry.targetDisplayName,
        entry.targetEmail,
        entry.targetUserId,
        entry.actorEmail,
        entry.actorUserId,
        entry.action,
      ])
    );
  }, [banLogs, banSearch]);

  const floatingSearchValue =
    activeTab === "members" ? memberSearch : activeTab === "flagged" ? reviewSearch : banSearch;

  const floatingSearchPlaceholder =
    activeTab === "members"
      ? "Search members..."
      : activeTab === "flagged"
      ? "Search flagged reviews..."
      : "Search bans...";

  const setFloatingSearchValue = useCallback(
    (text: string) => {
      if (activeTab === "members") {
        setMemberSearch(text);
      } else if (activeTab === "flagged") {
        setReviewSearch(text);
      } else {
        setBanSearch(text);
      }
    },
    [activeTab]
  );

  const patchUser = useCallback(
    async (targetUid: string, patch: Record<string, unknown>) => {
      await firestore()
        .collection("users")
        .doc(targetUid)
        .set(
          {
            ...patch,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    },
    [firestore]
  );

  const patchReview = useCallback(
    async (reviewId: string, patch: Record<string, unknown>) => {
      await firestore()
        .collection("reviews")
        .doc(reviewId)
        .set(
          {
            ...patch,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    },
    [firestore]
  );

  const writeBanLog = useCallback(
    async (entry: {
      action: BanLogAction;
      targetUserId: string;
      targetEmail: string;
      targetDisplayName: string;
    }) => {
      await firestore().collection("adminBanLog").add({
        ...entry,
        actorUserId: currentUid,
        actorEmail: currentEmail,
        createdAtMs: Date.now(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [currentEmail, currentUid, firestore]
  );

  const setEmailBan = useCallback(
    async (email: string, targetUid: string, targetDisplayName: string, active: boolean) => {
      const normalizedEmail = normalizeText(email);
      if (!normalizedEmail) return;

      const emailKey = normalizeEmailKey(normalizedEmail);
      await firestore()
        .collection("bannedEmails")
        .doc(emailKey)
        .set(
          {
            email: normalizedEmail,
            targetUserId: targetUid,
            targetDisplayName,
            active,
            updatedAtMs: Date.now(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUid,
          },
          { merge: true }
        );
    },
    [currentUid, firestore]
  );

  const toggleBan = useCallback(
    (target: AdminUserRow) => {
      if (target.id === currentUid) {
        Alert.alert("Blocked", "You cannot ban your own account.");
        return;
      }
      const nextBanned = !target.accountDisabled;
      const title = nextBanned ? "Ban user" : "Restore user";
      const message = nextBanned
        ? "This user will be signed out and blocked from app access."
        : "This user will regain app access.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: nextBanned ? "Ban" : "Restore",
          style: nextBanned ? "destructive" : "default",
          onPress: async () => {
            try {
              await patchUser(target.id, {
                accountDisabled: nextBanned,
                accountDisabledAtMs: nextBanned ? Date.now() : null,
              });
              await setEmailBan(target.email, target.id, target.displayName, nextBanned);
              await writeBanLog({
                action: nextBanned ? "banned" : "unbanned",
                targetUserId: target.id,
                targetEmail: target.email,
                targetDisplayName: target.displayName,
              });
              Alert.alert(
                "Updated",
                nextBanned
                  ? `${target.displayName} has been banned.`
                  : `${target.displayName} has been restored.`
              );
            } catch (error: any) {
              Alert.alert("Action failed", error?.message ?? "Could not update account status.");
            }
          },
        },
      ]);
    },
    [currentUid, patchUser, setEmailBan, writeBanLog]
  );

  const setPostingLock = useCallback(
    async (target: AdminUserRow, lock: "clear" | "7d" | "14d" | "manual") => {
      const now = Date.now();
      let patch: Record<string, unknown>;
      if (lock === "clear") {
        patch = {
          reviewRestrictionLevel: 0,
          reviewRestrictionUntilMs: null,
          reviewRestrictionManual: false,
        };
      } else if (lock === "7d") {
        patch = {
          reviewRestrictionLevel: 1,
          reviewRestrictionUntilMs: now + 7 * DAY_MS,
          reviewRestrictionManual: false,
        };
      } else if (lock === "14d") {
        patch = {
          reviewRestrictionLevel: 2,
          reviewRestrictionUntilMs: now + 14 * DAY_MS,
          reviewRestrictionManual: false,
        };
      } else {
        patch = {
          reviewRestrictionLevel: 3,
          reviewRestrictionUntilMs: null,
          reviewRestrictionManual: true,
        };
      }

      try {
        await patchUser(target.id, patch);
      } catch (error: any) {
        Alert.alert("Action failed", error?.message ?? "Could not update posting restriction.");
      }
    },
    [patchUser]
  );

  const deleteDocsInUserSubcollection = useCallback(
    async (uid: string, subcollection: string) => {
      while (true) {
        const snap = await firestore()
          .collection("users")
          .doc(uid)
          .collection(subcollection)
          .limit(200)
          .get();
        if (snap.empty) break;
        const batch = firestore().batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        if (snap.size < 200) break;
      }
    },
    [firestore]
  );

  const anonymiseReviewsByUser = useCallback(
    async (uid: string) => {
      const deletedUserId = `deleted:${uid}`;
      while (true) {
        const snap = await firestore().collection("reviews").where("userId", "==", uid).limit(200).get();
        if (snap.empty) break;
        const batch = firestore().batch();
        snap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            userId: deletedUserId,
            authorDeleted: true,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            anonymisedAtMs: Date.now(),
          });
        });
        await batch.commit();
        if (snap.size < 200) break;
      }
    },
    [firestore]
  );

  const deleteMemberAccount = useCallback(
    (target: AdminUserRow) => {
      if (target.id === currentUid) {
        Alert.alert("Blocked", "You cannot delete your own account from admin tools.");
        return;
      }

      Alert.alert(
        "Delete account",
        "Admin delete is permanent. This will disable this member's access, anonymise their reviews, and strip profile data.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete account",
            style: "destructive",
            onPress: async () => {
              try {
                await anonymiseReviewsByUser(target.id);
                await deleteDocsInUserSubcollection(target.id, "helpful");
                await deleteDocsInUserSubcollection(target.id, "reportedReviews");
                await deleteDocsInUserSubcollection(target.id, "notifications");
                await deleteDocsInUserSubcollection(target.id, "following");
                await deleteDocsInUserSubcollection(target.id, "favorites");
                await deleteDocsInUserSubcollection(target.id, "favourites");

                await patchUser(target.id, {
                  accountDisabled: true,
                  accountDeleted: true,
                  accountDeletedAtMs: Date.now(),
                  displayName: "Deleted member",
                  reviewRestrictionLevel: 3,
                  reviewRestrictionUntilMs: null,
                  reviewRestrictionManual: true,
                });

                await setEmailBan(target.email, target.id, target.displayName, true);
                await writeBanLog({
                  action: "banned",
                  targetUserId: target.id,
                  targetEmail: target.email,
                  targetDisplayName: target.displayName,
                });

                Alert.alert("Account deleted", "Member account data has been deleted.");
              } catch (error: any) {
                Alert.alert("Delete failed", error?.message ?? "Could not delete this member account.");
              }
            },
          },
        ]
      );
    },
    [
      anonymiseReviewsByUser,
      currentUid,
      deleteDocsInUserSubcollection,
      patchUser,
      setEmailBan,
      writeBanLog,
    ]
  );

  const clearReportsForReview = useCallback(
    async (reviewId: string) => {
      while (true) {
        const reportsSnap = await firestore()
          .collection("reviewReports")
          .where("reviewId", "==", reviewId)
          .limit(200)
          .get();
        if (reportsSnap.empty) break;

        const batch = firestore().batch();
        reportsSnap.docs.forEach((doc) => {
          const reporterUid = typeof doc.data()?.reporterUserId === "string" ? doc.data()?.reporterUserId : "";
          batch.delete(doc.ref);
          if (reporterUid) {
            batch.delete(
              firestore()
                .collection("users")
                .doc(reporterUid)
                .collection("reportedReviews")
                .doc(reviewId)
            );
          }
        });
        await batch.commit();
        if (reportsSnap.size < 200) break;
      }
    },
    [firestore]
  );

  const setModerationState = useCallback(
    async (review: AdminReviewRow, nextStatus: ReviewStatus) => {
      if (nextStatus === "active") {
        try {
          await clearReportsForReview(review.id);
          await patchReview(review.id, {
            moderationStatus: "active",
            reportCount: 0,
            removedAtMs: null,
          });
          Alert.alert("Review restored", "Review is active again and previous reports were cleared.");
        } catch (error: any) {
          Alert.alert("Action failed", error?.message ?? "Could not restore review.");
        }
        return;
      }

      const patch: Record<string, unknown> = { moderationStatus: nextStatus };
      if (nextStatus === "removed_admin" || nextStatus === "removed_auto") {
        patch.removedAtMs = Date.now();
      } else {
        patch.removedAtMs = null;
      }

      try {
        await patchReview(review.id, patch);
        Alert.alert("Updated", `Review set to ${nextStatus.replace("_", " ")}.`);
      } catch (error: any) {
        Alert.alert("Action failed", error?.message ?? "Could not update moderation state.");
      }
    },
    [clearReportsForReview, patchReview]
  );

  const hardDeleteReview = useCallback(
    (review: AdminReviewRow) => {
      Alert.alert(
        "Delete review permanently",
        "This removes the review document permanently. Use only when required.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete forever",
            style: "destructive",
            onPress: async () => {
              try {
                await firestore().collection("reviews").doc(review.id).delete();
              } catch (error: any) {
                Alert.alert("Delete failed", error?.message ?? "Could not delete review.");
              }
            },
          },
        ]
      );
    },
    [firestore]
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y || 0;
    const shouldShow = y > 220;
    if (floatingVisibleRef.current !== shouldShow) {
      floatingVisibleRef.current = shouldShow;
      setShowFloatingTools(shouldShow);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  if (!gateResolved) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUid || !isAdmin) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.title}>Admin only</Text>
          <Text style={styles.subtitle}>
            This moderation panel is only available to approved admin accounts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Moderation</Text>
          <Text style={styles.subtitle}>
            Auto-moderation threshold is set to 5 unique reports per review.
          </Text>
          <View style={styles.filterRow}>
            <Pill
              label="Members"
              active={activeTab === "members"}
              onPress={() => setActiveTab("members")}
            />
            <Pill
              label="Flagged Reviews"
              active={activeTab === "flagged"}
              onPress={() => setActiveTab("flagged")}
            />
            <Pill
              label="Ban Log"
              active={activeTab === "banLog"}
              onPress={() => setActiveTab("banLog")}
            />
          </View>
        </View>

        {activeTab === "members" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.meta}>
              {usersLoading
                ? "Loading members..."
                : `${users.length} users | ${usersWithEmailCount} with email | ${users.filter((u) => u.accountDisabled).length} banned | ${restrictedUsersCount} restricted`}
            </Text>

            <SearchInput
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Search members by name, email or UID"
            />

            <View style={styles.filterRow}>
              <Pill
                label="All"
                active={memberFilter === "all"}
                onPress={() => setMemberFilter("all")}
              />
              <Pill
                label="Banned"
                active={memberFilter === "banned"}
                onPress={() => setMemberFilter("banned")}
              />
              <Pill
                label="Restricted"
                active={memberFilter === "restricted"}
                onPress={() => setMemberFilter("restricted")}
              />
            </View>

            {filteredMembers.length === 0 ? (
              <Text style={styles.emptyText}>No members match this search/filter.</Text>
            ) : null}

            {filteredMembers.map((target) => {
              const stats = memberStatsByUid[target.id] ?? {
                reviewsCount: 0,
                helpfulReceived: 0,
                helpfulGiven: 0,
                favoritesCount: 0,
              };
              return (
                <View key={target.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{target.displayName}</Text>
                    {target.isAdmin ? <Text style={styles.badge}>Admin</Text> : null}
                    {target.accountDisabled ? (
                      <Text style={[styles.badge, styles.badgeDanger]}>Banned</Text>
                    ) : null}
                  </View>

                  <Text style={styles.metaText}>
                    {target.email || "Email missing in profile"}
                  </Text>
                  <Text style={styles.metaText}>UID: {target.id}</Text>
                  <Text style={styles.metaText}>
                    Joined: {formatDateTime(target.createdAtMs)} | Reviews: {stats.reviewsCount}
                  </Text>
                  <Text style={styles.metaText}>
                    Favourites: {stats.favoritesCount} | Helpful given: {stats.helpfulGiven} | Helpful received: {stats.helpfulReceived}
                  </Text>
                  <Text style={styles.metaText}>{postingLockLabel(target)}</Text>

                  <View style={styles.actionRow}>
                    <ActionPill
                      label="Open profile"
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/user/admin-member/[uid]",
                          params: { uid: target.id },
                        })
                      }
                    />
                    <ActionPill
                      label={target.accountDisabled ? "Restore access" : "Ban account"}
                      onPress={() => toggleBan(target)}
                      danger={!target.accountDisabled}
                      disabled={target.id === currentUid}
                    />
                    <ActionPill
                      label="Delete account"
                      onPress={() => deleteMemberAccount(target)}
                      danger
                      disabled={target.id === currentUid}
                    />
                    <ActionPill label="Lock 7 days" onPress={() => setPostingLock(target, "7d")} />
                    <ActionPill label="Lock 14 days" onPress={() => setPostingLock(target, "14d")} />
                    <ActionPill label="Manual lock" onPress={() => setPostingLock(target, "manual")} />
                    <ActionPill label="Unlock posting" onPress={() => setPostingLock(target, "clear")} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {activeTab === "flagged" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Flagged Reviews</Text>
            <Text style={styles.meta}>
              {reviewsLoading
                ? "Loading flagged reviews..."
                : `${flaggedReviews.length} flagged reviews`}
            </Text>

            <SearchInput
              value={reviewSearch}
              onChangeText={setReviewSearch}
              placeholder="Search flagged reviews by user, email, UID or text"
            />

            <View style={styles.filterRow}>
              <Pill
                label="Most reported"
                active={reviewSort === "mostReported"}
                onPress={() => setReviewSort("mostReported")}
              />
              <Pill
                label="Recent"
                active={reviewSort === "recent"}
                onPress={() => setReviewSort("recent")}
              />
            </View>

            {flaggedReviews.length === 0 ? (
              <Text style={styles.emptyText}>No flagged reviews match this search.</Text>
            ) : null}

            {flaggedReviews.map((review) => {
              const user = usersById[review.userId];
              const userLabel = user
                ? `${user.displayName} (${user.email || `uid ${shortUid(user.id)}`})`
                : review.userId || "Unknown user";

              return (
                <View key={review.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>Review {review.id.slice(0, 8)}</Text>
                    <Text style={styles.badge}>{review.moderationStatus}</Text>
                  </View>
                  <Text style={styles.metaText}>Reports: {review.reportCount}</Text>
                  <Text style={styles.metaText}>User: {userLabel}</Text>
                  <Text style={styles.metaText}>
                    Product: {review.productId || "Unknown"} | Created: {formatDateTime(review.createdAtMs)}
                  </Text>
                  {review.text ? (
                    <Text style={styles.reviewText} numberOfLines={3}>
                      {review.text}
                    </Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    <ActionPill
                      label="Under review"
                      onPress={() => setModerationState(review, "under_review")}
                    />
                    <ActionPill
                      label="Remove"
                      danger
                      onPress={() => setModerationState(review, "removed_admin")}
                    />
                    <ActionPill label="Restore" onPress={() => setModerationState(review, "active")} />
                    <ActionPill
                      label="Delete forever"
                      danger
                      onPress={() => hardDeleteReview(review)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {activeTab === "banLog" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ban Log</Text>
              <Text style={styles.meta}>
                {banLogsLoading
                  ? "Loading ban log..."
                  : `${filteredBanLogs.length} events | ${currentBannedUsers.length} currently banned`}
              </Text>

              <SearchInput
                value={banSearch}
                onChangeText={setBanSearch}
                placeholder="Search ban log by user, email or UID"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Currently Banned Users</Text>
              {currentBannedUsers.length === 0 ? (
                <Text style={styles.emptyText}>No banned users match this search.</Text>
              ) : null}

              {currentBannedUsers.map((user) => (
                <View key={user.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{user.displayName}</Text>
                    <Text style={[styles.badge, styles.badgeDanger]}>Banned</Text>
                  </View>
                  <Text style={styles.metaText}>{user.email || "Email missing in profile"}</Text>
                  <Text style={styles.metaText}>UID: {user.id}</Text>
                  <Text style={styles.metaText}>Joined: {formatDateTime(user.createdAtMs)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ban/Unban Events</Text>
              {filteredBanLogs.length === 0 ? (
                <Text style={styles.emptyText}>No ban events match this search.</Text>
              ) : null}

              {filteredBanLogs.map((entry) => (
                <View key={entry.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>
                      {entry.action === "banned" ? "Banned" : "Unbanned"}
                    </Text>
                    <Text
                      style={[
                        styles.badge,
                        entry.action === "banned" ? styles.badgeDanger : styles.badgeSuccess,
                      ]}
                    >
                      {entry.action}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>
                    Target: {entry.targetDisplayName || "Unknown"} ({entry.targetEmail || "no email"})
                  </Text>
                  <Text style={styles.metaText}>Target UID: {entry.targetUserId || "n/a"}</Text>
                  <Text style={styles.metaText}>
                    By: {entry.actorEmail || "admin"} ({entry.actorUserId || "n/a"})
                  </Text>
                  <Text style={styles.metaText}>At: {formatDateTime(entry.createdAtMs)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {showFloatingTools ? (
        <View pointerEvents="box-none" style={styles.floatingLayer}>
          <View style={styles.floatingBar}>
            <TextInput
              value={floatingSearchValue}
              onChangeText={setFloatingSearchValue}
              placeholder={floatingSearchPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.floatingSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <Pressable onPress={scrollToTop} style={({ pressed }) => [styles.toTopButton, { opacity: pressed ? 0.86 : 1 }]}>
              <Text style={styles.toTopLabel}>↑</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.appBgSolid,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 58,
    paddingBottom: 28,
    gap: 12,
  },
  floatingLayer: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 40,
  },
  floatingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  floatingSearchInput: {
    flex: 1,
    color: theme.colors.textOnDark,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(6,10,18,0.96)",
  },
  toTopButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(6,10,18,0.96)",
  },
  toTopLabel: {
    color: theme.colors.textOnDark,
    fontWeight: "900",
    fontSize: 18,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 14,
  },
  title: {
    color: theme.colors.textOnDark,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    color: theme.colors.textOnDarkSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    color: theme.colors.textOnDark,
    fontSize: 18,
    fontWeight: "900",
  },
  meta: {
    marginTop: 6,
    color: theme.colors.textOnDarkSecondary,
    fontSize: 13,
  },
  searchWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  searchInput: {
    color: theme.colors.textOnDark,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 5,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  rowTitle: {
    color: theme.colors.textOnDark,
    fontWeight: "900",
    fontSize: 16,
  },
  metaText: {
    color: theme.colors.textOnDarkSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  reviewText: {
    marginTop: 4,
    color: theme.colors.textOnDark,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.68)",
    lineHeight: 18,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: theme.colors.textOnDark,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  badgeDanger: {
    backgroundColor: "rgba(255,97,97,0.30)",
  },
  badgeSuccess: {
    backgroundColor: "rgba(94,203,125,0.28)",
  },
  filterRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillOn: {
    borderColor: "rgba(212,175,55,0.65)",
    backgroundColor: "rgba(212,175,55,0.20)",
  },
  pillText: {
    color: theme.colors.textOnDarkSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  pillTextOn: {
    color: theme.colors.textOnDark,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionPillDanger: {
    borderColor: "rgba(255,116,116,0.55)",
    backgroundColor: "rgba(255,116,116,0.18)",
  },
  actionPillDisabled: {
    opacity: 0.45,
  },
  actionPillText: {
    color: theme.colors.textOnDark,
    fontSize: 12,
    fontWeight: "800",
  },
  actionPillTextDanger: {
    color: "rgba(255,210,210,1)",
  },
});
