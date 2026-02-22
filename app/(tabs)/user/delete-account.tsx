import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

function Glass({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.16)",
                borderWidth: 1,
                borderRadius: 18,
                padding: 16,
            }}
        >
            {children}
        </View>
    );
}

export default function DeleteAccountScreen() {
    const router = useRouter();
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();
    const [deleting, setDeleting] = useState(false);
    const [statusText, setStatusText] = useState("");

    if (!auth || !firestore) {
        return (
            <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
                <Glass>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: "white" }}>Unavailable</Text>
                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 8 }}>
                        Account tools are unavailable right now. Please close and reopen the app.
                    </Text>
                </Glass>
            </SafeAreaView>
        );
    }

    const deleteDocsByQuery = async (query: FirebaseFirestoreTypes.Query<FirebaseFirestoreTypes.DocumentData>) => {
        while (true) {
            const snap = await query.limit(200).get();
            if (snap.empty) break;
            const batch = firestore().batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            if (snap.size < 200) break;
        }
    };

    const deleteDocsInSubcollection = async (uid: string, subcollection: string) => {
        while (true) {
            const snap = await firestore().collection("users").doc(uid).collection(subcollection).limit(200).get();
            if (snap.empty) break;
            const batch = firestore().batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            if (snap.size < 200) break;
        }
    };

    const anonymiseReviewsByUser = async (uid: string) => {
        const deletedUserId = `deleted:${uid}`;
        while (true) {
            const snap = await firestore().collection("reviews").where("userId", "==", uid).limit(200).get();
            if (snap.empty) break;

            const batch = firestore().batch();
            snap.docs.forEach((d) => {
                batch.update(d.ref, {
                    userId: deletedUserId,
                    authorDeleted: true,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                    anonymisedAtMs: Date.now(),
                });
            });
            await batch.commit();
            if (snap.size < 200) break;
        }
    };

    const purgeUserDataBestEffort = async (uid: string) => {
        // Keep this tolerant: auth delete should still succeed even if a collection is blocked by rules.
        const runSafely = async (fn: () => Promise<void>) => {
            try {
                await fn();
            } catch {
                // ignore best-effort cleanup errors
            }
        };

        setStatusText("Anonymising your reviews...");
        await runSafely(async () => {
            await anonymiseReviewsByUser(uid);
        });

        setStatusText("Removing votes and reports...");
        await runSafely(async () => deleteDocsInSubcollection(uid, "helpful"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "reportedReviews"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "notifications"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "following"));

        setStatusText("Removing favourites...");
        await runSafely(async () => deleteDocsInSubcollection(uid, "favorites"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "favourites"));

        setStatusText("Removing profile data...");
        await runSafely(async () => {
            await firestore().collection("users").doc(uid).delete();
        });
    };

    const onDelete = () => {
        Alert.alert(
            "Delete account",
            "This permanently deletes your account sign-in. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: deleting ? "Deleting..." : "Delete account",
                    style: "destructive",
                    onPress: async () => {
                        const user = auth().currentUser;
                        if (!user) {
                            Alert.alert("Not signed in", "Please sign in again and retry.");
                            return;
                        }

                        try {
                            setDeleting(true);
                            setStatusText("Preparing account deletion...");
                            await purgeUserDataBestEffort(user.uid);

                            setStatusText("Deleting sign-in account...");
                            await user.delete();

                            setStatusText("");
                            Alert.alert("Account deleted", "Your account has been removed.");
                            router.replace("/auth");
                        } catch (e: any) {
                            const code = typeof e?.code === "string" ? e.code : "";
                            if (code.includes("requires-recent-login")) {
                                Alert.alert(
                                    "Re-authentication required",
                                    "Please sign out, sign back in, then try deleting your account again."
                                );
                            } else {
                                Alert.alert("Delete failed", e?.message ?? "Unknown error");
                            }
                        } finally {
                            setStatusText("");
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Glass>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>Delete account</Text>
                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 8, lineHeight: 22 }}>
                        Deleting your account is permanent. This removes your sign-in account for this app.
                    </Text>

                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 10, lineHeight: 22 }}>
                        If prompted, you may need to sign in again before deletion can complete.
                    </Text>

                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 10, lineHeight: 22 }}>
                        Self-delete does not add your email to the app's banned list.
                    </Text>

                    {deleting && statusText ? (
                        <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 12, lineHeight: 20 }}>
                            {statusText}
                        </Text>
                    ) : null}

                    <Pressable
                        onPress={onDelete}
                        disabled={deleting}
                        style={({ pressed }) => ({
                            marginTop: 16,
                            borderRadius: 14,
                            paddingVertical: 14,
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: "rgba(255,120,120,0.45)",
                            backgroundColor: "rgba(255,120,120,0.18)",
                            opacity: deleting ? 0.5 : pressed ? 0.88 : 1,
                        })}
                    >
                        <Text style={{ color: "rgba(255,190,190,1)", fontWeight: "900", fontSize: 16 }}>
                            {deleting ? "Deleting..." : "Delete account"}
                        </Text>
                    </Pressable>
                </Glass>
            </ScrollView>
        </SafeAreaView>
    );
}
