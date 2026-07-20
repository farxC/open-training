import type { MuscleGroup, MuscleSeriesRow } from "@/types";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  legs: "Legs",
  femoral: "Femoral",
  glutes: "Glutes",
  core: "Core",
  cardio: "Cardio",
  full_body: "Full Body",
};

// Muscle groups offered when creating/editing a strength exercise (cardio is implied for corrida).
export const MUSCLE_OPTIONS: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "legs", "femoral", "glutes", "core", "full_body",
];

export function muscleGroupLabel(mg: string): string {
  return MUSCLE_LABELS[mg as MuscleGroup] ?? mg;
}

/** Formats a MuscleSeriesRow's value: raw totals round to the nearest 0.5 (guards
 *  float noise from summing 0.5/1.0 counting factors), while weekly averages are
 *  genuinely fractional and get one decimal place instead. */
export function formatMuscleSeriesValue(row: MuscleSeriesRow): string {
  if (!row.isAverage) {
    const rounded = Math.round(row.value * 2) / 2;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return row.value.toFixed(1);
}
