import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Modality, RoutineUnit, RoutineUnitExercise } from "@/types";
import type { TargetPatch } from "@/hooks/useRoutine";
import { modalityConfig } from "@/data/modalities";
import { NumField, RunTargetFields } from "@/components/TargetFields";

interface Props {
  unit: RoutineUnit;
  exercises: RoutineUnitExercise[];
  modality: Modality;
  expanded: boolean;
  onToggleExpand: () => void;
  onRename: (label: string) => void;
  onAddExercise: () => void;
  onRemoveExercise: (id: number) => void;
  onUpdateTargets: (exerciseId: number, patch: TargetPatch) => void;
  badge?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
}

export function UnitCard({
  unit,
  exercises,
  modality,
  expanded,
  onToggleExpand,
  onRename,
  onAddExercise,
  onRemoveExercise,
  onUpdateTargets,
  badge,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const isDistance = modalityConfig(modality).targetKind === "distance";

  return (
    <View
      className="bg-surface-card rounded-2xl mb-3 overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      <View className="flex-row items-center p-4">
        {badge !== undefined && (
          <View
            style={{
              minWidth: 34,
              height: 34,
              paddingHorizontal: 8,
              borderRadius: 17,
              backgroundColor: "#26241f",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>{badge}</Text>
          </View>
        )}
        <TextInput
          value={unit.label}
          onChangeText={onRename}
          placeholder="Nome do treino"
          placeholderTextColor="#bdb8aa"
          className="flex-1 text-ink font-semibold text-base"
        />
        {onDelete && (
          <View className="flex-row items-center" style={{ gap: 10 }}>
            {onMoveUp && (
              <TouchableOpacity onPress={onMoveUp} className="px-1">
                <Text className="text-ink-mute text-base">↑</Text>
              </TouchableOpacity>
            )}
            {onMoveDown && (
              <TouchableOpacity onPress={onMoveDown} className="px-1">
                <Text className="text-ink-mute text-base">↓</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onDelete} className="px-1">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isDistance ? (
        exercises[0] && (
          <View className="px-4 pb-4">
            <RunTargetFields
              value={exercises[0]}
              onChange={(patch) => onUpdateTargets(exercises[0].id, patch)}
            />
          </View>
        )
      ) : (
        <>
          <TouchableOpacity onPress={onToggleExpand} className="px-4 pb-3">
            <Text className="text-ink-mute text-sm">
              {exercises.length} {exercises.length === 1 ? "exercício" : "exercícios"} {expanded ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {expanded && (
            <View className="px-4 pb-4">
              {exercises.map((re) => (
                <View
                  key={re.id}
                  className="py-3"
                  style={{ borderTopWidth: 1, borderTopColor: "#ddd8ce" }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-ink text-sm flex-1">{re.exercise_name}</Text>
                    <TouchableOpacity onPress={() => onRemoveExercise(re.id)} className="px-2">
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#928d80" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                    <NumField
                      value={re.target_sets}
                      onChange={(n) => onUpdateTargets(re.id, { target_sets: n ?? 0 })}
                      suffix="séries"
                      integer
                    />
                    <Text className="text-ink-faint text-sm">×</Text>
                    <NumField
                      value={re.target_reps}
                      onChange={(n) => onUpdateTargets(re.id, { target_reps: n ?? 0 })}
                      integer
                    />
                    <Text className="text-ink-faint text-xs">–</Text>
                    <NumField
                      value={re.target_reps_max}
                      onChange={(n) => onUpdateTargets(re.id, { target_reps_max: n })}
                      suffix="reps"
                      integer
                    />
                    <NumField
                      value={re.target_weight_kg}
                      onChange={(n) => onUpdateTargets(re.id, { target_weight_kg: n })}
                      suffix="kg"
                    />
                  </View>
                </View>
              ))}
              <TouchableOpacity
                className="mt-3 py-2.5 rounded-xl items-center"
                style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                onPress={onAddExercise}
              >
                <Text className="text-ink text-sm font-medium">+ Adicionar exercício</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}
