import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 22, color: "#fff" }}>🌿 Review Budz 🌿</Text>
      <Text style={{ color: "rgba(255,255,255,0.7)" }}>Home</Text>
    </View>
  );
}
