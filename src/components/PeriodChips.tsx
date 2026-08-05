import { Pressable, Text, View } from "react-native";
import { useInteractionState } from "@/hooks/useInteractionState";

export interface ChipOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

/** One period chip. Interaction state comes from a hook rather than Pressable's
 *  style callback — see useInteractionState for why. */
function PeriodChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 15,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : hovered ? "#f0ede6" : "transparent",
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: active ? "700" : "500",
          color: active ? "#ffffff" : hovered ? "#5c594f" : "#928d80",
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Inline filter chips for the analytics time period — the desktop counterpart
 * to PeriodTabs. Ghost chips fill with ink when active; inactive chips warm up
 * on hover.
 */
export function PeriodChips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {options.map((opt) => (
        <PeriodChip
          key={opt.key}
          label={opt.label}
          active={opt.key === value}
          onPress={() => onChange(opt.key)}
        />
      ))}
    </View>
  );
}
