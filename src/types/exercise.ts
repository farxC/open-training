export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "femoral"
  | "glutes"
  | "core"
  | "cardio"
  | "full_body";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

export type ExerciseType = "compound" | "isolation";

export type Modality = "musculacao" | "corrida";

/** How much of a full set a muscle group earns for this exercise (1 = full, 0.5 = half). */
export interface ExerciseMuscleGroup {
  muscle_group: MuscleGroup;
  counting_factor: number;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_groups: ExerciseMuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  is_custom: 0 | 1;
  modality: Modality;
  uuid: string;
}
