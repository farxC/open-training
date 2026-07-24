export const SCHEMA_VERSION = 17;

export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    equipment TEXT NOT NULL,
    type TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    modality TEXT NOT NULL DEFAULT 'musculacao',
    uuid TEXT UNIQUE
  )`,

  `CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group TEXT NOT NULL,
    counting_factor REAL NOT NULL DEFAULT 1 CHECK (counting_factor IN (0.5, 1)),
    PRIMARY KEY (exercise_id, muscle_group)
  )`,

  // Default physical configuration of an exercise (resistance curve, load type,
  // pulley type, laterality, range of motion, bench angle). Every exercise must
  // have exactly one row — enforced by the migration backfill, not by
  // application code.
  `CREATE TABLE IF NOT EXISTS exercise_config (
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
    -- Degrees: 0 = flat, positive = incline, negative = decline. NULL when uses_bench = 0.
    bench_angle_degrees REAL CHECK (bench_angle_degrees IS NULL OR bench_angle_degrees BETWEEN -90 AND 90)
  )`,

  // Per-session-exercise override of exercise_config. Every column is nullable —
  // NULL means "inherit the exercise's default for this column". A row here is
  // optional (0..1 per session_exercise); no row at all means "no overrides".
  `CREATE TABLE IF NOT EXISTS session_exercise_config (
    session_exercise_id INTEGER PRIMARY KEY REFERENCES session_exercises(id) ON DELETE CASCADE,
    resistance_curve TEXT CHECK (resistance_curve IS NULL OR resistance_curve IN ('ascending','descending','constant','bell')),
    load_type TEXT CHECK (load_type IS NULL OR load_type IN ('free','plate','pulley')),
    pulley_type TEXT CHECK (pulley_type IS NULL OR pulley_type IN ('mobile','fixed')),
    laterality TEXT CHECK (laterality IS NULL OR laterality IN ('bilateral','unilateral')),
    rom TEXT CHECK (rom IS NULL OR rom IN ('full','partial')),
    uses_bench INTEGER CHECK (uses_bench IS NULL OR uses_bench IN (0, 1)),
    bench_angle_degrees REAL CHECK (bench_angle_degrees IS NULL OR bench_angle_degrees BETWEEN -90 AND 90)
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
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
  )`,

  `CREATE TABLE IF NOT EXISTS session_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    uri TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS session_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    "order" INTEGER NOT NULL DEFAULT 0,
    UNIQUE(session_id, exercise_id)
  )`,

  `CREATE TABLE IF NOT EXISTS sets (
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
  )`,

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

  `CREATE TABLE IF NOT EXISTS routine_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    split_id INTEGER NOT NULL REFERENCES routine_splits(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    label TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS routine_unit_exercises (
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
  )`,

  `CREATE TABLE IF NOT EXISTS routine_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

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

  `CREATE TABLE IF NOT EXISTS program_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    label TEXT,
    UNIQUE(program_id, week_number)
  )`,

  `CREATE TABLE IF NOT EXISTS program_entries (
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
  )`,
];
