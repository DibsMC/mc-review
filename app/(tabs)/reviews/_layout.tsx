import React from "react";
import { Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function PaddedBack() {
  const router = useRouter();

  const onPress = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/reviews");
  };

  return (
    <View style={{ paddingLeft: 18 }}>
      <Pressable
        onPress={onPress}
        hitSlop={12}
        style={{
          paddingRight: 8,
          paddingVertical: 10,
        }}
      >
        <Ionicons name="chevron-back" size={30} color="rgba(120,160,255,0.95)" />
      </Pressable>
    </View>
  );
}

export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerLeft: () => <PaddedBack />,

        headerStyle: { backgroundColor: "transparent" },
        headerTransparent: true,
        contentStyle: { backgroundColor: "rgba(10,11,15,0.35)" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Screen
        name="product/[productId]"
        options={{
          headerShown: true,
          headerTitle: "",
        }}
      />

      {/* Legacy route kept working */}
      <Stack.Screen name="[flowerId]" options={{ headerShown: true, headerTitle: "" }} />
      <Stack.Screen
        name="product/[productId]/index"
        options={{ headerShown: true, headerTitle: "", headerShadowVisible: false }}
      />
    </Stack>
  );
}
