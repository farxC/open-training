import { Text, TextInput, TouchableOpacity, View } from "react-native";
import type { RoutineUnit, RoutineUnitExercise } from "@/types";
import type { TargetPatch } from "@/hooks/useRoutine";
import { NumField } from "@/components/TargetFields";

function strengthSummary(exercises: RoutineUnitExercise[]): string {
  if (exercises.length === 0) return "—";
  const first = exercises[0];
  const sets = first.target_sets > 0 ? `${first.target_sets}s` : null;
  const reps =
    first.target_reps_max != null
      ? `${first.target_reps}–${first.target_reps_max}`
      : first.target_reps > 0
        ? String(first.target_reps)
        : null;
  const weight = first.target_weight_kg ? `@ ${first.target_weight_kg}kg` : null;
  const parts = [sets, reps ? `× ${reps}` : null, weight].filter(Boolean);
  const suffix = exercises.length > 1 ? ` +${exercises.length - 1}` : "";
  return parts.length > 0 ? parts.join(" ") + suffix : "—";
}

interface StrengthPlanTableProps {
  units: RoutineUnit[];
  exercisesByUnit: Record<number, RoutineUnitExercise[]>;
  expandedUnitId: number | null;
  onToggleExpand: (id: number) => void;
  onRename: (unitId: number, label: string) => void;
  onAddExercise: (unitId: number) => void;
  onRemoveExercise: (id: number) => void;
  onUpdateTargets: (exerciseId: number, patch: TargetPatch) => void;
  onMoveUp?: (unitId: number) => void;
  onMoveDown?: (unitId: number) => void;
  onDelete?: (unitId: number) => void;
}

export function StrengthPlanTable({
  units,
  exercisesByUnit,
  expandedUnitId,
  onToggleExpand,
  onRename,
  onAddExercise,
  onRemoveExercise,
  onUpdateTargets,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StrengthPlanTableProps) {
  if (units.length === 0) return null;

  return (
    <View
      className="bg-surface-card rounded-2xl mb-3 overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      {units.map((unit, i) => {
        const exercises = exercisesByUnit[unit.id] ?? [];
        const expanded = expandedUnitId === unit.id;
        const summary = strengthSummary(exercises);

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

              <Text
                className="text-ink-mute text-xs"
                numberOfLines={1}
                style={{ maxWidth: 160, flexShrink: 1 }}
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
                      <Text className="text-red-600 text-base">✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {exercises.map((ex) => (
                  <View
                    key={ex.id}
                    className="py-2"
                    style={{ borderTopWidth: 1, borderTopColor: "#ebe7df" }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-ink text-sm flex-1">{ex.exercise_name}</Text>
                      <TouchableOpacity onPress={() => onRemoveExercise(ex.id)}>
                        <Text className="text-ink-mute text-xl px-2">×</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                      <NumField
                        value={ex.target_sets}
                        onChange={(n) => onUpdateTargets(ex.id, { target_sets: n ?? 0 })}
                        suffix="séries"
                        integer
                      />
                      <Text className="text-ink-faint text-sm">×</Text>
                      <NumField
                        value={ex.target_reps}
                        onChange={(n) => onUpdateTargets(ex.id, { target_reps: n ?? 0 })}
                        integer
                      />
                      <Text className="text-ink-faint text-xs">–</Text>
                      <NumField
                        value={ex.target_reps_max}
                        onChange={(n) => onUpdateTargets(ex.id, { target_reps_max: n })}
                        suffix="reps"
                        integer
                      />
                      <NumField
                        value={ex.target_weight_kg}
                        onChange={(n) => onUpdateTargets(ex.id, { target_weight_kg: n })}
                        suffix="kg"
                      />
                    </View>
                  </View>
                ))}

                {exercises.length === 0 && (
                  <Text className="text-ink-faint text-xs mb-3">Sem exercícios definidos</Text>
                )}

                <TouchableOpacity
                  className="mt-3 py-2 rounded-xl items-center"
                  style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                  onPress={() => onAddExercise(unit.id)}
                >
                  <Text className="text-ink text-xs font-medium">+ Adicionar exercício</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
