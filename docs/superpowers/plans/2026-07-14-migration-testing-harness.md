# Migration Testing Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `runMigrations()` testable against frozen historical schema snapshots, and gate the Android release build on those tests passing, so a destructive or buggy future migration never reaches an installed phone.

**Architecture:** `runMigrations()` gains an optional `DbHandle` parameter (default: the existing production singleton), so tests can inject an in-memory `sql.js`-backed handle instead of the native `expo-sqlite` binding that only works on-device. Two frozen `.sql` fixtures (schema v8, pre-uuid; schema v11, current) are run through the *current* `runMigrations()` in Jest, asserting old data survives and new columns/uuids are populated correctly. A new CI job runs this suite and blocks the release-APK build job on success.

**Tech Stack:** TypeScript, Jest (`jest-expo` preset), `sql.js` (already a project dependency, used by `client.web.ts`), GitHub Actions.

## Global Constraints

- `runMigrations()`'s existing call site in `app/_layout.tsx` (`runMigrations()`, zero arguments) must keep working unchanged — the DI parameter must default to the current production `db` singleton.
- `"order"` is a SQL reserved word — always double-quote it in any new DDL or query (already followed in existing fixtures below).
- TypeScript strict mode is on (`tsconfig.json`: `"strict": true`) — all new code must type-check under `npx tsc --noEmit` with no new errors.
- Jest test files are matched by `jest.config.js`'s `testMatch: ["**/*.test.ts", "**/*.test.tsx"]` — only files ending in `.test.ts` run as suites; helper/fixture files must NOT use that suffix.
- Frozen fixture files (`src/db/__fixtures__/*.sql`), once committed, are never edited again — new schema states get a new file.
- No new runtime dependencies — `sql.js` is already installed and used by `src/db/client.web.ts`.

---

### Task 1: `DbHandle` type and dependency injection in `runMigrations`

**Files:**
- Create: `src/db/dbHandle.ts`
- Modify: `src/db/migrations.ts` (entire file)
- Test: verified via `npx tsc --noEmit` (no dedicated `.test.ts` — this is a behavior-preserving refactor with no new runtime behavior to assert; Task 2 builds the first real runtime test on top of this seam)

**Interfaces:**
- Produces: `DbHandle` interface and `BindParam` type from `src/db/dbHandle.ts`, consumed by `migrations.ts`, and later by `src/db/__tests__/testDb.ts` (Task 2) and `src/db/migrations.test.ts` (Tasks 3–4).
- Produces: `runMigrations(dbHandle: DbHandle = db): void`, exported from `src/db/migrations.ts` — same export name and default-argument behavior as today, so `app/_layout.tsx`'s existing `runMigrations()` call is unaffected.

This exact `DbHandle` shape was verified to type-check with the real `expo-sqlite` `SQLiteDatabase` (i.e. `db` from `client.ts`) assigned into a `DbHandle`-typed parameter — do not change the method signatures below (in particular, `params` must NOT be optional; making it optional breaks assignability against the real driver's overloaded `runSync`/`getAllSync`/`getFirstSync` signatures).

- [ ] **Step 1: Create `src/db/dbHandle.ts`**

```ts
export type BindParam = string | number | null;

export interface DbHandle {
  execSync(source: string): void;
  runSync(source: string, params: BindParam[]): { lastInsertRowId: number; changes: number };
  getAllSync<T>(source: string, params: BindParam[]): T[];
  getFirstSync<T>(source: string, params: BindParam[]): T | null;
  prepareSync(source: string): {
    executeSync(params: BindParam[]): void;
    finalizeSync(): void;
  };
}
```

- [ ] **Step 2: Replace `src/db/migrations.ts` with the DI-parameterized version**

Every `db.` call becomes `dbHandle.`; `hasColumn`/`ensureColumn` take `dbHandle` as their first argument; five call sites that previously omitted the params array now pass `[]` explicitly (required by `DbHandle`, unlike the real driver's optional/variadic overloads). No other logic changes.

```ts
import { db } from "./client";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema";
import { SEED_EXERCISES, SEED_RUNNING_EXERCISES } from "../data/exercises";
import { todayISO } from "../utils/cycle";
import type { DbHandle } from "./dbHandle";

function hasColumn(dbHandle: DbHandle, table: string, column: string): boolean {
  const rows = dbHandle.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`, []);
  return rows.some((r) => r.name === column);
}

