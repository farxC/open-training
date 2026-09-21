import { Pressable, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useInteractionState } from "@/hooks/useInteractionState";
import { useTheme } from "@/theme";
import type { ThemePreference } from "@/theme";

const OPTIONS: { key: ThemePreference; label: string; icon: "white-balance-sunny" | "weather-night" | "cellphone-cog" }[] = [
  { key: "light", label: "Claro", icon: "white-balance-sunny" },
  { key: "dark", label: "Escuro", icon: "weather-night" },
  { key: "system", label: "Sistema", icon: "cellphone-cog" },
];

/** Ghost chip that fills with ink when active — the same shape as PeriodChips,
 *  and the same reason for hooking interaction state rather than using
 *  Pressable's style callback (see useInteractionState). */
function ThemeChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: (typeof OPTIONS)[number]["icon"];
  active: boolean;
  onPress: () => void;
}) {
  const { hovered, handlers } = useInteractionState();
  const { colors } = useTheme();

  const foreground = active
    ? colors["brand-ink"]
    : hovered
      ? colors["ink-soft"]
      : colors["ink-mute"];

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors["brand-500"] : colors["surface-border"],
        backgroundColor: active
          ? colors["brand-500"]
          : hovered
            ? colors["surface-tint"]
            : "transparent",
      }}
    >
      <MaterialCommunityIcons name={icon} size={15} color={foreground} />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: active ? "700" : "500",
          color: foreground,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Claro / Escuro / Sistema. Content-sized and left-aligned rather than stretched
 * across the screen — three short words do not need the full width to be
 * tappable.
 */
export function ThemePicker() {
  const { preference, setPreference } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
    >
      {OPTIONS.map((option) => (
        <ThemeChip
          key={option.key}
          label={option.label}
          icon={option.icon}
          active={option.key === preference}
          onPress={() => setPreference(option.key)}
        />
      ))}
    </View>
  );
}
