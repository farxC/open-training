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
  getMuscleSeriesForSession,
  getMuscleSeriesInRange,
  getSetsInRange,
  getExercises,
  getDistanceRecords,
  getExerciseDailyMaxes,
  getStrengthRecords,
  getExerciseConfig,
  updateExerciseConfig,
  updateSessionExerciseConfig,
  resetSessionExerciseConfig,
  updateExercise,
  archiveExercise,
  unarchiveExercise,
  ExerciseNameTakenError,
} from "../queries";
import { DEFAULT_EXERCISE_CONFIG } from "../../data/exerciseConfig";
import type { ExerciseConfig, Modality } from "../../types";

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

describe("exercise_config", () => {
  it("createExercise seeds a default-valued config row", () => {
    const ex = createExercise({
      name: "Supino", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    expect(getExerciseConfig(ex.id)).toEqual(DEFAULT_EXERCISE_CONFIG);
    expect(getExercises().find((e) => e.id === ex.id)!.config).toEqual(DEFAULT_EXERCISE_CONFIG);
  });

  it("updateExerciseConfig fully replaces the config", () => {
    const ex = createExercise({
      name: "Supino", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    const config: ExerciseConfig = {
      resistance_curve: "bell",
      load_type: "pulley",
      pulley_type: "fixed",
      laterality: "unilateral",
      rom: "partial",
      uses_bench: 1,
      bench_angle_degrees: 30,
      grip_type: "supinated",
      grip_width: "close",
      uses_bodyweight: 1,
      load_mode: "assisted",
    };
    updateExerciseConfig(ex.id, config);

    expect(getExerciseConfig(ex.id)).toEqual(config);
  });

  it("updateExerciseConfig forces pulley_type to null when load_type isn't pulley", () => {
    const ex = createExercise({
      name: "Supino", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    updateExerciseConfig(ex.id, {
      ...DEFAULT_EXERCISE_CONFIG,
      load_type: "free",
      pulley_type: "mobile", // inconsistent input — should be dropped
    });

    expect(getExerciseConfig(ex.id).pulley_type).toBeNull();
  });

  it("updateExerciseConfig forces bench_angle_degrees to null when uses_bench is 0", () => {
    const ex = createExercise({
      name: "Supino", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    updateExerciseConfig(ex.id, {
      ...DEFAULT_EXERCISE_CONFIG,
      uses_bench: 0,
      bench_angle_degrees: 30, // inconsistent input — should be dropped
    });

    expect(getExerciseConfig(ex.id).bench_angle_degrees).toBeNull();
  });

  it("updateExerciseConfig keeps a positive/negative bench angle when uses_bench is 1", () => {
    const ex = createExercise({
      name: "Supino inclinado", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    updateExerciseConfig(ex.id, {
      ...DEFAULT_EXERCISE_CONFIG,
      resistance_curve: "ascending",
      uses_bench: 1,
      bench_angle_degrees: -15,
    });

    expect(getExerciseConfig(ex.id).bench_angle_degrees).toBe(-15);
  });

  it("updateExerciseConfig forces load_mode to null when uses_bodyweight is 0", () => {
    const ex = createExercise({
      name: "Remada", muscle_groups: ["back"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    updateExerciseConfig(ex.id, {
      ...DEFAULT_EXERCISE_CONFIG,
      uses_bodyweight: 0,
      load_mode: "assisted", // inconsistent input — should be dropped
    });

    expect(getExerciseConfig(ex.id).load_mode).toBeNull();
  });

  it("keeps a null grip as 'not applicable' rather than coercing it to a value", () => {
    const ex = createExercise({
      name: "Leg press", muscle_groups: ["legs"], equipment: "machine", type: "compound", modality: "musculacao", is_custom: 0,
    });

    updateExerciseConfig(ex.id, { ...DEFAULT_EXERCISE_CONFIG, grip_type: null, grip_width: null });

    const config = getExerciseConfig(ex.id);
    expect(config.grip_type).toBeNull();
    expect(config.grip_width).toBeNull();
  });
});

describe("exercise identity edits", () => {
  function setup() {
    return createExercise({
      name: "Supino reto", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
  }

  it("a rename propagates to sessions already recorded", () => {
    const ex = setup();
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex.id);

    updateExercise(ex.id, {
      name: "Supino reto com barra", equipment: "barbell", type: "compound", modality: "musculacao",
    });

    expect(getSessionExercises(sessionId)[0].exercise_name).toBe("Supino reto com barra");
  });

  it("rejects a rename that collides with another exercise", () => {
    const ex = setup();
    createExercise({
      name: "Supino inclinado", muscle_groups: ["chest"], equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });

    expect(() =>
      updateExercise(ex.id, {
        name: "Supino inclinado", equipment: "barbell", type: "compound", modality: "musculacao",
      })
    ).toThrow(ExerciseNameTakenError);
    expect(getExercises().find((e) => e.id === ex.id)!.name).toBe("Supino reto");
  });

  it("allows saving an exercise under its own unchanged name", () => {
    const ex = setup();
    expect(() =>
      updateExercise(ex.id, {
        name: "Supino reto", equipment: "dumbbell", type: "compound", modality: "musculacao",
      })
    ).not.toThrow();
    expect(getExercises().find((e) => e.id === ex.id)!.equipment).toBe("dumbbell");
  });

  it("archiving hides the exercise from listings but keeps its history readable", () => {
    const ex = setup();
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex.id);

    archiveExercise(ex.id);

    expect(getExercises().find((e) => e.id === ex.id)).toBeUndefined();
    expect(getExercises({ include_archived: true }).find((e) => e.id === ex.id)!.is_archived).toBe(1);
    expect(getSessionExercises(sessionId)[0].exercise_name).toBe("Supino reto");

    unarchiveExercise(ex.id);
    expect(getExercises().find((e) => e.id === ex.id)).toBeDefined();
  });
});

describe("session_exercise_config snapshots", () => {
  const SETUP_CONFIG: ExerciseConfig = {
    ...DEFAULT_EXERCISE_CONFIG,
    resistance_curve: "ascending",
    load_type: "pulley",
    pulley_type: "mobile",
    grip_type: "pronated",
  };

  function setupExercise() {
    const ex = createExercise({
      name: "Cadeira extensora", muscle_groups: ["legs"], equipment: "machine", type: "isolation", modality: "musculacao", is_custom: 0,
    });
    updateExerciseConfig(ex.id, SETUP_CONFIG);
    return ex;
  }

  it("adding an exercise to a session copies the exercise's current config", () => {
    const ex = setupExercise();
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex.id);

    expect(getSessionExercises(sessionId)[0].config).toEqual(SETUP_CONFIG);
  });

  it("editing the default leaves recorded sessions alone and applies to the next one", () => {
    const ex = setupExercise();
    const past = createSession("2026-01-01");
    addSessionExercise(past, ex.id);

    updateExerciseConfig(ex.id, { ...SETUP_CONFIG, resistance_curve: "bell", grip_type: "neutral" });

    const future = createSession("2026-02-01");
    addSessionExercise(future, ex.id);

    expect(getSessionExercises(past)[0].config.resistance_curve).toBe("ascending");
    expect(getSessionExercises(past)[0].config.grip_type).toBe("pronated");
    expect(getSessionExercises(future)[0].config.resistance_curve).toBe("bell");
    expect(getSessionExercises(future)[0].config.grip_type).toBe("neutral");
  });

  it("applyToHistory rewrites the snapshots of sessions already recorded", () => {
    const ex = setupExercise();
    const past = createSession("2026-01-01");
    addSessionExercise(past, ex.id);

    updateExerciseConfig(
      ex.id,
      { ...SETUP_CONFIG, resistance_curve: "bell" },
      { applyToHistory: true }
    );

    expect(getSessionExercises(past)[0].config.resistance_curve).toBe("bell");
  });

  it("only rewrites the edited exercise's snapshots", () => {
    const ex = setupExercise();
    const other = createExercise({
      name: "Mesa flexora", muscle_groups: ["femoral"], equipment: "machine", type: "isolation", modality: "musculacao", is_custom: 0,
    });
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex.id);
    addSessionExercise(sessionId, other.id);

    updateExerciseConfig(ex.id, { ...SETUP_CONFIG, rom: "partial" }, { applyToHistory: true });

    const rows = getSessionExercises(sessionId);
    expect(rows.find((r) => r.exercise_id === ex.id)!.config.rom).toBe("partial");
    expect(rows.find((r) => r.exercise_id === other.id)!.config.rom).toBe("full");
  });

  it("updateSessionExerciseConfig edits one session without touching the exercise default", () => {
    const ex = setupExercise();
    const sessionId = createSession("2026-01-01");
    const sessionExerciseId = addSessionExercise(sessionId, ex.id);

    updateSessionExerciseConfig(sessionExerciseId, { ...SETUP_CONFIG, pulley_type: "fixed" });

    expect(getSessionExercises(sessionId)[0].config.pulley_type).toBe("fixed");
    expect(getExerciseConfig(ex.id).pulley_type).toBe("mobile");
  });

  it("normalises a session snapshot the same way the default is normalised", () => {
    const ex = setupExercise();
    const sessionId = createSession("2026-01-01");
    const sessionExerciseId = addSessionExercise(sessionId, ex.id);

    updateSessionExerciseConfig(sessionExerciseId, {
      ...SETUP_CONFIG,
      uses_bench: 0,
      bench_angle_degrees: 45, // inconsistent input — should be dropped
    });

    expect(getSessionExercises(sessionId)[0].config.bench_angle_degrees).toBeNull();
  });

  it("resetSessionExerciseConfig re-copies the exercise's current default", () => {
    const ex = setupExercise();
    const sessionId = createSession("2026-01-01");
    const sessionExerciseId = addSessionExercise(sessionId, ex.id);
    updateSessionExerciseConfig(sessionExerciseId, { ...SETUP_CONFIG, rom: "partial" });

    updateExerciseConfig(ex.id, { ...SETUP_CONFIG, resistance_curve: "constant" });
    resetSessionExerciseConfig(sessionExerciseId, ex.id);

    const config = getSessionExercises(sessionId)[0].config;
    expect(config.rom).toBe("full");
    expect(config.resistance_curve).toBe("constant");
  });

  it("re-adding an exercise already in the session preserves its edited snapshot", () => {
    const ex = setupExercise();
    const sessionId = createSession("2026-01-01");
    const sessionExerciseId = addSessionExercise(sessionId, ex.id);
    updateSessionExerciseConfig(sessionExerciseId, { ...SETUP_CONFIG, rom: "partial" });

    const again = addSessionExercise(sessionId, ex.id);

    expect(again).toBe(sessionExerciseId);
    expect(getSessionExercises(sessionId)[0].config.rom).toBe("partial");
    expect(getSessionExercises(sessionId)).toHaveLength(1);
  });

  it("snapshots the muscle groups and their counting factors", () => {
    const ex = setupExercise();
    updateExerciseMuscleGroups(ex.id, [
      { muscle_group: "legs", counting_factor: 1 },
      { muscle_group: "glutes", counting_factor: 0.5 },
    ]);
    const sessionId = createSession("2026-01-01");
    addSessionExercise(sessionId, ex.id);

    expect(getSessionExercises(sessionId)[0].muscle_groups).toEqual(
      expect.arrayContaining([
        { muscle_group: "legs", counting_factor: 1 },
        { muscle_group: "glutes", counting_factor: 0.5 },
      ])
    );
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

  it("reads the snapshot: re-weighting an exercise doesn't move series already logged", () => {
    const bench = createExercise({
      name: "Supino reto", muscle_groups: ["chest", "triceps"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(bench.id, [
      { muscle_group: "chest", counting_factor: 1 },
      { muscle_group: "triceps", counting_factor: 0.5 },
    ]);
    const sessionId = createSession("2026-01-01");
    addSet({
      session_id: sessionId, exercise_id: bench.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });

    // Triceps re-weighted up, and a whole new muscle group added, after the fact.
    updateExerciseMuscleGroups(bench.id, [
      { muscle_group: "chest", counting_factor: 1 },
      { muscle_group: "triceps", counting_factor: 1 },
      { muscle_group: "shoulders", counting_factor: 0.5 },
    ]);

    expect(getMuscleSeriesInRange("musculacao", "2026-01-01", "2026-01-31")).toEqual(
      expect.arrayContaining([
        { muscle_group: "chest", total_series: 1 },
        { muscle_group: "triceps", total_series: 0.5 }, // still the logged weighting
      ])
    );
    expect(
      getMuscleSeriesForSession(sessionId).some((r) => r.muscle_group === "shoulders")
    ).toBe(false);

    // …until the user explicitly says the weighting was wrong all along.
    updateExerciseMuscleGroups(
      bench.id,
      [
        { muscle_group: "chest", counting_factor: 1 },
        { muscle_group: "triceps", counting_factor: 1 },
      ],
      { applyToHistory: true }
    );

    expect(getMuscleSeriesForSession(sessionId)).toEqual(
      expect.arrayContaining([
        { muscle_group: "chest", total_series: 1 },
        { muscle_group: "triceps", total_series: 1 },
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

describe("records are scoped to a single modality", () => {
  // No muscle groups: endurance exercises carry none, matching what the seeds
  // and the picker now create.
  function logDistance(modality: Modality, date: string, distanceKm: number, paceSec: number): number {
    const ex = createExercise({
      name: `Atividade ${modality}-${date}`, muscle_groups: [],
      equipment: "bodyweight", type: "compound", modality, is_custom: 0,
    });
    const sessionId = createSession(date, { modality });
    addSet({
      session_id: sessionId, exercise_id: ex.id, set_number: 1, reps: 0, weight_kg: 0,
      rpe: null, rir: null, notes: null,
      distance_km: distanceKm, duration_sec: distanceKm * paceSec, pace_sec: paceSec, failure: 0,
    });
    return sessionId;
  }

  it("reports no muscle series for an endurance session", () => {
    const swim = logDistance("natacao", "2026-01-14", 1.5, 1200);
    expect(getMuscleSeriesForSession(swim)).toEqual([]);
  });

  it("never mixes one distance modality's records into another's", () => {
    logDistance("corrida", "2026-01-10", 10, 300); // 10 km @ 5:00/km
    logDistance("ciclismo", "2026-01-11", 40, 120); // 40 km @ 30 km/h

    const run = getDistanceRecords("corrida");
    expect(run.longest_distance_km).toBe(10);
    expect(run.fastest_pace_sec).toBe(300);
    expect(run.longest_distance_on).toBe("2026-01-10");

    const bike = getDistanceRecords("ciclismo");
    expect(bike.longest_distance_km).toBe(40);
    expect(bike.fastest_pace_sec).toBe(120);

    // Natação has nothing logged — it must read empty, not fall back to another modality.
    const swim = getDistanceRecords("natacao");
    expect(swim.longest_distance_km).toBeNull();
    expect(swim.fastest_pace_sec).toBeNull();
    expect(swim.longest_duration_sec).toBeNull();
  });

  it("keeps strength records out of distance sessions", () => {
    const bench = createExercise({
      name: "Supino", muscle_groups: ["chest"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    const strengthSession = createSession("2026-01-12", { modality: "musculacao" });
    addSet({
      session_id: strengthSession, exercise_id: bench.id, set_number: 1, reps: 5, weight_kg: 100,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    logDistance("caminhada", "2026-01-13", 6, 600);

    const records = getStrengthRecords("musculacao");
    expect(records).toHaveLength(1);
    expect(records[0].max_weight_kg).toBe(100);
    expect(getStrengthRecords("caminhada")).toEqual([]);
  });
});

describe("getStrengthRecords muscle groups", () => {
  function logRecord(exerciseId: number, weightKg: number) {
    const sessionId = createSession("2026-03-01", { modality: "musculacao" });
    addSet({
      session_id: sessionId, exercise_id: exerciseId, set_number: 1, reps: 5,
      weight_kg: weightKg, rpe: null, rir: null, notes: null,
      distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
  }

  it("files a record only under the groups the exercise emphasises most", () => {
    const bench = createExercise({
      name: "Supino reto", muscle_groups: ["chest", "triceps"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(bench.id, [
      { muscle_group: "chest", counting_factor: 1 },
      { muscle_group: "triceps", counting_factor: 0.5 },
    ]);
    logRecord(bench.id, 100);

    expect(getStrengthRecords("musculacao")[0].muscle_groups).toEqual(["chest"]);
  });

  it("keeps every group when the exercise emphasises them equally", () => {
    const clean = createExercise({
      name: "Clean and press", muscle_groups: ["shoulders", "legs"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(clean.id, [
      { muscle_group: "shoulders", counting_factor: 1 },
      { muscle_group: "legs", counting_factor: 1 },
    ]);
    logRecord(clean.id, 70);

    expect(getStrengthRecords("musculacao")[0].muscle_groups.sort()).toEqual(["legs", "shoulders"]);
  });

  it("does not orphan an exercise configured entirely at half a set", () => {
    const carry = createExercise({
      name: "Farmer's walk", muscle_groups: ["core", "back"],
      equipment: "dumbbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(carry.id, [
      { muscle_group: "core", counting_factor: 0.5 },
      { muscle_group: "back", counting_factor: 0.5 },
    ]);
    logRecord(carry.id, 40);

    expect(getStrengthRecords("musculacao")[0].muscle_groups.sort()).toEqual(["back", "core"]);
  });
});

describe("getExerciseDailyMaxes", () => {
  function benchPress() {
    return createExercise({
      name: "Supino reto", muscle_groups: ["chest"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
  }

  function logSet(exerciseId: number, date: string, weightKg: number, setNumber = 1) {
    const sessionId = createSession(date, { modality: "musculacao" });
    addSet({
      session_id: sessionId, exercise_id: exerciseId, set_number: setNumber, reps: 5,
      weight_kg: weightKg, rpe: null, rir: null, notes: null,
      distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });
    return sessionId;
  }

  it("returns the heaviest set of each day, oldest first", () => {
    const bench = benchPress();
    const heavyDay = createSession("2026-02-10", { modality: "musculacao" });
    for (const [i, weight] of [80, 95, 90].entries()) {
      addSet({
        session_id: heavyDay, exercise_id: bench.id, set_number: i + 1, reps: 5,
        weight_kg: weight, rpe: null, rir: null, notes: null,
        distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
      });
    }
    logSet(bench.id, "2026-01-05", 85);

    expect(getExerciseDailyMaxes("musculacao")).toEqual([
      { exercise_id: bench.id, date: "2026-01-05", max_weight_kg: 85 },
      { exercise_id: bench.id, date: "2026-02-10", max_weight_kg: 95 },
    ]);
  });

  it("skips bodyweight sets and other modalities", () => {
    const bench = benchPress();
    logSet(bench.id, "2026-01-05", 85);
    logSet(bench.id, "2026-01-06", 0); // bodyweight — no load to compare

    const rows = getExerciseDailyMaxes("musculacao");
    expect(rows.map((r) => r.date)).toEqual(["2026-01-05"]);
    expect(getExerciseDailyMaxes("corrida")).toEqual([]);
  });
});

describe("getSetsInRange", () => {
  function benchWithFactors() {
    const bench = createExercise({
      name: "Supino reto", muscle_groups: ["chest", "triceps"],
      equipment: "barbell", type: "compound", modality: "musculacao", is_custom: 0,
    });
    updateExerciseMuscleGroups(bench.id, [
      { muscle_group: "chest", counting_factor: 1 },
      { muscle_group: "triceps", counting_factor: 0.5 },
    ]);
    return bench;
  }

  it("returns the session's snapshot muscle groups for each set", () => {
    const bench = benchWithFactors();
    const sessionId = createSession("2026-01-01");
    addSet({
      session_id: sessionId, exercise_id: bench.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });

    const rows = getSetsInRange("musculacao", "2026-01-01", "2026-01-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].muscle_groups.sort()).toEqual(["chest", "triceps"]);
  });

  it("does not fan out the set row itself — one row per set, whatever the muscle count", () => {
    const bench = benchWithFactors();
    const sessionId = createSession("2026-01-01");
    for (const setNumber of [1, 2, 3]) {
      addSet({
        session_id: sessionId, exercise_id: bench.id, set_number: setNumber, reps: 10, weight_kg: 60,
        rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
      });
    }
    expect(getSetsInRange("musculacao", "2026-01-01", "2026-01-01")).toHaveLength(3);
  });

  it("reports the exercise's order within the session, for replaying a day", () => {
    const bench = benchWithFactors();
    const sessionId = createSession("2026-01-01");
    addSet({
      session_id: sessionId, exercise_id: bench.id, set_number: 1, reps: 10, weight_kg: 60,
      rpe: null, rir: null, notes: null, distance_km: null, duration_sec: null, pace_sec: null, failure: 0,
    });

    const row = getSetsInRange("musculacao", "2026-01-01", "2026-01-01")[0];
    expect(row.exercise_order).toBe(0);
  });
});
