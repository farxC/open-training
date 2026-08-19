import { useCallback, useState } from "react";
import {
  archiveExercise,
  createExercise,
  createVariation,
  getExercises,
  setDefaultVariation,
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

type NewExercise = Omit<
  Exercise,
  "id" | "uuid" | "muscle_groups" | "config" | "is_archived" | "parent_exercise_id" | "is_default_variation"
> & {
  muscle_groups: MuscleGroup[];
};

type NewVariation = Omit<
  Exercise,
  | "id"
  | "uuid"
  | "muscle_groups"
  | "config"
  | "is_archived"
  | "parent_exercise_id"
  | "is_default_variation"
  | "modality"
>;

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
        parent_exercise_id: null,
        is_default_variation: 0,
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

  /** Creates a grip/angle/equipment variation of parentExerciseId. Returns the
   *  new exercise's id/uuid rather than a constructed Exercise — the cloned
   *  config/muscle groups aren't known client-side, so callers re-read from
   *  `exercises` after refresh() instead of trusting a hand-built object. */
  const createVariationOf = useCallback(
    (parentExerciseId: number, ex: NewVariation): { id: number; uuid: string } => {
      const result = createVariation(parentExerciseId, ex);
      refresh();
      return result;
    },
    [refresh]
  );

  const setDefaultVariationOf = useCallback(
    (exerciseId: number): void => {
      setDefaultVariation(exerciseId);
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

  return {
    exercises,
    refresh,
    createCustom,
    updateMuscleGroups,
    updateConfig,
    updateIdentity,
    archive,
    unarchive,
    createVariationOf,
    setDefaultVariationOf,
  };
}
