import { Text, View } from "react-native";
import { formatMuscleSeriesValue, muscleGroupLabel } from "@/data/muscleGroups";
import type { MuscleSeriesRow } from "@/types";

interface Props {
  data: MuscleSeriesRow[];
}

/** Series-per-muscle-group card shared by the live recording screen and the
 *  finished-session detail view — both scope to a single session, so `data`
 *  is always unaveraged (see MuscleSeriesChart for the analytics/averaged variant). */
export function MuscleSeriesSessionCard({ data }: Props) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View
      className="bg-surface-card mb-3"
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(38, 36, 31, 0.07)",
        overflow: "hidden",
        shadowColor: "#26241f",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      }}
    >
      {data.map((item, index) => (
        <View
          key={item.muscle_group}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: "rgba(38, 36, 31, 0.07)",
          }}
        >
          <View className="flex-row justify-between items-center mb-1.5">
            <Text style={{ color: "#26241f", fontSize: 13, fontWeight: "600" }}>
              {muscleGroupLabel(item.muscle_group)}
            </Text>
            <Text
              style={{
                color: "#26241f",
                fontSize: 13,
                fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
              }}
            >
              {formatMuscleSeriesValue(item)}
            </Text>
          </View>
          <View
            style={{
              height: 4,
              backgroundColor: "rgba(38, 36, 31, 0.06)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${(item.value / max) * 100}%`,
                backgroundColor: "#26241f",
                borderRadius: 99,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
