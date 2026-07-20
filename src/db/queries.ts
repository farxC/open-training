import { db } from "./client";
import { todayISO } from "../utils/cycle";
import { generateUuid } from "../utils/uuid";
import type {
  Exercise,
  ExerciseMuscleGroup,
  MuscleGroup,
  Modality,
  Session,
  SessionPhoto,
  SessionExercise,
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
  AnalyticsSetRow,
  StrengthRecord,
  RunningRecords,
  MuscleSeriesRaw,
} from "../types";

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSessions(): SessionSummary[] {
  const rows = db.getAllSync<{
    id: number;
    date: string;
    name: string | null;
    notes: string | null;
    duration_seconds: number | null;
    start_time: string | null;
    end_time: string | null;
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
      s.id, s.date, s.name, s.notes, s.duration_seconds, s.start_time, s.end_time, s.photo_uri, s.uuid,
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

export function getSessionById(id: number): Session | null {
  return db.getFirstSync<Session>(
    `SELECT id, date, name, notes, duration_seconds, start_time, end_time, photo_uri, uuid,
            modality, split_id, unit_id, program_week_id
     FROM sessions WHERE id = ?`,
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
     ORDER BY (
       SELECT se."order" FROM session_exercises se
       WHERE se.session_id = st.session_id AND se.exercise_id = st.exercise_id
     ), st.set_number`,
    [id]
  );

  const ctx = db.getFirstSync<{ split_name: string | null; unit_label: string | null }>(
    `SELECT rs.name AS split_name, ru.label AS unit_label
     FROM sessions s
     LEFT JOIN routine_splits rs ON rs.id = s.split_id
     LEFT JOIN routine_units ru ON ru.id = s.unit_id
     WHERE s.id = ?`,
    [id]
  );

  return {
    ...session,
    sets,
    photos: getSessionPhotos(id),
    split_name: ctx?.split_name ?? null,
    unit_label: ctx?.unit_label ?? null,
  };
}

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

export function updateSession(
  id: number,
  patch: Partial<Pick<Session, "name" | "notes" | "date" | "duration_seconds" | "start_time" | "end_time">>
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

// ─── Session photos ────────────────────────────────────────────────────────────

export function getSessionPhotos(sessionId: number): SessionPhoto[] {
  return db.getAllSync<SessionPhoto>(
    `SELECT * FROM session_photos WHERE session_id = ? ORDER BY "order", id`,
    [sessionId]
  );
}

export function addSessionPhoto(sessionId: number, uri: string, order?: number): number {
  const position = order ?? getSessionPhotos(sessionId).length;
  const result = db.runSync(
    `INSERT INTO session_photos (session_id, uri, "order") VALUES (?, ?, ?)`,
    [sessionId, uri, position]
  );
  return result.lastInsertRowId;
}

export function removeSessionPhoto(id: number): void {
  db.runSync("DELETE FROM session_photos WHERE id = ?", [id]);
}

export function moveSessionPhoto(sessionId: number, id: number, direction: "up" | "down"): void {
  const rows = db.getAllSync<{ id: number; order: number }>(
    `SELECT id, "order" FROM session_photos WHERE session_id = ? ORDER BY "order", id`,
    [sessionId]
  );
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= rows.length) return;
  db.runSync(`UPDATE session_photos SET "order" = ? WHERE id = ?`, [rows[swap].order, rows[idx].id]);
  db.runSync(`UPDATE session_photos SET "order" = ? WHERE id = ?`, [rows[idx].order, rows[swap].id]);
}

// ─── Session exercises ─────────────────────────────────────────────────────────

export function getSessionExercises(sessionId: number): SessionExercise[] {
  const rows = db.getAllSync<Omit<SessionExercise, "muscle_groups"> & { muscle_groups_csv: string | null }>(
    `SELECT se.*, e.name AS exercise_name,
            (SELECT GROUP_CONCAT(emg.muscle_group) FROM exercise_muscle_groups emg WHERE emg.exercise_id = e.id) AS muscle_groups_csv
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     WHERE se.session_id = ?
     ORDER BY se."order"`,
    [sessionId]
  );
  return rows.map(({ muscle_groups_csv, ...rest }) => ({
    ...rest,
    muscle_groups: muscle_groups_csv ? muscle_groups_csv.split(",") : [],
  }));
}

export function addSessionExercise(sessionId: number, exerciseId: number, order?: number): number {
  const position = order ?? getSessionExercises(sessionId).length;
  const result = db.runSync(
    `INSERT OR IGNORE INTO session_exercises (session_id, exercise_id, "order") VALUES (?, ?, ?)`,
    [sessionId, exerciseId, position]
  );
  return result.lastInsertRowId;
}

export function removeSessionExercise(sessionId: number, exerciseId: number): void {
  deleteSetsByExercise(sessionId, exerciseId);
  db.runSync("DELETE FROM session_exercises WHERE session_id = ? AND exercise_id = ?", [sessionId, exerciseId]);
  const rows = db.getAllSync<{ id: number }>(
    `SELECT id FROM session_exercises WHERE session_id = ? ORDER BY "order"`,
    [sessionId]
  );
  rows.forEach((row, i) => db.runSync(`UPDATE session_exercises SET "order" = ? WHERE id = ?`, [i, row.id]));
}

export function reorderSessionExercises(sessionId: number, orderedExerciseIds: number[]): void {
  orderedExerciseIds.forEach((exerciseId, i) => {
    db.runSync(`UPDATE session_exercises SET "order" = ? WHERE session_id = ? AND exercise_id = ?`, [
      i,
      sessionId,
      exerciseId,
    ]);
  });
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

export function getSetsBySession(sessionId: number): WorkoutSet[] {
  return db.getAllSync<WorkoutSet>(
    `SELECT * FROM sets st
     WHERE st.session_id = ?
     ORDER BY (
       SELECT se."order" FROM session_exercises se
       WHERE se.session_id = st.session_id AND se.exercise_id = st.exercise_id
     ), st.set_number`,
    [sessionId]
  );
}

export function addSet(set: Omit<WorkoutSet, "id">): number {
  const result = db.runSync(
    `INSERT INTO sets (session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec, failure)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      set.session_id,
      set.exercise_id,
      set.set_number,
      set.reps,
      set.weight_kg,
      set.rpe ?? null,
      set.rir ?? null,
      set.notes ?? null,
      set.distance_km ?? null,
      set.duration_sec ?? null,
      set.pace_sec ?? null,
      set.failure ?? 0,
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

export function deleteSetsByExercise(sessionId: number, exerciseId: number): void {
  db.runSync("DELETE FROM sets WHERE session_id = ? AND exercise_id = ?", [sessionId, exerciseId]);
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export function getExercises(filter?: {
  muscle_group?: MuscleGroup; // matches exercises that include this group among their set
  is_custom?: boolean;
  modality?: Modality;
}): Exercise[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter?.muscle_group) {
    conditions.push("id IN (SELECT exercise_id FROM exercise_muscle_groups WHERE muscle_group = ?)");
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
  const rows = db.getAllSync<Omit<Exercise, "muscle_groups">>(
    `SELECT * FROM exercises ${where} ORDER BY name`,
    params
  );
  if (rows.length === 0) return [];

  // Batch-fetch all muscle groups for the returned exercises — no N+1.
  const ids = rows.map((r) => r.id);
  const mgRows = db.getAllSync<{ exercise_id: number; muscle_group: string; counting_factor: number }>(
    `SELECT exercise_id, muscle_group, counting_factor FROM exercise_muscle_groups WHERE exercise_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  const groupsByExerciseId = new Map<number, ExerciseMuscleGroup[]>();
  for (const { exercise_id, muscle_group, counting_factor } of mgRows) {
    const groups = groupsByExerciseId.get(exercise_id);
    const entry = { muscle_group: muscle_group as MuscleGroup, counting_factor };
    if (groups) groups.push(entry);
    else groupsByExerciseId.set(exercise_id, [entry]);
  }
  return rows.map((r) => ({ ...r, muscle_groups: groupsByExerciseId.get(r.id) ?? [] }));
}

export function createExercise(
  ex: Omit<Exercise, "id" | "uuid" | "muscle_groups"> & { muscle_groups: MuscleGroup[] }
): { id: number; uuid: string } {
  const uuid = generateUuid();
  const result = db.runSync(
    "INSERT INTO exercises (name, equipment, type, is_custom, modality, uuid) VALUES (?, ?, ?, ?, ?, ?)",
    [ex.name, ex.equipment, ex.type, 1, ex.modality, uuid]
  );
  const id = result.lastInsertRowId;
  for (const mg of ex.muscle_groups) {
    db.runSync("INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group) VALUES (?, ?)", [id, mg]);
  }
  return { id, uuid };
}

/** Full replace of an exercise's muscle groups — used by the picker's edit UI. */
export function updateExerciseMuscleGroups(exerciseId: number, muscleGroups: ExerciseMuscleGroup[]): void {
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM exercise_muscle_groups WHERE exercise_id = ?", [exerciseId]);
    for (const { muscle_group, counting_factor } of muscleGroups) {
      db.runSync(
        "INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group, counting_factor) VALUES (?, ?, ?)",
        [exerciseId, muscle_group, counting_factor]
      );
    }
  });
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
  uuid: string;
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
    uuid: r.uuid,
  }));
}

export function createSplit(s: { name: string; mode: SplitMode; modality: Modality }): number {
  const count = db.getAllSync<{ id: number }>("SELECT id FROM routine_splits").length;
  const result = db.runSync(
    `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid) VALUES (?, ?, ?, NULL, '', ?, ?)`,
    [s.name, s.mode, s.modality, count, generateUuid()]
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
  const rows = db.getAllSync<
    Omit<RoutineUnitExercise, "muscle_groups"> & { muscle_groups_csv: string | null }
  >(
    `SELECT re.*, e.name AS exercise_name,
            (SELECT GROUP_CONCAT(emg.muscle_group) FROM exercise_muscle_groups emg WHERE emg.exercise_id = e.id) AS muscle_groups_csv
     FROM routine_unit_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     WHERE re.unit_id = ?
     ORDER BY re."order"`,
    [unitId]
  );
  return rows.map(({ muscle_groups_csv, ...rest }) => ({
    ...rest,
    muscle_groups: muscle_groups_csv ? muscle_groups_csv.split(",") : [],
  }));
}

export function addUnitExercise(
  re: Omit<RoutineUnitExercise, "id" | "exercise_name" | "muscle_groups">
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
  const row = db.getFirstSync<{ unit_id: number }>("SELECT unit_id FROM routine_unit_exercises WHERE id = ?", [id]);
  db.runSync("DELETE FROM routine_unit_exercises WHERE id = ?", [id]);
  if (!row) return;
  const rows = db.getAllSync<{ id: number }>(
    `SELECT id FROM routine_unit_exercises WHERE unit_id = ? ORDER BY "order"`,
    [row.unit_id]
  );
  rows.forEach((r, i) => db.runSync(`UPDATE routine_unit_exercises SET "order" = ? WHERE id = ?`, [i, r.id]));
}

export function reorderUnitExercises(unitId: number, orderedIds: number[]): void {
  orderedIds.forEach((id, i) => {
    db.runSync(`UPDATE routine_unit_exercises SET "order" = ? WHERE id = ?`, [i, id]);
  });
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
  uuid: string;
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
    uuid: r.uuid,
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
    `INSERT INTO training_programs (split_id, name, total_weeks, is_active, "order", uuid) VALUES (?, ?, ?, 0, ?, ?)`,
    [p.split_id, p.name, p.total_weeks, count, generateUuid()]
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

export function getSetsInRange(
  modality: Modality,
  startISO: string,
  endISO: string
): AnalyticsSetRow[] {
  // Scalar correlated subquery, not a JOIN against exercise_muscle_groups — a real
  // JOIN would fan out one row per (set, muscle_group) pair, silently multiplying
  // the volume/weight sums this same row array feeds in useAnalytics.ts.
  const rows = db.getAllSync<Omit<AnalyticsSetRow, "muscle_groups"> & { muscle_groups_csv: string | null }>(
    `SELECT st.session_id, s.date, st.exercise_id, e.name AS exercise_name,
            (SELECT GROUP_CONCAT(emg.muscle_group) FROM exercise_muscle_groups emg WHERE emg.exercise_id = e.id) AS muscle_groups_csv,
            st.reps, st.weight_kg, st.distance_km, st.duration_sec, st.pace_sec
     FROM sessions s
     JOIN sets st ON st.session_id = s.id
     JOIN exercises e ON e.id = st.exercise_id
     WHERE s.modality = ? AND s.date >= ? AND s.date <= ?
     ORDER BY s.date ASC, st.set_number ASC`,
    [modality, startISO, endISO]
  );
  return rows.map(({ muscle_groups_csv, ...rest }) => ({
    ...rest,
    muscle_groups: muscle_groups_csv ? muscle_groups_csv.split(",") : [],
  }));
}

export function getMuscleSeriesInRange(
  modality: Modality,
  startISO: string,
  endISO: string
): MuscleSeriesRaw[] {
  // Real JOIN against exercise_muscle_groups — the opposite choice from
  // getSetsInRange above, and deliberately so: here the fan-out of one row per
  // (set, muscle_group) pair is exactly what's wanted, since each muscle
  // independently earns the exercise's counting_factor for that set. Reflects
  // the exercise's CURRENT muscle-group/factor configuration across the whole
  // range, not a historical snapshot of what was configured when each set was
  // logged (the schema has no per-set snapshot of counting_factor).
  return db.getAllSync<MuscleSeriesRaw>(
    `SELECT emg.muscle_group AS muscle_group, SUM(emg.counting_factor) AS total_series
     FROM sessions s
     JOIN sets st ON st.session_id = s.id
     JOIN exercise_muscle_groups emg ON emg.exercise_id = st.exercise_id
     WHERE s.modality = ? AND s.date >= ? AND s.date <= ?
     GROUP BY emg.muscle_group
     ORDER BY total_series DESC`,
    [modality, startISO, endISO]
  );
}

/** Same weighting as getMuscleSeriesInRange, scoped to a single session
 *  instead of a date range/modality — used by the live recording screen and
 *  the finished-session detail view, both of which already know the session. */
export function getMuscleSeriesForSession(sessionId: number): MuscleSeriesRaw[] {
  return db.getAllSync<MuscleSeriesRaw>(
    `SELECT emg.muscle_group AS muscle_group, SUM(emg.counting_factor) AS total_series
     FROM sets st
     JOIN exercise_muscle_groups emg ON emg.exercise_id = st.exercise_id
     WHERE st.session_id = ?
     GROUP BY emg.muscle_group
     ORDER BY total_series DESC`,
    [sessionId]
  );
}

export function getStrengthRecords(): StrengthRecord[] {
  return db.getAllSync<StrengthRecord>(
    `SELECT st.exercise_id,
            e.name AS exercise_name,
            st.weight_kg AS max_weight_kg,
            st.reps AS reps_at_max,
            s.date AS achieved_on
     FROM sets st
     JOIN sessions s ON s.id = st.session_id
     JOIN exercises e ON e.id = st.exercise_id
     WHERE s.modality = 'musculacao'
       AND st.weight_kg > 0
       AND st.weight_kg = (
         SELECT MAX(st2.weight_kg) FROM sets st2
         JOIN sessions s2 ON s2.id = st2.session_id
         WHERE st2.exercise_id = st.exercise_id AND s2.modality = 'musculacao'
       )
     GROUP BY st.exercise_id
     ORDER BY max_weight_kg DESC`
  );
}

export function getRunningRecords(): RunningRecords {
  const longestDistance = db.getFirstSync<{ v: number; on: string }>(
    `SELECT st.distance_km AS v, s.date AS "on"
     FROM sets st
     JOIN sessions s ON s.id = st.session_id
     WHERE s.modality = 'corrida' AND st.distance_km IS NOT NULL AND st.distance_km > 0
     ORDER BY st.distance_km DESC
     LIMIT 1`
  );

  const fastestPace = db.getFirstSync<{ v: number; on: string }>(
    `SELECT st.pace_sec AS v, s.date AS "on"
     FROM sets st
     JOIN sessions s ON s.id = st.session_id
     WHERE s.modality = 'corrida' AND st.pace_sec IS NOT NULL AND st.pace_sec > 0
     ORDER BY st.pace_sec ASC
     LIMIT 1`
  );

  const longestDuration = db.getFirstSync<{ v: number; on: string }>(
    `SELECT st.duration_sec AS v, s.date AS "on"
     FROM sets st
     JOIN sessions s ON s.id = st.session_id
     WHERE s.modality = 'corrida' AND st.duration_sec IS NOT NULL AND st.duration_sec > 0
     ORDER BY st.duration_sec DESC
     LIMIT 1`
  );

  return {
    longest_distance_km: longestDistance?.v ?? null,
    longest_distance_on: longestDistance?.on ?? null,
    fastest_pace_sec: fastestPace?.v ?? null,
    fastest_pace_on: fastestPace?.on ?? null,
    longest_duration_sec: longestDuration?.v ?? null,
    longest_duration_on: longestDuration?.on ?? null,
  };
}

export function getSessionDatesByModality(modality: Modality): string[] {
  const rows = db.getAllSync<{ date: string }>(
    "SELECT DISTINCT date FROM sessions WHERE modality = ? ORDER BY date DESC",
    [modality]
  );
  return rows.map((r) => r.date);
}

