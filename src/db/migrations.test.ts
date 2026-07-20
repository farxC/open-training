import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createInMemoryDb } from "./__tests__/testDb";
import { runMigrations } from "./migrations";
import { SCHEMA_VERSION } from "./schema";
import type { DbHandle } from "./dbHandle";

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
    expect(exerciseCount!.count).toBe(3); // the unconditional 'Correr' seed matches the existing row by name — no duplicate
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
    expect(groups).toEqual([
      { exercise_id: 1, muscle_group: "chest" },
      { exercise_id: 1, muscle_group: "shoulders" },
      { exercise_id: 1, muscle_group: "triceps" },
      { exercise_id: 2, muscle_group: "biceps" },
      { exercise_id: 3, muscle_group: "cardio" },
    ]);

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
      "SELECT exercise_id, muscle_group, counting_factor FROM exercise_muscle_groups ORDER BY exercise_id, muscle_group",
      []
    );
    expect(groups).toEqual([
      { exercise_id: 1, muscle_group: "chest", counting_factor: 1 },
      { exercise_id: 1, muscle_group: "shoulders", counting_factor: 1 },
      { exercise_id: 1, muscle_group: "triceps", counting_factor: 1 },
      { exercise_id: 2, muscle_group: "biceps", counting_factor: 1 },
      { exercise_id: 3, muscle_group: "cardio", counting_factor: 1 },
    ]);

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

    const count = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercise_muscle_groups",
      []
    );
    expect(count!.count).toBe(5);
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

describe("runMigrations against an already-current device", () => {
  it("is a no-op: no rows added or removed, existing uuids untouched", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v11-snapshot.sql"));

    runMigrations(dbHandle);

    const exercises = dbHandle.getAllSync<{ id: number; uuid: string }>(
      "SELECT id, uuid FROM exercises ORDER BY id",
      []
    );
    expect(exercises).toEqual([
      { id: 1, uuid: "fixed-uuid-ex-1" },
      { id: 2, uuid: "fixed-uuid-ex-2" },
      { id: 3, uuid: "fixed-uuid-ex-3" },
    ]);

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
    expect(exerciseCount!.count).toBe(3);
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
