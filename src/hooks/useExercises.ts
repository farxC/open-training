import { useCallback, useState } from "react";
import {
  archiveExercise,
  createExercise,
  getExercises,
  unarchiveExercise,
  updateExercise,
  updateExerciseConfig,
  updateExerciseMuscleGroups,
} from "@/db/queries";
import { DEFAULT_EXERCISE_CONFIG } from "@/data/exerciseConfig";
import type { Exercise, ExerciseConfig, ExerciseMuscleGroup, MuscleGroup } from "@/types";

interface Filter {
  muscle_group?: MuscleGroup;
  is_custom?: boolean;
  include_archived?: boolean;
}

/** New defaults apply from the next session on; passing applyToHistory rewrites
 *  the snapshots of sessions already recorded too. */
interface PropagationOptions {
  applyToHistory?: boolean;
}

type NewExercise = Omit<Exercise, "id" | "uuid" | "muscle_groups" | "config" | "is_archived"> & {
  muscle_groups: MuscleGroup[];
};

export function useExercises(filter?: Filter) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    getExercises(filter)
  );

  const refresh = useCallback(() => {
    setExercises(getExercises(filter));
  }, [filter]);

  const createCustom = useCallback(
    (ex: NewExercise): Exercise => {
      const { id, uuid } = createExercise(ex);
      refresh();
      return {
        ...ex,
        id,
        uuid,
        is_custom: 1,
        is_archived: 0,
        muscle_groups: ex.muscle_groups.map((muscle_group) => ({ muscle_group, counting_factor: 1 })),
        config: DEFAULT_EXERCISE_CONFIG,
      };
    },
    [refresh]
  );

  const updateMuscleGroups = useCallback(
    (exerciseId: number, muscleGroups: ExerciseMuscleGroup[], options?: PropagationOptions): void => {
      updateExerciseMuscleGroups(exerciseId, muscleGroups, options);
      refresh();
    },
    [refresh]
  );

  const updateConfig = useCallback(
    (exerciseId: number, config: ExerciseConfig, options?: PropagationOptions): void => {
      updateExerciseConfig(exerciseId, config, options);
      refresh();
    },
    [refresh]
  );

  /** Renames / retypes an exercise. Throws ExerciseNameTakenError on a name
   *  clash — `exercises.name` is UNIQUE — for the caller to surface. */
  const updateIdentity = useCallback(
    (exerciseId: number, fields: Pick<Exercise, "name" | "equipment" | "type" | "modality">): void => {
      updateExercise(exerciseId, fields);
      refresh();
    },
    [refresh]
  );

  const archive = useCallback(
    (exerciseId: number): void => {
      archiveExercise(exerciseId);
      refresh();
    },
    [refresh]
  );

  const unarchive = useCallback(
    (exerciseId: number): void => {
      unarchiveExercise(exerciseId);
      refresh();
    },
    [refresh]
  );

  return { exercises, refresh, createCustom, updateMuscleGroups, updateConfig, updateIdentity, archive, unarchive };
}
