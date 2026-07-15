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
