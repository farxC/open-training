# Export/Import (Backup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user export their full open-training dataset (sessions, exercises, routine splits, training programs) to a JSON file, and import that file back in — merging into whatever is already on the device — so data survives a device migration or an app reinstall.

**Architecture:** A new `uuid` column on the four top-level entities (`exercises`, `sessions`, `routine_splits`, `training_programs`) gives every row a device-independent identity. Export walks the full data tree into a versioned JSON payload keyed by those uuids. Import runs pure merge-planning functions (exercise-by-name-or-uuid, session/split/program-by-uuid) against the current DB state, then applies the result inside a single transaction. A native/web platform split (matching the existing `PhotoAttachment`/`PhotoAttachment.web.tsx` pattern) handles writing the file and sharing it (native) vs. triggering a browser download (web), and picking a file back in on both platforms.

**Tech Stack:** Expo SQLite 15 (`expo-sqlite`, native) / `sql.js` (WASM, web) — existing dual-driver setup; `expo-file-system`, `expo-sharing`, `expo-document-picker` (new); no new UI libraries.

## Global Constraints

- Self-hosted, offline-first — no network calls to external services (export/import both stay entirely on-device; `npm install` for dependencies is a dev-time operation, not an app runtime call).
- No auth, single-user.
- Every feature must work in the browser (`react-native-web`), not just on native — verify both code paths for anything platform-split.
- `"order"` is a SQL reserved word — always double-quote it in DDL and queries: `re."order"`.
- TypeScript strict mode (`tsconfig.json`); path alias `@/*` → `./src/*`.
- ESLint (`expo` config) — `@typescript-eslint/no-unused-vars` is an error; keep imports/vars clean.
- Expo SDK 52 / React Native 0.76 / `expo-sqlite` ~15.1.4 — version floor for any new `expo-*` package added here.

### Testing strategy (read before Task 6)

This codebase has **no existing precedent for testing anything that touches the live `db` singleton** — `src/db/queries.ts` and `src/db/migrations.ts` have zero test coverage today, and this plan does not change that. Two things were verified empirically before writing this plan:

1. `src/db/client.ts` (native `expo-sqlite` driver) throws immediately under Jest (`jest-expo`) — there is no native module bridge in the test process. It cannot be exercised in a unit test.
2. `src/db/client.web.ts` (the `sql.js`/WASM driver) also fails under Jest, at WASM instantiation — the test environment's sandbox does not support it either.

Given that, this plan's automated tests target the **pure merge/validation logic** only (`validateExportPayload`, `planExerciseMerge`, `planSessionMerge` in Tasks 6–8) — functions that take and return plain data, with no `db` access. `buildExportPayload` and `applyImport` (Tasks 9–10) call `db` directly and are therefore not covered by `npx jest`; they're kept as thin as possible specifically so the untested surface is small, and are verified via `npx tsc --noEmit` (Task 14) plus manual exercise of the running app. This is a narrower automated-test surface than the design spec's "Testing" section describes (no automated round-trip test) — flagged here rather than silently dropped.

## File Structure

