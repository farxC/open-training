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
