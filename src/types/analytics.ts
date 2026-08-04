// Shared contracts for the analytics feature (modality/period segmentation,
// comparison, trend, gamified records). Kept in one place so the DB queries, the
// pure aggregation utils, the hook, and the presentational components all agree on
// shapes without importing each other.

export type Granularity = "week" | "month" | "semester" | "year";

/** An inclusive date range, both bounds as local 'YYYY-MM-DD' strings. */
export interface DateRange {
  start: string;
  end: string;
}

/** A single trend bucket: a date range plus a short display label (e.g. "Jan", "S1", "2025"). */
export interface TrendBucket extends DateRange {
  label: string;
}

/**
 * A set row scoped to one modality within a date range, joined with its session's
 * date and its exercise's name/muscle group. The single seam that powers strength
 * summaries (volume, max weight), running summaries (distance, duration, pace), and
 * the trend buckets — the hook fetches these once for the whole trend window and
 * slices/aggregates them in pure JS.
 */
export interface AnalyticsSetRow {
  session_id: number;
  date: string; // 'YYYY-MM-DD'
  exercise_id: number;
  exercise_name: string;
  muscle_groups: string[];
  /** The exercise's position within its session, for replaying a day in the
   *  order it was trained. Null for sets with no session_exercises row. */
  exercise_order: number | null;
  reps: number;
  weight_kg: number;
  distance_km: number | null;
  duration_sec: number | null;
  pace_sec: number | null;
}

export interface StrengthSummary {
  volume: number; // Σ reps × weight_kg
  sessionCount: number; // distinct sessions
}

/** One bar of the per-day chart shown at week granularity. Seven of these, always
 *  Monday→Sunday, so rest days keep their slot. `value` is canonical: volume in kg
 *  for strength modalities, distance in km for endurance ones. */
export interface DayBar {
  dateISO: string;
  /** Single-letter weekday initial, PT — S T Q Q S S D. */
  label: string;
  value: number;
  hasData: boolean;
}

/** One exercise's contribution to a single day, for the day-detail modal. Values
 *  stay canonical (kg, km, seconds); the modal formats per modality. */
export interface DayExerciseBreakdown {
  exercise_id: number;
  exercise_name: string;
  setCount: number;
  volume: number;
  distanceKm: number | null;
  durationSec: number | null;
  /** session_exercises."order" — drives the list order; null sorts last. */
  order: number | null;
}

/** Summary for any distance modality (corrida, ciclismo, natação, caminhada).
 *  Values are canonical — km and seconds-per-km — and are converted to the
 *  modality's display units at render time (see src/data/modalities.ts). */
export interface DistanceSummary {
  distance: number; // Σ distance_km
  runCount: number; // distinct sessions
  totalDuration: number; // Σ duration_sec
  avgPaceSec: number | null; // Σ duration ÷ Σ distance (weighted); null if no data
}

export interface StrengthRecord {
  exercise_id: number;
  exercise_name: string;
  max_weight_kg: number;
  reps_at_max: number;
  achieved_on: string; // 'YYYY-MM-DD' — enables the "NOVO" badge
  /** The exercise's muscle groups as configured NOW (not the per-session
   *  snapshot): an all-time record belongs under the group the exercise
   *  currently trains. Drives the records accordion. */
  muscle_groups: string[];
}

/** Personal records for one distance modality. `fastest_pace_sec` is canonical
 *  seconds-per-km, so "lower is better" holds even where it's shown as km/h. */
export interface DistanceRecords {
  longest_distance_km: number | null;
  longest_distance_on: string | null;
  fastest_pace_sec: number | null;
  fastest_pace_on: string | null;
  longest_duration_sec: number | null;
  longest_duration_on: string | null;
}

/** The result of comparing a current-period metric to the previous period. */
export interface Delta {
  /** true = improved, false = regressed, null = no previous data to compare. */
  better: boolean | null;
  /** Signed percent change vs previous; null when previous is 0 or absent. */
  pct: number | null;
  /** Signed absolute change vs previous; null when there is no previous data. */
  absChange: number | null;
}

/** Raw per-scope muscle-series aggregate straight out of SQL — one row per
 *  muscle group, no notion of averaging. Scope is whatever the query filtered
 *  on (a date range, or a single session). */
export interface MuscleSeriesRaw {
  muscle_group: string;
  total_series: number;
}

/** UI-facing muscle-series row shared by MuscleSeriesChart (analytics) and
 *  MuscleSeriesSessionCard (live recording + session detail). `value` is a
 *  raw total when isAverage is false (week granularity, or any single
 *  session), and a weekly average when isAverage is true (month/semester/year
 *  granularity). `weeks` is the divisor used to produce `value` when
 *  isAverage is true — always 1 otherwise. */
export interface MuscleSeriesRow {
  muscle_group: string;
  value: number;
  weeks: number;
  isAverage: boolean;
}

/** How often a muscle group was trained, in sessions — the same shape as
 *  MuscleSeriesRow but a different unit ("×/sem", not series), so it gets its
 *  own type rather than sharing one and hoping callers remember which is which.
 *  `value` is a raw session count when isAverage is false (week granularity) and
 *  sessions-per-week when true. */
export interface MuscleFrequencyRow {
  muscle_group: string;
  value: number;
  weeks: number;
  isAverage: boolean;
}
