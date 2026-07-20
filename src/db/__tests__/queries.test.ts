import { createInMemoryDb } from "./testDb";
import { CREATE_TABLES } from "../schema";
import type { DbHandle } from "../dbHandle";

let mockDb: DbHandle;

jest.mock("../client", () => ({
  get db() {
    return mockDb;
  },
}));

import {
  createExercise,
  createSplit,
  createUnit,
  getUnitExercises,
  addUnitExercise,
  removeUnitExercise,
  reorderUnitExercises,
  createSession,
  addSet,
  getSetsBySession,
  getSessionWithSets,
  getSessionExercises,
  addSessionExercise,
  removeSessionExercise,
  reorderSessionExercises,
  updateExerciseMuscleGroups,
  getMuscleSeriesInRange,
} from "../queries";

function baseUnitExercise(unitId: number, exerciseId: number, order: number) {
  return {
    unit_id: unitId,
    exercise_id: exerciseId,
    order,
    target_sets: 3,
    target_reps: 8,
    target_reps_max: null,
    target_weight_kg: null,
    target_distance_km: null,
    target_duration_min: null,
    run_type: null,
    target_pace_sec: null,
    interval_reps: null,
    interval_work_sec: null,
    interval_work_km: null,
    interval_rest_sec: null,
  };
}

beforeEach(async () => {
  mockDb = await createInMemoryDb();
  for (const sql of CREATE_TABLES) mockDb.execSync(sql);
});

