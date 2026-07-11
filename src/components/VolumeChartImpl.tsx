import { Text, View } from "react-native";
import { CartesianChart, Line } from "victory-native";

type DataPoint = Record<string, unknown> & {
  week: string;
  volume_kg: number;
  x: number;
};

interface Props {
  data: { week: string; volume_kg: number }[];
}

export function VolumeChartImpl({ data }: Props) {
  if (data.length === 0) {
    return (
      <View className="h-48 items-center justify-center bg-surface-card rounded-2xl">
        <Text className="text-ink-mute text-sm">No data yet</Text>
      </View>
    );
  }

  const chartData: DataPoint[] = data.map((d, i) => ({
    x: i,
    volume_kg: d.volume_kg,
    week: d.week,
  }));

  return (
    <View className="h-48 bg-surface-card rounded-2xl p-3">
      <Text className="text-ink-mute text-xs mb-2 uppercase tracking-wider">
        Volume per week (kg)
      </Text>
      <CartesianChart data={chartData} xKey="x" yKeys={["volume_kg"]}>
        {({ points }) => (
          <Line
            points={points.volume_kg}
            color="#26241f"
            strokeWidth={2}
            animate={{ type: "timing", duration: 400 }}
          />
        )}
      </CartesianChart>
    </View>
  );
}
