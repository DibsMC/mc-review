import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, Text, View, Alert } from "react-native";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";

function GlassCard({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: any;
}) {
    return (
        <View
            style={[
                {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.16)",
                    borderWidth: 1,
                    borderRadius: 18,
                    padding: 16,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

function Divider() {
    return <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.10)" }} />;
}

function MenuRow({
    title,
    subtitle,
    onPress,
    danger,
}: {
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: 14,
                opacity: pressed ? 0.7 : 1,
            })}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: danger ? "rgba(255,90,90,1)" : "white",
                            marginBottom: subtitle ? 4 : 0,
                        }}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
                <Text style={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }}>›</Text>
            </View>
        </Pressable>
    );
}

export default function UserMenuScreen() {
    const router = useRouter();
    const user = auth().currentUser;

    const displayName = user?.displayName ?? "Your account";

    const handleSignOut = async () => {
        try {
            await auth().signOut();
        } catch (e: any) {
            Alert.alert("Sign out failed", e?.message ?? "Unknown error");
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "white" }}>
                    User
                </Text>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
                    {displayName}
                </Text>
            </View>

            <GlassCard style={{ marginBottom: 14 }}>
                <MenuRow
                    title="Edit profile"
                    subtitle="Change username and photo"
                    onPress={() => router.push("/(tabs)/user/edit-profile")}
                />
                <Divider />
                <MenuRow
                    title="Reviews and scale"
                    subtitle="How ratings work and how to leave great reviews"
                    onPress={() => router.push("/(tabs)/user/reviews-info")}
                />
                <Divider />
                <MenuRow
                    title="About"
                    subtitle="What this app is trying to do"
                    onPress={() => router.push("/(tabs)/user/about")}
                />
                <Divider />
                <MenuRow
                    title="Terms and legal"
                    subtitle="Terms, privacy, and acknowledgements"
                    onPress={() => router.push("/(tabs)/user/legal")}
                />
                <Divider />
                <MenuRow
                    title="Suggestions"
                    subtitle="Help shape the app"
                    onPress={() => router.push("/(tabs)/user/feedback")}
                />
                <Divider />
                <MenuRow
                    title="Change email"
                    subtitle="Update your sign in email"
                    onPress={() => router.push("/(tabs)/user/change-email")}
                />

            </GlassCard>

            <GlassCard>
                <MenuRow
                    title="Sign out"
                    subtitle="Sign out of this account"
                    danger
                    onPress={() => {
                        Alert.alert("Sign out", "Are you sure you want to sign out?", [
                            { text: "Cancel", style: "cancel" },
                            { text: "Sign out", style: "destructive", onPress: handleSignOut },
                        ]);
                    }}
                />
            </GlassCard>

            <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                    Review app beta
                </Text>
            </View>
        </SafeAreaView>
    );
}
