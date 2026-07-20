import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { formatClock, formatPaceSec } from "@/data/modalities";
import type { WorkoutSet } from "@/types";

interface Props {
  exerciseId: number;
  exerciseName: string;
  ordinal: number;
  sets: (WorkoutSet & { exercise_name: string })[];
}

/** Inserts "." every 3 digits from the right — pt-BR thousands separator. Avoids toLocaleString (Hermes support is spotty). */
function formatThousands(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sign + withDots;
}

function intensityColor(rpe: number | null, rir: number | null, failure: 0 | 1): string {
  if (failure || (rpe != null && rpe >= 9)) return "#bf3b30";
  if ((rir != null && rir <= 1) || (rpe != null && rpe >= 8)) return "#b9791f";
  return "#928d80";
}

export function ExerciseSessionCard({ exerciseId, exerciseName, ordinal, sets }: Props) {
  const isRunGroup = sets.some((s) => s.distance_km != null);
  const vol = sets.reduce((s, x) => s + x.reps * x.weight_kg, 0);
  const dist = sets.reduce((s, x) => s + (x.distance_km ?? 0), 0);
  const setLabel = sets.length === 1 ? "1 série" : `${sets.length} séries`;

  const loadValues = sets.map((s) => s.distance_km ?? s.weight_kg);
  const maxLoad = Math.max(...loadValues, 0);
  const hasLoadSpread = maxLoad > 0 && loadValues.some((v) => v < maxLoad);
  const bestIndex = hasLoadSpread ? loadValues.indexOf(maxLoad) : -1;

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
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => router.push(`/exercises/${exerciseId}`)}
        className="flex-row items-center"
        style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 11, gap: 10 }}
      >
        <View
          className="items-center justify-center"
          style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#26241f" }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 10,
              fontWeight: "700",
              fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
            }}
          >
            {ordinal}
          </Text>
        </View>

        <Text
          className="font-display flex-1"
          style={{ color: "#26241f", fontSize: 16, fontWeight: "600" }}
          numberOfLines={1}
        >
          {exerciseName}
        </Text>

        <Text
          className="text-ink-soft"
          style={{ fontSize: 12, fontFamily: "JetBrains Mono, Menlo, Courier New, monospace" }}
        >
          {isRunGroup ? (dist > 0 ? `${dist.toFixed(1)} km` : setLabel) : vol > 0 ? `${formatThousands(vol)} kg` : setLabel}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color="#bdb8aa" />
      </TouchableOpacity>

      <View style={{ height: 1, backgroundColor: "rgba(38, 36, 31, 0.07)" }} />

      <View style={{ paddingHorizontal: 14 }}>
        {sets.map((s, i) => {
          const hasIntensity = s.rpe != null || s.rir != null || !!s.failure;
          const isBest = i === bestIndex;
          const load = s.distance_km ?? s.weight_kg;
          const barPct = maxLoad > 0 ? Math.max((load / maxLoad) * 100, load > 0 ? 6 : 0) : 0;

          return (
            <View
              key={s.id}
              style={{
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(38, 36, 31, 0.05)",
              }}
            >
              {barPct > 0 && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 4,
                    bottom: 4,
                    width: `${barPct}%`,
                    backgroundColor: isBest ? "rgba(38, 36, 31, 0.07)" : "rgba(38, 36, 31, 0.035)",
                    borderRadius: 8,
                  }}
                />
              )}

              <View className="flex-row items-center">
                <Text
                  className="text-ink-faint"
                  style={{
                    width: 20,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                  }}
                >
                  {s.set_number}
                </Text>

                {s.distance_km != null ? (
                  <Text className="text-ink flex-1" style={{ fontSize: 14 }}>
                    {s.distance_km} km em {formatClock(s.duration_sec)}
                    {formatPaceSec(s.pace_sec) ? ` · pace ${formatPaceSec(s.pace_sec)}` : ""}
                  </Text>
                ) : (
                  <Text className="text-ink flex-1" style={{ fontSize: 14 }}>
                    <Text
                      style={{
                        fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                        fontWeight: isBest ? "700" : "400",
                      }}
                    >
                      {s.weight_kg}
                    </Text>
                    <Text className="text-ink-mute"> kg × </Text>
                    <Text style={{ fontFamily: "JetBrains Mono, Menlo, Courier New, monospace" }}>
                      {s.reps}
                    </Text>
                    <Text className="text-ink-mute"> reps</Text>
                  </Text>
                )}

                {isBest && (
                  <MaterialCommunityIcons
                    name="trophy-outline"
                    size={13}
                    color="#b9791f"
                    style={{ marginRight: hasIntensity ? 6 : 0 }}
                  />
                )}

                {hasIntensity && (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      backgroundColor: `${intensityColor(s.rpe, s.rir, s.failure)}1a`,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: intensityColor(s.rpe, s.rir, s.failure),
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      {s.rpe != null ? `RPE ${s.rpe}` : ""}
                      {s.rpe != null && s.rir != null ? " · " : ""}
                      {s.rir != null ? `RIR ${s.rir}` : ""}
                      {s.failure ? `${s.rpe != null || s.rir != null ? " · " : ""}Falha` : ""}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
