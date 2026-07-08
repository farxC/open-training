import { useCallback } from "react";
import { useRecorderContext } from "@/context/SessionRecorderContext";
import {
  createSession,
  updateSession,
  deleteSession,
  addSet,
  updateSet,
  deleteSet,
  getSetsBySession,
} from "@/db/queries";
import type { Exercise, WorkoutSet } from "@/types";

export function useSessionRecorder() {
  const { state, start, addExercise, removeExercise, finish, discard } =
    useRecorderContext();

  const startSession = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sessionId = createSession(today);
    start(sessionId);
    return sessionId;
  }, [start]);

  const addExerciseToSession = useCallback(
    (exercise: Exercise) => {
      addExercise(exercise);
    },
    [addExercise]
  );

  const removeExerciseFromSession = useCallback(
    (exerciseId: number) => {
      removeExercise(exerciseId);
    },
    [removeExercise]
  );

  const addSetToSession = useCallback(
    (exerciseId: number, setData: { reps: number; weight_kg: number; rpe?: number; notes?: string }) => {
      if (!state.sessionId) return;
      const existing = getSetsBySession(state.sessionId).filter(
        (s) => s.exercise_id === exerciseId
      );
      addSet({
        session_id: state.sessionId,
        exercise_id: exerciseId,
        set_number: existing.length + 1,
        reps: setData.reps,
        weight_kg: setData.weight_kg,
        rpe: setData.rpe ?? null,
        rir: null,
        notes: setData.notes ?? null,
      });
    },
    [state.sessionId]
  );

  const updateSetInSession = useCallback(
    (setId: number, patch: Partial<Omit<WorkoutSet, "id" | "session_id">>) => {
      updateSet(setId, patch);
    },
    []
  );

  const removeSetFromSession = useCallback((setId: number) => {
    deleteSet(setId);
  }, []);

  const finishSession = useCallback(
    (notes?: string, photoUri?: string) => {
      if (!state.sessionId || !state.startTime) return;
      const duration = Math.round(
        (Date.now() - state.startTime.getTime()) / 1000
      );
      updateSession(state.sessionId, {
        notes: notes ?? null,
        duration_seconds: duration,
        photo_uri: photoUri ?? null,
      });
      finish();
    },
    [state.sessionId, state.startTime, finish]
  );

  const discardSession = useCallback(() => {
    if (state.sessionId) {
      deleteSession(state.sessionId);
    }
    discard();
  }, [state.sessionId, discard]);

  return {
    ...state,
    startSession,
    addExerciseToSession,
    removeExerciseFromSession,
    addSetToSession,
    updateSetInSession,
    removeSetFromSession,
    finishSession,
    discardSession,
  };
}
