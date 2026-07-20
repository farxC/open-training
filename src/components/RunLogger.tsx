import { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { RunRow } from "./RunRow";
import {
  addSet,
  deleteSet,
  getSetsBySession,
  updateSet,
} from "@/db/queries";
import { formatPaceSec } from "@/data/modalities";
import type { RoutineUnitExercise, WorkoutSet } from "@/types";

interface Props {
  exerciseId: number;
  exerciseName: string;
  sessionId: number;
  onRemoveExercise: () => void;
  targets?: RoutineUnitExercise;
  dragHandle?: React.ReactNode;
  index?: number;
  onSetsChanged?: () => void;
}

function targetLabel(targets: RoutineUnitExercise): string | null {
  if (!targets.target_distance_km) return null;
  const pace = formatPaceSec(targets.target_pace_sec);
  return `Meta: ${targets.target_distance_km}km${pace ? ` · pace ${pace}` : ""}`;
}

export function RunLogger({ exerciseId, exerciseName, sessionId, onRemoveExercise, targets, dragHandle, index, onSetsChanged }: Props) {
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  const refreshSets = useCallback(() => {
    setSets(
      getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId)
    );
  }, [sessionId, exerciseId]);

  // Adding a run exercise implies at least one entry is coming, so seed it instead
  // of making the user tap "+ Add Run" for what's always their first one. Runs once
  // per mount, so deleting the only entry afterward doesn't bring it back.
  useEffect(() => {
    const existing = getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId);
    if (existing.length === 0) {
      addSet({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: 1,
        reps: 0,
        weight_kg: 0,
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
    addSet({
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: sets.length + 1,
      reps: 0,
      weight_kg: 0,
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
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {dragHandle}
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
        </View>
        <TouchableOpacity onPress={onRemoveExercise}>
          <Text className="text-ink-mute text-sm">Remove</Text>
        </TouchableOpacity>
      </View>

      {sets.length > 0 && (
        <View className="flex-row mb-1" style={{ gap: 8, paddingLeft: 0 }}>
          <Text className="text-ink-mute text-xs text-center" style={{ width: 20 }}>#</Text>
          <Text className="text-ink-mute text-xs flex-1 text-center">Distância</Text>
          <Text className="text-ink-mute text-xs" style={{ width: 20 }} />
          <Text className="text-ink-mute text-xs flex-1 text-center">Pace</Text>
          <Text style={{ width: 20 }} />
        </View>
      )}

      {sets.map((set) => (
        <RunRow
          key={set.id}
          set={set}
          onChange={(patch) => handleChange(set.id, patch)}
          onDelete={() => handleDelete(set.id)}
        />
      ))}

    </View>
  );
}
