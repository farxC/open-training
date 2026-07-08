import { db } from "./client";
import { todayISO } from "../utils/cycle";
import type {
  Exercise,
  MuscleGroup,
  Modality,
  Session,
  SessionSummary,
  SessionWithSets,
  WorkoutSet,
  SplitMode,
  RoutineSplit,
  RoutineUnit,
  RoutineUnitExercise,
  OverrideStatus,
  RoutineOverride,
  TrainingProgram,
  ProgramWeek,
  ProgramEntry,
} from "../types";

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSessions(): SessionSummary[] {
  const rows = db.getAllSync<{
    id: number;
    date: string;
    notes: string | null;
    duration_seconds: number | null;
    photo_uri: string | null;
    total_volume: number | null;
    exercise_names_raw: string | null;
  }>(
    `SELECT
      s.id, s.date, s.notes, s.duration_seconds, s.photo_uri,
      SUM(st.reps * st.weight_kg) AS total_volume,
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

export function getSessionById(id: number): Session | null {
  return db.getFirstSync<Session>(
    "SELECT id, date, notes, duration_seconds, photo_uri FROM sessions WHERE id = ?",
    [id]
  );
}

export function getSessionWithSets(id: number): SessionWithSets | null {
  const session = getSessionById(id);
  if (!session) return null;

  const sets = db.getAllSync<WorkoutSet & { exercise_name: string }>(
    `SELECT st.*, e.name AS exercise_name
     FROM sets st
     JOIN exercises e ON e.id = st.exercise_id
     WHERE st.session_id = ?
     ORDER BY st.exercise_id, st.set_number`,
    [id]
  );

  return { ...session, sets };
}

export function createSession(date: string): number {
  const result = db.runSync(
    "INSERT INTO sessions (date) VALUES (?)",
    [date]
  );
  return result.lastInsertRowId;
}

export function updateSession(
  id: number,
  patch: Partial<Pick<Session, "notes" | "duration_seconds" | "photo_uri">>
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => patch[f] ?? null);
  db.runSync(`UPDATE sessions SET ${setClauses} WHERE id = ?`, [...values, id]);
}

export function deleteSession(id: number): void {
  db.runSync("DELETE FROM sessions WHERE id = ?", [id]);
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

export function getSetsBySession(sessionId: number): WorkoutSet[] {
  return db.getAllSync<WorkoutSet>(
    "SELECT * FROM sets WHERE session_id = ? ORDER BY exercise_id, set_number",
    [sessionId]
  );
}

export function addSet(set: Omit<WorkoutSet, "id">): number {
  const result = db.runSync(
    `INSERT INTO sets (session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      set.session_id,
      set.exercise_id,
      set.set_number,
      set.reps,
      set.weight_kg,
      set.rpe ?? null,
      set.rir ?? null,
      set.notes ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export function updateSet(
  id: number,
  patch: Partial<Omit<WorkoutSet, "id" | "session_id">>
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => patch[f] ?? null);
  db.runSync(`UPDATE sets SET ${setClauses} WHERE id = ?`, [...values, id]);
}

export function deleteSet(id: number): void {
  db.runSync("DELETE FROM sets WHERE id = ?", [id]);
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export function getExercises(filter?: {
  muscle_group?: MuscleGroup;
  is_custom?: boolean;
  modality?: Modality;
}): Exercise[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter?.muscle_group) {
    conditions.push("muscle_group = ?");
    params.push(filter.muscle_group);
  }
  if (filter?.is_custom !== undefined) {
    conditions.push("is_custom = ?");
    params.push(filter.is_custom ? 1 : 0);
  }
  if (filter?.modality) {
    conditions.push("modality = ?");
    params.push(filter.modality);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.getAllSync<Exercise>(
    `SELECT * FROM exercises ${where} ORDER BY name`,
    params
  );
}

export function createExercise(ex: Omit<Exercise, "id">): number {
  const result = db.runSync(
    "INSERT INTO exercises (name, muscle_group, equipment, type, is_custom, modality) VALUES (?, ?, ?, ?, ?, ?)",
    [ex.name, ex.muscle_group, ex.equipment, ex.type, 1, ex.modality]
  );
  return result.lastInsertRowId;
}

export function getExerciseSets(exerciseId: number): (WorkoutSet & { date: string })[] {
  return db.getAllSync<WorkoutSet & { date: string }>(
    `SELECT st.*, s.date
     FROM sets st
     JOIN sessions s ON s.id = st.session_id
     WHERE st.exercise_id = ?
     ORDER BY s.date ASC, st.set_number ASC`,
    [exerciseId]
  );
}

// ─── Routine (multi-split) ──────────────────────────────────────────────────

interface SplitRow {
  id: number;
  name: string;
  mode: string;
  modality: string;
  anchor_date: string | null;
  rest_weekdays: string;
  order: number;
}

function parseRest(csv: string): number[] {
  return csv ? csv.split(",").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n)) : [];
}

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
  }));
}

