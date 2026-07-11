import { useCallback, useState } from "react";
import { getExercises, createExercise } from "@/db/queries";
import type { Exercise, MuscleGroup } from "@/types";

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
    (ex: Omit<Exercise, "id" | "uuid">): Exercise => {
      const { id, uuid } = createExercise(ex);
      refresh();
      return { ...ex, id, uuid, is_custom: 1 };
    },
    [refresh]
  );

  return { exercises, refresh, createCustom };
}
