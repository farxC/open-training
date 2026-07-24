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

/** Where along the range of motion resistance is highest. */
export type ResistanceCurve = "ascending" | "descending" | "constant" | "bell";
/** How load is applied — free weight, stacked plates, or a pulley/cable system. */
export type LoadType = "free" | "plate" | "pulley";
/** Only meaningful when load_type is "pulley"; null otherwise. */
export type PulleyType = "mobile" | "fixed";
export type Laterality = "bilateral" | "unilateral";
export type RangeOfMotion = "full" | "partial";

/** Physical configuration of an exercise — how it's actually executed, which
 *  changes how logged load should be interpreted. Every exercise has exactly
 *  one (its default); a session-logged exercise may partially override it. */
export interface ExerciseConfig {
  resistance_curve: ResistanceCurve;
  load_type: LoadType;
  pulley_type: PulleyType | null;
  laterality: Laterality;
  rom: RangeOfMotion;
  uses_bench: 0 | 1;
  /** Degrees: 0 = flat, positive = incline, negative = decline. Null when uses_bench is 0. */
  bench_angle_degrees: number | null;
}

/** A per-session-exercise override: each field is either a concrete value or
 *  null, meaning "inherit the exercise's default for this field". */
export type ExerciseConfigOverride = { [K in keyof ExerciseConfig]: ExerciseConfig[K] | null };

export interface Exercise {
  id: number;
  name: string;
  muscle_groups: ExerciseMuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  is_custom: 0 | 1;
  modality: Modality;
  uuid: string;
  config: ExerciseConfig;
}