describe("routine_unit_exercises reorder/remove", () => {
  function setupUnitWithThreeExercises() {
    const splitId = createSplit({ name: "Push Pull Legs", mode: "cyclic", modality: "musculacao" });
    const unitId = createUnit({ split_id: splitId, ordinal: 0, label: "Push" });
    const a = createExercise({
      name: "Supino", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    const b = createExercise({
      name: "Desenvolvimento", muscle_groups: ["shoulders"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    const c = createExercise({
      name: "Tríceps", muscle_groups: ["triceps"], equipment: "cable", type: "isolation", modality: "musculacao", is_custom: 0,
    });
    const idA = addUnitExercise(baseUnitExercise(unitId, a.id, 0));
    const idB = addUnitExercise(baseUnitExercise(unitId, b.id, 1));
    const idC = addUnitExercise(baseUnitExercise(unitId, c.id, 2));
    return { unitId, idA, idB, idC };
  }

  it("reorderUnitExercises writes the new order", () => {
    const { unitId, idA, idB, idC } = setupUnitWithThreeExercises();

    reorderUnitExercises(unitId, [idC, idA, idB]);

    const ordered = getUnitExercises(unitId);
    expect(ordered.map((re) => re.id)).toEqual([idC, idA, idB]);
    expect(ordered.map((re) => re.order)).toEqual([0, 1, 2]);
  });

  it("removeUnitExercise repacks remaining order values, closing the gap", () => {
    const { unitId, idA, idB, idC } = setupUnitWithThreeExercises();

    removeUnitExercise(idA);

    const remaining = getUnitExercises(unitId);
    expect(remaining.map((re) => re.id)).toEqual([idB, idC]);
    // Order values must be sequential 0..n-1 with no gap left behind.
    expect(remaining.map((re) => re.order)).toEqual([0, 1]);
  });
});

describe("session_exercises", () => {
  function setupExercises() {
    const ex1 = createExercise({
      name: "Supino", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    const ex2 = createExercise({
      name: "Agachamento", muscle_groups: ["legs"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    const ex3 = createExercise({
      name: "Remada", muscle_groups: ["back"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    return { ex1, ex2, ex3 };
  }

  it("addSessionExercise appends by default and getSessionExercises returns them in order", () => {
    const { ex1, ex2 } = setupExercises();
    const sessionId = createSession("2026-01-01");

    addSessionExercise(sessionId, ex1.id);
    addSessionExercise(sessionId, ex2.id);

    const rows = getSessionExercises(sessionId);
    expect(rows.map((r) => r.exercise_id)).toEqual([ex1.id, ex2.id]);
    expect(rows.map((r) => r.order)).toEqual([0, 1]);
    expect(rows[0].exercise_name).toBe("Supino");
  });

  it("addSessionExercise is a no-op when the pair already exists (UNIQUE constraint)", () => {
    const { ex1 } = setupExercises();
    const sessionId = createSession("2026-01-01");

    addSessionExercise(sessionId, ex1.id);
    addSessionExercise(sessionId, ex1.id);

    expect(getSessionExercises(sessionId)).toHaveLength(1);
  });

  it("reorderSessionExercises writes the new order", () => {
    const { ex1, ex2, ex3 } = setupExercises();
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex1.id);
    addSessionExercise(sessionId, ex2.id);
    addSessionExercise(sessionId, ex3.id);

    reorderSessionExercises(sessionId, [ex3.id, ex1.id, ex2.id]);

    const rows = getSessionExercises(sessionId);
    expect(rows.map((r) => r.exercise_id)).toEqual([ex3.id, ex1.id, ex2.id]);
  });

  it("removeSessionExercise cascades to delete that exercise's sets and repacks order", () => {
    const { ex1, ex2, ex3 } = setupExercises();
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex1.id);
    addSessionExercise(sessionId, ex2.id);
    addSessionExercise(sessionId, ex3.id);
    addSet({
      session_id: sessionId, exercise_id: ex2.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });

    removeSessionExercise(sessionId, ex2.id);

    const rows = getSessionExercises(sessionId);
    expect(rows.map((r) => r.exercise_id)).toEqual([ex1.id, ex3.id]);
    expect(rows.map((r) => r.order)).toEqual([0, 1]);
    expect(getSetsBySession(sessionId).filter((s) => s.exercise_id === ex2.id)).toHaveLength(0);
  });

  it("getSessionWithSets groups sets by session_exercises order, not insertion order", () => {
    const { ex1, ex2 } = setupExercises();
    const sessionId = createSession("2026-01-01");
    // Exercise 2 is logged first (lower set id) but placed AFTER exercise 1 in session_exercises.
    addSet({
      session_id: sessionId, exercise_id: ex2.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    addSet({
      session_id: sessionId, exercise_id: ex1.id, set_number: 1, reps: 8, weight_kg: 40,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    addSessionExercise(sessionId, ex1.id, 0);
    addSessionExercise(sessionId, ex2.id, 1);

    const session = getSessionWithSets(sessionId);
    expect(session!.sets.map((s) => s.exercise_id)).toEqual([ex1.id, ex2.id]);
  });
});

describe("getMuscleSeriesInRange", () => {
  it("sums counting_factor per muscle group, fanning out sets that hit multiple muscles", () => {
    // Bench press: chest full set, triceps/shoulders half set each.
    const bench = createExercise({
      name: "Supino reto", muscle_groups: ["chest", "triceps", "shoulders"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(bench.id, [
      { muscle_group: "chest", counting_factor: 1 },
      { muscle_group: "triceps", counting_factor: 0.5 },
      { muscle_group: "shoulders", counting_factor: 0.5 },
    ]);
    // Isolation curl, also hitting triceps at a different factor to prove the sum
    // is per (exercise, muscle) — not a single global factor per muscle name.
    const pushdown = createExercise({
      name: "Tríceps pulley", muscle_groups: ["triceps"],
      equipment: "cable", type: "isolation", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(pushdown.id, [{ muscle_group: "triceps", counting_factor: 1 }]);

    const sessionId = createSession("2026-01-01");
    addSet({
      session_id: sessionId, exercise_id: bench.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    addSet({
      session_id: sessionId, exercise_id: bench.id, set_number: 2, reps: 8, weight_kg: 65,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    addSet({
      session_id: sessionId, exercise_id: pushdown.id, set_number: 1, reps: 12, weight_kg: 20,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });

    const result = getMuscleSeriesInRange("musculacao", "2026-01-01", "2026-01-01");

    expect(result).toEqual(
      expect.arrayContaining([
        { muscle_group: "chest", total_series: 2 }, // 2 bench sets × 1.0
        { muscle_group: "shoulders", total_series: 1 }, // 2 bench sets × 0.5
        { muscle_group: "triceps", total_series: 2 }, // 2 bench sets × 0.5 + 1 pushdown set × 1.0
      ])
    );
  });

  it("excludes sets outside the date range and outside the requested modality", () => {
    const ex = createExercise({
      name: "Supino reto", muscle_groups: ["chest"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    const inRange = createSession("2026-01-15");
    const outOfRange = createSession("2026-02-01");
    addSet({
      session_id: inRange, exercise_id: ex.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    addSet({
      session_id: outOfRange, exercise_id: ex.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });

    const result = getMuscleSeriesInRange("musculacao", "2026-01-01", "2026-01-31");

    expect(result).toEqual([{ muscle_group: "chest", total_series: 1 }]);
  });
});
