import { Stack } from "expo-router";
import { theme } from "../../../lib/theme";

export default function UserLayout() {
    return (
        <Stack
            screenOptions={{
                headerShadowVisible: false,
                headerBackButtonDisplayMode: "minimal",
                contentStyle: { backgroundColor: "rgba(10,11,15,0.35)" },
            }}
        >

            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="reviews-info" options={{ headerShown: true, title: "Reviews and scale" }} />
            <Stack.Screen name="about" options={{ headerShown: true, title: "About" }} />
            <Stack.Screen name="legal" options={{ headerShown: true, title: "Terms and legal" }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: true, title: "Edit profile" }} />
            <Stack.Screen name="change-email" options={{ headerShown: true, title: "Change email" }} />
            <Stack.Screen name="feedback" options={{ headerShown: true, title: "Suggestions" }} />
            <Stack.Screen name="privacy" options={{ headerShown: true, title: "Privacy policy" }} />
        </Stack>
    );
}
