import { useCallback, useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { SetRow } from "./SetRow";
import {
  addSet,
  deleteSet,
  getSetsBySession,
  updateSet,
} from "@/db/queries";
import type { RoutineUnitExercise, WorkoutSet } from "@/types";

interface Props {
  exerciseId: number;
  exerciseName: string;
  sessionId: number;
  onRemoveExercise: () => void;
  targets?: RoutineUnitExercise;
  dragHandleIcon?: React.ReactNode;
  DragHandle?: React.ComponentType<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }>;
  index?: number;
  onSetsChanged?: () => void;
}

function targetLabel(targets: RoutineUnitExercise): string | null {
  if (!targets.target_sets || targets.target_sets <= 0) return null;
  const reps = targets.target_reps_max
    ? `${targets.target_reps}–${targets.target_reps_max}`
    : `${targets.target_reps}`;
  const weight = targets.target_weight_kg ? ` @ ${targets.target_weight_kg}kg` : "";
  return `Meta: ${targets.target_sets}×${reps} reps${weight}`;
}

export function SetLogger({ exerciseId, exerciseName, sessionId, onRemoveExercise, targets, dragHandleIcon, DragHandle, index, onSetsChanged }: Props) {
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const HandleWrapper = DragHandle ?? View;

  const refreshSets = useCallback(() => {
    setSets(
      getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId)
    );
  }, [sessionId, exerciseId]);

  // Adding an exercise implies at least one set is coming, so seed it instead of
  // making the user tap "+ Add Set" for what's always their first one. Runs once
  // per mount, so deleting the only set afterward doesn't bring it back.
  useEffect(() => {
    const existing = getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId);
    if (existing.length === 0) {
      addSet({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: 1,
        reps: targets?.target_reps ?? 8,
        weight_kg: targets?.target_weight_kg ?? 0,
        rpe: null,
        rir: null,
        notes: null,
        distance_km: null,
        duration_sec: null,
        pace_sec: null,
        failure: 0,
      });
    }
    refreshSets();
    onSetsChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    const last = sets[sets.length - 1];
    addSet({
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: sets.length + 1,
      reps: last?.reps ?? targets?.target_reps ?? 8,
      weight_kg: last?.weight_kg ?? targets?.target_weight_kg ?? 0,
      rpe: null,
      rir: null,
      notes: null,
      distance_km: null,
      duration_sec: null,
      pace_sec: null,
      failure: 0,
    });
    refreshSets();
    onSetsChanged?.();
  };

  const handleChange = (id: number, patch: Partial<WorkoutSet>) => {
    updateSet(id, patch);
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    onSetsChanged?.();
  };

  const handleDelete = (id: number) => {
    deleteSet(id);
    refreshSets();
    onSetsChanged?.();
  };

  return (
    <View className="mb-5">
      {/* Exercise header */}
      <View className="flex-row justify-between items-center mb-2">
        <HandleWrapper style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {dragHandleIcon}
          {index != null && (
            <Text className="text-ink-mute text-xs" style={{ width: 16 }}>{index + 1}.</Text>
          )}
          <View style={{ width: 2, height: 14, backgroundColor: '#26241f', borderRadius: 1 }} />
          <View>
            <Text className="text-ink font-semibold text-base">{exerciseName}</Text>
            {targets && targetLabel(targets) && (
              <Text className="text-ink-faint text-xs mt-0.5">{targetLabel(targets)}</Text>
            )}
          </View>
        </HandleWrapper>
        <TouchableOpacity onPress={onRemoveExercise}>
          <Text className="text-ink-mute text-sm">Remove</Text>
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      {sets.length > 0 && (
        <View className="flex-row mb-1" style={{ gap: 8, paddingLeft: 0 }}>
          <Text className="text-ink-mute text-xs text-center" style={{ width: 20 }}>#</Text>
          <Text className="text-ink-mute text-xs flex-1 text-center">Weight</Text>
          <Text className="text-ink-mute text-xs" style={{ width: 12 }} />
          <Text className="text-ink-mute text-xs flex-1 text-center">Reps</Text>
          <Text style={{ width: 20 }} />
        </View>
      )}

      {sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          onChange={(patch) => handleChange(set.id, patch)}
          onDelete={() => handleDelete(set.id)}
        />
      ))}

      <TouchableOpacity
        className="mt-2 py-2.5 rounded-lg items-center"
        style={{ borderWidth: 1, borderColor: '#c9c3b6', borderStyle: 'dashed' }}
        onPress={handleAdd}
      >
        <Text className="text-ink text-sm">+ Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}
