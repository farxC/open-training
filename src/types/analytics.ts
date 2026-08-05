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
  /** The groups this exercise emphasises most, as configured NOW (not the
   *  per-session snapshot): an all-time record belongs under the group the
   *  exercise currently trains. Secondary groups — a bench press's ½× triceps —
   *  are left out, so a shelf only holds lifts you would look for there.
   *  Drives the records accordion. */
  muscle_groups: string[];
}

/** The heaviest set an exercise saw on one day. A full timeline of these is what
 *  separates a lift that is climbing from one that set a record and stalled —
 *  StrengthRecord only carries the all-time best, which can't tell them apart. */
export interface ExerciseDailyMax {
  exercise_id: number;
  date: string; // 'YYYY-MM-DD'
  max_weight_kg: number;
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

/** One (muscle group, exercise) pair straight out of SQL — the same snapshot
 *  rollup as MuscleSeriesRaw, broken down by which exercise produced the
 *  series. `raw_sets` is the unweighted set count, kept alongside the weighted
 *  `total_series` so a half-counting pair is recognisable without a second
 *  query: total_series < raw_sets means some set entered this group at ½×. */
export interface MuscleExerciseSeriesRaw {
  muscle_group: string;
  exercise_id: number;
  exercise_name: string;
  total_series: number;
  raw_sets: number;
  session_count: number;
}

/** One exercise's contribution to one muscle group over the analysis window —
 *  the drill-down under a muscle-group row. `series` follows the same convention
 *  as the group row it sits under: a raw total when isAverage is false (week
 *  granularity), a per-week average when true, so the children always sum to
 *  the parent. */
export interface MuscleExerciseRow {
  exercise_id: number;
  exercise_name: string;
  /** Weighted series (sum of counting_factor) — raw total or per-week average. */
  series: number;
  /** Sessions this exercise appeared in over the whole window, counted, NOT
   *  averaged per week like the group row's frequency. A movement trained eight
   *  times in a 26-week window averages 0.3×/week, which reads as nothing; the
   *  count is legible in every window, and nothing here needs to sum to the
   *  parent the way series does. */
  sessionCount: number;
  /** Fraction of the group's series this exercise accounts for, 0–1. */
  share: number;
  /** True when any set entered this group at ½× — the number below the name is
   *  smaller than the sets actually logged, and the row says why. */
  halved: boolean;
  weeks: number;
  isAverage: boolean;
}
