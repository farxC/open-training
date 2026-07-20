import { useCallback, useState } from "react";
import { getExercises, createExercise, updateExerciseMuscleGroups } from "@/db/queries";
import type { Exercise, ExerciseMuscleGroup, MuscleGroup } from "@/types";

interface Filter {
  muscle_group?: MuscleGroup;
  is_custom?: boolean;
}

export function useExercises(filter?: Filter) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    getExercises(filter)
  );

  const refresh = useCallback(() => {
    setExercises(getExercises(filter));
  }, [filter]);

  const createCustom = useCallback(
    (ex: Omit<Exercise, "id" | "uuid" | "muscle_groups"> & { muscle_groups: MuscleGroup[] }): Exercise => {
      const { id, uuid } = createExercise(ex);
      refresh();
      return {
        ...ex,
        id,
        uuid,
        is_custom: 1,
        muscle_groups: ex.muscle_groups.map((muscle_group) => ({ muscle_group, counting_factor: 1 })),
      };
    },
    [refresh]
  );

  const updateMuscleGroups = useCallback(
    (exerciseId: number, muscleGroups: ExerciseMuscleGroup[]): void => {
      updateExerciseMuscleGroups(exerciseId, muscleGroups);
      refresh();
    },
    [refresh]
  );

  return { exercises, refresh, createCustom, updateMuscleGroups };
}
