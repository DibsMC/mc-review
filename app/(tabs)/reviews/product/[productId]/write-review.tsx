import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyWriteReviewRoute() {
    const { productId } = useLocalSearchParams<{ productId?: string }>();
    const pid = typeof productId === "string" ? productId : "";

    if (!pid) {
        return <Redirect href="/(tabs)/reviews" />;
    }

    return <Redirect href={`/(tabs)/reviews/${pid}`} />;
}
