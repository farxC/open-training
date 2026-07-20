import { Text, View } from "react-native";
import { formatMuscleSeriesValue, muscleGroupLabel } from "@/data/muscleGroups";
import type { MuscleSeriesRow } from "@/types";

interface Props {
  data: MuscleSeriesRow[];
}

export function MuscleSeriesChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <View className="bg-surface-card rounded-2xl p-4 items-center">
        <Text className="text-ink-mute text-sm">No data yet</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const isAverage = data[0].isAverage;

  return (
    <View>
      {isAverage && (
        <Text className="text-ink-mute text-xs mb-2">
          Média semanal · {data[0].weeks} {data[0].weeks === 1 ? "semana" : "semanas"} no período
        </Text>
      )}
      <View className="bg-surface-card rounded-2xl overflow-hidden">
        {data.map((item, index) => (
          <View
            key={item.muscle_group}
            className="px-4 py-3"
            style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#ddd8ce' }}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-ink-soft text-xs capitalize" style={{ letterSpacing: 0.3 }}>
                {muscleGroupLabel(item.muscle_group)}
              </Text>
              <Text style={{ color: '#26241f', fontSize: 12, fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace' }}>
                {formatMuscleSeriesValue(item)}{isAverage ? " /sem" : ""}
              </Text>
            </View>
            <View className="h-1 bg-surface-elevated rounded-full overflow-hidden">
              <View
                style={{
                  height: '100%',
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: '#26241f',
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
