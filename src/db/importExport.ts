import type { Modality, SplitMode } from "@/types";
import { db } from "./client";
import { SCHEMA_VERSION } from "./schema";

export const CURRENT_EXPORT_FORMAT_VERSION = 1;

export interface ExportedExercise {
  uuid: string;
  name: string;
  muscle_group: string;
  equipment: string;
  type: string;
  is_custom: 0 | 1;
  modality: Modality;
}

export interface ExportedSet {
  exercise_uuid: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
  distance_km: number | null;
  duration_sec: number | null;
  pace_sec: number | null;
}

export interface ExportedSession {
  uuid: string;
  date: string;
  name: string | null;
  notes: string | null;
  duration_seconds: number | null;
  modality: Modality;
  sets: ExportedSet[];
}

export interface ExportedUnitExercise {
  exercise_uuid: string;
  order: number;
  target_sets: number;
  target_reps: number;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_distance_km: number | null;
  target_duration_min: number | null;
  run_type: "continuous" | "interval" | null;
  target_pace_sec: number | null;
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
}

export interface ExportedUnit {
  ordinal: number;
  label: string;
  exercises: ExportedUnitExercise[];
}

export interface ExportedSplit {
  uuid: string;
  name: string;
  mode: SplitMode;
  modality: Modality;
  anchor_date: string | null;
  rest_weekdays: number[];
  order: number;
  units: ExportedUnit[];
}

export interface ExportedProgramEntry {
  exercise_uuid: string;
  unit_ordinal: number;
  target_sets: number | null;
  target_reps: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_distance_km: number | null;
  target_duration_min: number | null;
  run_type: "continuous" | "interval" | null;
  target_pace_sec: number | null;
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
}

export interface ExportedProgramWeek {
  week_number: number;
  label: string | null;
  entries: ExportedProgramEntry[];
}

export interface ExportedProgram {
  uuid: string;
  split_uuid: string;
  name: string;
  total_weeks: number;
  is_active: boolean;
  order: number;
  setup_week_number: number | null;
  started_at: string | null;
  weeks: ExportedProgramWeek[];
}

export interface ExportPayload {
  exportFormatVersion: number;
  exportedAt: string;
  appSchemaVersion: number;
  exercises: ExportedExercise[];
  sessions: ExportedSession[];
  routineSplits: ExportedSplit[];
  trainingPrograms: ExportedProgram[];
}

/** Throws with a user-facing (pt-BR) message on anything that isn't a well-formed export file. */
export function validateExportPayload(data: unknown): ExportPayload {
  if (typeof data !== "object" || data === null) {
    throw new Error("Arquivo de backup inválido: conteúdo não é um objeto JSON.");
  }
  const payload = data as Partial<ExportPayload>;
  if (payload.exportFormatVersion !== CURRENT_EXPORT_FORMAT_VERSION) {
    throw new Error(
      `Arquivo de backup em formato não suportado (versão ${String(payload.exportFormatVersion)}).`
    );
  }
  if (
    !Array.isArray(payload.exercises) ||
    !Array.isArray(payload.sessions) ||
    !Array.isArray(payload.routineSplits) ||
    !Array.isArray(payload.trainingPrograms)
  ) {
    throw new Error("Arquivo de backup inválido: uma ou mais seções de dados estão ausentes.");
  }
  return payload as ExportPayload;
}

export interface ExerciseMergePlan {
  toInsert: ExportedExercise[];
  /** Imported exercise uuid -> local exercise id (already present, either by uuid or by name). */
  matchedIds: Map<string, number>;
}

export function planExerciseMerge(
  existing: { id: number; uuid: string | null; name: string }[],
  imported: ExportedExercise[]
): ExerciseMergePlan {
  const idByUuid = new Map(existing.filter((e) => e.uuid).map((e) => [e.uuid as string, e.id]));
  const idByName = new Map(existing.map((e) => [e.name, e.id]));
  const toInsert: ExportedExercise[] = [];
  const matchedIds = new Map<string, number>();

  for (const ex of imported) {
    const byUuid = idByUuid.get(ex.uuid);
    if (byUuid !== undefined) {
      matchedIds.set(ex.uuid, byUuid);
      continue;
    }
    const byName = idByName.get(ex.name);
    if (byName !== undefined) {
      matchedIds.set(ex.uuid, byName);
      continue;
    }
    toInsert.push(ex);
  }

  return { toInsert, matchedIds };
}

