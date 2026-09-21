import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/theme";

const LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; // index = getDay() 0..6
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // display Mon..Sun

interface Props {
  selected: number[];
  onToggle: (weekday: number) => void;
  /** "compact" (default) is the dense inline row used in settings-style screens.
   *  "large" is a centered row of bigger touch targets for standalone picker steps. */
  size?: "compact" | "large";
}

export function WeekdayPicker({ selected, onToggle, size = "compact" }: Props) {
  const { colors } = useTheme();
  if (size === "large") {
    return (
      <View className="flex-row justify-center" style={{ gap: 8 }}>
        {ORDER.map((wd) => {
          const on = selected.includes(wd);
          return (
            <TouchableOpacity
              key={wd}
              onPress={() => onToggle(wd)}
              activeOpacity={0.85}
              style={{
                width: 42,
                height: 54,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? colors["brand-500"] : colors["surface-card"],
                borderWidth: 1.5,
                borderColor: on ? colors["brand-500"] : colors["surface-border"],
                shadowColor: colors["shadow"],
                shadowOpacity: on ? 0.2 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: on ? 3 : 0,
              }}
            >
              <Text style={{ color: on ? colors["brand-ink"] : colors["ink"], fontSize: 14, fontWeight: "700" }}>
                {LABELS[wd]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View className="flex-row" style={{ gap: 5 }}>
      {ORDER.map((wd) => {
        const on = selected.includes(wd);
        return (
          <TouchableOpacity
            key={wd}
            onPress={() => onToggle(wd)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: on ? colors["brand-500"] : "transparent",
              borderWidth: 1,
              borderColor: on ? colors["brand-500"] : colors["surface-border"],
            }}
          >
            <Text style={{ color: on ? colors["brand-ink"] : colors["ink-mute"], fontSize: 11, fontWeight: "600" }}>
              {LABELS[wd]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
