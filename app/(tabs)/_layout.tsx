import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";
import auth from "@react-native-firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";


export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [guestMode, setGuestMode] = useState(true);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged((user) => {
      setGuestMode(!user);
    });

    return () => unsub();
  }, []);

  return (
    <Tabs
      // @ts-expect-error expo-router types lag behind runtime support
      sceneContainerStyle={{ backgroundColor: "transparent" }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 0,
          height: 72 + Math.max(insets.bottom, 10),
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom + 6, 16),
          paddingHorizontal: 18,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          shadowColor: "transparent",
          shadowOpacity: 0,
          elevation: 0,
          overflow: "visible",
        },
        tabBarBackground: () => (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <LinearGradient
              colors={[
                "rgba(4,6,10,0.24)",
                "rgba(4,6,10,0.52)",
                "rgba(4,6,10,0.78)",
                "rgba(4,6,10,0.94)",
              ]}
              locations={[0, 0.14, 0.46, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["rgba(255,255,255,0.025)", "rgba(255,255,255,0.0)"]}
              locations={[0, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.tabBarFeather}
            />
            <LinearGradient
              colors={["rgba(2,3,6,0.34)", "rgba(2,3,6,0.68)", "rgba(2,3,6,0.92)"]}
              locations={[0, 0.52, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.tabBarFloor}
            />
          </View>
        ),
        tabBarItemStyle: styles.tabItem,
        tabBarActiveTintColor: "rgba(244,245,247,0.90)",
        tabBarInactiveTintColor: "rgba(194,198,208,0.76)",
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
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
        listeners={{
          tabPress: (event) => {
            if (!guestMode) return;
            event.preventDefault();
            router.replace("/(tabs)/user");
          },
        }}
        options={{
          title: "Reviews",
          tabBarIcon: ({ color, size, focused }) => (
            <Image
              source={require("../../assets/icons/bud.png")}
              style={{
                width: size,
                height: size,
                opacity: focused ? 0.94 : 0.56,
                ...(focused ? {} : { tintColor: color }),
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="user"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.replace("/(tabs)/user");
          },
        }}
        options={{
          title: "User",
          tabBarLabel: "User",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    marginHorizontal: 2,
    borderRadius: 18,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 1,
  },
  tabIcon: {
    marginTop: 2,
  },
  tabBarFeather: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  tabBarFloor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
  },
});
