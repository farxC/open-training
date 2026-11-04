import { Text, View } from "react-native";
import { distanceDisplay, formatClock, formatDistanceValue, formatEffort } from "@/data/modalities";
import type { Modality, WorkoutSet } from "@/types";
import colors from "@/theme/palette.json";

/** Legs belong to one activity. Render a single table, without exercise cards,
 * exercise-history links or a distance-based "best set" award for each leg. */
export function DistanceSessionSplits({ sets, modality }: { sets: WorkoutSet[]; modality: Modality }) {
  if (sets.length === 0) return null;
  const rows = [...sets].sort((a, b) => a.set_number - b.set_number || a.id - b.id);
  const effortLabel = distanceDisplay(modality).effortMode === "speed" ? "Velocidade" : "Pace";
  const completeDistance = rows.every((s) => s.distance_km !== null);
  const completeDuration = rows.every((s) => s.duration_sec !== null);
  const distance = completeDistance ? rows.reduce((sum, s) => sum + (s.distance_km ?? 0), 0) : null;
  const duration = completeDuration ? rows.reduce((sum, s) => sum + (s.duration_sec ?? 0), 0) : null;
  const pace = distance !== null && distance > 0 && duration !== null && duration > 0 ? duration / distance : null;
  const widths = [0.8, 1, 1, 1.2];
  const cell = (value: string, index: number, heading = false) => <Text key={index}
    className={heading ? "font-sans" : ""}
    style={{ flex: widths[index], textAlign: index === 0 ? "left" : "right", color: heading ? colors.muted : colors.ink,
      fontSize: heading ? 10 : 12, fontWeight: heading ? "600" : "400", fontFamily: heading ? undefined : "JetBrains Mono" }}>
    {value}
  </Text>;

  return <View className="bg-surface-card rounded-2xl" style={{ borderWidth: 1, borderColor: colors.line, padding: 16 }}>
    <Text className="font-display text-ink font-semibold" style={{ fontSize: 18, marginBottom: 14 }}>Parciais</Text>
    <View style={{ flexDirection: "row", gap: 8, paddingBottom: 10 }}>
      {["Parcial", "Distância", "Tempo", effortLabel].map((label, index) => cell(label, index, true))}
    </View>
    {rows.map((s, index) => <View key={s.id} accessibilityLabel={`Parcial ${index + 1}`}
      style={{ flexDirection: "row", gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
      {[String(index + 1), formatDistanceValue(s.distance_km, modality) ?? "—", formatClock(s.duration_sec) || "—",
        formatEffort(s.pace_sec, modality) ?? "—"].map((value, i) => cell(value, i))}
    </View>)}
    {rows.length > 1 && <View style={{ flexDirection: "row", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
      {["Total", formatDistanceValue(distance, modality) ?? "—", formatClock(duration) || "—", formatEffort(pace, modality) ?? "—"]
        .map((value, index) => cell(value, index))}
    </View>}
  </View>;
}
