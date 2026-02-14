// app/(tabs)/user/edit-profile.tsx
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { theme } from "../../../lib/theme";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

export default function EditProfileScreen() {
    const router = useRouter();
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();

    if (!auth || !firestore) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 58 }}>
                    <Text style={{ color: theme.colors.textOnDark, fontSize: 20, fontWeight: "900" }}>
                        Profile unavailable
                    </Text>
                    <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 8 }}>
                        Required modules did not load. Please close and reopen the app.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const [displayName, setDisplayName] = useState<string>("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const u = auth().currentUser;
        setDisplayName(u?.displayName ?? "");
    }, []);

    const handleSave = async () => {
        const user = auth().currentUser;

        if (!user) {
            Alert.alert("Not signed in", "Please sign in again.");
            return;
        }

        const name = displayName.trim();

        // You can loosen this if you want, but it's a good guardrail
        if (name.length < 2) {
            Alert.alert("Name needed", "Please enter a display name (2+ characters).");
            return;
        }

        try {
            setSaving(true);

            // 1) Firebase Auth (some UI reads from here)
            await user.updateProfile({ displayName: name });

            // 2) Firestore (public source of truth for other users + profile pages)
            await firestore()
                .collection("users")
                .doc(user.uid)
                .set(
                    {
                        displayName: name,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );

            Alert.alert("Saved", "Your display name was updated.");
            router.back();
        } catch (e: any) {
            Alert.alert("Save failed", e?.message ?? "Unknown error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 58 }}>
                <Text
                    style={{
                        color: theme.colors.textOnDark,
                        fontSize: 22,
                        fontWeight: "900",
                        marginBottom: 12,
                    }}
                >
                    Edit profile
                </Text>

                <Text style={{ color: theme.colors.textOnDarkSecondary, fontWeight: "800" }}>
                    Display name
                </Text>

                <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!saving}
                    style={{
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.16)",
                        backgroundColor: "rgba(0,0,0,0.16)",
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        color: "white",
                        fontSize: 16,
                        fontWeight: "800",
                    }}
                />

                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => ({
                        marginTop: 14,
                        paddingVertical: 12,
                        borderRadius: 14,
                        alignItems: "center",
                        backgroundColor: "rgba(255,255,255,0.14)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.18)",
                        opacity: saving ? 0.6 : pressed ? 0.85 : 1,
                    })}
                >
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>
                        {saving ? "Saving..." : "Save"}
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => router.back()}
                    disabled={saving}
                    style={({ pressed }) => ({
                        marginTop: 10,
                        paddingVertical: 12,
                        borderRadius: 14,
                        alignItems: "center",
                        backgroundColor: "rgba(0,0,0,0.10)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                        opacity: saving ? 0.6 : pressed ? 0.85 : 1,
                    })}
                >
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>Cancel</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
