import { Stack } from "expo-router";
import { theme } from "../../../lib/theme";

export default function UserLayout() {
    return (
        <Stack
            screenOptions={{
                headerShadowVisible: false,
                headerBackButtonDisplayMode: "minimal",
                headerTintColor: theme.colors.textOnDark,
                headerTitleStyle: {
                    color: theme.colors.textOnDark,
                    fontSize: 16,
                    fontWeight: "800",
                },
                headerStyle: {
                    backgroundColor: "rgba(8,10,15,0.96)",
                },
                contentStyle: { backgroundColor: "rgba(10,11,15,0.70)" },
            }}
        >

            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="reviews-info" options={{ headerShown: true, title: "Reviews and scale" }} />
            <Stack.Screen name="about" options={{ headerShown: true, title: "About" }} />
            <Stack.Screen name="legal" options={{ headerShown: true, title: "Terms and legal" }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: true, title: "Edit profile" }} />
            <Stack.Screen name="profile/[uid]" options={{ headerShown: true, title: "Member profile" }} />
            <Stack.Screen name="change-email" options={{ headerShown: true, title: "Change email" }} />
            <Stack.Screen name="feedback" options={{ headerShown: true, title: "Suggestions" }} />
            <Stack.Screen name="admin-moderation" options={{ headerShown: true, title: "Admin panel" }} />
            <Stack.Screen name="delete-account" options={{ headerShown: true, title: "Delete account" }} />
        </Stack>
    );
}
