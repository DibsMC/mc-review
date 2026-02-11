import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { theme } from "../../../lib/theme";

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <View style={{ padding: 16 }}>
        <Text
          style={{
            color: theme.colors.textOnDark,
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          Privacy policy
        </Text>

        <Text
          style={{
            color: theme.colors.textOnDarkSecondary,
            marginTop: 10,
            lineHeight: 20,
          }}
        >
          Privacy details will be published here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
