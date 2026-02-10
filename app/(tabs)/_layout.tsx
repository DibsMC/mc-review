import { Tabs, useRouter } from "expo-router";
import { Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppBackground from "../../components/AppBackground";
import { theme } from "../../lib/theme";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <AppBackground>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.appBgSolid,
            borderTopColor: theme.colors.dividerOnDark,
          },
          tabBarActiveTintColor: theme.colors.textOnDark,
          tabBarInactiveTintColor: theme.colors.iconMuted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}

          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace("/(tabs)");
            },
          }}
        />

        <Tabs.Screen
          name="reviews"
          options={{
            title: "Reviews",
            tabBarIcon: ({ size }) => (
              <Image
                source={require("../../assets/icons/bud.png")}
                style={{ width: size, height: size, opacity: 0.95 }}
                resizeMode="contain"
              />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace("/(tabs)/reviews");
            },
          }}
        />

        <Tabs.Screen
          name="user"
          options={{
            title: "User",
            tabBarLabel: "User",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace("/(tabs)/user");
            },
          }}
        />
      </Tabs>
    </AppBackground>
  );
}
