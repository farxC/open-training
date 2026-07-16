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
