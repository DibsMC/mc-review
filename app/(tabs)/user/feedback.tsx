import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import * as Linking from "expo-linking";

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

export default function FeedbackScreen() {
    const [message, setMessage] = useState("");

    const handleSend = async () => {
        const text = message.trim();
        if (!text) {
            Alert.alert("Add a suggestion", "Write a quick note first.");
            return;
        }

        // Replace with your real support email when ready
        const to = "dibsmccallum@sky.com";
        const subject = encodeURIComponent("App suggestion");
        const body = encodeURIComponent(text);

        const url = `mailto:${to}?subject=${subject}&body=${body}`;

        try {
            await Linking.openURL(url);
            setMessage("");
        } catch {
            Alert.alert(
                "Could not open email app",
                "No mail app is available right now. Please set up an email app on this device and try again."
            );
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
            <Glass>
                <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                    Suggestions
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 14 }}>
                    Got an idea or found something annoying? Tell us. This is how the app gets better.
                </Text>

                <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Write your suggestion here..."
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    multiline
                    style={{
                        minHeight: 130,
                        textAlignVertical: "top",
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
                    onPress={handleSend}
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
                        Send suggestion
                    </Text>
                </Pressable>

                <Text style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                    This opens your email app. No data is sent automatically.
                </Text>
            </Glass>
        </SafeAreaView>
    );
}
