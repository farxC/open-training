import { DEFAULT_EXERCISE_CONFIG, normalizeExerciseConfig } from "../data/exerciseConfig";
import type { ExerciseConfig } from "../types";

// Shared SQL plumbing for the exercise config columns. Kept out of queries.ts
// so the exporter can reuse it, and free of any `./client` import so it stays
// loadable under Jest (importing the client opens a real SQLite handle).

/** The config columns in one canonical order. exercise_config and its
 *  per-session snapshot session_exercise_config share this exact shape, so
 *  every read and write of either goes through this list — adding a dimension
 *  means touching one array instead of a dozen hand-written SQL statements. */
export const CONFIG_COLUMNS: (keyof ExerciseConfig)[] = [
  "resistance_curve",
  "load_type",
  "pulley_type",
  "laterality",
  "rom",
  "uses_bench",
  "bench_angle_degrees",
  "grip_type",
  "grip_width",
  "uses_bodyweight",
  "load_mode",
];

/** A config row as SQLite hands it back: every column possibly NULL, since it
 *  may have come from a LEFT JOIN that found nothing. */
export type ConfigRow = { [K in keyof ExerciseConfig]: ExerciseConfig[K] | null };

export const CONFIG_COLUMN_LIST = CONFIG_COLUMNS.join(", ");
export const CONFIG_PLACEHOLDERS = CONFIG_COLUMNS.map(() => "?").join(", ");

/** Prefixed column list for a JOINed config table, e.g. "sec.load_type, …". */
export function configColumnsOf(alias: string): string {
  return CONFIG_COLUMNS.map((c) => `${alias}.${c}`).join(", ");
}

/** `col = excluded.col, …` for an UPSERT's DO UPDATE clause. */
export const CONFIG_UPSERT_ASSIGNMENTS = CONFIG_COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ");

/** Bind values for an INSERT/UPDATE of all config columns, in column order.
 *  Normalises first, so a dependent field can never be written alongside the
 *  toggle that disables it. */
export function configValues(config: ExerciseConfig): (string | number | null)[] {
  const normalized = normalizeExerciseConfig(config);
  return CONFIG_COLUMNS.map((c) => normalized[c]);
}

/** Rebuilds a config from a row, falling back to the app defaults column by
 *  column. The fallback guards a theoretical missing row (a LEFT JOIN miss) —
 *  the migration backfills one for every exercise and every session-exercise,
 *  but reads must never crash if one slipped through. */
export function rowToConfig(row: Partial<ConfigRow> | null | undefined): ExerciseConfig {
  const config = { ...DEFAULT_EXERCISE_CONFIG };
  if (!row) return config;
  for (const column of CONFIG_COLUMNS) {
    const value = row[column];
    if (value != null) {
      // Each column's runtime type matches its slot in ExerciseConfig; the cast
      // is only needed because the loop erases the per-key correspondence.
      (config[column] as ExerciseConfig[typeof column]) = value as ExerciseConfig[typeof column];
    }
  }
  return config;
}
