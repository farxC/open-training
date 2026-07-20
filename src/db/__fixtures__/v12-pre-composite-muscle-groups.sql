-- Frozen snapshot: schema_version 12 (last version with the scalar muscle_group
-- column on exercises, before the exercise_muscle_groups many-to-many rebuild).
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

-- Exercise 1 matches a current curated seed name exactly (is_custom = 0) — the
-- migration's re-curation pass should replace its single legacy value with the
-- curated ["chest", "triceps", "shoulders"] set. Exercise 2 is user-created
-- (is_custom = 1) and its name matches no seed, so it must keep only its single
-- backfilled legacy value. Exercise 3 matches the running seed name exactly.
INSERT INTO exercises (id, name, muscle_group, equipment, type, is_custom, modality, uuid) VALUES
  (1, 'Barbell Bench Press', 'chest', 'barbell', 'compound', 0, 'musculacao', 'fixed-uuid-ex-1'),
  (2, 'Rosca concentrada customizada', 'biceps', 'dumbbell', 'isolation', 1, 'musculacao', 'fixed-uuid-ex-2'),
  (3, 'Correr', 'cardio', 'bodyweight', 'compound', 0, 'corrida', 'fixed-uuid-ex-3');

INSERT INTO sessions (id, date, name, notes, duration_seconds, start_time, end_time, photo_uri, modality, split_id, unit_id, program_week_id, uuid) VALUES
  (1, '2026-02-10', NULL, NULL, 3600, '2026-02-10T10:00:00.000Z', '2026-02-10T11:00:00.000Z', NULL, 'musculacao', NULL, NULL, NULL, 'fixed-uuid-session-1');

INSERT INTO sets (id, session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec, failure) VALUES
  (1, 1, 1, 1, 10, 60, 8, 2, NULL, NULL, NULL, NULL, 0),
  (2, 1, 2, 1, 12, 15, NULL, NULL, NULL, NULL, NULL, NULL, 0);

INSERT INTO user_meta (key, value) VALUES ('schema_version', '12');
