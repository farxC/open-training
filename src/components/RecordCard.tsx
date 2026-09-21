import type { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@/theme";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

interface Props {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  isNew?: boolean;
  onPress?: () => void;
}

export function RecordCard({ icon, label, value, sub, isNew, onPress }: Props) {
  const { colors } = useTheme();
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      className="bg-surface-card rounded-xl mb-2 overflow-hidden flex-row"
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
    >
      {/* Left accent bar */}
      <View style={{ width: 3, backgroundColor: colors["brand-500"] }} />

      <View className="flex-1 flex-row items-center px-3 py-3" style={{ gap: 10 }}>
        {/* Icon chip */}
        <View
          className="items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors["surface-elevated"] }}
        >
          <MaterialCommunityIcons name={icon as MciName} size={17} color={colors["ink-soft"]} />
        </View>

        {/* Label / sub column */}
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text
              style={{ color: colors["ink-mute"], fontSize: 9, fontWeight: "700", letterSpacing: 1.2 }}
              numberOfLines={1}
            >
              {label.toUpperCase()}
            </Text>
            {isNew ? (
              <View
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors["accent-green-soft"], paddingHorizontal: 6, paddingVertical: 1 }}
              >
                <Text style={{ color: colors["accent-green-ink"], fontSize: 9, fontWeight: "700" }}>NOVO</Text>
              </View>
            ) : null}
          </View>
          {sub ? (
            <Text className="text-ink-mute text-xs mt-0.5" numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>

        {/* Value */}
        <Text
          style={{
            color: colors["ink"],
            fontSize: 20,
            fontWeight: "700",
            fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
          }}
          numberOfLines={1}
        >
          {value}
        </Text>

        {onPress ? (
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors["ink-faint"]} />
        ) : null}
      </View>
    </Container>
  );
}
