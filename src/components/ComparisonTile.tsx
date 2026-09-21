import { Text, View } from "react-native";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

interface Props {
  label: string;
  value: string;
  deltaText?: string | null;
  better?: boolean | null;
}

/** Takes the palette rather than reaching for it: a module-level helper has no
 *  hook to call, and a frozen colour here would survive a theme switch. */
function deltaColor(colors: ThemeColors, better: boolean | null | undefined): string {
  if (better === true) return colors["accent-green"];
  if (better === false) return colors["accent-red"];
  return colors["ink-mute"];
}

export function ComparisonTile({ label, value, deltaText, better }: Props) {
  const { colors } = useTheme();
  return (
    <View className="flex-1 bg-surface-card rounded-2xl p-3">
      <Text
        style={{ color: colors["ink-mute"], fontSize: 10, fontWeight: "700", letterSpacing: 1 }}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.ink,
          fontSize: 22,
          fontWeight: "700",
          fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
          marginTop: 4,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{ color: deltaColor(colors, better), fontSize: 11, fontWeight: "600", marginTop: 4 }}
        numberOfLines={1}
      >
        {deltaText ?? " "}
      </Text>
    </View>
  );
}
