import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Modality, RoutineUnit, RoutineUnitExercise } from "@/types";
import type { TargetPatch } from "@/hooks/useRoutine";
import { continuousDurationSec, formatClock, formatDistanceValue, formatEffort } from "@/data/modalities";
import { DistanceTargetFields } from "@/components/TargetFields";

export function distanceSummary(re: RoutineUnitExercise, modality: Modality): string {
  const type = re.run_type ?? "continuous";
  if (type === "interval") {
    if (!re.interval_reps) return "—";
    const effort = re.interval_work_km
      ? formatDistanceValue(re.interval_work_km, modality)
      : re.interval_work_sec
        ? formatClock(re.interval_work_sec)
        : null;
    if (!effort) return "—";
    const pace = re.target_pace_sec ? ` @${formatEffort(re.target_pace_sec, modality)}` : "";
    const rest = re.interval_rest_sec ? ` / ${formatClock(re.interval_rest_sec)}` : "";
    return `${re.interval_reps}× ${effort}${pace}${rest}`;
  }
  // continuous
  const dist = formatDistanceValue(re.target_distance_km, modality);
  const pace = re.target_pace_sec ? `@${formatEffort(re.target_pace_sec, modality)}` : null;
  const totalSec = continuousDurationSec(re.target_distance_km, re.target_pace_sec);
  const time = totalSec ? `≈ ${formatClock(totalSec)}` : null;
  const parts = [dist, pace, time].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "—";
}

interface DistancePlanTableProps {
  units: RoutineUnit[];
  modality: Modality;
  exercisesByUnit: Record<number, RoutineUnitExercise[]>;
  expandedUnitId: number | null;
  onToggleExpand: (id: number) => void;
  onRename: (unitId: number, label: string) => void;
  onUpdateTargets: (exerciseId: number, patch: TargetPatch) => void;
  onMoveUp?: (unitId: number) => void;
  onMoveDown?: (unitId: number) => void;
  onDelete?: (unitId: number) => void;
}

export function DistancePlanTable({
  units,
  modality,
  exercisesByUnit,
  expandedUnitId,
  onToggleExpand,
  onRename,
  onUpdateTargets,
  onMoveUp,
  onMoveDown,
  onDelete,
}: DistancePlanTableProps) {
  if (units.length === 0) return null;

  return (
    <View
      className="bg-surface-card rounded-2xl mb-3 overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      {units.map((unit, i) => {
        const exercises = exercisesByUnit[unit.id] ?? [];
        const re = exercises[0] ?? null;
        const expanded = expandedUnitId === unit.id;
        const typeLabel =
          re == null ? null : re.run_type === "interval" ? "Intervalado" : "Contínuo";
        const summary = re ? distanceSummary(re, modality) : "—";

        return (
          <View
            key={unit.id}
            style={i > 0 ? { borderTopWidth: 1, borderTopColor: "#ddd8ce" } : undefined}
          >
            {/* Compact summary row */}
            <TouchableOpacity
              onPress={() => onToggleExpand(unit.id)}
              className="flex-row items-center px-3 py-3"
              style={{ gap: 10 }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "#26241f",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{i + 1}</Text>
              </View>

              <Text className="text-ink text-sm font-medium" style={{ flex: 1 }} numberOfLines={1}>
                {unit.label}
              </Text>

              {typeLabel && (
                <View
                  style={{
                    backgroundColor: "#ebe7df",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: "#5c594f", fontSize: 10, fontWeight: "600" }}>
                    {typeLabel}
                  </Text>
                </View>
              )}

              <Text
                className="text-ink-mute text-xs"
                numberOfLines={1}
                style={{ maxWidth: 150, flexShrink: 1 }}
              >
                {summary}
              </Text>

              <Text className="text-ink-faint text-xs" style={{ flexShrink: 0 }}>
                {expanded ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>

            {/* Expanded editing panel */}
            {expanded && (
              <View
                className="px-4 pb-4"
                style={{ borderTopWidth: 1, borderTopColor: "#ebe7df" }}
              >
                {/* Label + controls */}
                <View className="flex-row items-center mt-3 mb-3" style={{ gap: 8 }}>
                  <TextInput
                    value={unit.label}
                    onChangeText={(label) => onRename(unit.id, label)}
                    placeholder="Nome do treino"
                    placeholderTextColor="#bdb8aa"
                    className="flex-1 text-ink text-sm bg-surface-elevated rounded-lg px-3 py-2"
                  />
                  {onMoveUp && i > 0 && (
                    <TouchableOpacity onPress={() => onMoveUp(unit.id)} className="px-1">
                      <Text className="text-ink-mute text-base">↑</Text>
                    </TouchableOpacity>
                  )}
                  {onMoveDown && i < units.length - 1 && (
                    <TouchableOpacity onPress={() => onMoveDown(unit.id)} className="px-1">
                      <Text className="text-ink-mute text-base">↓</Text>
                    </TouchableOpacity>
                  )}
                  {onDelete && (
                    <TouchableOpacity onPress={() => onDelete(unit.id)} className="px-1">
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>

                {exercises[0] && (
                  <DistanceTargetFields
                    value={exercises[0]}
                    modality={modality}
                    onChange={(patch) => onUpdateTargets(exercises[0].id, patch)}
                  />
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
