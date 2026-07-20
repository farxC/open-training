import { Text, View } from "react-native";

interface Props {
  data: { muscle_group: string; total_series: number }[];
}

function formatSeries(value: number): string {
  // Guard against float noise from summing 0.5/1.0 counting factors (e.g. 4.499999999999999).
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function MuscleSeriesChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <View className="bg-surface-card rounded-2xl p-4 items-center">
        <Text className="text-ink-mute text-sm">No data yet</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.total_series), 1);

  return (
    <View className="bg-surface-card rounded-2xl overflow-hidden">
      {data.map((item, index) => (
        <View
          key={item.muscle_group}
          className="px-4 py-3"
          style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#ddd8ce' }}
        >
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-ink-soft text-xs capitalize" style={{ letterSpacing: 0.3 }}>
              {item.muscle_group.replace(/_/g, " ")}
            </Text>
            <Text style={{ color: '#26241f', fontSize: 12, fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace' }}>
              {formatSeries(item.total_series)}
            </Text>
          </View>
          <View className="h-1 bg-surface-elevated rounded-full overflow-hidden">
            <View
              style={{
                height: '100%',
                width: `${(item.total_series / max) * 100}%`,
                backgroundColor: '#26241f',
                borderRadius: 99,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
