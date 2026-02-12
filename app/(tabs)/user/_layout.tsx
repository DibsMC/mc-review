import { Stack } from "expo-router";

export default function UserLayout() {
    return (
        <Stack
            screenOptions={{
                headerShadowVisible: false,
                headerBackButtonDisplayMode: "minimal",
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerTitle: "",
                headerTintColor: "rgba(120,160,255,0.95)",
                contentStyle: { backgroundColor: "rgba(10,11,15,0.35)" },
            }}
        >

            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="reviews-info" options={{ headerShown: true }} />
            <Stack.Screen name="about" options={{ headerShown: true }} />
            <Stack.Screen name="legal" options={{ headerShown: true }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: true }} />
            <Stack.Screen name="change-email" options={{ headerShown: true }} />
            <Stack.Screen name="feedback" options={{ headerShown: true }} />
            <Stack.Screen name="delete-account" options={{ headerShown: true }} />
        </Stack>
    );
}
