export const SCHEMA_VERSION = 19;

export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    equipment TEXT NOT NULL,
    type TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    modality TEXT NOT NULL DEFAULT 'musculacao',
    uuid TEXT UNIQUE,
    -- Soft-delete. sets/session_exercises reference exercises(id) without
    -- cascade, so a real DELETE would strand history; archiving hides the
    -- exercise from pickers while leaving every logged set readable.
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    -- NULL for a root exercise. When set, this row is a grip/angle/equipment
    -- variation of the parent — its own independent config, muscle groups,
    -- sets, and history, per docs/superpowers/specs/2026-08-11-exercise-variations-design.md.
    parent_exercise_id INTEGER REFERENCES exercises(id),
    is_default_variation INTEGER NOT NULL DEFAULT 0 CHECK (is_default_variation IN (0, 1))
  )`,

  `CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group TEXT NOT NULL,
    counting_factor REAL NOT NULL DEFAULT 1 CHECK (counting_factor IN (0.5, 1)),
    PRIMARY KEY (exercise_id, muscle_group)
  )`,

  // Default physical configuration of an exercise (resistance curve, load type,
  // pulley type, laterality, range of motion, bench angle, grip, bodyweight).
  // Every exercise must have exactly one row — enforced by the migration
  // backfill, not by application code. This is the CURRENT default: it seeds
  // the snapshot taken every time the exercise is added to a session, and
  // editing it does not reach back into sessions already recorded.
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
    bench_angle_degrees REAL CHECK (bench_angle_degrees IS NULL OR bench_angle_degrees BETWEEN -90 AND 90),
    -- NULL grip means "doesn't apply" (leg press, squat) rather than "unset".
    grip_type TEXT CHECK (grip_type IS NULL OR grip_type IN ('pronated','supinated','neutral','mixed')),
    grip_width TEXT CHECK (grip_width IS NULL OR grip_width IN ('close','medium','wide')),
    uses_bodyweight INTEGER NOT NULL DEFAULT 0 CHECK (uses_bodyweight IN (0, 1)),
    -- How to read the logged load. NULL when uses_bodyweight = 0.
    load_mode TEXT CHECK (load_mode IS NULL OR load_mode IN ('total','added','assisted'))
  )`,

  // Per-session-exercise SNAPSHOT of exercise_config, taken when the exercise is
  // added to the session. Exactly one row per session_exercise, never zero, and
  // every column carries a concrete value — this table is the source of truth
  // for how a recorded session reads, so later edits to the exercise's default
  // leave it alone. Same columns and constraints as exercise_config.
  `CREATE TABLE IF NOT EXISTS session_exercise_config (
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
  )`,

  // Snapshot of exercise_muscle_groups, same idea and same lifetime as
  // session_exercise_config: re-weighting a muscle group (counting_factor) or
  // adding one to an exercise must not retroactively move the series-volume
  // numbers of weeks already trained. Analytics reads series from here.
  `CREATE TABLE IF NOT EXISTS session_exercise_muscle_groups (
    session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
    muscle_group TEXT NOT NULL,
    counting_factor REAL NOT NULL DEFAULT 1 CHECK (counting_factor IN (0.5, 1)),
    PRIMARY KEY (session_exercise_id, muscle_group)
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

// Not part of CREATE_TABLES because indexes are created/guarded separately in
// runMigrations (see idx_one_default_variation_per_parent) — kept here as the
// canonical DDL a fresh install and the migration guard both point at.
export const CREATE_INDEXES: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_variation_per_parent
     ON exercises(parent_exercise_id) WHERE is_default_variation = 1`,
];
