import { db } from "./client";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema";
import { SEED_EXERCISES, SEED_RUNNING_EXERCISES } from "../data/exercises";
import { todayISO } from "../utils/cycle";

function hasColumn(table: string, column: string): boolean {
  const rows = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

/** Idempotent ADD COLUMN — safe on both web and native, unlike a swallowed ALTER. */
function ensureColumn(table: string, column: string, decl: string): void {
  if (!hasColumn(table, column)) {
    db.runSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

export function runMigrations(): void {
  db.execSync("PRAGMA foreign_keys = ON;");
  db.execSync("PRAGMA journal_mode = WAL;");

  for (const sql of CREATE_TABLES) {
    db.execSync(sql);
  }

  // Self-healing column checks — run EVERY launch, idempotent. Version gating alone
  // can't recover a DB whose schema_version was bumped before a column was actually
  // added (e.g. a dev hot-reload running migrations mid-edit). PRAGMA + ALTER fixes it.
  ensureColumn("sets", "rir", "INTEGER");
  ensureColumn("exercises", "modality", "TEXT NOT NULL DEFAULT 'musculacao'");
  ensureColumn("routine_splits", "modality", "TEXT NOT NULL DEFAULT 'musculacao'");
  ensureColumn("routine_unit_exercises", "target_distance_km", "REAL");
  ensureColumn("routine_unit_exercises", "target_duration_min", "REAL");
  ensureColumn("routine_unit_exercises", "run_type", "TEXT");
  ensureColumn("routine_unit_exercises", "target_pace_sec", "INTEGER");
  ensureColumn("routine_unit_exercises", "interval_reps", "INTEGER");
  ensureColumn("routine_unit_exercises", "interval_work_sec", "INTEGER");
  ensureColumn("routine_unit_exercises", "interval_work_km", "REAL");
  ensureColumn("routine_unit_exercises", "interval_rest_sec", "INTEGER");
  ensureColumn("routine_unit_exercises", "target_reps_max", "INTEGER");
  ensureColumn("training_programs", "setup_week_number", "INTEGER");
  ensureColumn("training_programs", "started_at", "TEXT");

  // Backfill: programs already active before this column existed have no anchor for
  // "which week are we in" — start counting from today rather than showing nothing.
  db.runSync(
    "UPDATE training_programs SET started_at = ? WHERE is_active = 1 AND started_at IS NULL",
    [todayISO()]
  );

  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM user_meta WHERE key = 'schema_version'"
  );
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  if (currentVersion < 1) {
    const stmt = db.prepareSync(
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
    db.execSync("DROP TABLE IF EXISTS routine_exercises;");
    db.execSync("DROP TABLE IF EXISTS routine_days;");
  }

  if (currentVersion < 4) {
    // Generalized the single cycle into multi-split. The v3 tables were unused; drop them.
    db.execSync("DROP TABLE IF EXISTS routine_slot_exercises;");
    db.execSync("DROP TABLE IF EXISTS routine_slots;");
    db.execSync("DELETE FROM user_meta WHERE key = 'routine_cycle_anchor';");
  }

  // Ensure the running seed exists for DBs created before the modality migration.
  db.runSync(
    "INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, type, is_custom, modality) VALUES ('Correr', 'cardio', 'bodyweight', 'compound', 0, 'corrida')"
  );

  if (currentVersion < SCHEMA_VERSION) {
    db.runSync(
      "INSERT OR REPLACE INTO user_meta (key, value) VALUES ('schema_version', ?)",
      [String(SCHEMA_VERSION)]
    );
  }
}
