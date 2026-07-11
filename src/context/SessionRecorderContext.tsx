import React, { createContext, useCallback, useContext, useReducer } from "react";
import type { Exercise, Modality, RoutineUnitExercise } from "@/types";

interface RecorderState {
  sessionId: number | null;
  startTime: Date | null;
  selectedExercises: Exercise[];
  targetsByExerciseId: Record<number, RoutineUnitExercise>;
  isRecording: boolean;
  modality: Modality;
  splitId: number | null;
  unitId: number | null;
  programWeekId: number | null;
}

type StartExercise = { exercise: Exercise; targets?: RoutineUnitExercise };

type RecorderAction =
  | {
      type: "START";
      sessionId: number;
      modality: Modality;
      splitId: number | null;
      unitId: number | null;
      programWeekId: number | null;
    }
  | { type: "START_TIMER"; startTime: Date }
  | { type: "ADD_EXERCISE"; exercise: Exercise }
  | { type: "ADD_EXERCISES"; items: StartExercise[] }
  | { type: "REMOVE_EXERCISE"; exerciseId: number }
  | { type: "FINISH" }
  | { type: "DISCARD" };

const initialState: RecorderState = {
  sessionId: null,
  startTime: null,
  selectedExercises: [],
  targetsByExerciseId: {},
  isRecording: false,
  modality: "musculacao",
  splitId: null,
  unitId: null,
  programWeekId: null,
};

function reducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "START":
      return {
        sessionId: action.sessionId,
        startTime: null,
        selectedExercises: [],
        targetsByExerciseId: {},
        isRecording: true,
        modality: action.modality,
        splitId: action.splitId,
        unitId: action.unitId,
        programWeekId: action.programWeekId,
      };
    case "START_TIMER":
      return { ...state, startTime: action.startTime };
    case "ADD_EXERCISE":
      if (state.selectedExercises.some((e) => e.id === action.exercise.id)) {
        return state;
      }
      return {
        ...state,
        selectedExercises: [...state.selectedExercises, action.exercise],
      };
    case "ADD_EXERCISES": {
      const existingIds = new Set(state.selectedExercises.map((e) => e.id));
      const fresh = action.items.filter((item) => !existingIds.has(item.exercise.id));
      const targets = { ...state.targetsByExerciseId };
      for (const item of fresh) {
        if (item.targets) targets[item.exercise.id] = item.targets;
      }
      return {
        ...state,
        selectedExercises: [...state.selectedExercises, ...fresh.map((f) => f.exercise)],
        targetsByExerciseId: targets,
      };
    }
    case "REMOVE_EXERCISE":
      return {
        ...state,
        selectedExercises: state.selectedExercises.filter(
          (e) => e.id !== action.exerciseId
        ),
      };
    case "FINISH":
    case "DISCARD":
      return initialState;
    default:
      return state;
  }
}

interface RecorderContextValue {
  state: RecorderState;
  start: (
    sessionId: number,
    modality: Modality,
    splitId: number | null,
    unitId: number | null,
    programWeekId: number | null
  ) => void;
  startTimer: (startTime: Date) => void;
  addExercise: (exercise: Exercise) => void;
  addExercises: (items: StartExercise[]) => void;
  removeExercise: (exerciseId: number) => void;
  finish: () => void;
  discard: () => void;
}

const SessionRecorderContext = createContext<RecorderContextValue | null>(null);

export function SessionRecorderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const start = useCallback(
    (
      sessionId: number,
      modality: Modality,
      splitId: number | null,
      unitId: number | null,
      programWeekId: number | null
    ) => {
      dispatch({ type: "START", sessionId, modality, splitId, unitId, programWeekId });
    },
    []
  );

  const startTimer = useCallback((startTime: Date) => {
    dispatch({ type: "START_TIMER", startTime });
  }, []);

  const addExercise = useCallback((exercise: Exercise) => {
    dispatch({ type: "ADD_EXERCISE", exercise });
  }, []);

  const addExercises = useCallback((items: StartExercise[]) => {
    dispatch({ type: "ADD_EXERCISES", items });
  }, []);

  const removeExercise = useCallback((exerciseId: number) => {
    dispatch({ type: "REMOVE_EXERCISE", exerciseId });
  }, []);

  const finish = useCallback(() => {
    dispatch({ type: "FINISH" });
  }, []);

  const discard = useCallback(() => {
    dispatch({ type: "DISCARD" });
  }, []);

  return (
    <SessionRecorderContext.Provider
      value={{ state, start, startTimer, addExercise, addExercises, removeExercise, finish, discard }}
    >
      {children}
    </SessionRecorderContext.Provider>
  );
}

export function useRecorderContext(): RecorderContextValue {
  const ctx = useContext(SessionRecorderContext);
  if (!ctx) throw new Error("useRecorderContext must be used within SessionRecorderProvider");
  return ctx;
}
