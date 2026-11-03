import uiColors from "@/theme/palette.json";
import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { AppShell } from "@/components/ui/AppShell";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppModalHost } from "@/components/AppModal";
import { SessionRecorderProvider } from "@/context/SessionRecorderContext";
import { initDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import { ensureSkiaReady } from "@/skia/ensureSkiaReady";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Hanken Grotesk": HankenGrotesk_400Regular,
    Fraunces: Fraunces_600SemiBold,
    "JetBrains Mono": JetBrainsMono_400Regular,
  });
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
      <View
        style={{
          flex: 1,
          backgroundColor: uiColors.paper,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text
          className="font-sans"
          style={{
            color: uiColors.danger,
            fontWeight: "bold",
            marginBottom: 8,
          }}
        >
          Erro ao abrir os dados
        </Text>
        <Text
          className="font-sans"
          style={{ color: uiColors.muted, fontSize: 12, textAlign: "center" }}
        >
          {initError}
        </Text>
      </View>
    );
  }

  if (!dbReady || (!fontsLoaded && !fontError)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: uiColors.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={uiColors.ink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider>
          <SessionRecorderProvider>
            <AppShell>
              <AppModalHost />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: uiColors.paper },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="settings" />
                <Stack.Screen
                  name="session/new"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                  }}
                />
                <Stack.Screen name="session/[id]" />
                <Stack.Screen name="exercises/[id]" />
                <Stack.Screen name="exercises/[id]/variations" />
                <Stack.Screen
                  name="routine/new-split"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                  }}
                />
                <Stack.Screen name="routine/[id]" />
                <Stack.Screen
                  name="routine/program/new"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                  }}
                />
                <Stack.Screen name="routine/program/[id]" />
                <Stack.Screen name="routine/program/week/[id]" />
              </Stack>
            </AppShell>
          </SessionRecorderProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