New files:
- `src/utils/uuid.ts` — `generateUuid()`, a 32-hex-char random identifier used as the merge key for new rows.
- `src/db/importExport.ts` — export/import payload types, `validateExportPayload`, `planExerciseMerge`, `planSessionMerge`, `buildExportPayload`, `applyImport`.
- `src/db/exportFile.ts` / `src/db/exportFile.web.ts` — platform-specific "write + hand off" for the export file (native: `expo-file-system` + `expo-sharing`; web: `Blob` + `<a download>`).
- `src/db/importFile.ts` / `src/db/importFile.web.ts` — platform-specific "pick + read" for the import file (native: `expo-document-picker` + `expo-file-system`; web: `expo-document-picker`'s web path + `File.text()`/`fetch`).
- `app/settings.tsx` — the Settings screen (Export/Import buttons).

Modified files:
- `package.json` / `package-lock.json` — add `expo-sharing`, `expo-document-picker`, `expo-file-system`.
- `src/db/client.web.ts` — add a `withTransactionSync` method (missing today; `applyImport` needs it on both platforms).
- `src/db/schema.ts` — bump `SCHEMA_VERSION` to 9; add `uuid TEXT UNIQUE` to the four top-level `CREATE TABLE` statements.
- `src/db/migrations.ts` — `ensureColumn(...)` the same four `uuid` columns (no `UNIQUE` — see Task 4) onto existing databases, plus a one-time-safe SQL backfill for rows with no `uuid` yet.
- `src/types/exercise.ts`, `src/types/session.ts`, `src/types/routine.ts` — add `uuid: string` to `Exercise`, `Session`, `RoutineSplit`, `TrainingProgram`.
- `src/db/queries.ts` — `createExercise`, `createSession`, `createSplit`, `createProgram` generate and persist a `uuid`; `getSessions`, `getSessionById` select it; `SplitRow`/`TrainingProgramRow` (+ their mapping functions) carry it through.
- `src/hooks/useExercises.ts` — `createCustom` adapts to `createExercise`'s new return shape.
- `app/_layout.tsx` — register the `settings` route (plain pushed screen, no modal).
- `app/(tabs)/index.tsx` — add a gear icon in the Feed header that navigates to `/settings`.

## Task 1: Add file-handling dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `expo-sharing`, `expo-document-picker`, `expo-file-system` importable from any file in the project.

- [ ] **Step 1: Install SDK-compatible versions**

Run: `npx expo install expo-sharing expo-document-picker expo-file-system`

Expected: `package.json` gains three new entries under `dependencies` (SDK-52-compatible versions, e.g. `expo-document-picker": "~13.0.3"`, `"expo-file-system": "~18.0.12"`, `"expo-sharing": "~13.0.1"` — exact patch versions are whatever `expo install` resolves; do not hand-edit them).

- [ ] **Step 2: Verify**

Run: `grep -n "expo-sharing\|expo-document-picker\|expo-file-system" package.json`
Expected: three matching lines under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-sharing, expo-document-picker, expo-file-system"
```

## Task 2: `generateUuid()` utility

**Files:**
- Create: `src/utils/uuid.ts`
- Test: `src/utils/uuid.test.ts`

**Interfaces:**
- Produces: `generateUuid(): string` — a 32-character lowercase hex string, used as the merge-identity key written to the new `uuid` columns.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/uuid.test.ts
import { generateUuid } from "./uuid";

describe("generateUuid", () => {
  it("returns a 32-character lowercase hex string", () => {
    const id = generateUuid();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a different value on each call", () => {
    expect(generateUuid()).not.toBe(generateUuid());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/uuid.test.ts`
Expected: FAIL — `Cannot find module './uuid'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/uuid.ts
/**
 * Locally-unique identifier used as the merge key for export/import — not
 * cryptographically secure, just needs to not collide across two devices.
 */
export function generateUuid(): string {
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/uuid.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/uuid.ts src/utils/uuid.test.ts
git commit -m "feat(utils): add generateUuid for export/import merge keys"
```

## Task 3: Add the missing transaction method to the web SQL client

**Files:**
- Modify: `src/db/client.web.ts`

**Interfaces:**
- Consumes: nothing new — wraps the existing internal `requireDb()`/`persist()` helpers already in this file.
- Produces: `db.withTransactionSync(task: () => void): void` on the web driver, matching the method already present on the native driver (`expo-sqlite`'s `SQLiteDatabase.withTransactionSync`). `applyImport` (Task 10) depends on this existing on **both** platforms.

No automated test: this file has no existing test coverage (it's a thin driver shim, same as the rest of `client.web.ts`), and it cannot be exercised under Jest (see "Testing strategy" above — WASM instantiation fails in this test environment). Correctness is verified by `npx tsc --noEmit` (return/parameter types must match the native driver's signature) and by manual exercise of Import on web once the full feature is wired up.

- [ ] **Step 1: Add `withTransactionSync` to the exported `db` object**

In `src/db/client.web.ts`, add a new method to the `db` object (after `prepareSync`, closing the object):

```ts
  prepareSync(sql: string) {
    const stmt = requireDb().prepare(sql);
    return {
      executeSync(params: Param[]) {
        stmt.run(params as (string | number | null)[]);
        // Intentionally no persist() here — caller must call finalizeSync() to commit.
      },
      finalizeSync() {
        stmt.free();
        persist(); // One persist for the whole batch.
      },
    };
  },

  // Matches expo-sqlite's SQLiteDatabase.withTransactionSync — BEGIN/COMMIT wrapping a
  // synchronous task, ROLLBACK and rethrow on failure. Needed so import (Task 10) can
  // run as one atomic unit on both the native and web drivers.
  withTransactionSync(task: () => void): void {
    const d = requireDb();
    d.run("BEGIN");
    try {
      task();
      d.run("COMMIT");
      persist();
    } catch (err) {
      d.run("ROLLBACK");
      throw err;
    }
  },
};
```

(This replaces the file's final `};` — the new method is added as a sibling of `prepareSync`, and the closing `};` of the `db` object moves to after it.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/db/client.web.ts
git commit -m "fix(db): add withTransactionSync to the web sql.js client"
```

## Task 4: Schema v9 — add `uuid` columns

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations.ts`

**Interfaces:**
- Produces: an `exercises.uuid`, `sessions.uuid`, `routine_splits.uuid`, `training_programs.uuid` column on every database (fresh installs via `CREATE TABLE`, upgrades via `ALTER TABLE`), all populated (never `NULL` after migration).

**Important constraint discovered while planning this task:** SQLite's `ALTER TABLE ... ADD COLUMN` does **not** allow a `UNIQUE` constraint on the new column (only `CREATE TABLE` does). So the four `CREATE_TABLES` DDL statements get `uuid TEXT UNIQUE` (fresh installs are unaffected), but `migrations.ts`'s `ensureColumn` calls for upgrades must add plain `uuid TEXT` (no `UNIQUE`) — uniqueness on upgraded databases is guaranteed by `generateUuid()`'s collision odds, not enforced by SQLite. This is intentional, not an oversight — do not attempt to add `UNIQUE` via a separate `CREATE UNIQUE INDEX`; that's unnecessary complexity for a merge key that's never queried by uniqueness constraint, only by equality lookup.

No automated test for this task — migrations are untested elsewhere in this codebase today (see "Testing strategy"), and cannot be run against a real `db` in Jest either way.

- [ ] **Step 1: Add `uuid TEXT UNIQUE` to the four `CREATE_TABLES` entries**

In `src/db/schema.ts`, bump the version:

```ts
export const SCHEMA_VERSION = 9;
```

Add `uuid TEXT UNIQUE` as the last column in each of these four `CREATE_TABLES` entries (do not reorder existing columns):

```ts
  `CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    muscle_group TEXT NOT NULL,
    equipment TEXT NOT NULL,
    type TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    modality TEXT NOT NULL DEFAULT 'musculacao',
    uuid TEXT UNIQUE
  )`,
```

```ts
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT,
    notes TEXT,
    duration_seconds INTEGER,
    photo_uri TEXT,
    modality TEXT NOT NULL DEFAULT 'musculacao',
    split_id INTEGER REFERENCES routine_splits(id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES routine_units(id) ON DELETE SET NULL,
    program_week_id INTEGER REFERENCES program_weeks(id) ON DELETE SET NULL,
    uuid TEXT UNIQUE
  )`,
```

```ts
  `CREATE TABLE IF NOT EXISTS routine_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    modality TEXT NOT NULL DEFAULT 'musculacao',
    anchor_date TEXT,
    rest_weekdays TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    uuid TEXT UNIQUE
  )`,
```

```ts
  `CREATE TABLE IF NOT EXISTS training_programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    split_id INTEGER NOT NULL REFERENCES routine_splits(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_weeks INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    setup_week_number INTEGER,
    started_at TEXT,
    uuid TEXT UNIQUE
  )`,
```

- [ ] **Step 2: Add `ensureColumn` calls and a uuid backfill in `migrations.ts`**

In `src/db/migrations.ts`, add four more `ensureColumn` calls alongside the existing ones (after the `sets` distance/duration/pace ones):

```ts
  ensureColumn("sets", "distance_km", "REAL");
  ensureColumn("sets", "duration_sec", "INTEGER");
  ensureColumn("sets", "pace_sec", "INTEGER");
  ensureColumn("exercises", "uuid", "TEXT");
  ensureColumn("sessions", "uuid", "TEXT");
  ensureColumn("routine_splits", "uuid", "TEXT");
  ensureColumn("training_programs", "uuid", "TEXT");
```

Then, after the existing photo_uri backfill block (`INSERT INTO session_photos ...`), add a uuid backfill. It must run unconditionally every launch (like the photo backfill above it) — the `WHERE uuid IS NULL` guard makes it naturally idempotent, matching this file's existing self-healing pattern:

```ts
  // Backfill: rows created before schema v9 (export/import) have no uuid — the merge
  // key import uses to tell "already have this" from "new". Generated in pure SQL via
  // randomblob so it works identically on both the native and sql.js (web) drivers,
  // and one row at a time so each gets a distinct value.
  db.execSync("UPDATE exercises SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
  db.execSync("UPDATE sessions SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
  db.execSync("UPDATE routine_splits SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
  db.execSync("UPDATE training_programs SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL");
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (this task doesn't touch any TS types yet — that's Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/migrations.ts
git commit -m "feat(db): add uuid columns to exercises, sessions, splits, programs (schema v9)"
```

## Task 5: Wire `uuid` through types, create-functions, and reads

**Files:**
- Modify: `src/types/exercise.ts`, `src/types/session.ts`, `src/types/routine.ts`
- Modify: `src/db/queries.ts`
- Modify: `src/hooks/useExercises.ts`

**Interfaces:**
- Consumes: `generateUuid()` from `src/utils/uuid.ts` (Task 2).
- Produces: `Exercise.uuid`, `Session.uuid`, `RoutineSplit.uuid`, `TrainingProgram.uuid` (all `string`); `createExercise(ex: Omit<Exercise, "id" | "uuid">): { id: number; uuid: string }` (return type changed — was `number`); `createSession`/`createSplit`/`createProgram` keep returning `number` but now also persist a generated `uuid`.

This task is one unit because splitting it would leave the project in a non-compiling state partway through (the type changes and the `queries.ts`/`useExercises.ts` changes are mutually required).

No automated test: these are thin data-layer changes over the same `db` singleton already excluded from Jest coverage (see "Testing strategy"). Verified via `npx tsc --noEmit`.

- [ ] **Step 1: Add `uuid` to the four types**

In `src/types/exercise.ts`:

```ts
export interface Exercise {
  id: number;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  type: ExerciseType;
  is_custom: 0 | 1;
  modality: Modality;
  uuid: string;
}
```

In `src/types/session.ts`:

```ts
export interface Session {
  id: number;
  date: string;
  name: string | null;
  notes: string | null;
  duration_seconds: number | null;
  /** @deprecated superseded by session_photos (multi-photo). Read-only; new code must not write it. */
  photo_uri: string | null;
  modality: Modality;
  split_id: number | null;
  unit_id: number | null;
  program_week_id: number | null;
  uuid: string;
}
```

In `src/types/routine.ts`, add `uuid: string;` to both `RoutineSplit` and `TrainingProgram`:

```ts
export interface RoutineSplit {
  id: number;
  name: string;
  mode: SplitMode;
  modality: Modality;
  anchor_date: string | null;
  rest_weekdays: number[]; // 0=Sun..6=Sat (cyclic only)
  order: number;
  uuid: string;
}
```

```ts
export interface TrainingProgram {
  id: number;
  split_id: number;
  name: string;
  total_weeks: number;
  is_active: boolean;
  order: number;
  /** Week number the week-mapping wizard left off at; null once finished (or never started). */
  setup_week_number: number | null;
  /** Date (YYYY-MM-DD) this program was first activated; anchors "current week" math. Null until activated. */
  started_at: string | null;
  uuid: string;
}
```

- [ ] **Step 2: Persist `uuid` on create, in `src/db/queries.ts`**

Add the import at the top of the file:

```ts
import { generateUuid } from "../utils/uuid";
```

Replace `createExercise`:

```ts
export function createExercise(ex: Omit<Exercise, "id" | "uuid">): { id: number; uuid: string } {
  const uuid = generateUuid();
  const result = db.runSync(
    "INSERT INTO exercises (name, muscle_group, equipment, type, is_custom, modality, uuid) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [ex.name, ex.muscle_group, ex.equipment, ex.type, 1, ex.modality, uuid]
  );
  return { id: result.lastInsertRowId, uuid };
}
```

Replace `createSession`:

```ts
export function createSession(
  date: string,
  opts?: {
    name?: string | null;
    notes?: string | null;
    modality?: Modality;
    split_id?: number | null;
    unit_id?: number | null;
    program_week_id?: number | null;
  }
): number {
  const result = db.runSync(
    `INSERT INTO sessions (date, name, notes, modality, split_id, unit_id, program_week_id, uuid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      opts?.name ?? null,
      opts?.notes ?? null,
      opts?.modality ?? "musculacao",
      opts?.split_id ?? null,
      opts?.unit_id ?? null,
      opts?.program_week_id ?? null,
      generateUuid(),
    ]
  );
  return result.lastInsertRowId;
}
```

Add `s.uuid` to `getSessions`'s SELECT list (right after `s.photo_uri`) and to the inline row type:

```ts
export function getSessions(): SessionSummary[] {
  const rows = db.getAllSync<{
    id: number;
    date: string;
    name: string | null;
    notes: string | null;
    duration_seconds: number | null;
    photo_uri: string | null;
    uuid: string;
    modality: Modality;
    split_id: number | null;
    unit_id: number | null;
    program_week_id: number | null;
    cover_photo_uri: string | null;
    total_volume: number | null;
    total_distance_km: number | null;
    exercise_names_raw: string | null;
  }>(
    `SELECT
      s.id, s.date, s.name, s.notes, s.duration_seconds, s.photo_uri, s.uuid,
      s.modality, s.split_id, s.unit_id, s.program_week_id,
      COALESCE(
        (SELECT uri FROM session_photos WHERE session_id = s.id ORDER BY "order", id LIMIT 1),
        s.photo_uri
      ) AS cover_photo_uri,
      SUM(st.reps * st.weight_kg) AS total_volume,
      SUM(st.distance_km) AS total_distance_km,
      GROUP_CONCAT(DISTINCT e.name) AS exercise_names_raw
    FROM sessions s
    LEFT JOIN sets st ON st.session_id = s.id
    LEFT JOIN exercises e ON e.id = st.exercise_id
    GROUP BY s.id
    ORDER BY s.date DESC`
  );
  return rows.map((r) => ({
    ...r,
    exercise_names: r.exercise_names_raw ? r.exercise_names_raw.split(",") : [],
  }));
}
```

Add `uuid` to `getSessionById`:

```ts
export function getSessionById(id: number): Session | null {
  return db.getFirstSync<Session>(
    `SELECT id, date, name, notes, duration_seconds, photo_uri, uuid,
            modality, split_id, unit_id, program_week_id
     FROM sessions WHERE id = ?`,
    [id]
  );
}
```

Replace `createSplit`:

```ts
export function createSplit(s: { name: string; mode: SplitMode; modality: Modality }): number {
  const count = db.getAllSync<{ id: number }>("SELECT id FROM routine_splits").length;
  const result = db.runSync(
    `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid) VALUES (?, ?, ?, NULL, '', ?, ?)`,
    [s.name, s.mode, s.modality, count, generateUuid()]
  );
  return result.lastInsertRowId;
}
```

Add `uuid: string;` to the local `SplitRow` interface and to the `getSplits()` mapping:

```ts
interface SplitRow {
  id: number;
  name: string;
  mode: string;
  modality: string;
  anchor_date: string | null;
  rest_weekdays: string;
  order: number;
  uuid: string;
}
```

```ts
export function getSplits(): RoutineSplit[] {
  const rows = db.getAllSync<SplitRow>(`SELECT * FROM routine_splits ORDER BY "order"`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode as SplitMode,
    modality: r.modality as Modality,
    anchor_date: r.anchor_date,
    rest_weekdays: parseRest(r.rest_weekdays),
    order: r.order,
    uuid: r.uuid,
  }));
}
```

Replace `createProgram`:

```ts
export function createProgram(p: { split_id: number; name: string; total_weeks: number }): number {
  const count = db.getAllSync<{ id: number }>(
    "SELECT id FROM training_programs WHERE split_id = ?",
    [p.split_id]
  ).length;
  const result = db.runSync(
    `INSERT INTO training_programs (split_id, name, total_weeks, is_active, "order", uuid) VALUES (?, ?, ?, 0, ?, ?)`,
    [p.split_id, p.name, p.total_weeks, count, generateUuid()]
  );
  return result.lastInsertRowId;
}
```

Add `uuid: string;` to `TrainingProgramRow` and to `mapProgram`:

```ts
interface TrainingProgramRow {
  id: number;
  split_id: number;
  name: string;
  total_weeks: number;
  is_active: number;
  order: number;
  setup_week_number: number | null;
  started_at: string | null;
  uuid: string;
}
```

```ts
function mapProgram(r: TrainingProgramRow): TrainingProgram {
  return {
    id: r.id,
    split_id: r.split_id,
    name: r.name,
    total_weeks: r.total_weeks,
    is_active: r.is_active === 1,
    order: r.order,
    setup_week_number: r.setup_week_number,
    started_at: r.started_at,
    uuid: r.uuid,
  };
}
```

- [ ] **Step 3: Adapt `useExercises.ts` to `createExercise`'s new return shape**

```ts
// src/hooks/useExercises.ts
import { useCallback, useState } from "react";
import { getExercises, createExercise } from "@/db/queries";
import type { Exercise, MuscleGroup } from "@/types";

interface Filter {
  muscle_group?: MuscleGroup;
  is_custom?: boolean;
}

export function useExercises(filter?: Filter) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    getExercises(filter)
  );

  const refresh = useCallback(() => {
    setExercises(getExercises(filter));
  }, [filter]);

  const createCustom = useCallback(
    (ex: Omit<Exercise, "id" | "uuid">): Exercise => {
      const { id, uuid } = createExercise(ex);
      refresh();
      return { ...ex, id, uuid, is_custom: 1 };
    },
    [refresh]
  );

  return { exercises, refresh, createCustom };
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If any other call site references `createExercise`/`createSession`/`createSplit`/`createProgram` with a shape now missing `uuid` handling, this is where it would surface — there should be none beyond what this task already touched, since `uuid` is generated internally and no other caller destructures `createExercise`'s return value.)

- [ ] **Step 5: Commit**

```bash
git add src/types/exercise.ts src/types/session.ts src/types/routine.ts src/db/queries.ts src/hooks/useExercises.ts
git commit -m "feat(db): generate and expose uuid on exercises, sessions, splits, programs"
```

## Task 6: Export payload types + `validateExportPayload`

**Files:**
- Create: `src/db/importExport.ts`
- Test: `src/db/importExport.test.ts`

**Interfaces:**
- Consumes: `Modality`, `SplitMode` from `@/types`.
- Produces: `ExportPayload` and its nested types (`ExportedExercise`, `ExportedSet`, `ExportedSession`, `ExportedUnitExercise`, `ExportedUnit`, `ExportedSplit`, `ExportedProgramEntry`, `ExportedProgramWeek`, `ExportedProgram`); `CURRENT_EXPORT_FORMAT_VERSION = 1`; `validateExportPayload(data: unknown): ExportPayload` (throws `Error` with a user-facing Portuguese message on anything invalid).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/importExport.test.ts
import { validateExportPayload, CURRENT_EXPORT_FORMAT_VERSION } from "./importExport";

function validPayload() {
  return {
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-10T12:00:00.000Z",
    appSchemaVersion: 9,
    exercises: [],
    sessions: [],
    routineSplits: [],
    trainingPrograms: [],
  };
}

describe("validateExportPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(() => validateExportPayload(validPayload())).not.toThrow();
  });

  it("rejects non-object input", () => {
    expect(() => validateExportPayload(null)).toThrow();
    expect(() => validateExportPayload("not json")).toThrow();
    expect(() => validateExportPayload(42)).toThrow();
  });

  it("rejects an unknown exportFormatVersion", () => {
    expect(() => validateExportPayload({ ...validPayload(), exportFormatVersion: 2 })).toThrow();
    expect(() => validateExportPayload({ ...validPayload(), exportFormatVersion: undefined })).toThrow();
  });

  it("rejects a payload missing a data section", () => {
    const { exercises, ...rest } = validPayload();
    expect(() => validateExportPayload(rest)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/importExport.test.ts`
Expected: FAIL — `Cannot find module './importExport'`

- [ ] **Step 3: Write the payload types and `validateExportPayload`**

```ts
// src/db/importExport.ts
import type { Modality, SplitMode } from "@/types";

export const CURRENT_EXPORT_FORMAT_VERSION = 1;

export interface ExportedExercise {
  uuid: string;
  name: string;
  muscle_group: string;
  equipment: string;
  type: string;
  is_custom: 0 | 1;
  modality: Modality;
}

export interface ExportedSet {
  exercise_uuid: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
  distance_km: number | null;
  duration_sec: number | null;
  pace_sec: number | null;
}

export interface ExportedSession {
  uuid: string;
  date: string;
  name: string | null;
  notes: string | null;
  duration_seconds: number | null;
  modality: Modality;
  sets: ExportedSet[];
}

export interface ExportedUnitExercise {
  exercise_uuid: string;
  order: number;
  target_sets: number;
  target_reps: number;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_distance_km: number | null;
  target_duration_min: number | null;
  run_type: "continuous" | "interval" | null;
  target_pace_sec: number | null;
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
}

export interface ExportedUnit {
  ordinal: number;
  label: string;
  exercises: ExportedUnitExercise[];
}

export interface ExportedSplit {
  uuid: string;
  name: string;
  mode: SplitMode;
  modality: Modality;
  anchor_date: string | null;
  rest_weekdays: number[];
  order: number;
  units: ExportedUnit[];
}

export interface ExportedProgramEntry {
  exercise_uuid: string;
  unit_ordinal: number;
  target_sets: number | null;
  target_reps: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_distance_km: number | null;
  target_duration_min: number | null;
  run_type: "continuous" | "interval" | null;
  target_pace_sec: number | null;
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
}

export interface ExportedProgramWeek {
  week_number: number;
  label: string | null;
  entries: ExportedProgramEntry[];
}

export interface ExportedProgram {
  uuid: string;
  split_uuid: string;
  name: string;
  total_weeks: number;
  is_active: boolean;
  order: number;
  setup_week_number: number | null;
  started_at: string | null;
  weeks: ExportedProgramWeek[];
}

export interface ExportPayload {
  exportFormatVersion: number;
  exportedAt: string;
  appSchemaVersion: number;
  exercises: ExportedExercise[];
  sessions: ExportedSession[];
  routineSplits: ExportedSplit[];
  trainingPrograms: ExportedProgram[];
}

/** Throws with a user-facing (pt-BR) message on anything that isn't a well-formed export file. */
export function validateExportPayload(data: unknown): ExportPayload {
  if (typeof data !== "object" || data === null) {
    throw new Error("Arquivo de backup inválido: conteúdo não é um objeto JSON.");
  }
  const payload = data as Partial<ExportPayload>;
  if (payload.exportFormatVersion !== CURRENT_EXPORT_FORMAT_VERSION) {
    throw new Error(
      `Arquivo de backup em formato não suportado (versão ${String(payload.exportFormatVersion)}).`
    );
  }
  if (
    !Array.isArray(payload.exercises) ||
    !Array.isArray(payload.sessions) ||
    !Array.isArray(payload.routineSplits) ||
    !Array.isArray(payload.trainingPrograms)
  ) {
    throw new Error("Arquivo de backup inválido: uma ou mais seções de dados estão ausentes.");
  }
  return payload as ExportPayload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/importExport.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/importExport.ts src/db/importExport.test.ts
git commit -m "feat(db): add export payload types and validateExportPayload"
```

## Task 7: `planExerciseMerge`

**Files:**
- Modify: `src/db/importExport.ts`
- Modify: `src/db/importExport.test.ts`

**Interfaces:**
- Produces: `ExerciseMergePlan { toInsert: ExportedExercise[]; matchedIds: Map<string, number> }`; `planExerciseMerge(existing: { id: number; uuid: string | null; name: string }[], imported: ExportedExercise[]): ExerciseMergePlan`.

- [ ] **Step 1: Write the failing test**

Append to `src/db/importExport.test.ts`:

```ts
import { planExerciseMerge } from "./importExport";
import type { ExportedExercise } from "./importExport";

function exercise(overrides: Partial<ExportedExercise> = {}): ExportedExercise {
  return {
    uuid: "ex-uuid-1",
    name: "Supino reto",
    muscle_group: "chest",
    equipment: "barbell",
    type: "compound",
    is_custom: 0,
    modality: "musculacao",
    ...overrides,
  };
}

describe("planExerciseMerge", () => {
  it("matches an existing exercise by uuid", () => {
    const existing = [{ id: 5, uuid: "ex-uuid-1", name: "Supino reto" }];
    const plan = planExerciseMerge(existing, [exercise()]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.matchedIds.get("ex-uuid-1")).toBe(5);
  });

  it("falls back to matching by name when uuid is unknown", () => {
    const existing = [{ id: 5, uuid: null, name: "Supino reto" }];
    const plan = planExerciseMerge(existing, [exercise({ uuid: "ex-uuid-2" })]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.matchedIds.get("ex-uuid-2")).toBe(5);
  });

  it("queues an exercise with no local match for insertion", () => {
    const plan = planExerciseMerge([], [exercise({ uuid: "ex-uuid-3", name: "Novo exercício" })]);
    expect(plan.toInsert).toEqual([exercise({ uuid: "ex-uuid-3", name: "Novo exercício" })]);
    expect(plan.matchedIds.size).toBe(0);
  });

  it("prefers a uuid match over a name match", () => {
    const existing = [
      { id: 1, uuid: "ex-uuid-1", name: "Old name" },
      { id: 2, uuid: null, name: "Supino reto" },
    ];
    const plan = planExerciseMerge(existing, [exercise({ name: "Supino reto" })]);
    expect(plan.matchedIds.get("ex-uuid-1")).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/importExport.test.ts`
Expected: FAIL — `planExerciseMerge` is not exported yet.

- [ ] **Step 3: Implement `planExerciseMerge`**

Append to `src/db/importExport.ts`:

```ts
export interface ExerciseMergePlan {
  toInsert: ExportedExercise[];
  /** Imported exercise uuid -> local exercise id (already present, either by uuid or by name). */
  matchedIds: Map<string, number>;
}

export function planExerciseMerge(
  existing: { id: number; uuid: string | null; name: string }[],
  imported: ExportedExercise[]
): ExerciseMergePlan {
  const idByUuid = new Map(existing.filter((e) => e.uuid).map((e) => [e.uuid as string, e.id]));
  const idByName = new Map(existing.map((e) => [e.name, e.id]));
  const toInsert: ExportedExercise[] = [];
  const matchedIds = new Map<string, number>();

  for (const ex of imported) {
    const byUuid = idByUuid.get(ex.uuid);
    if (byUuid !== undefined) {
      matchedIds.set(ex.uuid, byUuid);
      continue;
    }
    const byName = idByName.get(ex.name);
    if (byName !== undefined) {
      matchedIds.set(ex.uuid, byName);
      continue;
    }
    toInsert.push(ex);
  }

  return { toInsert, matchedIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/importExport.test.ts`
Expected: PASS (8 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/db/importExport.ts src/db/importExport.test.ts
git commit -m "feat(db): add planExerciseMerge for import merge-by-uuid-then-name"
```

## Task 8: `planSessionMerge`

**Files:**
- Modify: `src/db/importExport.ts`
- Modify: `src/db/importExport.test.ts`

**Interfaces:**
- Produces: `planSessionMerge(existingUuids: Set<string>, imported: ExportedSession[]): ExportedSession[]` — the subset of `imported` whose `uuid` is not already present (this is also the shape used for `routineSplits`/`trainingPrograms` skip-checks in `applyImport`, Task 10, but those are simple enough to inline there — only sessions get a named, tested helper here since it's the case the spec's "re-importing the same file" edge case hinges on).

- [ ] **Step 1: Write the failing test**

Append to `src/db/importExport.test.ts`:

```ts
import { planSessionMerge } from "./importExport";
import type { ExportedSession } from "./importExport";

function session(overrides: Partial<ExportedSession> = {}): ExportedSession {
  return {
    uuid: "session-uuid-1",
    date: "2026-07-01",
    name: null,
    notes: null,
    duration_seconds: null,
    modality: "musculacao",
    sets: [],
    ...overrides,
  };
}

describe("planSessionMerge", () => {
  it("keeps a session whose uuid isn't present locally", () => {
    const result = planSessionMerge(new Set(), [session()]);
    expect(result).toEqual([session()]);
  });

  it("skips a session whose uuid is already present locally (idempotent re-import)", () => {
    const result = planSessionMerge(new Set(["session-uuid-1"]), [session()]);
    expect(result).toEqual([]);
  });

  it("filters a mixed batch correctly", () => {
    const a = session({ uuid: "a" });
    const b = session({ uuid: "b" });
    const result = planSessionMerge(new Set(["a"]), [a, b]);
    expect(result).toEqual([b]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/importExport.test.ts`
Expected: FAIL — `planSessionMerge` is not exported yet.

- [ ] **Step 3: Implement `planSessionMerge`**

Append to `src/db/importExport.ts`:

```ts
export function planSessionMerge(
  existingUuids: Set<string>,
  imported: ExportedSession[]
): ExportedSession[] {
  return imported.filter((s) => !existingUuids.has(s.uuid));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/importExport.test.ts`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/db/importExport.ts src/db/importExport.test.ts
git commit -m "feat(db): add planSessionMerge for idempotent session re-import"
```

## Task 9: `buildExportPayload`

**Files:**
- Modify: `src/db/importExport.ts`

**Interfaces:**
- Consumes: `db` from `./client`; `SCHEMA_VERSION` from `./schema`.
- Produces: `buildExportPayload(): ExportPayload`.

No automated test — reads directly from the live `db` singleton, which is excluded from Jest coverage (see "Testing strategy"). Verified via `npx tsc --noEmit` and, once Task 11 wires it to a button, by exercising Export in the running app.

- [ ] **Step 1: Implement `buildExportPayload`**

Append to `src/db/importExport.ts` (add `import { db } from "./client";` and `import { SCHEMA_VERSION } from "./schema";` to the top of the file, alongside the existing `Modality, SplitMode` import):

```ts
export function buildExportPayload(): ExportPayload {
  const exerciseRows = db.getAllSync<{
    id: number;
    uuid: string;
    name: string;
    muscle_group: string;
    equipment: string;
    type: string;
    is_custom: number;
    modality: Modality;
  }>("SELECT * FROM exercises");
  const exerciseUuidById = new Map(exerciseRows.map((e) => [e.id, e.uuid]));

  const exercises: ExportedExercise[] = exerciseRows.map((e) => ({
    uuid: e.uuid,
    name: e.name,
    muscle_group: e.muscle_group,
    equipment: e.equipment,
    type: e.type,
    is_custom: e.is_custom as 0 | 1,
    modality: e.modality,
  }));

  const sessionRows = db.getAllSync<{
    id: number;
    uuid: string;
    date: string;
    name: string | null;
    notes: string | null;
    duration_seconds: number | null;
    modality: Modality;
  }>("SELECT id, uuid, date, name, notes, duration_seconds, modality FROM sessions");

  const sessions: ExportedSession[] = sessionRows.map((s) => {
    const sets = db.getAllSync<{
      exercise_id: number;
      set_number: number;
      reps: number;
      weight_kg: number;
      rpe: number | null;
      rir: number | null;
      notes: string | null;
      distance_km: number | null;
      duration_sec: number | null;
      pace_sec: number | null;
    }>(
      `SELECT exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec
       FROM sets WHERE session_id = ?`,
      [s.id]
    );
    return {
      uuid: s.uuid,
      date: s.date,
      name: s.name,
      notes: s.notes,
      duration_seconds: s.duration_seconds,
      modality: s.modality,
      sets: sets.map((st) => ({
        exercise_uuid: exerciseUuidById.get(st.exercise_id) ?? "",
        set_number: st.set_number,
        reps: st.reps,
        weight_kg: st.weight_kg,
        rpe: st.rpe,
        rir: st.rir,
        notes: st.notes,
        distance_km: st.distance_km,
        duration_sec: st.duration_sec,
        pace_sec: st.pace_sec,
      })),
    };
  });

  const splitRows = db.getAllSync<{
    id: number;
    uuid: string;
    name: string;
    mode: SplitMode;
    modality: Modality;
    anchor_date: string | null;
    rest_weekdays: string;
    order: number;
  }>(`SELECT * FROM routine_splits`);

  const routineSplits: ExportedSplit[] = splitRows.map((sp) => {
    const units = db.getAllSync<{ id: number; ordinal: number; label: string }>(
      "SELECT id, ordinal, label FROM routine_units WHERE split_id = ? ORDER BY ordinal",
      [sp.id]
    );
    return {
      uuid: sp.uuid,
      name: sp.name,
      mode: sp.mode,
      modality: sp.modality,
      anchor_date: sp.anchor_date,
      rest_weekdays: sp.rest_weekdays
        ? sp.rest_weekdays.split(",").map(Number).filter((n) => !Number.isNaN(n))
        : [],
      order: sp.order,
      units: units.map((u) => {
        const unitExercises = db.getAllSync<{
          exercise_id: number;
          order: number;
          target_sets: number;
          target_reps: number;
          target_reps_max: number | null;
          target_weight_kg: number | null;
          target_distance_km: number | null;
          target_duration_min: number | null;
          run_type: "continuous" | "interval" | null;
          target_pace_sec: number | null;
          interval_reps: number | null;
          interval_work_sec: number | null;
          interval_work_km: number | null;
          interval_rest_sec: number | null;
        }>(
          `SELECT exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg,
                  target_distance_km, target_duration_min, run_type, target_pace_sec,
                  interval_reps, interval_work_sec, interval_work_km, interval_rest_sec
           FROM routine_unit_exercises WHERE unit_id = ? ORDER BY "order"`,
          [u.id]
        );
        return {
          ordinal: u.ordinal,
          label: u.label,
          exercises: unitExercises.map((ue) => ({
            exercise_uuid: exerciseUuidById.get(ue.exercise_id) ?? "",
            order: ue.order,
            target_sets: ue.target_sets,
            target_reps: ue.target_reps,
            target_reps_max: ue.target_reps_max,
            target_weight_kg: ue.target_weight_kg,
            target_distance_km: ue.target_distance_km,
            target_duration_min: ue.target_duration_min,
            run_type: ue.run_type,
            target_pace_sec: ue.target_pace_sec,
            interval_reps: ue.interval_reps,
            interval_work_sec: ue.interval_work_sec,
            interval_work_km: ue.interval_work_km,
            interval_rest_sec: ue.interval_rest_sec,
          })),
        };
      }),
    };
  });

  const splitUuidById = new Map(splitRows.map((sp) => [sp.id, sp.uuid]));

  const programRows = db.getAllSync<{
    id: number;
    uuid: string;
    split_id: number;
    name: string;
    total_weeks: number;
    is_active: number;
    order: number;
    setup_week_number: number | null;
    started_at: string | null;
  }>("SELECT * FROM training_programs");

  const trainingPrograms: ExportedProgram[] = programRows.map((p) => {
    const unitOrdinalById = new Map(
      db
        .getAllSync<{ id: number; ordinal: number }>(
          "SELECT id, ordinal FROM routine_units WHERE split_id = ?",
          [p.split_id]
        )
        .map((u) => [u.id, u.ordinal])
    );
    const weeks = db.getAllSync<{ id: number; week_number: number; label: string | null }>(
      "SELECT id, week_number, label FROM program_weeks WHERE program_id = ? ORDER BY week_number",
      [p.id]
    );
    return {
      uuid: p.uuid,
      split_uuid: splitUuidById.get(p.split_id) ?? "",
      name: p.name,
      total_weeks: p.total_weeks,
      is_active: p.is_active === 1,
      order: p.order,
      setup_week_number: p.setup_week_number,
      started_at: p.started_at,
      weeks: weeks.map((w) => {
        const entries = db.getAllSync<{
          unit_id: number;
          exercise_id: number;
          target_sets: number | null;
          target_reps: number | null;
          target_reps_max: number | null;
          target_weight_kg: number | null;
          target_distance_km: number | null;
          target_duration_min: number | null;
          run_type: "continuous" | "interval" | null;
          target_pace_sec: number | null;
          interval_reps: number | null;
          interval_work_sec: number | null;
          interval_work_km: number | null;
          interval_rest_sec: number | null;
        }>(
          `SELECT unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg,
                  target_distance_km, target_duration_min, run_type, target_pace_sec,
                  interval_reps, interval_work_sec, interval_work_km, interval_rest_sec
           FROM program_entries WHERE week_id = ?`,
          [w.id]
        );
        return {
          week_number: w.week_number,
          label: w.label,
          entries: entries.map((e) => ({
            exercise_uuid: exerciseUuidById.get(e.exercise_id) ?? "",
            unit_ordinal: unitOrdinalById.get(e.unit_id) ?? -1,
            target_sets: e.target_sets,
            target_reps: e.target_reps,
            target_reps_max: e.target_reps_max,
            target_weight_kg: e.target_weight_kg,
            target_distance_km: e.target_distance_km,
            target_duration_min: e.target_duration_min,
            run_type: e.run_type,
            target_pace_sec: e.target_pace_sec,
            interval_reps: e.interval_reps,
            interval_work_sec: e.interval_work_sec,
            interval_work_km: e.interval_work_km,
            interval_rest_sec: e.interval_rest_sec,
          })),
        };
      }),
    };
  });

  return {
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appSchemaVersion: SCHEMA_VERSION,
    exercises,
    sessions,
    routineSplits,
    trainingPrograms,
  };
}
```

Note: session photos are deliberately **not** included — `session_photos.uri` points at a local file path or blob URL that has no meaning on another device (see the design spec's "Photos are out of scope" decision). A restored session simply has no cover photo until the user re-adds one.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/importExport.ts
git commit -m "feat(db): add buildExportPayload"
```

## Task 10: `applyImport`

**Files:**
- Modify: `src/db/importExport.ts`

**Interfaces:**
- Consumes: `db` from `./client` (specifically `db.withTransactionSync`, added in Task 3 for the web driver); `planExerciseMerge`, `planSessionMerge` (Tasks 7–8).
- Produces: `ImportSummary { exercisesAdded: number; sessionsAdded: number; splitsAdded: number; programsAdded: number }`; `applyImport(payload: ExportPayload): ImportSummary`.

No automated test — same reasoning as Task 9. This is the highest-risk untested function in the plan (it's the one that writes the user's data), which is exactly why every state-changing branch inside it delegates its *decision* (insert vs. skip vs. match) to the already-tested pure planners — this function's own job is reduced to "loop and call `db.runSync`," minimizing what's left unverified by the test suite.

- [ ] **Step 1: Implement `applyImport`**

Append to `src/db/importExport.ts`:

```ts
export interface ImportSummary {
  exercisesAdded: number;
  sessionsAdded: number;
  splitsAdded: number;
  programsAdded: number;
}

export function applyImport(payload: ExportPayload): ImportSummary {
  const summary: ImportSummary = {
    exercisesAdded: 0,
    sessionsAdded: 0,
    splitsAdded: 0,
    programsAdded: 0,
  };

  db.withTransactionSync(() => {
    // 1. Exercises
    const existingExercises = db.getAllSync<{ id: number; uuid: string | null; name: string }>(
      "SELECT id, uuid, name FROM exercises"
    );
    const exercisePlan = planExerciseMerge(existingExercises, payload.exercises);
    const exerciseIdByUuid = new Map(exercisePlan.matchedIds);
    for (const ex of exercisePlan.toInsert) {
      const result = db.runSync(
        "INSERT INTO exercises (name, muscle_group, equipment, type, is_custom, modality, uuid) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [ex.name, ex.muscle_group, ex.equipment, ex.type, ex.is_custom, ex.modality, ex.uuid]
      );
      exerciseIdByUuid.set(ex.uuid, result.lastInsertRowId);
      summary.exercisesAdded++;
    }

    // 2. Routine splits (+ units + unit exercises) — matched-by-uuid splits are skipped
    // whole (their units/exercises are assumed to already match too), same as sessions.
    const existingSplits = db.getAllSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM routine_splits"
    );
    const splitIdByUuid = new Map(
      existingSplits.filter((s) => s.uuid).map((s) => [s.uuid as string, s.id])
    );
    for (const split of payload.routineSplits) {
      if (splitIdByUuid.has(split.uuid)) continue;

      const result = db.runSync(
        `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [split.name, split.mode, split.modality, split.anchor_date, split.rest_weekdays.join(","), split.order, split.uuid]
      );
      const splitId = result.lastInsertRowId;
      splitIdByUuid.set(split.uuid, splitId);
      summary.splitsAdded++;

      for (const unit of split.units) {
        const unitResult = db.runSync(
          "INSERT INTO routine_units (split_id, ordinal, label) VALUES (?, ?, ?)",
          [splitId, unit.ordinal, unit.label]
        );
        const unitId = unitResult.lastInsertRowId;
        for (const ue of unit.exercises) {
          const exerciseId = exerciseIdByUuid.get(ue.exercise_uuid);
          if (exerciseId === undefined) continue;
          db.runSync(
            `INSERT INTO routine_unit_exercises
               (unit_id, exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg,
                target_distance_km, target_duration_min, run_type, target_pace_sec,
                interval_reps, interval_work_sec, interval_work_km, interval_rest_sec)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              unitId, exerciseId, ue.order, ue.target_sets, ue.target_reps, ue.target_reps_max,
              ue.target_weight_kg, ue.target_distance_km, ue.target_duration_min, ue.run_type,
              ue.target_pace_sec, ue.interval_reps, ue.interval_work_sec, ue.interval_work_km, ue.interval_rest_sec,
            ]
          );
        }
      }
    }

    // 3. Sessions
    const existingSessionUuids = new Set(
      db
        .getAllSync<{ uuid: string | null }>("SELECT uuid FROM sessions")
        .map((r) => r.uuid)
        .filter((u): u is string => u !== null)
    );
    const sessionsToInsert = planSessionMerge(existingSessionUuids, payload.sessions);
    for (const session of sessionsToInsert) {
      const result = db.runSync(
        "INSERT INTO sessions (date, name, notes, modality, uuid) VALUES (?, ?, ?, ?, ?)",
        [session.date, session.name, session.notes, session.modality, session.uuid]
      );
      const sessionId = result.lastInsertRowId;
      for (const set of session.sets) {
        const exerciseId = exerciseIdByUuid.get(set.exercise_uuid);
        if (exerciseId === undefined) continue;
        db.runSync(
          `INSERT INTO sets (session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId, exerciseId, set.set_number, set.reps, set.weight_kg, set.rpe, set.rir,
            set.notes, set.distance_km, set.duration_sec, set.pace_sec,
          ]
        );
      }
      summary.sessionsAdded++;
    }

    // 4. Training programs (+ weeks + entries)
    const existingPrograms = db.getAllSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM training_programs"
    );
    const programIdByUuid = new Map(
      existingPrograms.filter((p) => p.uuid).map((p) => [p.uuid as string, p.id])
    );
    for (const program of payload.trainingPrograms) {
      if (programIdByUuid.has(program.uuid)) continue;
      const splitId = splitIdByUuid.get(program.split_uuid);
      if (splitId === undefined) continue; // split this program belongs to wasn't in the file or failed to match

      const unitIdByOrdinal = new Map(
        db
          .getAllSync<{ id: number; ordinal: number }>(
            "SELECT id, ordinal FROM routine_units WHERE split_id = ?",
            [splitId]
          )
          .map((u) => [u.ordinal, u.id])
      );

      const result = db.runSync(
        `INSERT INTO training_programs (split_id, name, total_weeks, is_active, "order", setup_week_number, started_at, uuid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          splitId, program.name, program.total_weeks, program.is_active ? 1 : 0, program.order,
          program.setup_week_number, program.started_at, program.uuid,
        ]
      );
      const programId = result.lastInsertRowId;
      summary.programsAdded++;

      for (const week of program.weeks) {
        const weekResult = db.runSync(
          "INSERT INTO program_weeks (program_id, week_number, label) VALUES (?, ?, ?)",
          [programId, week.week_number, week.label]
        );
        const weekId = weekResult.lastInsertRowId;
        for (const entry of week.entries) {
          const exerciseId = exerciseIdByUuid.get(entry.exercise_uuid);
          const unitId = unitIdByOrdinal.get(entry.unit_ordinal);
          if (exerciseId === undefined || unitId === undefined) continue;
          db.runSync(
            `INSERT INTO program_entries
               (week_id, unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg,
                target_distance_km, target_duration_min, run_type, target_pace_sec,
                interval_reps, interval_work_sec, interval_work_km, interval_rest_sec)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              weekId, unitId, exerciseId, entry.target_sets, entry.target_reps, entry.target_reps_max,
              entry.target_weight_kg, entry.target_distance_km, entry.target_duration_min, entry.run_type,
              entry.target_pace_sec, entry.interval_reps, entry.interval_work_sec, entry.interval_work_km,
              entry.interval_rest_sec,
            ]
          );
        }
      }
    }
  });

  return summary;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/importExport.ts
git commit -m "feat(db): add applyImport — transactional merge of an export payload"
```

## Task 11: File I/O layer (export + import, native + web)

**Files:**
- Create: `src/db/exportFile.ts`, `src/db/exportFile.web.ts`
- Create: `src/db/importFile.ts`, `src/db/importFile.web.ts`

**Interfaces:**
- Consumes: `buildExportPayload` from `./importExport` (Task 9); `expo-file-system`, `expo-sharing`, `expo-document-picker` (Task 1).
- Produces: `exportBackup(): Promise<void>` (both platforms); `pickImportFile(): Promise<string | null>` (both platforms — `null` means the user canceled the picker).

No automated test — these are platform-glue files with no pure logic to isolate, matching the existing untested `PhotoAttachment.tsx`/`PhotoAttachment.web.tsx` pair. Verified via `npx tsc --noEmit` and manual exercise once wired into the Settings screen (Task 12).

- [ ] **Step 1: Native export — `src/db/exportFile.ts`**

```ts
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { buildExportPayload } from "./importExport";

export async function exportBackup(): Promise<void> {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const fileUri = `${FileSystem.cacheDirectory}open-training-backup-${payload.exportedAt.slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: "application/json" });
  }
}
```

- [ ] **Step 2: Web export — `src/db/exportFile.web.ts`**

```ts
import { buildExportPayload } from "./importExport";

export async function exportBackup(): Promise<void> {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `open-training-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Native import — `src/db/importFile.ts`**

```ts
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

/** Returns the picked file's contents, or null if the user canceled. */
export async function pickImportFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
  if (result.canceled || !result.assets[0]) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}
```

- [ ] **Step 4: Web import — `src/db/importFile.web.ts`**

```ts
import * as DocumentPicker from "expo-document-picker";

/** Returns the picked file's contents, or null if the user canceled. */
export async function pickImportFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.file) return asset.file.text();
  const response = await fetch(asset.uri);
  return response.text();
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/exportFile.ts src/db/exportFile.web.ts src/db/importFile.ts src/db/importFile.web.ts
git commit -m "feat(db): add native/web file I/O for export and import"
```

## Task 12: Settings screen

**Files:**
- Create: `app/settings.tsx`
- Create: `src/utils/notify.ts`, `src/utils/notify.web.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `exportBackup` (`@/db/exportFile`), `pickImportFile` (`@/db/importFile`), `applyImport` + `validateExportPayload` (`@/db/importExport`), `ScreenHeader` (`@/components/ScreenHeader`).
- Produces: `notify(title: string, message: string): void` (both platforms); the `/settings` route.

No automated test for the screen component itself — this codebase has no component-level tests anywhere (`app/*.tsx` files are all untested; verification for screens is manual, per the project's established pattern). `notify.ts`/`notify.web.ts` are thin platform glue like Task 11's files, same rationale.

- [ ] **Step 1: Cross-platform alert helper**

`react-native-web`'s `Alert.alert` is a no-op stub (confirmed in `node_modules/react-native-web/dist/exports/Alert/index.js` — `static alert() {}`), so a raw `Alert.alert(...)` call would silently do nothing in the browser. Split it like `PhotoAttachment`:

```ts
// src/utils/notify.ts
import { Alert } from "react-native";

export function notify(title: string, message: string): void {
  Alert.alert(title, message);
}
```

```ts
// src/utils/notify.web.ts
export function notify(title: string, message: string): void {
  window.alert(`${title}\n\n${message}`);
}
```

- [ ] **Step 2: Settings screen**

```tsx
// app/settings.tsx
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { exportBackup } from "@/db/exportFile";
import { pickImportFile } from "@/db/importFile";
import { applyImport, validateExportPayload } from "@/db/importExport";
import { notify } from "@/utils/notify";

export default function SettingsScreen() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      await exportBackup();
    } catch (err) {
      notify("Erro ao exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy("import");
    try {
      const content = await pickImportFile();
      if (content === null) return;
      const payload = validateExportPayload(JSON.parse(content));
      const summary = applyImport(payload);
      notify(
        "Importação concluída",
        `${summary.exercisesAdded} exercícios novos\n${summary.sessionsAdded} sessões novas\n${summary.splitsAdded} rotinas novas\n${summary.programsAdded} programas novos`
      );
    } catch (err) {
      notify("Erro ao importar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Configurações" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text
          className="text-ink-mute"
          style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 }}
        >
          DADOS
        </Text>

        <TouchableOpacity
          className="bg-white rounded-2xl p-4 mb-3"
          style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
          onPress={handleExport}
          disabled={busy !== null}
        >
          <Text className="text-ink font-semibold text-base">Exportar dados</Text>
          <Text className="text-ink-mute text-xs mt-1">
            Gera um arquivo com todo o seu histórico de treinos, exercícios e rotinas.
          </Text>
          {busy === "export" && <ActivityIndicator style={{ marginTop: 8 }} color="#26241f" />}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-white rounded-2xl p-4"
          style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
          onPress={handleImport}
          disabled={busy !== null}
        >
          <Text className="text-ink font-semibold text-base">Importar dados</Text>
          <Text className="text-ink-mute text-xs mt-1">
            Sessões, exercícios e rotinas do arquivo serão adicionados aos seus dados atuais.
          </Text>
          {busy === "import" && <ActivityIndicator style={{ marginTop: 8 }} color="#26241f" />}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Register the route**

In `app/_layout.tsx`, add a plain (non-modal) screen inside the `<Stack>` — placement among the other `Stack.Screen` entries doesn't matter, add it right after `<Stack.Screen name="(tabs)" />`:

```tsx
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="session/new"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx app/_layout.tsx src/utils/notify.ts src/utils/notify.web.ts
git commit -m "feat(settings): add Settings screen with export/import actions"
```

## Task 13: Gear icon entry point in the Feed header

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `router` (`expo-router`, already imported in this file), `MaterialCommunityIcons` (`@expo/vector-icons/MaterialCommunityIcons`, new import in this file).

No automated test — this codebase has no test coverage on `app/(tabs)/*.tsx` screens. Verified via `npx tsc --noEmit`.

- [ ] **Step 1: Add the gear icon**

In `app/(tabs)/index.tsx`, add the icon import:

```tsx
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
```

Add a gear button just before the existing "+" button, inside the same `flex-row items-center` container:

```tsx
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-ink font-display font-semibold text-3xl" style={{ letterSpacing: -0.6 }}>Open Training Project</Text>
            <Text className="text-ink-mute text-xs mt-0.5">
              {sessions.length > 0
                ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} logged`
                : "No sessions yet"}
            </Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.push("/settings")}
            style={{ marginRight: 8 }}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color="#5c594f" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-ink w-11 h-11 rounded-full items-center justify-center"
            onPress={() => router.push("/session/new")}
            style={{
              shadowColor: '#26241f',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '300', lineHeight: 28, marginTop: -1 }}>+</Text>
          </TouchableOpacity>
        </View>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat(feed): add settings gear icon to the header"
```

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint the whole project**

Run: `npx eslint .`
Expected: no errors (warnings for pre-existing `no-console` usages elsewhere are fine — do not fix unrelated files).

- [ ] **Step 3: Run the full test suite**

Run: `npx jest --ci`
Expected: all suites pass, including the new `src/utils/uuid.test.ts` and `src/db/importExport.test.ts` (11+ tests across both), alongside the pre-existing `src/data/modalities.test.ts` and `src/utils/cycle.test.ts`.

- [ ] **Step 4: Confirm no stray files**

Run: `git status --short`
Expected: clean (everything from Tasks 1–13 already committed); if anything is untracked/modified, investigate before declaring the plan complete — do not leave uncommitted work.

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-07-10-export-import-backup-design.md` maps to a task — schema v9 (Task 4), export flow (Tasks 9, 11, 12), import/merge flow (Tasks 7, 8, 10, 11, 12), UI (Task 12 + 13), edge cases (re-import same file → Task 8's uuid-skip test; exercise renamed post-export → Task 7's "prefers uuid match over name match" test; unknown `exportFormatVersion` → Task 6's tests). The one gap: the spec's "round-trip test" and general DB-level automated tests are not implemented, for the empirically-verified reason in "Testing strategy" above — flagged, not silently dropped.
- **Placeholder scan:** no TBD/TODO; every step has complete, copy-pasteable code.
- **Type consistency:** `createExercise`'s new return shape (`{ id, uuid }`) is used consistently in Task 5 (both the function and its one caller, `useExercises.ts`); `ExportedExercise`/`ExportedSession`/etc. field names match exactly between `buildExportPayload` (Task 9, produces them) and `applyImport` (Task 10, consumes them) and the merge planners (Tasks 7–8); `withTransactionSync` (Task 3) is called with the exact same signature (`(task: () => void): void`) `applyImport` (Task 10) expects.
