import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export default function SessionLayout() {
  const { colors } = useTheme();

  // contentStyle matters even though every screen paints its own background:
  // it is the native container behind the screen, and without it a push or a
  // dismiss flashes the platform default (white) in dark mode.
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
    />
  );
}