export function createSplit(s: { name: string; mode: SplitMode; modality: Modality }): number {
  const count = db.getAllSync<{ id: number }>("SELECT id FROM routine_splits").length;
  const result = db.runSync(
    `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order") VALUES (?, ?, ?, NULL, '', ?)`,
    [s.name, s.mode, s.modality, count]
  );
  return result.lastInsertRowId;
}

export function updateSplit(
  id: number,
  patch: { name?: string; anchor_date?: string | null; rest_weekdays?: number[]; order?: number }
): void {
  if (patch.name !== undefined) db.runSync("UPDATE routine_splits SET name = ? WHERE id = ?", [patch.name, id]);
  if (patch.anchor_date !== undefined) db.runSync("UPDATE routine_splits SET anchor_date = ? WHERE id = ?", [patch.anchor_date, id]);
  if (patch.rest_weekdays !== undefined) db.runSync("UPDATE routine_splits SET rest_weekdays = ? WHERE id = ?", [patch.rest_weekdays.join(","), id]);
  if (patch.order !== undefined) db.runSync(`UPDATE routine_splits SET "order" = ? WHERE id = ?`, [patch.order, id]);
}

export function deleteSplit(id: number): void {
  db.runSync("DELETE FROM routine_splits WHERE id = ?", [id]);
  const rows = db.getAllSync<{ id: number }>(`SELECT id FROM routine_splits ORDER BY "order"`);
  rows.forEach((row, i) => db.runSync(`UPDATE routine_splits SET "order" = ? WHERE id = ?`, [i, row.id]));
}

export function moveSplit(id: number, direction: "up" | "down"): void {
  const rows = db.getAllSync<{ id: number; order: number }>(`SELECT id, "order" FROM routine_splits ORDER BY "order"`);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= rows.length) return;
  db.runSync(`UPDATE routine_splits SET "order" = ? WHERE id = ?`, [rows[swap].order, rows[idx].id]);
  db.runSync(`UPDATE routine_splits SET "order" = ? WHERE id = ?`, [rows[idx].order, rows[swap].id]);
}

export function getUnits(splitId: number): RoutineUnit[] {
  return db.getAllSync<RoutineUnit>(
    "SELECT * FROM routine_units WHERE split_id = ? ORDER BY ordinal",
    [splitId]
  );
}

export function createUnit(u: { split_id: number; ordinal: number; label: string }): number {
  const result = db.runSync(
    "INSERT INTO routine_units (split_id, ordinal, label) VALUES (?, ?, ?)",
    [u.split_id, u.ordinal, u.label]
  );
  return result.lastInsertRowId;
}

export function updateUnitLabel(id: number, label: string): void {
  db.runSync("UPDATE routine_units SET label = ? WHERE id = ?", [label, id]);
}

