import { Tabs } from "expo-router";
import { theme } from "../../lib/theme";
import AppBackground from "../../components/AppBackground";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";


export default function TabsLayout() {
  return (
    <AppBackground>
      <Tabs
        // @ts-expect-error expo-router types lag behind runtime support
        sceneContainerStyle={{ backgroundColor: "transparent" }}
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
        />
      </Tabs>
    </AppBackground>
  );
}
