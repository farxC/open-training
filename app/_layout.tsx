import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppModalHost } from "@/components/AppModal";
import { SessionRecorderProvider } from "@/context/SessionRecorderContext";
import { initDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import { ensureSkiaReady } from "@/skia/ensureSkiaReady";
import { ThemeProvider, useTheme } from "@/theme";

/**
 * Split out from RootLayout so the boot and error screens sit *inside*
 * ThemeProvider. Both persistence backends read synchronously, so the theme is
 * known on the very first render — the spinner already appears in the right
 * colors instead of flashing paper-white on a dark device.
 */
function RootLayoutInner() {
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const { colors, scheme } = useTheme();

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

  // The status bar is the one piece of chrome Android hardcodes outside the JS
  // bundle (values/styles.xml pins it to #ffffff and values-night is empty), and
  // android/ is checked in, so app.json can't fix it without a prebuild. Setting
  // it here covers every platform at runtime instead.
  const statusBar = (
    <StatusBar style={scheme === "dark" ? "light" : "dark"} backgroundColor={colors.surface} />
  );

  if (initError) {
    return (
      <View className="flex-1 items-center justify-center bg-surface" style={{ padding: 24 }}>
        {statusBar}
        <Text style={{ color: colors["accent-red"], fontWeight: "bold", marginBottom: 8 }}>
          Database error
        </Text>
        <Text style={{ color: colors["ink-soft"], fontSize: 12, textAlign: "center" }}>
          {initError}
        </Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        {statusBar}
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionRecorderProvider>
          {statusBar}
          <AppModalHost />
          {/* Without contentStyle the native container behind a push or a modal
              is whatever the platform defaults to — white — so every navigation
              flashed in dark mode. */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="session/new"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen name="session/[id]" />
            <Stack.Screen name="exercises/[id]" />
            <Stack.Screen name="exercises/[id]/variations" />
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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
