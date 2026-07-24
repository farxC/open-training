import { Text, View } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { resistanceCurvePoints } from "@/data/resistanceCurves";
import type { ResistanceCurve } from "@/types";

type DataPoint = Record<string, unknown> & { x: number; y: number };

interface Props {
  variant: ResistanceCurve;
}

export function ResistanceCurveChartImpl({ variant }: Props) {
  const chartData: DataPoint[] = resistanceCurvePoints(variant).map((p) => ({ x: p.x, y: p.y }));

  return (
    <View className="h-40 bg-surface-card rounded-2xl p-3">
      <View className="flex-row justify-between mb-2">
        <Text className="text-ink-mute text-xs uppercase tracking-wider">Amplitude</Text>
        <Text className="text-ink-mute text-xs uppercase tracking-wider">Resistência</Text>
      </View>
      <CartesianChart data={chartData} xKey="x" yKeys={["y"]} domain={{ y: [0, 1] }}>
        {({ points }) => (
          <Line
            points={points.y}
            color="#26241f"
            strokeWidth={2}
            curveType="natural"
            animate={{ type: "timing", duration: 300 }}
          />
        )}
      </CartesianChart>
    </View>
  );
}
