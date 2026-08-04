import type { MuscleGroup, MuscleSeriesRow } from "@/types";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  traps: "Traps",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  legs: "Legs",
  femoral: "Femoral",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  cardio: "Cardio",
  full_body: "Full Body",
};

// Muscle groups offered when creating/editing a strength exercise. `cardio` is
// omitted on purpose: it's carried by the gym-machine seeds (Treadmill Run,
// Rowing Machine, …) but isn't something you'd assign by hand, and endurance
// modalities carry no muscle groups at all.
export const MUSCLE_OPTIONS: MuscleGroup[] = [
  "chest", "back", "traps", "shoulders", "biceps", "triceps", "legs", "femoral", "glutes", "calves",
  "core", "full_body",
];

export function muscleGroupLabel(mg: string): string {
  return MUSCLE_LABELS[mg as MuscleGroup] ?? mg;
}

/** Formats a series count: raw totals round to the nearest 0.5 (guards float
 *  noise from summing 0.5/1.0 counting factors), while weekly averages are
 *  genuinely fractional and get one decimal place instead. */
export function formatSeriesNumber(value: number, isAverage: boolean): string {
  if (!isAverage) {
    const rounded = Math.round(value * 2) / 2;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return value.toFixed(1);
}

export function formatMuscleSeriesValue(row: MuscleSeriesRow): string {
  return formatSeriesNumber(row.value, row.isAverage);
}

/** The bare frequency number, for layouts that set the unit in its own type. */
export function formatFrequencyNumber(value: number, isAverage: boolean): string {
  return isAverage ? value.toFixed(1) : String(value);
}

/** The unit that follows a series number, split out so the number can carry the
 *  display weight and the unit sit quietly beside it. */
export function seriesUnit(value: number, isAverage: boolean): string {
  if (isAverage) return "séries/sem";
  return formatSeriesNumber(value, false) === "1" ? "série" : "séries";
}
