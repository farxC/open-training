import uiColors from "@/theme/palette.json";
import type { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

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
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      className="bg-surface-card rounded-xl mb-2 overflow-hidden flex-row"
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
    >
      {/* Left accent bar */}
      <View style={{ width: 3, backgroundColor: uiColors.record }} />

      <View className="flex-1 flex-row items-center px-3 py-3" style={{ gap: 10 }}>
        {/* Icon chip */}
        <View
          className="items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: uiColors.sidebar }}
        >
          <MaterialCommunityIcons name={icon as MciName} size={17} color={uiColors.muted} />
        </View>

        {/* Label / sub column */}
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="font-sans"
              style={{ color: uiColors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 }}
              numberOfLines={1}
            >
              {label.toUpperCase()}
            </Text>
            {isNew ? (
              <View
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: uiColors.recordSoft, paddingHorizontal: 6, paddingVertical: 1 }}
              >
                <Text className="font-sans" style={{ color: uiColors.record, fontSize: 9, fontWeight: "700" }}>NOVO</Text>
              </View>
            ) : null}
          </View>
          {sub ? (
            <Text className="font-sans text-ink-mute text-xs mt-0.5" numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>

        {/* Value */}
        <Text
          style={{
            color: uiColors.ink,
            fontSize: 20,
            fontWeight: "700",
            fontFamily: "JetBrains Mono",
          }}
          numberOfLines={1}
        >
          {value}
        </Text>

        {onPress ? (
          <MaterialCommunityIcons name="chevron-right" size={20} color={uiColors.faint} />
        ) : null}
      </View>
    </Container>
  );
}
