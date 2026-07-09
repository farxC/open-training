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
  addSessionPhoto,
} from "@/db/queries";
import type { Exercise, Modality, RoutineUnitExercise, WorkoutSet } from "@/types";

export function useSessionRecorder() {
  const { state, start, addExercise, addExercises, removeExercise, finish, discard } =
    useRecorderContext();

  const startResolvedSession = useCallback(
    (payload: {
      date: string;
      modality: Modality;
      splitId: number | null;
      unitId: number | null;
      programWeekId: number | null;
      name: string | null;
      notes: string | null;
      photoUris: string[];
      exercises: { exercise: Exercise; targets?: RoutineUnitExercise }[];
    }) => {
      const sessionId = createSession(payload.date, {
        name: payload.name,
        notes: payload.notes,
        modality: payload.modality,
        split_id: payload.splitId,
        unit_id: payload.unitId,
        program_week_id: payload.programWeekId,
      });
      payload.photoUris.forEach((uri, i) => addSessionPhoto(sessionId, uri, i));
      start(sessionId, payload.modality, payload.splitId, payload.unitId, payload.programWeekId);
      addExercises(payload.exercises);
      return sessionId;
    },
    [start, addExercises]
  );

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
        distance_km: null,
        duration_sec: null,
        pace_sec: null,
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
    (notes?: string) => {
      if (!state.sessionId || !state.startTime) return;
      const duration = Math.round(
        (Date.now() - state.startTime.getTime()) / 1000
      );
      updateSession(state.sessionId, {
        notes: notes ?? null,
        duration_seconds: duration,
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
    startResolvedSession,
    addExerciseToSession,
    removeExerciseFromSession,
    addSetToSession,
    updateSetInSession,
    removeSetFromSession,
    finishSession,
    discardSession,
  };
}
