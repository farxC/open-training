import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionRecorderProvider } from "@/context/SessionRecorderContext";
import { initDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => {
        runMigrations();
        setDbReady(true);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[open-training] DB init failed:", msg);
        setInitError(msg);
      });
  }, []);

  if (initError) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f4f2ee", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#bf3b30", fontWeight: "bold", marginBottom: 8 }}>Database error</Text>
        <Text style={{ color: "#5c594f", fontSize: 12, textAlign: "center" }}>{initError}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f4f2ee", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#26241f" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionRecorderProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="session/record"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="session/[id]"
              options={{ headerShown: true, headerTitle: "Session", headerStyle: { backgroundColor: "#f4f2ee" }, headerTintColor: "#26241f" }}
            />
            <Stack.Screen
              name="exercises/[id]"
              options={{ headerShown: true, headerTitle: "Exercise", headerStyle: { backgroundColor: "#f4f2ee" }, headerTintColor: "#26241f" }}
            />
            <Stack.Screen
              name="routine/new-split"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="routine/[id]"
              options={{ headerShown: true, headerTitle: "Split", headerBackTitle: "Rotina", headerStyle: { backgroundColor: "#f4f2ee" }, headerTintColor: "#26241f" }}
            />
            <Stack.Screen
              name="routine/program/new"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="routine/program/[id]"
              options={{ headerShown: true, headerTitle: "Plano", headerBackTitle: "Split", headerStyle: { backgroundColor: "#f4f2ee" }, headerTintColor: "#26241f" }}
            />
            <Stack.Screen name="routine/program/week/[id]" options={{ headerShown: false }} />
          </Stack>
        </SessionRecorderProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
