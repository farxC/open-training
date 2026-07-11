export type SplitMode = "cyclic" | "weekly";

import type { Modality } from "./exercise";

export interface RoutineSplit {
  id: number;
  name: string;
  mode: SplitMode;
  modality: Modality;
  anchor_date: string | null;
  rest_weekdays: number[]; // 0=Sun..6=Sat (cyclic only)
  order: number;
  uuid: string;
}

export interface RoutineUnit {
  id: number;
  split_id: number;
  ordinal: number; // cyclic: 0-based position; weekly: weekday 0..6
  label: string;
}

export interface RoutineUnitExercise {
  id: number;
  unit_id: number;
  exercise_id: number;
  order: number;
  target_sets: number;
  target_reps: number;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_distance_km: number | null;
  target_duration_min: number | null;
  // Running (corrida) targets
  run_type: "continuous" | "interval" | null;
  target_pace_sec: number | null; // sec/km (continuous & interval effort)
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
  exercise_name?: string;
  muscle_group?: string;
}

export type OverrideStatus = "trained" | "rest";

export interface RoutineOverride {
  id: number;
  date: string;
  status: OverrideStatus;
}

// ─── Training programs (weekly progression on top of a split's fixed days) ──

export interface TrainingProgram {
  id: number;
  split_id: number;
  name: string;
  total_weeks: number;
  is_active: boolean;
  order: number;
  /** Week number the week-mapping wizard left off at; null once finished (or never started). */
  setup_week_number: number | null;
  /** Date (YYYY-MM-DD) this program was first activated; anchors "current week" math. Null until activated. */
  started_at: string | null;
  uuid: string;
}

export interface ProgramWeek {
  id: number;
  program_id: number;
  week_number: number; // 1-based
  label: string | null;
}

export interface ProgramEntry {
  id: number;
  week_id: number;
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
}