export function planSessionMerge(
  existingUuids: Set<string>,
  imported: ExportedSession[]
): ExportedSession[] {
  return imported.filter((s) => !existingUuids.has(s.uuid));
}

export function buildExportPayload(): ExportPayload {
  const exerciseRows = db.getAllSync<{
    id: number;
    uuid: string;
    name: string;
    muscle_group: string;
    equipment: string;
    type: string;
    is_custom: number;
    modality: Modality;
  }>("SELECT * FROM exercises");
  const exerciseUuidById = new Map(exerciseRows.map((e) => [e.id, e.uuid]));

  const exercises: ExportedExercise[] = exerciseRows.map((e) => ({
    uuid: e.uuid,
    name: e.name,
    muscle_group: e.muscle_group,
    equipment: e.equipment,
    type: e.type,
    is_custom: e.is_custom as 0 | 1,
    modality: e.modality,
  }));

  const sessionRows = db.getAllSync<{
    id: number;
    uuid: string;
    date: string;
    name: string | null;
    notes: string | null;
    duration_seconds: number | null;
    modality: Modality;
  }>("SELECT id, uuid, date, name, notes, duration_seconds, modality FROM sessions");

  const sessions: ExportedSession[] = sessionRows.map((s) => {
    const sets = db.getAllSync<{
      exercise_id: number;
      set_number: number;
      reps: number;
      weight_kg: number;
      rpe: number | null;
      rir: number | null;
      notes: string | null;
      distance_km: number | null;
      duration_sec: number | null;
      pace_sec: number | null;
    }>(
      `SELECT exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec
       FROM sets WHERE session_id = ?`,
      [s.id]
    );
    return {
      uuid: s.uuid,
      date: s.date,
      name: s.name,
      notes: s.notes,
      duration_seconds: s.duration_seconds,
      modality: s.modality,
      sets: sets.map((st) => ({
        exercise_uuid: exerciseUuidById.get(st.exercise_id) ?? "",
        set_number: st.set_number,
        reps: st.reps,
        weight_kg: st.weight_kg,
        rpe: st.rpe,
        rir: st.rir,
        notes: st.notes,
        distance_km: st.distance_km,
        duration_sec: st.duration_sec,
        pace_sec: st.pace_sec,
      })),
    };
  });

  const splitRows = db.getAllSync<{
    id: number;
    uuid: string;
    name: string;
    mode: SplitMode;
    modality: Modality;
    anchor_date: string | null;
    rest_weekdays: string;
    order: number;
  }>(`SELECT * FROM routine_splits`);

  const routineSplits: ExportedSplit[] = splitRows.map((sp) => {
    const units = db.getAllSync<{ id: number; ordinal: number; label: string }>(
      "SELECT id, ordinal, label FROM routine_units WHERE split_id = ? ORDER BY ordinal",
      [sp.id]
    );
    return {
      uuid: sp.uuid,
      name: sp.name,
      mode: sp.mode,
      modality: sp.modality,
      anchor_date: sp.anchor_date,
      rest_weekdays: sp.rest_weekdays
        ? sp.rest_weekdays.split(",").map(Number).filter((n) => !Number.isNaN(n))
        : [],
      order: sp.order,
      units: units.map((u) => {
        const unitExercises = db.getAllSync<{
          exercise_id: number;
          order: number;
          target_sets: number;
          target_reps: number;
          target_reps_max: number | null;
          target_weight_kg: number | null;
          target_distance_km: number | null;
          target_duration_min: number | null;
          run_type: "continuous" | "interval" | null;
          target_pace_sec: number | null;
          interval_reps: number | null;
          interval_work_sec: number | null;
          interval_work_km: number | null;
          interval_rest_sec: number | null;
        }>(
          `SELECT exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg,
                  target_distance_km, target_duration_min, run_type, target_pace_sec,
                  interval_reps, interval_work_sec, interval_work_km, interval_rest_sec
           FROM routine_unit_exercises WHERE unit_id = ? ORDER BY "order"`,
          [u.id]
        );
        return {
          ordinal: u.ordinal,
          label: u.label,
          exercises: unitExercises.map((ue) => ({
            exercise_uuid: exerciseUuidById.get(ue.exercise_id) ?? "",
            order: ue.order,
            target_sets: ue.target_sets,
            target_reps: ue.target_reps,
            target_reps_max: ue.target_reps_max,
            target_weight_kg: ue.target_weight_kg,
            target_distance_km: ue.target_distance_km,
            target_duration_min: ue.target_duration_min,
            run_type: ue.run_type,
            target_pace_sec: ue.target_pace_sec,
            interval_reps: ue.interval_reps,
            interval_work_sec: ue.interval_work_sec,
            interval_work_km: ue.interval_work_km,
            interval_rest_sec: ue.interval_rest_sec,
          })),
        };
      }),
    };
  });

  const splitUuidById = new Map(splitRows.map((sp) => [sp.id, sp.uuid]));

  const programRows = db.getAllSync<{
    id: number;
    uuid: string;
    split_id: number;
    name: string;
    total_weeks: number;
    is_active: number;
    order: number;
    setup_week_number: number | null;
    started_at: string | null;
  }>("SELECT * FROM training_programs");

  const trainingPrograms: ExportedProgram[] = programRows.map((p) => {
    const unitOrdinalById = new Map(
      db
        .getAllSync<{ id: number; ordinal: number }>(
          "SELECT id, ordinal FROM routine_units WHERE split_id = ?",
          [p.split_id]
        )
        .map((u) => [u.id, u.ordinal])
    );
    const weeks = db.getAllSync<{ id: number; week_number: number; label: string | null }>(
      "SELECT id, week_number, label FROM program_weeks WHERE program_id = ? ORDER BY week_number",
      [p.id]
    );
    return {
      uuid: p.uuid,
      split_uuid: splitUuidById.get(p.split_id) ?? "",
      name: p.name,
      total_weeks: p.total_weeks,
      is_active: p.is_active === 1,
      order: p.order,
      setup_week_number: p.setup_week_number,
      started_at: p.started_at,
      weeks: weeks.map((w) => {
        const entries = db.getAllSync<{
          unit_id: number;
          exercise_id: number;
          target_sets: number | null;
          target_reps: number | null;
          target_reps_max: number | null;
          target_weight_kg: number | null;
          target_distance_km: number | null;
          target_duration_min: number | null;
          run_type: "continuous" | "interval" | null;
          target_pace_sec: number | null;
          interval_reps: number | null;
          interval_work_sec: number | null;
          interval_work_km: number | null;
          interval_rest_sec: number | null;
        }>(
          `SELECT unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg,
                  target_distance_km, target_duration_min, run_type, target_pace_sec,
                  interval_reps, interval_work_sec, interval_work_km, interval_rest_sec
           FROM program_entries WHERE week_id = ?`,
          [w.id]
        );
        return {
          week_number: w.week_number,
          label: w.label,
          entries: entries.map((e) => ({
            exercise_uuid: exerciseUuidById.get(e.exercise_id) ?? "",
            unit_ordinal: unitOrdinalById.get(e.unit_id) ?? -1,
            target_sets: e.target_sets,
            target_reps: e.target_reps,
            target_reps_max: e.target_reps_max,
            target_weight_kg: e.target_weight_kg,
            target_distance_km: e.target_distance_km,
            target_duration_min: e.target_duration_min,
            run_type: e.run_type,
            target_pace_sec: e.target_pace_sec,
            interval_reps: e.interval_reps,
            interval_work_sec: e.interval_work_sec,
            interval_work_km: e.interval_work_km,
            interval_rest_sec: e.interval_rest_sec,
          })),
        };
      }),
    };
  });

  return {
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appSchemaVersion: SCHEMA_VERSION,
    exercises,
    sessions,
    routineSplits,
    trainingPrograms,
  };
}