/** Idempotent ADD COLUMN — safe on both web and native, unlike a swallowed ALTER. */
function ensureColumn(dbHandle: DbHandle, table: string, column: string, decl: string): void {
  if (!hasColumn(dbHandle, table, column)) {
    dbHandle.runSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`, []);
  }
}

export function runMigrations(dbHandle: DbHandle = db): void {
  dbHandle.execSync("PRAGMA foreign_keys = ON;");
  dbHandle.execSync("PRAGMA journal_mode = WAL;");

  for (const sql of CREATE_TABLES) {
    dbHandle.execSync(sql);
  }

  // Self-healing column checks — run EVERY launch, idempotent. Version gating alone
  // can't recover a DB whose schema_version was bumped before a column was actually
  // added (e.g. a dev hot-reload running migrations mid-edit). PRAGMA + ALTER fixes it.
  ensureColumn(dbHandle, "sets", "rir", "INTEGER");
  ensureColumn(dbHandle, "exercises", "modality", "TEXT NOT NULL DEFAULT 'musculacao'");
  ensureColumn(dbHandle, "routine_splits", "modality", "TEXT NOT NULL DEFAULT 'musculacao'");
  ensureColumn(dbHandle, "routine_unit_exercises", "target_distance_km", "REAL");
  ensureColumn(dbHandle, "routine_unit_exercises", "target_duration_min", "REAL");
  ensureColumn(dbHandle, "routine_unit_exercises", "run_type", "TEXT");
  ensureColumn(dbHandle, "routine_unit_exercises", "target_pace_sec", "INTEGER");
  ensureColumn(dbHandle, "routine_unit_exercises", "interval_reps", "INTEGER");
  ensureColumn(dbHandle, "routine_unit_exercises", "interval_work_sec", "INTEGER");
  ensureColumn(dbHandle, "routine_unit_exercises", "interval_work_km", "REAL");
  ensureColumn(dbHandle, "routine_unit_exercises", "interval_rest_sec", "INTEGER");
  ensureColumn(dbHandle, "routine_unit_exercises", "target_reps_max", "INTEGER");
  ensureColumn(dbHandle, "training_programs", "setup_week_number", "INTEGER");
  ensureColumn(dbHandle, "training_programs", "started_at", "TEXT");
  ensureColumn(dbHandle, "sessions", "name", "TEXT");
  ensureColumn(dbHandle, "sessions", "modality", "TEXT NOT NULL DEFAULT 'musculacao'");
  ensureColumn(dbHandle, "sessions", "split_id", "INTEGER REFERENCES routine_splits(id) ON DELETE SET NULL");
  ensureColumn(dbHandle, "sessions", "unit_id", "INTEGER REFERENCES routine_units(id) ON DELETE SET NULL");
  ensureColumn(dbHandle, "sessions", "program_week_id", "INTEGER REFERENCES program_weeks(id) ON DELETE SET NULL");
  ensureColumn(dbHandle, "sessions", "start_time", "TEXT");
  ensureColumn(dbHandle, "sessions", "end_time", "TEXT");
  ensureColumn(dbHandle, "sets", "distance_km", "REAL");
  ensureColumn(dbHandle, "sets", "duration_sec", "INTEGER");
  ensureColumn(dbHandle, "sets", "pace_sec", "INTEGER");
  ensureColumn(dbHandle, "sets", "failure", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(dbHandle, "exercises", "uuid", "TEXT");
  ensureColumn(dbHandle, "sessions", "uuid", "TEXT");
  ensureColumn(dbHandle, "routine_splits", "uuid", "TEXT");
  ensureColumn(dbHandle, "training_programs", "uuid", "TEXT");

  // Backfill: programs already active before this column existed have no anchor for
  // "which week are we in" — start counting from today rather than showing nothing.
  dbHandle.runSync(
    "UPDATE training_programs SET started_at = ? WHERE is_active = 1 AND started_at IS NULL",
    [todayISO()]
  );

  // Backfill: photo_uri predates session_photos (multi-photo support). Copy any legacy
  // single photo into the new table once; NOT EXISTS keeps this idempotent across launches.
  dbHandle.runSync(
    `INSERT INTO session_photos (session_id, uri, "order")
     SELECT id, photo_uri, 0 FROM sessions
     WHERE photo_uri IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM session_photos WHERE session_id = sessions.id)`,
    []
  );

  // Backfill: rows created before schema v9 (export/import) have no uuid — the merge
  // key import uses to tell "already have this" from "new". Generated in pure SQL via
  // randomblob so it works identically on both the native and sql.js (web) drivers,
  // and one row at a time so each gets a distinct value.
  dbHandle.execSync("UPDATE exercises SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
  dbHandle.execSync("UPDATE sessions SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
  dbHandle.execSync("UPDATE routine_splits SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
  dbHandle.execSync("UPDATE training_programs SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");

  const row = dbHandle.getFirstSync<{ value: string }>(
    "SELECT value FROM user_meta WHERE key = 'schema_version'",
    []
  );
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  if (currentVersion < 1) {
    const stmt = dbHandle.prepareSync(
      "INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, type, is_custom, modality) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const ex of SEED_EXERCISES) {
      stmt.executeSync([ex.name, ex.muscle_group, ex.equipment, ex.type, ex.is_custom, "musculacao"]);
    }
    for (const ex of SEED_RUNNING_EXERCISES) {
      stmt.executeSync([ex.name, ex.muscle_group, ex.equipment, ex.type, ex.is_custom, "corrida"]);
    }
    stmt.finalizeSync();
  }

  if (currentVersion < 3) {
    // Replaced the weekday routine model with the cycle model. Old data is discarded.
    dbHandle.execSync("DROP TABLE IF EXISTS routine_exercises;");
    dbHandle.execSync("DROP TABLE IF EXISTS routine_days;");
  }

  if (currentVersion < 4) {
    // Generalized the single cycle into multi-split. The v3 tables were unused; drop them.
    dbHandle.execSync("DROP TABLE IF EXISTS routine_slot_exercises;");
    dbHandle.execSync("DROP TABLE IF EXISTS routine_slots;");
    dbHandle.execSync("DELETE FROM user_meta WHERE key = 'routine_cycle_anchor';");
  }

  // Ensure the running seed exists for DBs created before the modality migration.
  dbHandle.runSync(
    "INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, type, is_custom, modality) VALUES ('Correr', 'cardio', 'bodyweight', 'compound', 0, 'corrida')",
    []
  );

  if (currentVersion < SCHEMA_VERSION) {
    dbHandle.runSync(
      "INSERT OR REPLACE INTO user_meta (key, value) VALUES ('schema_version', ?)",
      [String(SCHEMA_VERSION)]
    );
  }
}
```

- [ ] **Step 3: Verify no type regressions**

Run: `npx tsc --noEmit`
Expected: no errors (same as before this change — this refactor is behavior-preserving; `db` from `client.ts` satisfies `DbHandle` structurally).

- [ ] **Step 4: Commit**

```bash
git add src/db/dbHandle.ts src/db/migrations.ts
git commit -m "refactor(db): inject DbHandle into runMigrations for testability"
```

---

### Task 2: In-memory `sql.js` test adapter

**Files:**
- Create: `src/db/__tests__/testDb.ts`
- Test: `src/db/__tests__/testDb.test.ts`

**Interfaces:**
- Consumes: `DbHandle`, `BindParam` from `src/db/dbHandle.ts` (Task 1).
- Produces: `createInMemoryDb(): Promise<DbHandle>`, consumed by `src/db/migrations.test.ts` in Tasks 3–4.

This decode-and-adapt logic was verified end-to-end against the project's actual `src/db/sql-wasm.ts` asset (multi-statement `execSync`, parameterized `runSync`, `getAllSync`, `getFirstSync`, and `prepareSync`/`executeSync`/`finalizeSync` round-trips all confirmed working).

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/testDb.test.ts`:

```ts
import { createInMemoryDb } from "./testDb";

describe("createInMemoryDb", () => {
  it("supports execSync, runSync, getAllSync, getFirstSync, and prepareSync", async () => {
    const db = await createInMemoryDb();

    db.execSync(
      "CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)"
    );
    db.runSync("INSERT INTO exercises (name) VALUES (?)", ["Supino reto"]);

    expect(db.getAllSync<{ id: number; name: string }>("SELECT * FROM exercises", [])).toEqual([
      { id: 1, name: "Supino reto" },
    ]);
    expect(
      db.getFirstSync<{ id: number; name: string }>("SELECT * FROM exercises WHERE id = ?", [1])
    ).toEqual({ id: 1, name: "Supino reto" });

    const stmt = db.prepareSync("INSERT INTO exercises (name) VALUES (?)");
    stmt.executeSync(["Agachamento"]);
    stmt.finalizeSync();

    expect(db.getAllSync<{ id: number; name: string }>("SELECT * FROM exercises", [])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/testDb.test.ts`
Expected: FAIL — `Cannot find module './testDb'`

- [ ] **Step 3: Create `src/db/__tests__/testDb.ts`**

```ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require("sql.js");
import wasmBase64 from "../sql-wasm";
import type { DbHandle, BindParam } from "../dbHandle";

function decodeWasm(): Uint8Array {
  return new Uint8Array(Buffer.from(wasmBase64, "base64"));
}

export async function createInMemoryDb(): Promise<DbHandle> {
  const initFn: typeof import("sql.js").default =
    typeof initSqlJs === "function" ? initSqlJs : initSqlJs.default;
  const SQL = await initFn({ wasmBinary: decodeWasm().buffer as ArrayBuffer });
  const raw = new SQL.Database();

  function getAllSync<T>(sql: string, params: BindParam[]): T[] {
    const stmt = raw.prepare(sql);
    stmt.bind(params as (string | number | null)[]);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  return {
    execSync(sql: string) {
      raw.run(sql);
    },
    runSync(sql: string, params: BindParam[]) {
      raw.run(sql, params as (string | number | null)[]);
      const idResult = raw.exec("SELECT last_insert_rowid()");
      const lastInsertRowId = (idResult[0]?.values[0]?.[0] as number) ?? 0;
      return { lastInsertRowId, changes: 0 };
    },
    getAllSync,
    getFirstSync<T>(sql: string, params: BindParam[]): T | null {
      return getAllSync<T>(sql, params)[0] ?? null;
    },
    prepareSync(sql: string) {
      const stmt = raw.prepare(sql);
      return {
        executeSync(params: BindParam[]) {
          stmt.run(params as (string | number | null)[]);
        },
        finalizeSync() {
          stmt.free();
        },
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/__tests__/testDb.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/db/__tests__/testDb.ts src/db/__tests__/testDb.test.ts
git commit -m "test(db): add in-memory sql.js adapter for migration testing"
```

---

### Task 3: v8 (pre-uuid) frozen fixture + upgrade test

**Files:**
- Create: `src/db/__fixtures__/v8-snapshot.sql`
- Create: `src/db/migrations.test.ts`

**Interfaces:**
- Consumes: `createInMemoryDb` (Task 2), `runMigrations` (Task 1), `SCHEMA_VERSION` from `src/db/schema.ts`.

The fixture reproduces the actual schema at `SCHEMA_VERSION = 8` (verified via `git show 82a8b9b^:src/db/schema.ts`, the commit immediately before uuid columns were added), populated with representative rows across every table. This exact fixture + assertions were dry-run against the real migration logic and confirmed: exercises/sessions/sets/split/program rows survive, `uuid` is backfilled on all four top-level entities, `sessions.start_time`/`end_time` are `NULL` (new nullable columns, no backfill value), `sets.failure` defaults to `0`, `schema_version` reaches `11`, and no duplicate `'Correr'` row is created.

- [ ] **Step 1: Create the frozen fixture `src/db/__fixtures__/v8-snapshot.sql`**

```sql
-- Frozen snapshot: schema_version 8 (before uuid columns / start_time / end_time / failure were added).
-- Never edit this file after creation — see docs/superpowers/specs/2026-07-14-migration-testing-design.md.

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  muscle_group TEXT NOT NULL,
  equipment TEXT NOT NULL,
  type TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  modality TEXT NOT NULL DEFAULT 'musculacao'
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT,
  notes TEXT,
  duration_seconds INTEGER,
  photo_uri TEXT,
  modality TEXT NOT NULL DEFAULT 'musculacao',
  split_id INTEGER REFERENCES routine_splits(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES routine_units(id) ON DELETE SET NULL,
  program_week_id INTEGER REFERENCES program_weeks(id) ON DELETE SET NULL
);

CREATE TABLE session_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  rpe REAL,
  rir INTEGER,
  notes TEXT,
  distance_km REAL,
  duration_sec INTEGER,
  pace_sec INTEGER
);

CREATE TABLE routine_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'musculacao',
  anchor_date TEXT,
  rest_weekdays TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE routine_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  split_id INTEGER NOT NULL REFERENCES routine_splits(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE routine_unit_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES routine_units(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER NOT NULL DEFAULT 8,
  target_reps_max INTEGER,
  target_weight_kg REAL,
  target_distance_km REAL,
  target_duration_min REAL,
  run_type TEXT,
  target_pace_sec INTEGER,
  interval_reps INTEGER,
  interval_work_sec INTEGER,
  interval_work_km REAL,
  interval_rest_sec INTEGER
);

CREATE TABLE routine_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL
);

CREATE TABLE user_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE training_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  split_id INTEGER NOT NULL REFERENCES routine_splits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_weeks INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  setup_week_number INTEGER,
  started_at TEXT
);

CREATE TABLE program_weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  label TEXT,
  UNIQUE(program_id, week_number)
);

CREATE TABLE program_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES routine_units(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  target_sets INTEGER,
  target_reps INTEGER,
  target_reps_max INTEGER,
  target_weight_kg REAL,
  target_distance_km REAL,
  target_duration_min REAL,
  run_type TEXT,
  target_pace_sec INTEGER,
  interval_reps INTEGER,
  interval_work_sec INTEGER,
  interval_work_km REAL,
  interval_rest_sec INTEGER,
  UNIQUE(week_id, unit_id, exercise_id)
);

INSERT INTO exercises (id, name, muscle_group, equipment, type, is_custom, modality) VALUES
  (1, 'Supino reto', 'chest', 'barbell', 'compound', 0, 'musculacao'),
  (2, 'Rosca direta customizada', 'arms', 'dumbbell', 'isolation', 1, 'musculacao'),
  (3, 'Correr', 'cardio', 'bodyweight', 'compound', 0, 'corrida');

INSERT INTO sessions (id, date, name, notes, duration_seconds, photo_uri, modality, split_id, unit_id, program_week_id) VALUES
  (1, '2026-01-05', NULL, NULL, 3600, NULL, 'musculacao', NULL, NULL, NULL);

INSERT INTO sets (id, session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec) VALUES
  (1, 1, 1, 1, 10, 60, 8, 2, NULL, NULL, NULL, NULL),
  (2, 1, 1, 2, 8, 65, 8.5, 1, NULL, NULL, NULL, NULL),
  (3, 1, 1, 3, 6, 70, 9, 1, NULL, NULL, NULL, NULL);

INSERT INTO routine_splits (id, name, mode, modality, anchor_date, rest_weekdays, "order") VALUES
  (1, 'Push Pull Legs', 'cycle', 'musculacao', '2026-01-01', '', 0);

INSERT INTO routine_units (id, split_id, ordinal, label) VALUES
  (1, 1, 1, 'Push');

INSERT INTO routine_unit_exercises (id, unit_id, exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg) VALUES
  (1, 1, 1, 0, 3, 8, 12, 60);

INSERT INTO training_programs (id, split_id, name, total_weeks, is_active, "order", setup_week_number, started_at) VALUES
  (1, 1, 'Bloco 1', 4, 1, 0, NULL, '2026-01-01');

INSERT INTO program_weeks (id, program_id, week_number, label) VALUES
  (1, 1, 1, 'Semana 1');

INSERT INTO program_entries (id, week_id, unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg) VALUES
  (1, 1, 1, 1, 3, 8, 12, 60);

INSERT INTO user_meta (key, value) VALUES ('schema_version', '8');
```

- [ ] **Step 2: Write the failing test — create `src/db/migrations.test.ts`**

```ts
import * as fs from "fs";
import * as path from "path";
import { createInMemoryDb } from "./__tests__/testDb";
import { runMigrations } from "./migrations";
import { SCHEMA_VERSION } from "./schema";
import type { DbHandle } from "./dbHandle";

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");
}

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/db/migrations.test.ts`
Expected: FAIL — `runMigrations` import resolves, but the fixture file doesn't exist yet if Step 1 was skipped; if Step 1 was done first, this instead confirms the assertions pass immediately. To genuinely see red first, comment out Step 1's `INSERT INTO user_meta` line temporarily, run, confirm a failure (`versionRow` is `null`), then restore it — this confirms the test actually exercises the fixture rather than trivially passing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/migrations.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/db/__fixtures__/v8-snapshot.sql src/db/migrations.test.ts
git commit -m "test(db): add frozen v8 schema fixture and migration upgrade test"
```

---

### Task 4: v11 (current) frozen fixture + no-op and idempotency tests

**Files:**
- Create: `src/db/__fixtures__/v11-snapshot.sql`
- Modify: `src/db/migrations.test.ts` (append a second `describe` block)

**Interfaces:**
- Consumes: same as Task 3.

This fixture represents a device already fully caught up (`schema_version = '11'`, all columns and uuids already populated). It was dry-run and confirmed: running `runMigrations()` against it changes nothing (counts stable, uuids unchanged — not regenerated), and running it a second time in a row produces byte-identical results (the idempotency guarantee).

- [ ] **Step 1: Create the frozen fixture `src/db/__fixtures__/v11-snapshot.sql`**

```sql
-- Frozen snapshot: schema_version 11 (current, at time of writing). Used as the
-- "already up to date" baseline for no-op and idempotency assertions.
-- Never edit this file after creation — see docs/superpowers/specs/2026-07-14-migration-testing-design.md.

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  muscle_group TEXT NOT NULL,
  equipment TEXT NOT NULL,
  type TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  modality TEXT NOT NULL DEFAULT 'musculacao',
  uuid TEXT UNIQUE
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT,
  notes TEXT,
  duration_seconds INTEGER,
  start_time TEXT,
  end_time TEXT,
  photo_uri TEXT,
  modality TEXT NOT NULL DEFAULT 'musculacao',
  split_id INTEGER REFERENCES routine_splits(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES routine_units(id) ON DELETE SET NULL,
  program_week_id INTEGER REFERENCES program_weeks(id) ON DELETE SET NULL,
  uuid TEXT UNIQUE
);

CREATE TABLE session_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  rpe REAL,
  rir INTEGER,
  notes TEXT,
  distance_km REAL,
  duration_sec INTEGER,
  pace_sec INTEGER,
  failure INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE routine_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'musculacao',
  anchor_date TEXT,
  rest_weekdays TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 0,
  uuid TEXT UNIQUE
);

CREATE TABLE routine_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  split_id INTEGER NOT NULL REFERENCES routine_splits(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE routine_unit_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES routine_units(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER NOT NULL DEFAULT 8,
  target_reps_max INTEGER,
  target_weight_kg REAL,
  target_distance_km REAL,
  target_duration_min REAL,
  run_type TEXT,
  target_pace_sec INTEGER,
  interval_reps INTEGER,
  interval_work_sec INTEGER,
  interval_work_km REAL,
  interval_rest_sec INTEGER
);

CREATE TABLE routine_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL
);

CREATE TABLE user_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE training_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  split_id INTEGER NOT NULL REFERENCES routine_splits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_weeks INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  setup_week_number INTEGER,
  started_at TEXT,
  uuid TEXT UNIQUE
);

CREATE TABLE program_weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  label TEXT,
  UNIQUE(program_id, week_number)
);

CREATE TABLE program_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES routine_units(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  target_sets INTEGER,
  target_reps INTEGER,
  target_reps_max INTEGER,
  target_weight_kg REAL,
  target_distance_km REAL,
  target_duration_min REAL,
  run_type TEXT,
  target_pace_sec INTEGER,
  interval_reps INTEGER,
  interval_work_sec INTEGER,
  interval_work_km REAL,
  interval_rest_sec INTEGER,
  UNIQUE(week_id, unit_id, exercise_id)
);

INSERT INTO exercises (id, name, muscle_group, equipment, type, is_custom, modality, uuid) VALUES
  (1, 'Supino reto', 'chest', 'barbell', 'compound', 0, 'musculacao', 'fixed-uuid-ex-1'),
  (2, 'Rosca direta customizada', 'arms', 'dumbbell', 'isolation', 1, 'musculacao', 'fixed-uuid-ex-2'),
  (3, 'Correr', 'cardio', 'bodyweight', 'compound', 0, 'corrida', 'fixed-uuid-ex-3');

INSERT INTO sessions (id, date, name, notes, duration_seconds, start_time, end_time, photo_uri, modality, split_id, unit_id, program_week_id, uuid) VALUES
  (1, '2026-01-05', NULL, NULL, 3600, '2026-01-05T10:00:00.000Z', '2026-01-05T11:00:00.000Z', NULL, 'musculacao', NULL, NULL, NULL, 'fixed-uuid-session-1');

INSERT INTO sets (id, session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec, failure) VALUES
  (1, 1, 1, 1, 10, 60, 8, 2, NULL, NULL, NULL, NULL, 0),
  (2, 1, 1, 2, 8, 65, 8.5, 1, NULL, NULL, NULL, NULL, 0),
  (3, 1, 1, 3, 6, 70, 9, 1, NULL, NULL, NULL, NULL, 0);

INSERT INTO routine_splits (id, name, mode, modality, anchor_date, rest_weekdays, "order", uuid) VALUES
  (1, 'Push Pull Legs', 'cycle', 'musculacao', '2026-01-01', '', 0, 'fixed-uuid-split-1');

INSERT INTO routine_units (id, split_id, ordinal, label) VALUES
  (1, 1, 1, 'Push');

INSERT INTO routine_unit_exercises (id, unit_id, exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg) VALUES
  (1, 1, 1, 0, 3, 8, 12, 60);

INSERT INTO training_programs (id, split_id, name, total_weeks, is_active, "order", setup_week_number, started_at, uuid) VALUES
  (1, 1, 'Bloco 1', 4, 1, 0, NULL, '2026-01-01', 'fixed-uuid-program-1');

INSERT INTO program_weeks (id, program_id, week_number, label) VALUES
  (1, 1, 1, 'Semana 1');

INSERT INTO program_entries (id, week_id, unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg) VALUES
  (1, 1, 1, 1, 3, 8, 12, 60);

INSERT INTO user_meta (key, value) VALUES ('schema_version', '11');
```

- [ ] **Step 2: Write the failing test — append to `src/db/migrations.test.ts`**

Add this new `describe` block at the end of the file (after the existing `describe("runMigrations upgrade from frozen snapshots", ...)` block):

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/db/migrations.test.ts`
Expected: FAIL if Step 1's fixture file is missing (`ENOENT`); confirms the new block is wired to the fixture correctly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/migrations.test.ts`
Expected: PASS — 3 tests total (1 from Task 3, 2 from this task).

- [ ] **Step 5: Run the full suite and type-check**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/__fixtures__/v11-snapshot.sql src/db/migrations.test.ts
git commit -m "test(db): add current-schema fixture, no-op and idempotency migration tests"
```

---

### Task 5: Gate the Android release build on the test suite

**Files:**
- Modify: `.github/workflows/android-build.yml`

**Interfaces:** none (CI configuration only).

- [ ] **Step 1: Add a `test` job and make `build` depend on it**

In `.github/workflows/android-build.yml`, insert a new `test` job before the existing `build` job, and add `needs: test` to `build`:

```yaml
name: Android Release Build

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch: {}

concurrency:
  group: android-build-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  test:
    name: Run test suite
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx jest

  build:
    name: Build signed release APK
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Java (Temurin 17)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Prebuild Android project
        run: |
          rm -rf android
          npx expo prebuild --platform android --no-install

      - name: Detect required Android SDK components
        id: sdk-versions
        run: |
          COMPILE_SDK=$(grep -oE "android\.compileSdkVersion'\) \?: '[0-9]+" android/build.gradle | grep -oE '[0-9]+$')
          BUILD_TOOLS=$(grep -oE "android\.buildToolsVersion'\) \?: '[0-9.]+" android/build.gradle | grep -oE '[0-9.]+$')
          echo "compile_sdk=$COMPILE_SDK" >> "$GITHUB_OUTPUT"
          echo "build_tools=$BUILD_TOOLS" >> "$GITHUB_OUTPUT"
          echo "Detected compileSdkVersion=$COMPILE_SDK buildToolsVersion=$BUILD_TOOLS"

      - name: Ensure required Android SDK platform/build-tools are installed
        run: |
          yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
            "platforms;android-${{ steps.sdk-versions.outputs.compile_sdk }}" \
            "build-tools;${{ steps.sdk-versions.outputs.build_tools }}"

      - name: Decode release keystore
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 --decode > android/app/release.keystore

      - name: Make gradlew executable
        run: chmod +x android/gradlew

      - name: Build signed release APK
        working-directory: android
        env:
          ANDROID_RELEASE_STORE_FILE: release.keystore
          ANDROID_RELEASE_STORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_RELEASE_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_RELEASE_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: ./gradlew assembleRelease --no-daemon

      - name: Remove keystore from disk
        if: always()
        run: rm -f android/app/release.keystore

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: open-training-release-apk
          path: android/app/build/outputs/apk/release/app-release.apk
          if-no-files-found: error
          retention-days: 30

      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          files: android/app/build/outputs/apk/release/app-release.apk
          generate_release_notes: true
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/android-build.yml'))" && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/android-build.yml
git commit -m "ci: gate Android release build on test suite passing"
```
