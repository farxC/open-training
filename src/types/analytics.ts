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
  reps: number;
  weight_kg: number;
  distance_km: number | null;
  duration_sec: number | null;
  pace_sec: number | null;
}

export interface StrengthSummary {
  volume: number; // Σ reps × weight_kg
  sessionCount: number; // distinct sessions
  maxWeight: number; // heaviest single set in range
}

export interface RunningSummary {
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
}

export interface RunningRecords {
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