export function deleteUnit(id: number): void {
  const unit = db.getFirstSync<{ split_id: number }>("SELECT split_id FROM routine_units WHERE id = ?", [id]);
  db.runSync("DELETE FROM routine_units WHERE id = ?", [id]);
  if (!unit) return;
  // Repack ordinals for cyclic splits only; for weekly splits ordinal is a weekday and must NOT be repacked.
  const split = db.getFirstSync<{ mode: string }>("SELECT mode FROM routine_splits WHERE id = ?", [unit.split_id]);
  if (split?.mode === "cyclic") {
    const rows = db.getAllSync<{ id: number }>("SELECT id FROM routine_units WHERE split_id = ? ORDER BY ordinal", [unit.split_id]);
    rows.forEach((row, i) => db.runSync("UPDATE routine_units SET ordinal = ? WHERE id = ?", [i, row.id]));
  }
}

export function moveUnit(id: number, direction: "up" | "down"): void {
  const unit = db.getFirstSync<{ split_id: number }>("SELECT split_id FROM routine_units WHERE id = ?", [id]);
  if (!unit) return;
  const rows = db.getAllSync<{ id: number; ordinal: number }>("SELECT id, ordinal FROM routine_units WHERE split_id = ? ORDER BY ordinal", [unit.split_id]);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= rows.length) return;
  db.runSync("UPDATE routine_units SET ordinal = ? WHERE id = ?", [rows[swap].ordinal, rows[idx].id]);
  db.runSync("UPDATE routine_units SET ordinal = ? WHERE id = ?", [rows[idx].ordinal, rows[swap].id]);
}

export function getUnitExercises(unitId: number): RoutineUnitExercise[] {
  return db.getAllSync<RoutineUnitExercise>(
    `SELECT re.*, e.name AS exercise_name, e.muscle_group
     FROM routine_unit_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     WHERE re.unit_id = ?
     ORDER BY re."order"`,
    [unitId]
  );
}

