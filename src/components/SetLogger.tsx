import { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SetRow } from "./SetRow";
import {
  addSet,
  deleteSet,
  getSetsBySession,
  updateSet,
} from "@/db/queries";
import type { WorkoutSet } from "@/types";

interface Props {
  exerciseId: number;
  exerciseName: string;
  sessionId: number;
  onRemoveExercise: () => void;
}

export function SetLogger({ exerciseId, exerciseName, sessionId, onRemoveExercise }: Props) {
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  const refreshSets = useCallback(() => {
    setSets(
      getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId)
    );
  }, [sessionId, exerciseId]);

  useEffect(() => {
    refreshSets();
  }, [refreshSets]);

  const handleAdd = () => {
    const last = sets[sets.length - 1];
    addSet({
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: sets.length + 1,
      reps: last?.reps ?? 8,
      weight_kg: last?.weight_kg ?? 0,
      rpe: null,
      rir: null,
      notes: null,
    });
    refreshSets();
  };

  const handleChange = (id: number, patch: Partial<WorkoutSet>) => {
    updateSet(id, patch);
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleDelete = (id: number) => {
    deleteSet(id);
    refreshSets();
  };

  return (
    <View className="mb-5">
      {/* Exercise header */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View style={{ width: 2, height: 14, backgroundColor: '#26241f', borderRadius: 1 }} />
          <Text className="text-ink font-semibold text-base">{exerciseName}</Text>
        </View>
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
