import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyProductRoute() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  if (!productId) return <Redirect href="/(tabs)/reviews" />;

  return <Redirect href={`/(tabs)/reviews/${encodeURIComponent(productId)}`} />;
}
