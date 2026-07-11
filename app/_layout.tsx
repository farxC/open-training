import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppModalHost } from "@/components/AppModal";
import { SessionRecorderProvider } from "@/context/SessionRecorderContext";
import { initDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import { ensureSkiaReady } from "@/skia/ensureSkiaReady";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // Skia's CanvasKit (WASM) runtime has no native equivalent to wait on — it's a
    // web-only async init, a no-op on native — so it waits alongside the DB the same
    // way. Without it, charts (VolumeChart) silently fail to draw once data exists.
    Promise.all([initDatabase(), ensureSkiaReady()])
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
          <AppModalHost />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="session/new"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen name="session/[id]" />
            <Stack.Screen name="exercises/[id]" />
            <Stack.Screen
              name="routine/new-split"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen name="routine/[id]" />
            <Stack.Screen
              name="routine/program/new"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen name="routine/program/[id]" />
            <Stack.Screen name="routine/program/week/[id]" />
          </Stack>
        </SessionRecorderProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