export function addUnitExercise(
  re: Omit<RoutineUnitExercise, "id" | "exercise_name" | "muscle_group">
): number {
  const result = db.runSync(
    `INSERT INTO routine_unit_exercises
       (unit_id, exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg,
        target_distance_km, target_duration_min, run_type, target_pace_sec,
        interval_reps, interval_work_sec, interval_work_km, interval_rest_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      re.unit_id,
      re.exercise_id,
      re.order,
      re.target_sets,
      re.target_reps,
      re.target_reps_max ?? null,
      re.target_weight_kg ?? null,
      re.target_distance_km ?? null,
      re.target_duration_min ?? null,
      re.run_type ?? null,
      re.target_pace_sec ?? null,
      re.interval_reps ?? null,
      re.interval_work_sec ?? null,
      re.interval_work_km ?? null,
      re.interval_rest_sec ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export function updateUnitExerciseTargets(
  id: number,
  patch: {
    target_sets?: number;
    target_reps?: number;
    target_reps_max?: number | null;
    target_weight_kg?: number | null;
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    run_type?: "continuous" | "interval" | null;
    target_pace_sec?: number | null;
    interval_reps?: number | null;
    interval_work_sec?: number | null;
    interval_work_km?: number | null;
    interval_rest_sec?: number | null;
  }
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => patch[f] ?? null);
  db.runSync(`UPDATE routine_unit_exercises SET ${setClause} WHERE id = ?`, [...values, id]);
}

export function removeUnitExercise(id: number): void {
  db.runSync("DELETE FROM routine_unit_exercises WHERE id = ?", [id]);
}

export function getOverridesInRange(startISO: string, endISO: string): RoutineOverride[] {
  return db.getAllSync<RoutineOverride>(
    "SELECT * FROM routine_overrides WHERE date >= ? AND date <= ? ORDER BY date",
    [startISO, endISO]
  );
}

export function setOverride(date: string, status: OverrideStatus): void {
  db.runSync(
    "INSERT INTO routine_overrides (date, status) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET status = excluded.status",
    [date, status]
  );
}

export function clearOverride(date: string): void {
  db.runSync("DELETE FROM routine_overrides WHERE date = ?", [date]);
}

// ─── Training programs (weekly progression) ───────────────────────────────────

interface TrainingProgramRow {
  id: number;
  split_id: number;
  name: string;
  total_weeks: number;
  is_active: number;
  order: number;
  setup_week_number: number | null;
  started_at: string | null;
}

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
  };
}

export function getProgramsForSplit(splitId: number): TrainingProgram[] {
  const rows = db.getAllSync<TrainingProgramRow>(
    `SELECT * FROM training_programs WHERE split_id = ? ORDER BY "order"`,
    [splitId]
  );
  return rows.map(mapProgram);
}

export function getProgram(id: number): TrainingProgram | null {
  const row = db.getFirstSync<TrainingProgramRow>("SELECT * FROM training_programs WHERE id = ?", [id]);
  return row ? mapProgram(row) : null;
}

export function createProgram(p: { split_id: number; name: string; total_weeks: number }): number {
  const count = db.getAllSync<{ id: number }>(
    "SELECT id FROM training_programs WHERE split_id = ?",
    [p.split_id]
  ).length;
  const result = db.runSync(
    `INSERT INTO training_programs (split_id, name, total_weeks, is_active, "order") VALUES (?, ?, ?, 0, ?)`,
    [p.split_id, p.name, p.total_weeks, count]
  );
  return result.lastInsertRowId;
}

export function updateProgram(id: number, patch: { name?: string; total_weeks?: number }): void {
  if (patch.name !== undefined) db.runSync("UPDATE training_programs SET name = ? WHERE id = ?", [patch.name, id]);
  if (patch.total_weeks !== undefined) db.runSync("UPDATE training_programs SET total_weeks = ? WHERE id = ?", [patch.total_weeks, id]);
}

/** Tracks where the week-mapping wizard left off; null marks it finished (or never started). */
export function updateProgramSetupProgress(id: number, weekNumber: number | null): void {
  db.runSync("UPDATE training_programs SET setup_week_number = ? WHERE id = ?", [weekNumber, id]);
}

export function deleteProgram(id: number): void {
  const program = db.getFirstSync<{ split_id: number }>(
    "SELECT split_id FROM training_programs WHERE id = ?",
    [id]
  );
  if (program) {
    const split = db.getFirstSync<{ modality: string }>(
      "SELECT modality FROM routine_splits WHERE id = ?",
      [program.split_id]
    );
    const siblingCount = db.getAllSync<{ id: number }>(
      "SELECT id FROM training_programs WHERE split_id = ?",
      [program.split_id]
    ).length;
    if (split?.modality === "corrida" && siblingCount <= 1) {
      throw new Error("CORRIDA_REQUIRES_PROGRAM");
    }
  }
  db.runSync("DELETE FROM training_programs WHERE id = ?", [id]);
}

export function setActiveProgram(splitId: number, programId: number): void {
  db.runSync("UPDATE training_programs SET is_active = 0 WHERE split_id = ?", [splitId]);
  // COALESCE preserves the original start across a deactivate/reactivate toggle.
  db.runSync(
    "UPDATE training_programs SET is_active = 1, started_at = COALESCE(started_at, ?) WHERE id = ?",
    [todayISO(), programId]
  );
}

export function getProgramWeeks(programId: number): ProgramWeek[] {
  return db.getAllSync<ProgramWeek>(
    "SELECT * FROM program_weeks WHERE program_id = ? ORDER BY week_number",
    [programId]
  );
}

export function getProgramWeek(id: number): ProgramWeek | null {
  return db.getFirstSync<ProgramWeek>("SELECT * FROM program_weeks WHERE id = ?", [id]);
}

export function updateProgramWeekLabel(id: number, label: string | null): void {
  db.runSync("UPDATE program_weeks SET label = ? WHERE id = ?", [label, id]);
}

export function addProgramWeek(programId: number, weekNumber: number, label?: string | null): number {
  const result = db.runSync(
    "INSERT INTO program_weeks (program_id, week_number, label) VALUES (?, ?, ?)",
    [programId, weekNumber, label ?? null]
  );
  return result.lastInsertRowId;
}

export function deleteProgramWeek(id: number): void {
  db.runSync("DELETE FROM program_weeks WHERE id = ?", [id]);
}

export function getWeekEntries(weekId: number): ProgramEntry[] {
  return db.getAllSync<ProgramEntry>(
    "SELECT * FROM program_entries WHERE week_id = ?",
    [weekId]
  );
}

export function upsertProgramEntry(entry: Omit<ProgramEntry, "id">): number {
  const result = db.runSync(
    `INSERT INTO program_entries
       (week_id, unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg,
        target_distance_km, target_duration_min, run_type, target_pace_sec,
        interval_reps, interval_work_sec, interval_work_km, interval_rest_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_id, unit_id, exercise_id) DO UPDATE SET
       target_sets = excluded.target_sets,
       target_reps = excluded.target_reps,
       target_reps_max = excluded.target_reps_max,
       target_weight_kg = excluded.target_weight_kg,
       target_distance_km = excluded.target_distance_km,
       target_duration_min = excluded.target_duration_min,
       run_type = excluded.run_type,
       target_pace_sec = excluded.target_pace_sec,
       interval_reps = excluded.interval_reps,
       interval_work_sec = excluded.interval_work_sec,
       interval_work_km = excluded.interval_work_km,
       interval_rest_sec = excluded.interval_rest_sec`,
    [
      entry.week_id,
      entry.unit_id,
      entry.exercise_id,
      entry.target_sets ?? null,
      entry.target_reps ?? null,
      entry.target_reps_max ?? null,
      entry.target_weight_kg ?? null,
      entry.target_distance_km ?? null,
      entry.target_duration_min ?? null,
      entry.run_type ?? null,
      entry.target_pace_sec ?? null,
      entry.interval_reps ?? null,
      entry.interval_work_sec ?? null,
      entry.interval_work_km ?? null,
      entry.interval_rest_sec ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export function deleteProgramEntry(id: number): void {
  db.runSync("DELETE FROM program_entries WHERE id = ?", [id]);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getVolumeByWeek(weeks = 12): { week: string; volume_kg: number }[] {
  return db.getAllSync<{ week: string; volume_kg: number }>(
    `SELECT strftime('%Y-%W', s.date) AS week,
            CAST(SUM(st.reps * st.weight_kg) AS REAL) AS volume_kg
     FROM sessions s
     JOIN sets st ON st.session_id = s.id
     GROUP BY week
     ORDER BY week DESC
     LIMIT ?`,
    [weeks]
  );
}

export function getPRs(): {
  exercise_id: number;
  exercise_name: string;
  max_weight_kg: number;
  max_reps_at_max: number;
}[] {
  return db.getAllSync(
    `SELECT
       st.exercise_id,
       e.name AS exercise_name,
       MAX(st.weight_kg) AS max_weight_kg,
       st.reps AS max_reps_at_max
     FROM sets st
     JOIN exercises e ON e.id = st.exercise_id
     WHERE st.weight_kg = (
       SELECT MAX(st2.weight_kg) FROM sets st2 WHERE st2.exercise_id = st.exercise_id
     )
     GROUP BY st.exercise_id
     ORDER BY e.name`
  );
}

export function getSessionFrequencyByMuscle(
  days = 84
): { muscle_group: string; count: number }[] {
  return db.getAllSync<{ muscle_group: string; count: number }>(
    `SELECT e.muscle_group, COUNT(DISTINCT s.id) AS count
     FROM sessions s
     JOIN sets st ON st.session_id = s.id
     JOIN exercises e ON e.id = st.exercise_id
     WHERE s.date >= date('now', '-' || ? || ' days')
     GROUP BY e.muscle_group
     ORDER BY count DESC`,
    [days]
  );
}

export function getRecentSessionDates(n: number): string[] {
  const rows = db.getAllSync<{ date: string }>(
    "SELECT DISTINCT date FROM sessions ORDER BY date DESC LIMIT ?",
    [n]
  );
  return rows.map((r) => r.date);
}

export function getStreakDays(): number {
  const rows = db.getAllSync<{ date: string }>(
    "SELECT DISTINCT date FROM sessions ORDER BY date DESC"
  );
  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const sessionDate = new Date(rows[i].date);
    sessionDate.setHours(0, 0, 0, 0);
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);

    if (sessionDate.getTime() === expected.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
