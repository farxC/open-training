import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createInMemoryDb } from "./__tests__/testDb";
import { runMigrations } from "./migrations";
import { SCHEMA_VERSION } from "./schema";
import { SEED_DISTANCE_EXERCISES } from "../data/exercises";
import { modalitiesOfCategory } from "../data/modalities";
import type { DbHandle } from "./dbHandle";

// Every distance modality's auto-provisioned exercise is (re)seeded on EVERY
// run, which is how a device that predates a modality still gets it. Derived
// from the registry so adding a modality doesn't silently break these tests.
const DISTANCE_SEED_NAMES = SEED_DISTANCE_EXERCISES.map((d) => d.exercise.name);
const NEW_DISTANCE_SEEDS = DISTANCE_SEED_NAMES.filter((n) => n !== "Correr");

/** Muscle-group breakdown is a strength-training concept: no exercise of an
 *  endurance modality may carry one, however it was seeded or imported. */
function expectNoEnduranceMuscleGroups(dbHandle: DbHandle): void {
  const keys = modalitiesOfCategory("endurance").map((m) => m.key);
  const row = dbHandle.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM exercise_muscle_groups
     WHERE exercise_id IN (SELECT id FROM exercises WHERE modality IN (${keys.map(() => "?").join(",")}))`,
    keys
  );
  expect(row!.count).toBe(0);
}

/** The seeds share the backfill with everything else, so assert the invariant
 *  rather than a fixture-specific id list: one config row per exercise. */
function expectOneConfigPerExercise(dbHandle: DbHandle): void {
  const row = dbHandle.getFirstSync<{ exercises: number; configs: number; orphans: number }>(
    `SELECT (SELECT COUNT(*) FROM exercises) AS exercises,
            (SELECT COUNT(*) FROM exercise_config) AS configs,
            (SELECT COUNT(*) FROM exercises WHERE id NOT IN (SELECT exercise_id FROM exercise_config)) AS orphans`,
    []
  );
  expect(row!.configs).toBe(row!.exercises);
  expect(row!.orphans).toBe(0);
}

const FIXTURES_DIR = path.join(__dirname, "__fixtures__");

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}

const ALL_FIXTURE_FILES = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".sql"));

describe("runMigrations upgrade from frozen snapshots", () => {
  it("upgrades a v8 device: preserves rows, adds new columns, drops nothing unexpectedly", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v8-snapshot.sql"));

    runMigrations(dbHandle);

    const exercises = dbHandle.getAllSync<{ id: number; name: string; uuid: string | null }>(
      "SELECT id, name, uuid FROM exercises ORDER BY id",
      []
    );
    expect(exercises.map((e) => e.name)).toEqual([
      "Supino reto",
      "Rosca direta customizada",
      "Correr",
      ...NEW_DISTANCE_SEEDS,
    ]);
    expect(exercises.every((e) => typeof e.uuid === "string" && e.uuid!.length > 0)).toBe(true);

    const session = dbHandle.getFirstSync<{
      id: number;
      uuid: string | null;
      start_time: string | null;
      end_time: string | null;
    }>("SELECT id, uuid, start_time, end_time FROM sessions WHERE id = 1", []);
    expect(session).not.toBeNull();
    expect(typeof session!.uuid).toBe("string");
    expect(session!.start_time).toBeNull();
    expect(session!.end_time).toBeNull();

    const sets = dbHandle.getAllSync<{ id: number; failure: number }>(
      "SELECT id, failure FROM sets WHERE session_id = 1 ORDER BY id",
      []
    );
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.failure === 0)).toBe(true);

    const split = dbHandle.getFirstSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM routine_splits WHERE id = 1",
      []
    );
    expect(typeof split!.uuid).toBe("string");

    const program = dbHandle.getFirstSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM training_programs WHERE id = 1",
      []
    );
    expect(typeof program!.uuid).toBe("string");

    const versionRow = dbHandle.getFirstSync<{ value: string }>(
      "SELECT value FROM user_meta WHERE key = 'schema_version'",
      []
    );
    expect(versionRow!.value).toBe(String(SCHEMA_VERSION));

    const exerciseCount = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercises",
      []
    );
    expect(exerciseCount!.count).toBe(3 + NEW_DISTANCE_SEEDS.length); // the unconditional 'Correr' seed matches the existing row by name — no duplicate
  });
});

describe("runMigrations backfills session_exercises", () => {
  it("preserves MIN(id)-per-exercise order, not exercise_id order", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-multi-exercise-session.sql"));

    runMigrations(dbHandle);

    const sessionExercises = dbHandle.getAllSync<{ exercise_id: number; order: number }>(
      'SELECT exercise_id, "order" FROM session_exercises WHERE session_id = 1 ORDER BY "order"',
      []
    );
    expect(sessionExercises).toEqual([
      { exercise_id: 2, order: 0 },
      { exercise_id: 1, order: 1 },
    ]);

    // Regression guard: the exercise grouping order used to render a session must
    // still match what it was before the migration (first set's rowid), now driven
    // by session_exercises."order" instead of the MIN(id) subquery.
    const sets = dbHandle.getAllSync<{ exercise_id: number }>(
      `SELECT st.exercise_id FROM sets st
       WHERE st.session_id = 1
       ORDER BY (
         SELECT se."order" FROM session_exercises se
         WHERE se.session_id = st.session_id AND se.exercise_id = st.exercise_id
       ), st.set_number`,
      []
    );
    expect(sets.map((s) => s.exercise_id)).toEqual([2, 2, 1, 1]);
  });

  it("running migrations twice does not duplicate session_exercises rows", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-multi-exercise-session.sql"));

    runMigrations(dbHandle);
    runMigrations(dbHandle);

    const count = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM session_exercises",
      []
    );
    expect(count!.count).toBe(2);
  });
});

describe("runMigrations rebuilds exercises for the muscle-groups join table (v12 -> v13)", () => {
  it("backfills exercise_muscle_groups, re-curates matching seeds, and drops the old column", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v12-pre-composite-muscle-groups.sql"));

    runMigrations(dbHandle);

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(exercises)", []);
    expect(columns.some((c) => c.name === "muscle_group")).toBe(false);

    const groups = dbHandle.getAllSync<{ exercise_id: number; muscle_group: string }>(
      "SELECT exercise_id, muscle_group FROM exercise_muscle_groups WHERE exercise_id IN (1, 2, 3) ORDER BY exercise_id, muscle_group",
      []
    );
    // Exercise 3 is "Correr": the v13 re-curation gives it no group, and the
    // endurance cleanup would strip one anyway.
    expect(groups).toEqual([
      { exercise_id: 1, muscle_group: "chest" },
      { exercise_id: 1, muscle_group: "shoulders" },
      { exercise_id: 1, muscle_group: "triceps" },
      { exercise_id: 2, muscle_group: "biceps" },
    ]);
    expectNoEnduranceMuscleGroups(dbHandle);

    // Custom exercise's id/uuid survived the table rebuild intact.
    const custom = dbHandle.getFirstSync<{ id: number; uuid: string; is_custom: number }>(
      "SELECT id, uuid, is_custom FROM exercises WHERE name = 'Rosca concentrada customizada'",
      []
    );
    expect(custom).toEqual({ id: 2, uuid: "fixed-uuid-ex-2", is_custom: 1 });

    // FKs still resolve to the right exercise after DROP + RENAME.
    const set = dbHandle.getFirstSync<{ exercise_id: number }>(
      "SELECT exercise_id FROM sets WHERE id = 2",
      []
    );
    expect(set!.exercise_id).toBe(2);

    const versionRow = dbHandle.getFirstSync<{ value: string }>(
      "SELECT value FROM user_meta WHERE key = 'schema_version'",
      []
    );
    expect(versionRow!.value).toBe(String(SCHEMA_VERSION));
  });

  it("is idempotent when run twice", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v12-pre-composite-muscle-groups.sql"));

    runMigrations(dbHandle);
    runMigrations(dbHandle);

    const groups = dbHandle.getAllSync<{ exercise_id: number; muscle_group: string }>(
      "SELECT exercise_id, muscle_group FROM exercise_muscle_groups WHERE exercise_id = 1 ORDER BY muscle_group",
      []
    );
    expect(groups).toEqual([
      { exercise_id: 1, muscle_group: "chest" },
      { exercise_id: 1, muscle_group: "shoulders" },
      { exercise_id: 1, muscle_group: "triceps" },
    ]);
  });

  // Regression: an unscoped `PRAGMA foreign_key_check` audits every table, not
  // just the ones holding an exercise_id FK. A dev DB that has accumulated
  // unrelated dangling references elsewhere (e.g. an orphaned session_photos row)
  // must not make this rebuild abort.
  it("succeeds even when an unrelated table already has a dangling foreign key", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v12-pre-composite-muscle-groups.sql"));
    dbHandle.execSync(
      `INSERT INTO session_photos (session_id, uri, "order") VALUES (999, 'orphan.jpg', 0)`
    );

    expect(() => runMigrations(dbHandle)).not.toThrow();

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(exercises)", []);
    expect(columns.some((c) => c.name === "muscle_group")).toBe(false);
  });
});

describe("runMigrations rebuilds exercise_muscle_groups for counting_factor (v13 -> v14)", () => {
  it("backfills counting_factor = 1 for every existing pair and enforces the CHECK", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v13-pre-counting-factor.sql"));

    runMigrations(dbHandle);

    const groups = dbHandle.getAllSync<{
      exercise_id: number;
      muscle_group: string;
      counting_factor: number;
    }>(
      `SELECT exercise_id, muscle_group, counting_factor FROM exercise_muscle_groups
       WHERE exercise_id <= 3 ORDER BY exercise_id, muscle_group`,
      []
    );
    expect(groups).toEqual([
      { exercise_id: 1, muscle_group: "chest", counting_factor: 1 },
      { exercise_id: 1, muscle_group: "shoulders", counting_factor: 1 },
      { exercise_id: 1, muscle_group: "triceps", counting_factor: 1 },
      { exercise_id: 2, muscle_group: "biceps", counting_factor: 1 },
    ]);

    // The distance seeds are added after the rebuild, and carry no muscle group
    // — exercise 3 ("Correr") had a legacy "cardio" row, now stripped.
    const seededGroups = dbHandle.getAllSync<{ name: string; muscle_group: string }>(
      `SELECT e.name, emg.muscle_group FROM exercises e
       JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
       WHERE e.name IN (${DISTANCE_SEED_NAMES.map(() => "?").join(", ")})
       ORDER BY e.id`,
      DISTANCE_SEED_NAMES
    );
    expect(seededGroups).toEqual([]);
    expectNoEnduranceMuscleGroups(dbHandle);

    expect(() =>
      dbHandle.runSync(
        "INSERT INTO exercise_muscle_groups (exercise_id, muscle_group, counting_factor) VALUES (?, ?, ?)",
        [1, "back", 0.75]
      )
    ).toThrow();

    // FKs still resolve to the right exercise after DROP + RENAME.
    const set = dbHandle.getFirstSync<{ exercise_id: number }>(
      "SELECT exercise_id FROM sets WHERE id = 2",
      []
    );
    expect(set!.exercise_id).toBe(2);

    const versionRow = dbHandle.getFirstSync<{ value: string }>(
      "SELECT value FROM user_meta WHERE key = 'schema_version'",
      []
    );
    expect(versionRow!.value).toBe(String(SCHEMA_VERSION));
  });

  it("is idempotent when run twice", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v13-pre-counting-factor.sql"));

    runMigrations(dbHandle);
    runMigrations(dbHandle);

    // 4 strength pairs from the fixture; the distance seeds contribute none.
    const count = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercise_muscle_groups",
      []
    );
    expect(count!.count).toBe(4);
    expectNoEnduranceMuscleGroups(dbHandle);
    expect(NEW_DISTANCE_SEEDS.length).toBeGreaterThan(0);
  });

  // Regression: a dev Fast Refresh cycle can pick up the bumped SCHEMA_VERSION
  // constant before this migration block existed yet, writing schema_version =
  // '14' into user_meta without ever creating the column. The rebuild must not
  // be gateable by a stale/poisoned version alone.
  it("still adds the column even if schema_version was already recorded as current", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v13-pre-counting-factor.sql"));
    dbHandle.runSync("UPDATE user_meta SET value = '14' WHERE key = 'schema_version'", []);

    runMigrations(dbHandle);

    const columns = dbHandle.getAllSync<{ name: string }>(
      "PRAGMA table_info(exercise_muscle_groups)",
      []
    );
    expect(columns.some((c) => c.name === "counting_factor")).toBe(true);

    const groups = dbHandle.getAllSync<{ counting_factor: number }>(
      "SELECT counting_factor FROM exercise_muscle_groups",
      []
    );
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.counting_factor === 1)).toBe(true);
  });

  // Regression: an unscoped `PRAGMA foreign_key_check` audits every table, not
  // just the one being rebuilt. A dev DB that has accumulated unrelated dangling
  // references elsewhere (nothing to do with exercise_muscle_groups) must not
  // make this migration abort.
  it("succeeds even when an unrelated table already has a dangling foreign key", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v13-pre-counting-factor.sql"));
    // Orphaned reference in an unrelated table — session_id 999 doesn't exist.
    dbHandle.execSync(
      `INSERT INTO session_photos (session_id, uri, "order") VALUES (999, 'orphan.jpg', 0)`
    );

    expect(() => runMigrations(dbHandle)).not.toThrow();

    const columns = dbHandle.getAllSync<{ name: string }>(
      "PRAGMA table_info(exercise_muscle_groups)",
      []
    );
    expect(columns.some((c) => c.name === "counting_factor")).toBe(true);
  });
});

describe("runMigrations backfills exercise_config (v14 -> v15)", () => {
  it("gives every exercise exactly one default-valued config row", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v14-pre-exercise-config.sql"));

    runMigrations(dbHandle);

    // Narrow SELECT (not *) so this test only asserts what the v15 migration
    // itself introduced — it must stay green regardless of later columns (e.g.
    // v16's bench angle) added to exercise_config afterward.
    const configs = dbHandle.getAllSync<{
      exercise_id: number;
      resistance_curve: string;
      load_type: string;
      pulley_type: string | null;
      laterality: string;
      rom: string;
    }>(
      `SELECT exercise_id, resistance_curve, load_type, pulley_type, laterality, rom FROM exercise_config
       WHERE exercise_id <= 3 ORDER BY exercise_id`,
      []
    );
    expect(configs).toEqual(
      [1, 2, 3].map((exercise_id) => ({
        exercise_id,
        resistance_curve: "descending",
        load_type: "free",
        pulley_type: null,
        laterality: "bilateral",
        rom: "full",
      }))
    );
    expectOneConfigPerExercise(dbHandle);

    const versionRow = dbHandle.getFirstSync<{ value: string }>(
      "SELECT value FROM user_meta WHERE key = 'schema_version'",
      []
    );
    expect(versionRow!.value).toBe(String(SCHEMA_VERSION));
  });

  it("is idempotent when run twice — no duplicate rows, no overwritten edits", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v14-pre-exercise-config.sql"));

    runMigrations(dbHandle);
    // Simulate the user having since customized exercise 1's config.
    dbHandle.runSync(
      "UPDATE exercise_config SET resistance_curve = 'bell', load_type = 'pulley', pulley_type = 'fixed' WHERE exercise_id = 1",
      []
    );

    runMigrations(dbHandle);

    const count = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercise_config",
      []
    );
    expect(count!.count).toBe(3 + NEW_DISTANCE_SEEDS.length);

    const custom = dbHandle.getFirstSync<{ resistance_curve: string; load_type: string; pulley_type: string | null }>(
      "SELECT resistance_curve, load_type, pulley_type FROM exercise_config WHERE exercise_id = 1",
      []
    );
    expect(custom).toEqual({ resistance_curve: "bell", load_type: "pulley", pulley_type: "fixed" });
  });

  it("enforces the CHECK constraints on resistance_curve, load_type, and pulley_type", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v14-pre-exercise-config.sql"));

    runMigrations(dbHandle);

    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET resistance_curve = 'zigzag' WHERE exercise_id = 1", [])
    ).toThrow();
    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET load_type = 'elastic' WHERE exercise_id = 1", [])
    ).toThrow();
    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET pulley_type = 'sideways' WHERE exercise_id = 1", [])
    ).toThrow();
  });

  it("backfills a config row for an exercise inserted after this migration existed", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v14-pre-exercise-config.sql"));

    runMigrations(dbHandle);
    dbHandle.runSync(
      "INSERT INTO exercises (name, equipment, type, is_custom, modality, uuid) VALUES ('Novo exercício', 'other', 'isolation', 1, 'musculacao', 'fixed-uuid-ex-4')",
      []
    );

    runMigrations(dbHandle);

    const config = dbHandle.getFirstSync<{ exercise_id: number }>(
      "SELECT exercise_id FROM exercise_config WHERE exercise_id = (SELECT id FROM exercises WHERE name = 'Novo exercício')",
      []
    );
    expect(config).not.toBeNull();
  });
});

describe("runMigrations rebuilds exercise_config/session_exercise_config for bench angle (v15 -> v16)", () => {
  it("adds the bench columns, defaulting to no bench, while preserving existing values", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    const configs = dbHandle.getAllSync<{
      exercise_id: number;
      resistance_curve: string;
      load_type: string;
      pulley_type: string | null;
      uses_bench: number;
      bench_angle_degrees: number | null;
    }>(
      `SELECT exercise_id, resistance_curve, load_type, pulley_type, uses_bench, bench_angle_degrees FROM exercise_config
       WHERE exercise_id <= 3 ORDER BY exercise_id`,
      []
    );
    expect(configs).toEqual([
      { exercise_id: 1, resistance_curve: "ascending", load_type: "pulley", pulley_type: "fixed", uses_bench: 0, bench_angle_degrees: null },
      { exercise_id: 2, resistance_curve: "descending", load_type: "free", pulley_type: null, uses_bench: 0, bench_angle_degrees: null },
      { exercise_id: 3, resistance_curve: "descending", load_type: "free", pulley_type: null, uses_bench: 0, bench_angle_degrees: null },
    ]);
    expectOneConfigPerExercise(dbHandle);

    // The pre-existing session-exercise override survives — as of v18 it's no
    // longer a sparse override but a snapshot, so the fields it used to inherit
    // are now materialised from the exercise's default (see the v18 block below).
    const snapshot = dbHandle.getFirstSync<{
      pulley_type: string | null;
      uses_bench: number | null;
      bench_angle_degrees: number | null;
    }>(
      "SELECT pulley_type, uses_bench, bench_angle_degrees FROM session_exercise_config WHERE session_exercise_id = 1",
      []
    );
    expect(snapshot).toEqual({ pulley_type: "mobile", uses_bench: 0, bench_angle_degrees: null });

    const versionRow = dbHandle.getFirstSync<{ value: string }>(
      "SELECT value FROM user_meta WHERE key = 'schema_version'",
      []
    );
    expect(versionRow!.value).toBe(String(SCHEMA_VERSION));
  });

  it("is idempotent when run twice — no duplicate rows, no overwritten edits", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);
    dbHandle.runSync(
      "UPDATE exercise_config SET uses_bench = 1, bench_angle_degrees = 30 WHERE exercise_id = 1",
      []
    );

    runMigrations(dbHandle);

    const count = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercise_config",
      []
    );
    expect(count!.count).toBe(3 + NEW_DISTANCE_SEEDS.length);

    const custom = dbHandle.getFirstSync<{ uses_bench: number; bench_angle_degrees: number }>(
      "SELECT uses_bench, bench_angle_degrees FROM exercise_config WHERE exercise_id = 1",
      []
    );
    expect(custom).toEqual({ uses_bench: 1, bench_angle_degrees: 30 });
  });

  it("enforces the CHECK constraints on uses_bench and bench_angle_degrees", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET uses_bench = 2 WHERE exercise_id = 1", [])
    ).toThrow();
    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET bench_angle_degrees = 120 WHERE exercise_id = 1", [])
    ).toThrow();
  });

  it("still adds the columns even if schema_version was already recorded as current", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));
    dbHandle.runSync("UPDATE user_meta SET value = '16' WHERE key = 'schema_version'", []);

    runMigrations(dbHandle);

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(exercise_config)", []);
    expect(columns.some((c) => c.name === "uses_bench")).toBe(true);
    expect(columns.some((c) => c.name === "bench_angle_degrees")).toBe(true);
  });

  it("succeeds even when an unrelated table already has a dangling foreign key", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));
    dbHandle.execSync(
      `INSERT INTO session_photos (session_id, uri, "order") VALUES (999, 'orphan.jpg', 0)`
    );

    expect(() => runMigrations(dbHandle)).not.toThrow();

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(session_exercise_config)", []);
    expect(columns.some((c) => c.name === "uses_bench")).toBe(true);
  });
});

describe("runMigrations turns session_exercise_config into a snapshot (v17 -> v18)", () => {
  it("materialises what the app rendered before the upgrade, for every session-exercise", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    const snapshots = dbHandle.getAllSync<{
      session_exercise_id: number;
      resistance_curve: string;
      load_type: string;
      pulley_type: string | null;
      laterality: string;
      rom: string;
    }>(
      `SELECT session_exercise_id, resistance_curve, load_type, pulley_type, laterality, rom
       FROM session_exercise_config ORDER BY session_exercise_id`,
      []
    );
    expect(snapshots).toEqual([
      // Had a pulley_type-only override; the rest resolved from exercise 1's default.
      { session_exercise_id: 1, resistance_curve: "ascending", load_type: "pulley", pulley_type: "mobile", laterality: "bilateral", rom: "full" },
      // Had no override row at all — backfilled wholesale from exercise 2's default.
      { session_exercise_id: 2, resistance_curve: "descending", load_type: "free", pulley_type: null, laterality: "bilateral", rom: "full" },
    ]);
  });

  it("gives every session-exercise exactly one config snapshot and its muscle groups", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    const counts = dbHandle.getFirstSync<{ sessionExercises: number; configs: number; missing: number }>(
      `SELECT (SELECT COUNT(*) FROM session_exercises) AS sessionExercises,
              (SELECT COUNT(*) FROM session_exercise_config) AS configs,
              (SELECT COUNT(*) FROM session_exercises
                WHERE id NOT IN (SELECT session_exercise_id FROM session_exercise_config)) AS missing`,
      []
    );
    expect(counts!.configs).toBe(counts!.sessionExercises);
    expect(counts!.missing).toBe(0);

    // Exercise 1 carries chest/triceps/shoulders; the snapshot copies all three.
    const groups = dbHandle.getAllSync<{ muscle_group: string; counting_factor: number }>(
      `SELECT muscle_group, counting_factor FROM session_exercise_muscle_groups
       WHERE session_exercise_id = 1 ORDER BY muscle_group`,
      []
    );
    expect(groups).toEqual([
      { muscle_group: "chest", counting_factor: 1 },
      { muscle_group: "shoulders", counting_factor: 1 },
      { muscle_group: "triceps", counting_factor: 1 },
    ]);
  });

  it("is idempotent — a second run neither duplicates nor rewrites edited snapshots", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);
    dbHandle.runSync(
      "UPDATE session_exercise_config SET rom = 'partial' WHERE session_exercise_id = 1",
      []
    );
    // A muscle group dropped from the exercise must not creep back into the
    // snapshot on the next launch's backfill.
    dbHandle.runSync(
      "DELETE FROM session_exercise_muscle_groups WHERE session_exercise_id = 1 AND muscle_group = 'shoulders'",
      []
    );

    runMigrations(dbHandle);

    const row = dbHandle.getFirstSync<{ rom: string }>(
      "SELECT rom FROM session_exercise_config WHERE session_exercise_id = 1",
      []
    );
    expect(row!.rom).toBe("partial");

    const groupCount = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM session_exercise_muscle_groups WHERE session_exercise_id = 1",
      []
    );
    expect(groupCount!.count).toBe(2);
  });

  it("adds the grip/bodyweight columns and enforces their CHECK constraints", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(exercise_config)", []);
    for (const name of ["grip_type", "grip_width", "uses_bodyweight", "load_mode"]) {
      expect(columns.some((c) => c.name === name)).toBe(true);
    }
    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET grip_type = 'sideways' WHERE exercise_id = 1", [])
    ).toThrow();
    expect(() =>
      dbHandle.runSync("UPDATE exercise_config SET load_mode = 'guessed' WHERE exercise_id = 1", [])
    ).toThrow();
  });

  it("adds is_archived to exercises, defaulting every existing row to visible", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    const archived = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM exercises WHERE is_archived != 0",
      []
    );
    expect(archived!.count).toBe(0);
    expect(() =>
      dbHandle.runSync("UPDATE exercises SET is_archived = 7 WHERE id = 1", [])
    ).toThrow();
  });

  it("recovers from a rebuild interrupted between DROP and RENAME", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));
    // Simulate the app being killed mid-rebuild: the fully-populated new table
    // exists, the old one is already dropped, the RENAME never ran.
    dbHandle.execSync("DROP TABLE session_exercise_config;");
    dbHandle.execSync(
      `CREATE TABLE session_exercise_config_new (
        session_exercise_id INTEGER PRIMARY KEY REFERENCES session_exercises(id) ON DELETE CASCADE,
        resistance_curve TEXT NOT NULL DEFAULT 'descending',
        load_type TEXT NOT NULL DEFAULT 'free',
        pulley_type TEXT,
        laterality TEXT NOT NULL DEFAULT 'bilateral',
        rom TEXT NOT NULL DEFAULT 'full',
        uses_bench INTEGER NOT NULL DEFAULT 0,
        bench_angle_degrees REAL,
        grip_type TEXT,
        grip_width TEXT,
        uses_bodyweight INTEGER NOT NULL DEFAULT 0,
        load_mode TEXT
      )`
    );
    dbHandle.execSync(
      "INSERT INTO session_exercise_config_new (session_exercise_id, resistance_curve) VALUES (1, 'constant')"
    );

    expect(() => runMigrations(dbHandle)).not.toThrow();

    const row = dbHandle.getFirstSync<{ resistance_curve: string }>(
      "SELECT resistance_curve FROM session_exercise_config WHERE session_exercise_id = 1",
      []
    );
    expect(row!.resistance_curve).toBe("constant");
  });
});

describe("runMigrations renames the seed exercise Tricep Dip to Dips (v16 -> v17)", () => {
  it("renames an existing built-in row still carrying the old name", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    // Bootstrap a fully current database, then roll just this one exercise back
    // to how an upgrading install would have it — named by the pre-rename seed,
    // on schema_version 16 — without needing a whole new frozen fixture.
    runMigrations(dbHandle);
    dbHandle.runSync("UPDATE exercises SET name = 'Tricep Dip' WHERE name = 'Dips'", []);
    dbHandle.runSync("UPDATE user_meta SET value = '16' WHERE key = 'schema_version'", []);

    runMigrations(dbHandle);

    const dips = dbHandle.getFirstSync<{ id: number; is_custom: number }>(
      "SELECT id, is_custom FROM exercises WHERE name = 'Dips'",
      []
    );
    expect(dips).not.toBeNull();
    expect(dips!.is_custom).toBe(0);
    const stillTricepDip = dbHandle.getFirstSync("SELECT id FROM exercises WHERE name = 'Tricep Dip'", []);
    expect(stillTricepDip).toBeNull();
  });

  it("does not rename (or crash) when the user already has their own custom 'Dips' exercise", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    runMigrations(dbHandle);
    dbHandle.runSync("UPDATE exercises SET name = 'Tricep Dip' WHERE name = 'Dips'", []);
    dbHandle.runSync(
      "INSERT INTO exercises (name, equipment, type, is_custom, modality) VALUES ('Dips', 'bodyweight', 'compound', 1, 'musculacao')",
      []
    );
    dbHandle.runSync("UPDATE user_meta SET value = '16' WHERE key = 'schema_version'", []);

    expect(() => runMigrations(dbHandle)).not.toThrow();

    const tricepDip = dbHandle.getFirstSync<{ is_custom: number }>(
      "SELECT is_custom FROM exercises WHERE name = 'Tricep Dip'",
      []
    );
    expect(tricepDip).not.toBeNull();
    expect(tricepDip!.is_custom).toBe(0);
  });

  it("is a no-op on a fresh install, which seeds 'Dips' directly", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    runMigrations(dbHandle);

    const dips = dbHandle.getAllSync("SELECT id FROM exercises WHERE name = 'Dips'", []);
    expect(dips).toHaveLength(1);
  });
});

describe("runMigrations adds exercise variation columns (v18 -> v19)", () => {
  it("adds parent_exercise_id/is_default_variation, defaulting existing rows to root", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(exercises)", []);
    for (const name of ["parent_exercise_id", "is_default_variation"]) {
      expect(columns.some((c) => c.name === name)).toBe(true);
    }
    const row = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM exercises WHERE parent_exercise_id IS NOT NULL OR is_default_variation != 0",
      []
    );
    expect(row!.count).toBe(0);
  });

  it("enforces the CHECK constraint on is_default_variation", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    expect(() =>
      dbHandle.runSync("UPDATE exercises SET is_default_variation = 7 WHERE id = 1", [])
    ).toThrow();
  });

  it("enforces at most one default variation per parent via the partial unique index", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);

    dbHandle.runSync(
      "INSERT INTO exercises (name, equipment, type, parent_exercise_id, is_default_variation) VALUES (?, 'barbell', 'compound', 1, 1)",
      ["Variation A"]
    );
    expect(() =>
      dbHandle.runSync(
        "INSERT INTO exercises (name, equipment, type, parent_exercise_id, is_default_variation) VALUES (?, 'barbell', 'compound', 1, 1)",
        ["Variation B"]
      )
    ).toThrow();
  });

  it("is idempotent — running migrations twice does not duplicate the index or error", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));

    runMigrations(dbHandle);
    expect(() => runMigrations(dbHandle)).not.toThrow();

    const indexes = dbHandle.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_one_default_variation_per_parent'",
      []
    );
    expect(indexes).toHaveLength(1);
  });

  it("still adds the columns and index even if schema_version was already recorded as current", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));
    dbHandle.runSync(
      "INSERT OR REPLACE INTO user_meta (key, value) VALUES ('schema_version', ?)",
      [String(SCHEMA_VERSION)]
    );

    runMigrations(dbHandle);

    const columns = dbHandle.getAllSync<{ name: string }>("PRAGMA table_info(exercises)", []);
    expect(columns.some((c) => c.name === "parent_exercise_id")).toBe(true);
    const indexes = dbHandle.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_one_default_variation_per_parent'",
      []
    );
    expect(indexes).toHaveLength(1);
  });

  it("succeeds even when an unrelated table already has a dangling foreign key", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v15-pre-bench-angle.sql"));
    dbHandle.execSync("PRAGMA foreign_keys = OFF;");
    dbHandle.runSync(
      "INSERT INTO session_exercises (session_id, exercise_id, \"order\") VALUES (999999, 1, 0)",
      []
    );
    dbHandle.execSync("PRAGMA foreign_keys = ON;");

    expect(() => runMigrations(dbHandle)).not.toThrow();
  });
});

describe("runMigrations against an already-current device", () => {
  it("leaves existing rows untouched, adding only the missing modality seeds", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-snapshot.sql"));

    runMigrations(dbHandle);

    const exercises = dbHandle.getAllSync<{ id: number; uuid: string }>(
      "SELECT id, uuid FROM exercises ORDER BY id",
      []
    );
    expect(exercises.slice(0, 3)).toEqual([
      { id: 1, uuid: "fixed-uuid-ex-1" },
      { id: 2, uuid: "fixed-uuid-ex-2" },
      { id: 3, uuid: "fixed-uuid-ex-3" },
    ]);
    // The only additions are the distance modalities this device predates.
    const seeded = dbHandle.getAllSync<{ name: string }>(
      "SELECT name FROM exercises WHERE id > 3 ORDER BY id",
      []
    );
    expect(seeded.map((e) => e.name)).toEqual(NEW_DISTANCE_SEEDS);

    const sessionCount = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sessions",
      []
    );
    expect(sessionCount!.count).toBe(1);

    const setCount = dbHandle.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM sets", []);
    expect(setCount!.count).toBe(3);
  });

  it("running migrations twice in a row is idempotent", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-snapshot.sql"));

    runMigrations(dbHandle);
    const afterFirstRun = dbHandle.getAllSync<{ id: number; uuid: string }>(
      "SELECT id, uuid FROM exercises ORDER BY id",
      []
    );

    runMigrations(dbHandle);
    const afterSecondRun = dbHandle.getAllSync<{ id: number; uuid: string }>(
      "SELECT id, uuid FROM exercises ORDER BY id",
      []
    );

    expect(afterSecondRun).toEqual(afterFirstRun);

    const exerciseCount = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercises",
      []
    );
    expect(exerciseCount!.count).toBe(3 + NEW_DISTANCE_SEEDS.length);
  });
});

describe("runMigrations strips muscle groups from endurance exercises", () => {
  it("clears them for every endurance modality while leaving strength exercises alone", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-snapshot.sql"));

    // First pass brings the device to the current shape, seeding one exercise
    // per distance modality.
    runMigrations(dbHandle);

    // Re-create the state every real install is in: each endurance exercise
    // tagged "cardio", the way they used to be seeded. A musculação exercise
    // gets the same tag — there it's legitimate (Treadmill Run, Rowing Machine…)
    // and must survive.
    const enduranceIds = dbHandle.getAllSync<{ id: number }>(
      `SELECT id FROM exercises WHERE name IN (${DISTANCE_SEED_NAMES.map(() => "?").join(",")})`,
      DISTANCE_SEED_NAMES
    );
    expect(enduranceIds.length).toBe(DISTANCE_SEED_NAMES.length);
    for (const { id } of enduranceIds) {
      dbHandle.runSync(
        "INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group) VALUES (?, 'cardio')",
        [id]
      );
    }
    dbHandle.runSync(
      "INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group) VALUES (1, 'cardio')",
      []
    );

    runMigrations(dbHandle);

    expectNoEnduranceMuscleGroups(dbHandle);
    const strengthCardio = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM exercise_muscle_groups WHERE exercise_id = 1 AND muscle_group = 'cardio'",
      []
    );
    expect(strengthCardio!.count).toBe(1);
  });

  it("keeps the endurance exercises themselves, and their config rows", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-snapshot.sql"));

    runMigrations(dbHandle);

    const seeds = dbHandle.getAllSync<{ name: string }>(
      `SELECT name FROM exercises WHERE name IN (${DISTANCE_SEED_NAMES.map(() => "?").join(",")}) ORDER BY id`,
      DISTANCE_SEED_NAMES
    );
    expect(seeds.map((e) => e.name)).toEqual(DISTANCE_SEED_NAMES);
    expectOneConfigPerExercise(dbHandle);
  });
});

// Baseline safety net: every frozen fixture, whatever it was written to test
// specifically, must never regress on the two invariants runMigrations makes to
// ANY device — reaching the current schema version, and never losing exercises,
// sessions, or sets. New fixtures get this coverage automatically, with no test
// code to write.
describe("runMigrations baseline sweep (every frozen fixture)", () => {
  function countCoreRows(dbHandle: DbHandle): number {
    const row = dbHandle.getFirstSync<{ total: number }>(
      `SELECT (SELECT COUNT(*) FROM exercises)
            + (SELECT COUNT(*) FROM sessions)
            + (SELECT COUNT(*) FROM sets) AS total`,
      []
    );
    return row!.total;
  }

  it.each(ALL_FIXTURE_FILES)(
    "%s: reaches the current schema version without losing exercises, sessions, or sets",
    async (fixtureFile) => {
      const dbHandle: DbHandle = await createInMemoryDb();
      dbHandle.execSync(loadFixture(fixtureFile));

      const before = countCoreRows(dbHandle);
      runMigrations(dbHandle);
      const after = countCoreRows(dbHandle);

      expect(after).toBeGreaterThanOrEqual(before);

      const versionRow = dbHandle.getFirstSync<{ value: string }>(
        "SELECT value FROM user_meta WHERE key = 'schema_version'",
        []
      );
      expect(versionRow!.value).toBe(String(SCHEMA_VERSION));
    }
  );
});

// A frozen fixture is only useful as a regression guard if it truly never changes
// after being committed — editing one to match today's schema would make its test
// a tautology. This is enforced, not just documented in a comment.
describe("frozen fixture integrity", () => {
  const CHECKSUMS: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, "CHECKSUMS.json"), "utf8")
  );

  it("every fixture file has a checksum recorded in CHECKSUMS.json", () => {
    expect(ALL_FIXTURE_FILES.slice().sort()).toEqual(Object.keys(CHECKSUMS).sort());
  });

  it.each(ALL_FIXTURE_FILES)("%s matches its recorded checksum", (fixtureFile) => {
    const hash = crypto.createHash("sha256").update(loadFixture(fixtureFile)).digest("hex");
    expect(hash).toBe(CHECKSUMS[fixtureFile]);
  });
});
