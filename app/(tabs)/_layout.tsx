import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#ddd8ce",
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#26241f",
        tabBarInactiveTintColor: "#928d80",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routine"
        options={{
          title: "Routine",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
