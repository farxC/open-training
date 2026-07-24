import { db } from "./client";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema";
import { SEED_EXERCISES, SEED_RUNNING_EXERCISES } from "../data/exercises";
import { todayISO } from "../utils/cycle";
import type { DbHandle } from "./dbHandle";
import type { MuscleGroup } from "../types/exercise";

function hasColumn(dbHandle: DbHandle, table: string, column: string): boolean {
  const rows = dbHandle.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`, []);
  return rows.some((r) => r.name === column);
}

function hasTable(dbHandle: DbHandle, table: string): boolean {
  return (
    dbHandle.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    ).length > 0
  );
}

/** Idempotent ADD COLUMN — safe on both web and native, unlike a swallowed ALTER. */
function ensureColumn(dbHandle: DbHandle, table: string, column: string, decl: string): void {
  if (!hasColumn(dbHandle, table, column)) {
    dbHandle.runSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`, []);
  }
}

function insertExerciseMuscleGroups(
  dbHandle: DbHandle,
  exerciseId: number,
  muscleGroups: readonly string[]
): void {
  for (const mg of muscleGroups) {
    dbHandle.runSync(
      "INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group) VALUES (?, ?)",
      [exerciseId, mg]
    );
  }
}

export function runMigrations(dbHandle: DbHandle = db): void {
  // Recover from an interrupted v13 exercises rebuild (app killed mid-migration,
  // between DROP TABLE and RENAME below). If left alone, the CREATE_TABLES loop's
  // `IF NOT EXISTS` would recreate an empty `exercises` table and orphan every row
  // sitting in `exercises_new` — finish (or clean up) the swap before anything else
  // touches `exercises`.
  if (hasTable(dbHandle, "exercises_new")) {
    if (!hasTable(dbHandle, "exercises")) {
      dbHandle.execSync("ALTER TABLE exercises_new RENAME TO exercises;");
    } else {
      dbHandle.execSync("DROP TABLE exercises_new;");
    }
  }

  // Same recovery, for an interrupted v14 exercise_muscle_groups rebuild.
  if (hasTable(dbHandle, "exercise_muscle_groups_new")) {
    if (!hasTable(dbHandle, "exercise_muscle_groups")) {
      dbHandle.execSync("ALTER TABLE exercise_muscle_groups_new RENAME TO exercise_muscle_groups;");
    } else {
      dbHandle.execSync("DROP TABLE exercise_muscle_groups_new;");
    }
  }

  // Same recovery, for an interrupted v16 exercise_config rebuild.
  if (hasTable(dbHandle, "exercise_config_new")) {
    if (!hasTable(dbHandle, "exercise_config")) {
      dbHandle.execSync("ALTER TABLE exercise_config_new RENAME TO exercise_config;");
    } else {
      dbHandle.execSync("DROP TABLE exercise_config_new;");
    }
  }

  // Same recovery, for an interrupted v16 session_exercise_config rebuild.
  if (hasTable(dbHandle, "session_exercise_config_new")) {
    if (!hasTable(dbHandle, "session_exercise_config")) {
      dbHandle.execSync("ALTER TABLE session_exercise_config_new RENAME TO session_exercise_config;");
    } else {
      dbHandle.execSync("DROP TABLE session_exercise_config_new;");
    }
  }

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

  // Backfill: session_exercises predates real exercise ordering in sessions — before
  // this table, "exercise order" was just an accident of which exercise's first set
  // got logged first. Preserve that exact order per session (MIN(id) per exercise_id)
  // so upgrading never visually reorders anyone's existing history. Done as a JS loop
  // rather than a window-function query to avoid depending on the SQLite version
  // bundled by the web (sql.js) driver.
  {
    const pairsNeedingBackfill = dbHandle.getAllSync<{ session_id: number; exercise_id: number }>(
      `SELECT session_id, exercise_id
       FROM sets
       WHERE NOT EXISTS (
         SELECT 1 FROM session_exercises se
         WHERE se.session_id = sets.session_id AND se.exercise_id = sets.exercise_id
       )
       GROUP BY session_id, exercise_id
       ORDER BY session_id, MIN(id)`,
      []
    );
    const nextOrderBySession = new Map<number, number>();
    for (const { session_id, exercise_id } of pairsNeedingBackfill) {
      if (!nextOrderBySession.has(session_id)) {
        const maxRow = dbHandle.getFirstSync<{ maxOrder: number | null }>(
          `SELECT MAX("order") as maxOrder FROM session_exercises WHERE session_id = ?`,
          [session_id]
        );
        nextOrderBySession.set(session_id, (maxRow?.maxOrder ?? -1) + 1);
      }
      const order = nextOrderBySession.get(session_id)!;
      nextOrderBySession.set(session_id, order + 1);
      dbHandle.runSync(
        `INSERT INTO session_exercises (session_id, exercise_id, "order") VALUES (?, ?, ?)`,
        [session_id, exercise_id, order]
      );
    }
  }

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
    // Only ever runs on a fresh install — an upgrading device is always already
    // >= 1 — so `exercises`/`exercise_muscle_groups` are guaranteed to already be
    // in the current (post-v13) shape here, created directly by CREATE_TABLES above.
    const insertSeed = (
      ex: { name: string; muscle_groups: MuscleGroup[]; equipment: string; type: string; is_custom: 0 | 1 },
      modality: string
    ) => {
      dbHandle.runSync(
        "INSERT OR IGNORE INTO exercises (name, equipment, type, is_custom, modality) VALUES (?, ?, ?, ?, ?)",
        [ex.name, ex.equipment, ex.type, ex.is_custom, modality]
      );
      const inserted = dbHandle.getFirstSync<{ id: number }>(
        "SELECT id FROM exercises WHERE name = ?",
        [ex.name]
      );
      if (inserted) insertExerciseMuscleGroups(dbHandle, inserted.id, ex.muscle_groups);
    };
    for (const ex of SEED_EXERCISES) insertSeed(ex, "musculacao");
    for (const ex of SEED_RUNNING_EXERCISES) insertSeed(ex, "corrida");
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

  // v13: exercises can now belong to multiple muscle groups (composite movements
  // like bench press train chest+triceps+shoulders, not just one bucket). SQLite
  // has no ALTER TABLE DROP COLUMN + NOT NULL removal that's safe on both the
  // native driver and the web sql.js/WASM driver, so dropping the old scalar
  // `muscle_group` column requires the documented full-table-rebuild procedure.
  // Double-guarded (version AND column presence) so this is a correct no-op both
  // on a fresh install (new shape already in place) and if runMigrations is ever
  // re-entered mid-migration (e.g. a dev hot reload).
  if (currentVersion < 13 && hasColumn(dbHandle, "exercises", "muscle_group")) {
    // 1. Backfill every existing exercise's single legacy value BEFORE the column
    //    is gone — covers both seeded and user-created custom exercises.
    dbHandle.execSync(
      `INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group)
       SELECT id, muscle_group FROM exercises WHERE muscle_group IS NOT NULL`
    );

    // 2. Re-curate built-in exercises (is_custom = 0) that still carry their
    //    original seed name to the new curated multi-muscle-group breakdown —
    //    this is what actually "updates" a pre-existing install's seeded
    //    exercises, not just gives the capability. Exercises the user renamed or
    //    created themselves don't match any seed name and keep their single
    //    legacy value, editable manually via the picker's edit affordance.
    const curatedByName = new Map<string, MuscleGroup[]>([
      ...SEED_EXERCISES.map((ex) => [ex.name, ex.muscle_groups] as const),
      ...SEED_RUNNING_EXERCISES.map((ex) => [ex.name, ex.muscle_groups] as const),
    ]);
    const builtins = dbHandle.getAllSync<{ id: number; name: string }>(
      "SELECT id, name FROM exercises WHERE is_custom = 0",
      []
    );
    for (const { id, name } of builtins) {
      const curated = curatedByName.get(name);
      if (!curated) continue;
      dbHandle.runSync("DELETE FROM exercise_muscle_groups WHERE exercise_id = ?", [id]);
      insertExerciseMuscleGroups(dbHandle, id, curated);
    }

    // 3. FK enforcement must be off for the whole rebuild — PRAGMA foreign_keys is
    //    a no-op inside an active transaction, and runMigrations never opens one
    //    explicitly (every statement here runs autocommit), so this is safe.
    dbHandle.execSync("PRAGMA foreign_keys = OFF;");

    // 4. New shape, no muscle_group.
    dbHandle.execSync(
      `CREATE TABLE exercises_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        equipment TEXT NOT NULL,
        type TEXT NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0,
        modality TEXT NOT NULL DEFAULT 'musculacao',
        uuid TEXT UNIQUE
      )`
    );

    // 5. Copy every remaining column, preserving `id` explicitly — session_exercises,
    //    sets, routine_unit_exercises, and program_entries all hold exercise_id FKs
    //    that must not shift.
    dbHandle.execSync(
      `INSERT INTO exercises_new (id, name, equipment, type, is_custom, modality, uuid)
       SELECT id, name, equipment, type, is_custom, modality, uuid FROM exercises`
    );

    // 6. Drop old, rename new into place. Other tables' FK clauses reference
    //    `exercises` by name, so they transparently repoint once it exists again.
    dbHandle.execSync("DROP TABLE exercises;");
    dbHandle.execSync("ALTER TABLE exercises_new RENAME TO exercises;");

    // 7. Verify before trusting it, then restore enforcement. Scoped to the tables
    //    that actually hold an exercise_id FK — an unscoped `PRAGMA foreign_key_check`
    //    audits every table in the database, so a dev DB that has accumulated
    //    unrelated dangling references elsewhere (nothing to do with this rebuild)
    //    would otherwise make this migration abort on pre-existing, unrelated debt.
    const exerciseReferencingTables = [
      "exercise_muscle_groups",
      "session_exercises",
      "sets",
      "routine_unit_exercises",
      "program_entries",
    ];
    const violations = exerciseReferencingTables.flatMap((table) =>
      dbHandle.getAllSync<unknown>(`PRAGMA foreign_key_check(${table});`, [])
    );
    if (violations.length > 0) {
      throw new Error(
        `Migration v13 exercise rebuild left ${violations.length} dangling foreign key reference(s).`
      );
    }
    dbHandle.execSync("PRAGMA foreign_keys = ON;");
  }

  // v14: exercise-muscle relationships now carry a configurable counting factor
  // (1 = full set, 0.5 = half set) so compound movements can weight their
  // emphasis per involved muscle when totaling series volume. SQLite's
  // ALTER TABLE ADD COLUMN can't attach an inline CHECK, so — same as v13 —
  // adding this column to an upgrading install requires a table rebuild rather
  // than `ensureColumn`. Gated on column absence ALONE, not `currentVersion` —
  // unlike v13's rebuild, this one must be self-healing even if schema_version
  // was already bumped to >= 14 without the column actually existing (e.g. a
  // dev hot-reload that picked up the new SCHEMA_VERSION constant before this
  // migration block existed, poisoning user_meta). A stale `schema_version`
  // must never be able to permanently skip this rebuild.
  if (!hasColumn(dbHandle, "exercise_muscle_groups", "counting_factor")) {
    dbHandle.execSync("PRAGMA foreign_keys = OFF;");

    dbHandle.execSync(
      `CREATE TABLE exercise_muscle_groups_new (
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        muscle_group TEXT NOT NULL,
        counting_factor REAL NOT NULL DEFAULT 1 CHECK (counting_factor IN (0.5, 1)),
        PRIMARY KEY (exercise_id, muscle_group)
      )`
    );

    // No existing row has a factor yet — every pair simply inherits DEFAULT 1
    // (full set), left for the user to adjust per exercise via the picker.
    dbHandle.execSync(
      `INSERT INTO exercise_muscle_groups_new (exercise_id, muscle_group)
       SELECT exercise_id, muscle_group FROM exercise_muscle_groups`
    );

    dbHandle.execSync("DROP TABLE exercise_muscle_groups;");
    dbHandle.execSync("ALTER TABLE exercise_muscle_groups_new RENAME TO exercise_muscle_groups;");

    // Scoped to this table alone — an unscoped `PRAGMA foreign_key_check` audits
    // every table in the database, so on a dev DB that has accumulated unrelated
    // dangling references elsewhere over time, it would misattribute pre-existing
    // debt to this rebuild and abort a migration that was otherwise correct.
    const mgViolations = dbHandle.getAllSync<unknown>(
      "PRAGMA foreign_key_check(exercise_muscle_groups);",
      []
    );
    if (mgViolations.length > 0) {
      throw new Error(
        `Migration v14 exercise_muscle_groups rebuild left ${mgViolations.length} dangling foreign key reference(s).`
      );
    }
    dbHandle.execSync("PRAGMA foreign_keys = ON;");
  }

  // Ensure the running seed exists for DBs created before the modality migration.
  // Always targets the current (post-v13, no muscle_group column) shape.
  dbHandle.runSync(
    "INSERT OR IGNORE INTO exercises (name, equipment, type, is_custom, modality) VALUES ('Correr', 'bodyweight', 'compound', 0, 'corrida')",
    []
  );
  {
    const correr = dbHandle.getFirstSync<{ id: number }>(
      "SELECT id FROM exercises WHERE name = 'Correr'",
      []
    );
    if (correr) insertExerciseMuscleGroups(dbHandle, correr.id, ["cardio"]);
  }

  // v15: every exercise must carry a physical configuration (resistance curve,
  // load type, pulley type, laterality, range of motion). exercise_config is a
  // brand-new table (no rebuild needed, unlike v13/v14) — just backfill a
  // default-valued row for every exercise that doesn't have one yet. Runs every
  // launch, unconditionally (placed after the Correr seed above so a freshly
  // inserted Correr also gets a row), so it self-heals any exercise created
  // before this migration existed and is a no-op once every exercise has one.
  dbHandle.execSync(
    `INSERT INTO exercise_config (exercise_id)
     SELECT id FROM exercises
     WHERE id NOT IN (SELECT exercise_id FROM exercise_config)`
  );

  // v16: exercise config gains a bench angle (uses_bench + bench_angle_degrees,
  // in degrees — 0 flat, positive incline, negative decline). SQLite's ALTER
  // TABLE ADD COLUMN can't attach the CHECK constraints these need, so — same
  // as v14's counting_factor rebuild — adding them to an upgrading install
  // requires rebuilding both exercise_config and session_exercise_config
  // rather than `ensureColumn`. Gated on column absence ALONE, not
  // `currentVersion`, so it self-heals even if schema_version was already
  // bumped to >= 16 without the columns actually existing.
  if (!hasColumn(dbHandle, "exercise_config", "uses_bench")) {
    dbHandle.execSync("PRAGMA foreign_keys = OFF;");

    dbHandle.execSync(
      `CREATE TABLE exercise_config_new (
        exercise_id INTEGER PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
        resistance_curve TEXT NOT NULL DEFAULT 'descending'
          CHECK (resistance_curve IN ('ascending','descending','constant','bell')),
        load_type TEXT NOT NULL DEFAULT 'free'
          CHECK (load_type IN ('free','plate','pulley')),
        pulley_type TEXT CHECK (pulley_type IS NULL OR pulley_type IN ('mobile','fixed')),
        laterality TEXT NOT NULL DEFAULT 'bilateral'
          CHECK (laterality IN ('bilateral','unilateral')),
        rom TEXT NOT NULL DEFAULT 'full' CHECK (rom IN ('full','partial')),
        uses_bench INTEGER NOT NULL DEFAULT 0 CHECK (uses_bench IN (0, 1)),
        bench_angle_degrees REAL CHECK (bench_angle_degrees IS NULL OR bench_angle_degrees BETWEEN -90 AND 90)
      )`
    );
    // No existing row has a bench angle yet — every exercise simply inherits
    // uses_bench = 0 (no bench), left for the user to set per exercise.
    dbHandle.execSync(
      `INSERT INTO exercise_config_new (exercise_id, resistance_curve, load_type, pulley_type, laterality, rom)
       SELECT exercise_id, resistance_curve, load_type, pulley_type, laterality, rom FROM exercise_config`
    );
    dbHandle.execSync("DROP TABLE exercise_config;");
    dbHandle.execSync("ALTER TABLE exercise_config_new RENAME TO exercise_config;");

    dbHandle.execSync(
      `CREATE TABLE session_exercise_config_new (
        session_exercise_id INTEGER PRIMARY KEY REFERENCES session_exercises(id) ON DELETE CASCADE,
        resistance_curve TEXT CHECK (resistance_curve IS NULL OR resistance_curve IN ('ascending','descending','constant','bell')),
        load_type TEXT CHECK (load_type IS NULL OR load_type IN ('free','plate','pulley')),
        pulley_type TEXT CHECK (pulley_type IS NULL OR pulley_type IN ('mobile','fixed')),
        laterality TEXT CHECK (laterality IS NULL OR laterality IN ('bilateral','unilateral')),
        rom TEXT CHECK (rom IS NULL OR rom IN ('full','partial')),
        uses_bench INTEGER CHECK (uses_bench IS NULL OR uses_bench IN (0, 1)),
        bench_angle_degrees REAL CHECK (bench_angle_degrees IS NULL OR bench_angle_degrees BETWEEN -90 AND 90)
      )`
    );
    dbHandle.execSync(
      `INSERT INTO session_exercise_config_new (session_exercise_id, resistance_curve, load_type, pulley_type, laterality, rom)
       SELECT session_exercise_id, resistance_curve, load_type, pulley_type, laterality, rom FROM session_exercise_config`
    );
    dbHandle.execSync("DROP TABLE session_exercise_config;");
    dbHandle.execSync("ALTER TABLE session_exercise_config_new RENAME TO session_exercise_config;");

    // Scoped to these two tables — an unscoped `PRAGMA foreign_key_check` audits
    // every table in the database, so a dev DB with unrelated pre-existing
    // dangling references elsewhere must not make this rebuild abort.
    const benchViolations = ["exercise_config", "session_exercise_config"].flatMap((table) =>
      dbHandle.getAllSync<unknown>(`PRAGMA foreign_key_check(${table});`, [])
    );
    if (benchViolations.length > 0) {
      throw new Error(
        `Migration v16 bench-angle rebuild left ${benchViolations.length} dangling foreign key reference(s).`
      );
    }
    dbHandle.execSync("PRAGMA foreign_keys = ON;");
  }

  // v17: renamed the seed exercise "Tricep Dip" to "Dips". A pre-existing
  // install already seeded a row named "Tricep Dip" (the `currentVersion < 1`
  // seed loop above only ever fires once, on a brand-new database), so the
  // source-code rename in src/data/exercises.ts alone never reaches it —
  // rename it in place here. Skipped if a "Dips" row already exists (e.g. a
  // custom exercise the user made themselves), since `exercises.name` is
  // UNIQUE and the UPDATE would otherwise throw and abort every future launch.
  if (currentVersion < 17) {
    const dipsExists = dbHandle.getFirstSync<{ id: number }>(
      "SELECT id FROM exercises WHERE name = 'Dips'",
      []
    );
    if (!dipsExists) {
      dbHandle.runSync(
        "UPDATE exercises SET name = 'Dips' WHERE is_custom = 0 AND name = 'Tricep Dip'",
        []
      );
    }
  }

  if (currentVersion < SCHEMA_VERSION) {
    dbHandle.runSync(
      "INSERT OR REPLACE INTO user_meta (key, value) VALUES ('schema_version', ?)",
      [String(SCHEMA_VERSION)]
    );
  }
}
