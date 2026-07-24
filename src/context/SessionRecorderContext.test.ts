import { reducer, type RecorderState } from "./SessionRecorderContext";
import { DEFAULT_EXERCISE_CONFIG } from "@/data/exerciseConfig";
import type { Exercise } from "@/types";

function makeExercise(id: number, name: string): Exercise {
  return {
    id,
    name,
    muscle_groups: [{ muscle_group: "chest", counting_factor: 1 }],
    equipment: "barbell",
    type: "compound",
    is_custom: 0,
    modality: "musculacao",
    uuid: `uuid-${id}`,
    config: DEFAULT_EXERCISE_CONFIG,
  };
}

const baseState: RecorderState = {
  sessionId: 1,
  startTime: null,
  selectedExercises: [],
  targetsByExerciseId: {},
  isRecording: true,
  modality: "musculacao",
  splitId: null,
  unitId: null,
  programWeekId: null,
};

describe("SessionRecorderContext reducer — REORDER_EXERCISES", () => {
  it("reorders selectedExercises to match the given id order", () => {
    const a = makeExercise(1, "Supino");
    const b = makeExercise(2, "Agachamento");
    const c = makeExercise(3, "Remada");
    const state: RecorderState = { ...baseState, selectedExercises: [a, b, c] };

    const next = reducer(state, { type: "REORDER_EXERCISES", orderedExerciseIds: [3, 1, 2] });

    expect(next.selectedExercises.map((e) => e.id)).toEqual([3, 1, 2]);
    // Same objects, not copies — identity is preserved for downstream memoization.
    expect(next.selectedExercises[0]).toBe(c);
  });

  it("drops ids that no longer exist in selectedExercises instead of inserting undefined", () => {
    const a = makeExercise(1, "Supino");
    const b = makeExercise(2, "Agachamento");
    const state: RecorderState = { ...baseState, selectedExercises: [a, b] };

    const next = reducer(state, { type: "REORDER_EXERCISES", orderedExerciseIds: [2, 1, 999] });

    expect(next.selectedExercises.map((e) => e.id)).toEqual([2, 1]);
  });

  it("leaves other state fields untouched", () => {
    const a = makeExercise(1, "Supino");
    const state: RecorderState = { ...baseState, selectedExercises: [a], startTime: new Date("2026-01-01") };

    const next = reducer(state, { type: "REORDER_EXERCISES", orderedExerciseIds: [1] });

    expect(next.sessionId).toBe(state.sessionId);
    expect(next.startTime).toBe(state.startTime);
    expect(next.isRecording).toBe(state.isRecording);
  });
});
