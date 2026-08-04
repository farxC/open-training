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

// Muscle groups offered when creating/editing a strength exercise. `cardio` is
// omitted on purpose: it's carried by the gym-machine seeds (Treadmill Run,
// Rowing Machine, …) but isn't something you'd assign by hand, and endurance
// modalities carry no muscle groups at all.
export const MUSCLE_OPTIONS: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "legs", "femoral", "glutes", "core", "full_body",
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

/** Series count with its unit: "12 séries" for a raw total, "10.2 séries/sem"
 *  for a weekly average. */
export function formatSeriesLabel(value: number, isAverage: boolean): string {
  const number = formatSeriesNumber(value, isAverage);
  if (isAverage) return `${number} séries/sem`;
  return `${number} ${number === "1" ? "série" : "séries"}`;
}

/** Training frequency: "2×" for a raw session count in one week, "2.0×/sem" for
 *  an average across the window. */
export function formatFrequencyLabel(value: number, isAverage: boolean): string {
  return isAverage ? `${value.toFixed(1)}×/sem` : `${value}×`;
}
