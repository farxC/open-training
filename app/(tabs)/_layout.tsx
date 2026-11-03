import { Tabs, router } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import colors from "@/theme/palette.json";

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 960;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarStyle: desktop
          ? { display: "none" }
          : {
              backgroundColor: colors.white,
              borderTopColor: colors.line,
              borderTopWidth: 1,
              height: 64 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 8),
              paddingTop: 8,
            },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: "Treino",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size - 2} color={color} />
          ),
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/session/new");
          },
        }}
      />
      <Tabs.Screen
        name="routine"
        options={{
          title: "Rotina",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Evolução",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="stats-chart-outline"
              size={size - 2}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
