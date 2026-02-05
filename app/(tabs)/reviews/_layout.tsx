import { Stack } from "expo-router";

export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: "rgba(10,11,15,0.35)" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Reviews", headerShown: false }} />
      <Stack.Screen name="[flowerId]" options={{ title: "" }} />
      {/* NOTE: do not register product/[productId] here.
          The file still exists to safely redirect legacy links. */}
    </Stack>
  );
}
