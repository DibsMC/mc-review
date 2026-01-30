import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import auth from "@react-native-firebase/auth";

const GLASS_BG = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.16)";
const INPUT_BG = "rgba(0,0,0,0.18)";
const BTN_BG = "rgba(255,255,255,0.14)";
const BTN_BORDER = "rgba(255,255,255,0.18)";
const SUBTLE = "rgba(255,255,255,0.70)";
const SUBTLE_2 = "rgba(255,255,255,0.55)";

function Glass({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: GLASS_BG,
                borderColor: GLASS_BORDER,
                borderWidth: 1,
                borderRadius: 18,
                padding: 16,
            }}
        >
            {children}
        </View>
    );
}

export default function EditProfileScreen() {
    const user = auth().currentUser;
    const [displayName, setDisplayName] = useState<string>(user?.displayName ?? "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        try {
            if (!user) {
                Alert.alert("Not signed in", "Please sign in again.");
                return;
            }

            const name = displayName.trim();
            if (!name) {
                Alert.alert("Name needed", "Please enter a display name.");
                return;
            }

            setSaving(true);
            await user.updateProfile({ displayName: name });
            Alert.alert("Saved", "Your display name was updated.");
        } catch (e: any) {
            Alert.alert("Save failed", e?.message ?? "Unknown error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 72 }}>
            <Glass>
                <View style={{ gap: 16 }}>
                    <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                            Edit profile
                        </Text>
                        <Text style={{ color: SUBTLE, fontSize: 14, lineHeight: 20 }}>
                            Update your display name.
                        </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: "white" }}>
                            Display name
                        </Text>

                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Your name"
                            placeholderTextColor={SUBTLE_2}
                            style={{
                                backgroundColor: INPUT_BG,
                                borderColor: GLASS_BORDER,
                                borderWidth: 1,
                                borderRadius: 14,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                color: "white",
                                fontSize: 15,
                            }}
                            returnKeyType="done"
                        />
                    </View>

                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={({ pressed }) => ({
                            backgroundColor: BTN_BG,
                            borderColor: BTN_BORDER,
                            borderWidth: 1,
                            borderRadius: 14,
                            paddingVertical: 12,
                            alignItems: "center",
                            opacity: saving ? 0.6 : pressed ? 0.75 : 1,
                        })}
                    >
                        <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
                            {saving ? "Saving..." : "Save"}
                        </Text>
                    </Pressable>

                    <Text style={{ fontSize: 12, color: SUBTLE_2, lineHeight: 18 }}>
                        Photo upload is coming soon.
                    </Text>
                </View>
            </Glass>
        </SafeAreaView>
    );
}
