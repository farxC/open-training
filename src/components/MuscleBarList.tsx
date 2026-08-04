import { Text, View } from "react-native";
import { muscleGroupLabel } from "@/data/muscleGroups";

interface Props {
  rows: { muscle_group: string; value: number }[];
  /** Window caption, e.g. "últimas 4 semanas · 06/07 – 02/08". */
  caption?: string;
  formatValue: (value: number) => string;
  emptyText?: string;
}

/** Horizontal bar list keyed by muscle group — shared by the series-per-week and
 *  the training-frequency sections, which differ only in unit. Bars are scaled to
 *  the largest row, so the list reads as a ranking, not as absolute magnitudes. */
export function MuscleBarList({ rows, caption, formatValue, emptyText = "Sem dados no período" }: Props) {
  if (rows.length === 0) {
    return (
      <View className="bg-surface-card rounded-2xl p-4 items-center">
        <Text className="text-ink-mute text-sm">{emptyText}</Text>
      </View>
    );
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <View>
      {caption ? (
        <Text className="text-ink-mute text-xs mb-2">{caption}</Text>
      ) : null}
      <View className="bg-surface-card rounded-2xl overflow-hidden">
        {rows.map((row, index) => (
          <View
            key={row.muscle_group}
            className="px-4 py-3"
            style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: "#ddd8ce" }}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-ink-soft text-xs" style={{ letterSpacing: 0.3 }}>
                {muscleGroupLabel(row.muscle_group)}
              </Text>
              <Text
                style={{
                  color: "#26241f",
                  fontSize: 12,
                  fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                }}
              >
                {formatValue(row.value)}
              </Text>
            </View>
            <View className="h-1 bg-surface-elevated rounded-full overflow-hidden">
              <View
                style={{
                  height: "100%",
                  width: `${(row.value / max) * 100}%`,
                  backgroundColor: "#26241f",
                  borderRadius: 99,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
