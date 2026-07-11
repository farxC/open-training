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

export interface ImportSummary {
  exercisesAdded: number;
  sessionsAdded: number;
  splitsAdded: number;
  programsAdded: number;
}

export function applyImport(payload: ExportPayload): ImportSummary {
  const summary: ImportSummary = {
    exercisesAdded: 0,
    sessionsAdded: 0,
    splitsAdded: 0,
    programsAdded: 0,
  };

  db.withTransactionSync(() => {
    // 1. Exercises
    const existingExercises = db.getAllSync<{ id: number; uuid: string | null; name: string }>(
      "SELECT id, uuid, name FROM exercises"
    );
    const exercisePlan = planExerciseMerge(existingExercises, payload.exercises);
    const exerciseIdByUuid = new Map(exercisePlan.matchedIds);
    for (const ex of exercisePlan.toInsert) {
      const result = db.runSync(
        "INSERT INTO exercises (name, muscle_group, equipment, type, is_custom, modality, uuid) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [ex.name, ex.muscle_group, ex.equipment, ex.type, ex.is_custom, ex.modality, ex.uuid]
      );
      exerciseIdByUuid.set(ex.uuid, result.lastInsertRowId);
      summary.exercisesAdded++;
    }

    // 2. Routine splits (+ units + unit exercises) — matched-by-uuid splits are skipped
    // whole (their units/exercises are assumed to already match too), same as sessions.
    const existingSplits = db.getAllSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM routine_splits"
    );
    const splitIdByUuid = new Map(
      existingSplits.filter((s) => s.uuid).map((s) => [s.uuid as string, s.id])
    );
    for (const split of payload.routineSplits) {
      if (splitIdByUuid.has(split.uuid)) continue;

      const result = db.runSync(
        `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [split.name, split.mode, split.modality, split.anchor_date, split.rest_weekdays.join(","), split.order, split.uuid]
      );
      const splitId = result.lastInsertRowId;
      splitIdByUuid.set(split.uuid, splitId);
      summary.splitsAdded++;

      for (const unit of split.units) {
        const unitResult = db.runSync(
          "INSERT INTO routine_units (split_id, ordinal, label) VALUES (?, ?, ?)",
          [splitId, unit.ordinal, unit.label]
        );
        const unitId = unitResult.lastInsertRowId;
        for (const ue of unit.exercises) {
          const exerciseId = exerciseIdByUuid.get(ue.exercise_uuid);
          if (exerciseId === undefined) continue;
          db.runSync(
            `INSERT INTO routine_unit_exercises
               (unit_id, exercise_id, "order", target_sets, target_reps, target_reps_max, target_weight_kg,
                target_distance_km, target_duration_min, run_type, target_pace_sec,
                interval_reps, interval_work_sec, interval_work_km, interval_rest_sec)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              unitId, exerciseId, ue.order, ue.target_sets, ue.target_reps, ue.target_reps_max,
              ue.target_weight_kg, ue.target_distance_km, ue.target_duration_min, ue.run_type,
              ue.target_pace_sec, ue.interval_reps, ue.interval_work_sec, ue.interval_work_km, ue.interval_rest_sec,
            ]
          );
        }
      }
    }

    // 3. Sessions
    const existingSessionUuids = new Set(
      db
        .getAllSync<{ uuid: string | null }>("SELECT uuid FROM sessions")
        .map((r) => r.uuid)
        .filter((u): u is string => u !== null)
    );
    const sessionsToInsert = planSessionMerge(existingSessionUuids, payload.sessions);
    for (const session of sessionsToInsert) {
      const result = db.runSync(
        "INSERT INTO sessions (date, name, notes, modality, uuid) VALUES (?, ?, ?, ?, ?)",
        [session.date, session.name, session.notes, session.modality, session.uuid]
      );
      const sessionId = result.lastInsertRowId;
      for (const set of session.sets) {
        const exerciseId = exerciseIdByUuid.get(set.exercise_uuid);
        if (exerciseId === undefined) continue;
        db.runSync(
          `INSERT INTO sets (session_id, exercise_id, set_number, reps, weight_kg, rpe, rir, notes, distance_km, duration_sec, pace_sec)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId, exerciseId, set.set_number, set.reps, set.weight_kg, set.rpe, set.rir,
            set.notes, set.distance_km, set.duration_sec, set.pace_sec,
          ]
        );
      }
      summary.sessionsAdded++;
    }

    // 4. Training programs (+ weeks + entries)
    const existingPrograms = db.getAllSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM training_programs"
    );
    const programIdByUuid = new Map(
      existingPrograms.filter((p) => p.uuid).map((p) => [p.uuid as string, p.id])
    );
    for (const program of payload.trainingPrograms) {
      if (programIdByUuid.has(program.uuid)) continue;
      const splitId = splitIdByUuid.get(program.split_uuid);
      if (splitId === undefined) continue; // split this program belongs to wasn't in the file or failed to match

      const unitIdByOrdinal = new Map(
        db
          .getAllSync<{ id: number; ordinal: number }>(
            "SELECT id, ordinal FROM routine_units WHERE split_id = ?",
            [splitId]
          )
          .map((u) => [u.ordinal, u.id])
      );

      const result = db.runSync(
        `INSERT INTO training_programs (split_id, name, total_weeks, is_active, "order", setup_week_number, started_at, uuid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          splitId, program.name, program.total_weeks, program.is_active ? 1 : 0, program.order,
          program.setup_week_number, program.started_at, program.uuid,
        ]
      );
      const programId = result.lastInsertRowId;
      summary.programsAdded++;

      for (const week of program.weeks) {
        const weekResult = db.runSync(
          "INSERT INTO program_weeks (program_id, week_number, label) VALUES (?, ?, ?)",
          [programId, week.week_number, week.label]
        );
        const weekId = weekResult.lastInsertRowId;
        for (const entry of week.entries) {
          const exerciseId = exerciseIdByUuid.get(entry.exercise_uuid);
          const unitId = unitIdByOrdinal.get(entry.unit_ordinal);
          if (exerciseId === undefined || unitId === undefined) continue;
          db.runSync(
            `INSERT INTO program_entries
               (week_id, unit_id, exercise_id, target_sets, target_reps, target_reps_max, target_weight_kg,
                target_distance_km, target_duration_min, run_type, target_pace_sec,
                interval_reps, interval_work_sec, interval_work_km, interval_rest_sec)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              weekId, unitId, exerciseId, entry.target_sets, entry.target_reps, entry.target_reps_max,
              entry.target_weight_kg, entry.target_distance_km, entry.target_duration_min, entry.run_type,
              entry.target_pace_sec, entry.interval_reps, entry.interval_work_sec, entry.interval_work_km,
              entry.interval_rest_sec,
            ]
          );
        }
      }
    }
  });

  return summary;
}
