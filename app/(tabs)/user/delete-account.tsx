import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

function Glass({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: "rgba(11,15,22,0.82)",
                borderColor: "rgba(255,255,255,0.14)",
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
    const [password, setPassword] = useState("");

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

    const deleteDocsInSubcollection = async (uid: string, subcollection: string) => {
        while (true) {
            const snap = await firestore().collection("users").doc(uid).collection(subcollection).limit(200).get();
            if (snap.empty) break;
            const batch = firestore().batch();
            snap.docs.forEach((doc) => batch.delete(doc.ref));
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
            snap.docs.forEach((doc) => {
                batch.update(doc.ref, {
                    userId: deletedUserId,
                    uid: deletedUserId,
                    authorUid: deletedUserId,
                    displayName: "Deleted member",
                    authorName: "Deleted member",
                    userName: "Deleted member",
                    email: null,
                    authorEmail: null,
                    userEmail: null,
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
        const runSafely = async (fn: () => Promise<void>) => {
            try {
                await fn();
            } catch {
                // best effort on cleanup
            }
        };

        setStatusText("Anonymising your reviews...");
        await runSafely(async () => {
            await anonymiseReviewsByUser(uid);
        });

        setStatusText("Removing votes, favourites, and notifications...");
        await runSafely(async () => deleteDocsInSubcollection(uid, "helpful"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "reportedReviews"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "notifications"));
        await runSafely(async () => deleteDocsInSubcollection(uid, "following"));
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

                        if (!user.email) {
                            Alert.alert("Delete failed", "This account does not have a sign-in email attached.");
                            return;
                        }

                        const trimmedPassword = password.trim();
                        if (!trimmedPassword) {
                            Alert.alert("Password needed", "Enter your current password to delete your account.");
                            return;
                        }

                        try {
                            setDeleting(true);
                            setStatusText("Verifying your sign-in...");
                            const credential = auth.EmailAuthProvider.credential(user.email, trimmedPassword);
                            await user.reauthenticateWithCredential(credential);

                            setStatusText("Preparing account deletion...");
                            await purgeUserDataBestEffort(user.uid);

                            setStatusText("Deleting sign-in account...");
                            await user.delete();
                            await auth().signOut().catch(() => {
                                // ignore local sign-out issues after delete
                            });

                            setPassword("");
                            setStatusText("");
                            Alert.alert("Account deleted", "Your account has been removed.");
                            router.replace("/auth");
                        } catch (error: any) {
                            const code = typeof error?.code === "string" ? error.code : "";
                            if (code.includes("requires-recent-login")) {
                                Alert.alert(
                                    "Re-authentication required",
                                    "Please sign out, sign back in, then try deleting your account again."
                                );
                            } else if (code.includes("wrong-password") || code.includes("invalid-credential")) {
                                Alert.alert("Password incorrect", "Please enter your current password and try again.");
                            } else {
                                Alert.alert(
                                    "Delete failed",
                                    `${error?.message ?? "Unknown error"}\n\nIf your sign-in account was not removed, this email will still be in use.`
                                );
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
                        Your reviews are anonymised so community totals stay intact, but your profile access is removed.
                    </Text>

                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 10, lineHeight: 22 }}>
                        If prompted, sign out and sign back in before trying again.
                    </Text>

                    <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 14, marginBottom: 8 }}>
                        Confirm with your password
                    </Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Current password"
                        placeholderTextColor="rgba(255,255,255,0.42)"
                        secureTextEntry
                        autoCapitalize="none"
                        style={{
                            backgroundColor: "rgba(0,0,0,0.18)",
                            borderColor: "rgba(255,255,255,0.16)",
                            borderWidth: 1,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            color: "white",
                            fontSize: 15,
                        }}
                    />

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
