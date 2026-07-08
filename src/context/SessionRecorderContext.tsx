import React, { createContext, useCallback, useContext, useReducer } from "react";
import type { Exercise } from "@/types";

interface RecorderState {
  sessionId: number | null;
  startTime: Date | null;
  selectedExercises: Exercise[];
  isRecording: boolean;
}

type RecorderAction =
  | { type: "START"; sessionId: number; startTime: Date }
  | { type: "ADD_EXERCISE"; exercise: Exercise }
  | { type: "REMOVE_EXERCISE"; exerciseId: number }
  | { type: "FINISH" }
  | { type: "DISCARD" };

const initialState: RecorderState = {
  sessionId: null,
  startTime: null,
  selectedExercises: [],
  isRecording: false,
};

function reducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "START":
      return {
        sessionId: action.sessionId,
        startTime: action.startTime,
        selectedExercises: [],
        isRecording: true,
      };
    case "ADD_EXERCISE":
      if (state.selectedExercises.some((e) => e.id === action.exercise.id)) {
        return state;
      }
      return {
        ...state,
        selectedExercises: [...state.selectedExercises, action.exercise],
      };
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
  start: (sessionId: number) => void;
  addExercise: (exercise: Exercise) => void;
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

  const start = useCallback((sessionId: number) => {
    dispatch({ type: "START", sessionId, startTime: new Date() });
  }, []);

  const addExercise = useCallback((exercise: Exercise) => {
    dispatch({ type: "ADD_EXERCISE", exercise });
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
      value={{ state, start, addExercise, removeExercise, finish, discard }}
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
