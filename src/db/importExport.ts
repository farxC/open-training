import type { Modality, SplitMode } from "@/types";

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
