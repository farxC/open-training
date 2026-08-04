import { Text, View } from "react-native";
import { FadeInRow } from "@/components/FadeInRow";
import { TickBar } from "@/components/TickBar";
import { formatMuscleSeriesValue, formatSeriesNumber, muscleGroupLabel } from "@/data/muscleGroups";
import type { MuscleSeriesRow } from "@/types";
import { tickSlots } from "@/utils/muscleLoad";
import { monogramFor } from "@/utils/recordsGamification";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const INK = "#26241f";
const CREAM = "#f4f2ee";
const HAIRLINE = "rgba(38, 36, 31, 0.07)";

interface Props {
  data: MuscleSeriesRow[];
}

/** Series-per-muscle-group card shared by the live recording screen and the
 *  finished-session detail view — both scope to a single session, so `data`
 *  is always unaveraged (see AnalyticsMuscleBreakdown for the windowed variant).
 *  Same racked-plate bar as the analytics panel, minus the frequency reading,
 *  which means nothing inside a single session. */
export function MuscleSeriesSessionCard({ data }: Props) {
  if (data.length === 0) return null;

  const maxSeries = Math.max(...data.map((d) => d.value), 0);
  const slots = tickSlots(maxSeries);
  // One tick is one série, so the track holds exactly its slot count.
  const capacity = slots ?? maxSeries;
  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <View
      className="bg-surface-card mb-3"
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: HAIRLINE,
        overflow: "hidden",
        shadowColor: INK,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      }}
    >
      {data.map((item, index) => {
        const label = muscleGroupLabel(item.muscle_group);

        return (
          <FadeInRow
            key={item.muscle_group}
            index={index}
            step={45}
            accessibilityLabel={`${label}: ${formatMuscleSeriesValue(item)} séries`}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: HAIRLINE,
            }}
          >
            <View className="flex-row items-center" style={{ gap: 9 }}>
              <View
                className="items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  backgroundColor: CREAM,
                  borderWidth: 1,
                  borderColor: "#e7e4dc",
                }}
              >
                <Text
                  style={{
                    color: "#6f6b5f",
                    fontSize: 9,
                    fontWeight: "700",
                    fontFamily: MONO,
                    letterSpacing: 0.4,
                  }}
                >
                  {monogramFor(item.muscle_group, label)}
                </Text>
              </View>

              <Text
                style={{ color: INK, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, flex: 1 }}
                numberOfLines={1}
              >
                {label.toUpperCase()}
              </Text>

              <Text style={{ color: INK, fontSize: 15, fontWeight: "700", fontFamily: MONO }}>
                {formatMuscleSeriesValue(item)}
              </Text>
            </View>

            <View style={{ marginTop: 8 }}>
              <TickBar
                value={item.value}
                capacity={capacity}
                slots={slots}
                height={8}
                // Snappier than the analytics panel: this card grows a tick
                // every time a set is logged, so it can't feel like a wind-up.
                delay={index * 45}
              />
            </View>
          </FadeInRow>
        );
      })}

      <View
        className="flex-row items-center justify-between"
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: HAIRLINE,
          backgroundColor: "#fdfcfa",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 5 }}>
          {slots != null ? (
            <>
              <View style={{ width: 6, height: 9, borderRadius: 1.5, backgroundColor: INK }} />
              <Text className="text-ink-faint" style={{ fontSize: 9, letterSpacing: 0.3 }}>
                1 série
              </Text>
            </>
          ) : null}
        </View>

        <View className="flex-row items-baseline" style={{ gap: 4 }}>
          <Text style={{ color: "#928d80", fontSize: 9, fontWeight: "700", letterSpacing: 1.1 }}>
            CARGA TOTAL
          </Text>
          <Text style={{ color: INK, fontSize: 13, fontWeight: "700", fontFamily: MONO }}>
            {formatSeriesNumber(total, false)}
          </Text>
        </View>
      </View>
    </View>
  );
}
