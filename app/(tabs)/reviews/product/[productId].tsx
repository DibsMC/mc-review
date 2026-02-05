import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function ProductIdRedirect() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  useEffect(() => {
    const id = typeof productId === "string" ? productId : "";
    if (!id) {
      // If somehow opened without an id, just go back to Reviews index
      router.replace("/(tabs)/reviews");
      return;
    }

    // Canonical route is /reviews/[flowerId] (this is actually productId)
    router.replace(`/(tabs)/reviews/${encodeURIComponent(id)}`);
  }, [productId, router]);

  // Minimal loading state while redirect happens
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
    >
      <ActivityIndicator />
    </View>
  );
}
