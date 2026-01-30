import { Stack } from "expo-router";
import { theme } from "../../../lib/theme";

export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "fade",
        headerTransparent: true,
        headerTintColor: "white",
        headerTitle: "",
        headerBackTitleVisible: false,
        headerBackTitle: "",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "rgba(10,11,15,0.35)" },
      }}


    >
      <Stack.Screen name="index" options={{ title: "Reviews" }} />
      <Stack.Screen name="[flowerId]" options={{ title: "" }} />
      <Stack.Screen name="product/index" options={{ title: "Product" }} />
    </Stack>
  );
}
