export type MuscleGroup =
  | "chest"
  | "back"
  | "traps"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "femoral"
  | "glutes"
  | "calves"
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

/** Source of truth for the behaviour of each value: MODALITIES in src/data/modalities.ts. */
export type Modality = "musculacao" | "corrida" | "ciclismo" | "natacao" | "caminhada";

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
/** How the hands hold the implement. Null means "doesn't apply" (leg press, squat…). */
export type GripType = "pronated" | "supinated" | "neutral" | "mixed";
/** Hand spacing relative to shoulder width. Null means "doesn't apply". */
export type GripWidth = "close" | "medium" | "wide";
/** How to read the logged load on a bodyweight movement: the total weight moved,
 *  extra weight hung on the body, or assistance subtracted from it. Null when the
 *  exercise doesn't use bodyweight. */
export type LoadMode = "total" | "added" | "assisted";

/** Physical configuration of an exercise — how it's actually executed, which
 *  changes how logged load should be interpreted. Every exercise has exactly one
 *  (its default). Adding the exercise to a session copies it into an independent
 *  per-session snapshot, so editing the default never rewrites history. */
export interface ExerciseConfig {
  resistance_curve: ResistanceCurve;
  load_type: LoadType;
  pulley_type: PulleyType | null;
  laterality: Laterality;
  rom: RangeOfMotion;
  uses_bench: 0 | 1;
  /** Degrees: 0 = flat, positive = incline, negative = decline. Null when uses_bench is 0. */
  bench_angle_degrees: number | null;
  grip_type: GripType | null;
  grip_width: GripWidth | null;
  uses_bodyweight: 0 | 1;
  /** Null when uses_bodyweight is 0. */
  load_mode: LoadMode | null;
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
  config: ExerciseConfig;
  /** Soft-delete: archived exercises stay in history but disappear from pickers. */
  is_archived: 0 | 1;
}
