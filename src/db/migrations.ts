import { db } from "./client";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema";
import { SEED_DISTANCE_EXERCISES, SEED_EXERCISES } from "../data/exercises";
import { modalitiesOfCategory } from "../data/modalities";
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

  // Same recovery, for an interrupted session_exercise_config rebuild (v16, and
  // again in v18 when the table turned from sparse override into full snapshot).
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
      // uuid is generated inline, not left to the backfill above: that already ran
      // for this launch, so a seed inserted now would sit uuid-less until the next
      // one — and export/import merges by uuid.
      dbHandle.runSync(
        `INSERT OR IGNORE INTO exercises (name, equipment, type, is_custom, modality, uuid)
         VALUES (?, ?, ?, ?, ?, lower(hex(randomblob(16))))`,
        [ex.name, ex.equipment, ex.type, ex.is_custom, modality]
      );
      const inserted = dbHandle.getFirstSync<{ id: number }>(
        "SELECT id FROM exercises WHERE name = ?",
        [ex.name]
      );
      if (inserted) insertExerciseMuscleGroups(dbHandle, inserted.id, ex.muscle_groups);
    };
    for (const ex of SEED_EXERCISES) insertSeed(ex, "musculacao");
    for (const { modality, exercise } of SEED_DISTANCE_EXERCISES) insertSeed(exercise, modality);
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
  // Gated on column absence ALONE, not `currentVersion` — same reasoning as v14/v16
  // below: a stale `schema_version` (bumped to >= 13 without this rebuild actually
  // having run) must never be able to permanently skip it.
  if (hasColumn(dbHandle, "exercises", "muscle_group")) {
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
      ...SEED_DISTANCE_EXERCISES.map(({ exercise }) => [exercise.name, exercise.muscle_groups] as const),
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
    dbHandle.execSync("PRAGMA foreign_keys = ON;");
  }

  // Self-healing cleanup for exercise_id references left dangling by an
  // interrupted or partially-persisted transaction (observed on the web
  // driver — see feedback_web_sqlite_transaction_persist_bug) — a session
  // insert can survive uncommitted while its child rows persist, or vice
  // versa. Runs every launch, unconditionally, so accumulated debt never
  // permanently blocks the v13 rebuild's FK verification again. Confirmed
  // via the actual data (Rafael's live sessions feed) that every previously
  // surfaced violation pointed at a session that no longer exists — safe to
  // delete rather than merely report.
  {
    const exerciseReferencingTables = [
      "exercise_muscle_groups",
      "session_exercises",
      "sets",
      "routine_unit_exercises",
      "program_entries",
    ];
    for (const table of exerciseReferencingTables) {
      const result = dbHandle.runSync(
        `DELETE FROM ${table} WHERE exercise_id NOT IN (SELECT id FROM exercises)`,
        []
      );
      if (result.changes > 0) {
        console.warn(`[migrations] removed ${result.changes} dangling row(s) from ${table}`);
      }
    }
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

  // Ensure every distance modality's auto-provisioned exercise exists. Runs
  // unconditionally and is idempotent (INSERT OR IGNORE on a UNIQUE name), which
  // is what backfills DBs created before a given modality existed — this is how
  // ciclismo/natação/caminhada reach installs that were seeded when only corrida
  // was around, with no schema_version bump needed. Always targets the current
  // (post-v13, no muscle_group column) shape.
  for (const { modality, exercise } of SEED_DISTANCE_EXERCISES) {
    dbHandle.runSync(
      `INSERT OR IGNORE INTO exercises (name, equipment, type, is_custom, modality, uuid)
       VALUES (?, ?, ?, ?, ?, lower(hex(randomblob(16))))`,
      [exercise.name, exercise.equipment, exercise.type, exercise.is_custom, modality]
    );
    const inserted = dbHandle.getFirstSync<{ id: number }>(
      "SELECT id FROM exercises WHERE name = ?",
      [exercise.name]
    );
    if (inserted) insertExerciseMuscleGroups(dbHandle, inserted.id, exercise.muscle_groups);
  }

  // Muscle-group breakdown is a strength-training concept: "1 série de cardio"
  // says nothing about a swim. Endurance exercises used to be seeded with a
  // `cardio` group, which made the per-group series card show up on endurance
  // sessions — strip those rows.
  //
  // Unconditional and idempotent rather than gated on `currentVersion`, same as
  // the seed loop above: besides reaching installs seeded earlier, it also
  // self-heals after importing an older export that still carries the rows.
  // No schema_version bump — the DDL and the export format are unchanged, and a
  // bump would imply a version gate this block deliberately doesn't have.
  //
  // Scoped by the exercise's own modality, so `cardio` survives where it still
  // means something: the musculação seeds Treadmill Run, Rowing Machine,
  // Stationary Bike, Jump Rope and Stair Master.
  const enduranceKeys = modalitiesOfCategory("endurance").map((m) => m.key);
  if (enduranceKeys.length > 0) {
    dbHandle.runSync(
      `DELETE FROM exercise_muscle_groups
       WHERE exercise_id IN (
         SELECT id FROM exercises WHERE modality IN (${enduranceKeys.map(() => "?").join(",")})
       )`,
      enduranceKeys
    );
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

  // v18: four new config dimensions (grip type and width, bodyweight usage and
  // how to read the logged load) plus a soft-delete flag on exercises. SQLite's
  // ADD COLUMN does accept CHECK constraints — the real restrictions are
  // UNIQUE/PRIMARY KEY and NOT NULL without a default — so unlike the v14/v16
  // columns these need no table rebuild.
  //
  // Placed AFTER the v13/v16 rebuilds rather than up with the other
  // ensureColumn calls: those rebuilds recreate `exercises` and
  // `exercise_config` from a frozen DDL, which would silently drop any column
  // added before them.
  ensureColumn(dbHandle, "exercises", "is_archived", "INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))");
  ensureColumn(
    dbHandle,
    "exercise_config",
    "grip_type",
    "TEXT CHECK (grip_type IS NULL OR grip_type IN ('pronated','supinated','neutral','mixed'))"
  );
  ensureColumn(
    dbHandle,
    "exercise_config",
    "grip_width",
    "TEXT CHECK (grip_width IS NULL OR grip_width IN ('close','medium','wide'))"
  );
  ensureColumn(
    dbHandle,
    "exercise_config",
    "uses_bodyweight",
    "INTEGER NOT NULL DEFAULT 0 CHECK (uses_bodyweight IN (0, 1))"
  );
  ensureColumn(
    dbHandle,
    "exercise_config",
    "load_mode",
    "TEXT CHECK (load_mode IS NULL OR load_mode IN ('total','added','assisted'))"
  );

  // v18: session_exercise_config stops being a sparse override of the exercise's
  // current default and becomes a full snapshot taken when the exercise enters
  // the session — every column concrete and NOT NULL, exactly one row per
  // session_exercise. That flips the whole model from resolve-on-read to
  // freeze-on-write: editing an exercise's default no longer rewrites how
  // already-recorded sessions read.
  //
  // Nullable -> NOT NULL can't be expressed with ALTER TABLE, so this one does
  // need a rebuild. Gated on column absence alone (never on schema_version), so
  // it self-heals an install whose version was bumped without the rebuild
  // actually landing. On a fresh database CREATE_TABLES already made the new
  // shape, so grip_type is present and this block is skipped.
  if (!hasColumn(dbHandle, "session_exercise_config", "grip_type")) {
    dbHandle.execSync("PRAGMA foreign_keys = OFF;");

    dbHandle.execSync(
      `CREATE TABLE session_exercise_config_new (
        session_exercise_id INTEGER PRIMARY KEY REFERENCES session_exercises(id) ON DELETE CASCADE,
        resistance_curve TEXT NOT NULL DEFAULT 'descending'
          CHECK (resistance_curve IN ('ascending','descending','constant','bell')),
        load_type TEXT NOT NULL DEFAULT 'free'
          CHECK (load_type IN ('free','plate','pulley')),
        pulley_type TEXT CHECK (pulley_type IS NULL OR pulley_type IN ('mobile','fixed')),
        laterality TEXT NOT NULL DEFAULT 'bilateral'
          CHECK (laterality IN ('bilateral','unilateral')),
        rom TEXT NOT NULL DEFAULT 'full' CHECK (rom IN ('full','partial')),
        uses_bench INTEGER NOT NULL DEFAULT 0 CHECK (uses_bench IN (0, 1)),
        bench_angle_degrees REAL CHECK (bench_angle_degrees IS NULL OR bench_angle_degrees BETWEEN -90 AND 90),
        grip_type TEXT CHECK (grip_type IS NULL OR grip_type IN ('pronated','supinated','neutral','mixed')),
        grip_width TEXT CHECK (grip_width IS NULL OR grip_width IN ('close','medium','wide')),
        uses_bodyweight INTEGER NOT NULL DEFAULT 0 CHECK (uses_bodyweight IN (0, 1)),
        load_mode TEXT CHECK (load_mode IS NULL OR load_mode IN ('total','added','assisted'))
      )`
    );
    // Materialise exactly what the app renders TODAY — COALESCE(override,
    // exercise default, app default), the same expression getSessionExercises
    // used to evaluate on every read — so the upgrade is visually a no-op.
    // The pulley/bench CASEs only null out values the UI already hides (it
    // shows pulley_type solely when load_type is 'pulley', and the bench angle
    // solely when uses_bench is 1), keeping the new table's invariants clean.
    // Inner-joining session_exercises drops override rows whose session
    // exercise is already gone, instead of carrying dangling ids across.
    dbHandle.execSync(
      `INSERT INTO session_exercise_config_new
         (session_exercise_id, resistance_curve, load_type, pulley_type, laterality, rom, uses_bench, bench_angle_degrees)
       SELECT sec.session_exercise_id,
              COALESCE(sec.resistance_curve, ec.resistance_curve, 'descending'),
              COALESCE(sec.load_type, ec.load_type, 'free'),
              CASE WHEN COALESCE(sec.load_type, ec.load_type, 'free') = 'pulley'
                   THEN COALESCE(sec.pulley_type, ec.pulley_type) END,
              COALESCE(sec.laterality, ec.laterality, 'bilateral'),
              COALESCE(sec.rom, ec.rom, 'full'),
              COALESCE(sec.uses_bench, ec.uses_bench, 0),
              CASE WHEN COALESCE(sec.uses_bench, ec.uses_bench, 0) = 1
                   THEN COALESCE(sec.bench_angle_degrees, ec.bench_angle_degrees) END
       FROM session_exercise_config sec
       JOIN session_exercises se ON se.id = sec.session_exercise_id
       LEFT JOIN exercise_config ec ON ec.exercise_id = se.exercise_id`
    );
    dbHandle.execSync("DROP TABLE session_exercise_config;");
    dbHandle.execSync("ALTER TABLE session_exercise_config_new RENAME TO session_exercise_config;");

    // Scoped to the rebuilt table — an unscoped `PRAGMA foreign_key_check`
    // audits every table, so unrelated pre-existing dangling references
    // elsewhere in a dev DB must not abort this rebuild.
    const snapshotViolations = dbHandle.getAllSync<unknown>(
      "PRAGMA foreign_key_check(session_exercise_config);",
      []
    );
    if (snapshotViolations.length > 0) {
      throw new Error(
        `Migration v18 config-snapshot rebuild left ${snapshotViolations.length} dangling foreign key reference(s).`
      );
    }
    dbHandle.execSync("PRAGMA foreign_keys = ON;");
  }

  // v18 backfill, part 2: every session_exercise needs a config snapshot, not
  // just the ones that happened to carry an override before. Seeded from the
  // exercise's current default — the best available reconstruction of what was
  // in effect back then. Unconditional and idempotent (same self-healing shape
  // as v15's exercise_config backfill), so a session_exercise created by a
  // build that predates the snapshot writer still gets one on the next launch.
  dbHandle.execSync(
    `INSERT INTO session_exercise_config
       (session_exercise_id, resistance_curve, load_type, pulley_type, laterality, rom, uses_bench,
        bench_angle_degrees, grip_type, grip_width, uses_bodyweight, load_mode)
     SELECT se.id,
            COALESCE(ec.resistance_curve, 'descending'),
            COALESCE(ec.load_type, 'free'),
            ec.pulley_type,
            COALESCE(ec.laterality, 'bilateral'),
            COALESCE(ec.rom, 'full'),
            COALESCE(ec.uses_bench, 0),
            ec.bench_angle_degrees,
            ec.grip_type,
            ec.grip_width,
            COALESCE(ec.uses_bodyweight, 0),
            ec.load_mode
     FROM session_exercises se
     LEFT JOIN exercise_config ec ON ec.exercise_id = se.exercise_id
     WHERE se.id NOT IN (SELECT session_exercise_id FROM session_exercise_config)`
  );

  // v18 backfill, part 3: the muscle-group half of the same snapshot, so
  // re-weighting a counting_factor stops moving the series-volume of weeks
  // already trained. Guarded on "this session_exercise has NO snapshot rows
  // yet" rather than on each (session_exercise, muscle_group) pair: a plain
  // INSERT OR IGNORE would keep re-adding a group the user has since removed
  // from the exercise.
  dbHandle.execSync(
    `INSERT INTO session_exercise_muscle_groups (session_exercise_id, muscle_group, counting_factor)
     SELECT se.id, emg.muscle_group, emg.counting_factor
     FROM session_exercises se
     JOIN exercise_muscle_groups emg ON emg.exercise_id = se.exercise_id
     WHERE NOT EXISTS (
       SELECT 1 FROM session_exercise_muscle_groups sm WHERE sm.session_exercise_id = se.id
     )`
  );

  if (currentVersion < SCHEMA_VERSION) {
    dbHandle.runSync(
      "INSERT OR REPLACE INTO user_meta (key, value) VALUES ('schema_version', ?)",
      [String(SCHEMA_VERSION)]
    );
  }
}
