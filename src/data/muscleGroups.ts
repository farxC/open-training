import type { MuscleGroup } from "@/types";

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
