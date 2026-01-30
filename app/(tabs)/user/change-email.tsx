import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import auth from "@react-native-firebase/auth";

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

export default function ChangeEmailScreen() {
    const user = auth().currentUser;
    const [email, setEmail] = useState<string>(user?.email ?? "");
    const [newEmail, setNewEmail] = useState<string>("");

    const handleChange = async () => {
        try {
            if (!user) {
                Alert.alert("Not signed in", "Please sign in again.");
                return;
            }

            const next = newEmail.trim();
            if (!next || !next.includes("@")) {
                Alert.alert("Check email", "Please enter a valid email address.");
                return;
            }

            // Prefer verification flow when available
            // @ts-ignore
            if (typeof user.verifyBeforeUpdateEmail === "function") {
                // @ts-ignore
                await user.verifyBeforeUpdateEmail(next);
                Alert.alert(
                    "Check your inbox",
                    "We sent a verification link to your new email. Verify it to complete the change."
                );
                setNewEmail("");
                return;
            }

            await user.updateEmail(next);
            Alert.alert("Email updated", "Your sign in email has been updated.");
            setNewEmail("");
        } catch (e: any) {
            const msg = e?.message ?? "Unknown error";
            if (String(msg).toLowerCase().includes("recent")) {
                Alert.alert(
                    "Please re-authenticate",
                    "For security, you need to sign in again before changing email. Sign out and sign back in, then try again."
                );
                return;
            }
            Alert.alert("Change failed", msg);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
            <Glass>
                <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                    Change email
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 14 }}>
                    Update the email you use to sign in.
                </Text>

                <Text style={{ color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>
                    Current
                </Text>
                <Text style={{ color: "white", fontWeight: "800", marginBottom: 14 }}>
                    {email || "No email found"}
                </Text>

                <Text style={{ color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>
                    New email
                </Text>
                <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="new@email.com"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={{
                        backgroundColor: "rgba(0,0,0,0.18)",
                        borderColor: "rgba(255,255,255,0.16)",
                        borderWidth: 1,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        color: "white",
                        fontSize: 15,
                        marginBottom: 12,
                    }}
                />

                <Pressable
                    onPress={handleChange}
                    style={({ pressed }) => ({
                        backgroundColor: "rgba(255,255,255,0.14)",
                        borderColor: "rgba(255,255,255,0.18)",
                        borderWidth: 1,
                        borderRadius: 14,
                        paddingVertical: 12,
                        alignItems: "center",
                        opacity: pressed ? 0.75 : 1,
                    })}
                >
                    <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
                        Update email
                    </Text>
                </Pressable>
            </Glass>
        </SafeAreaView>
    );
}
