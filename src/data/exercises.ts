import type { Exercise, MuscleGroup } from "@/types";

type SeedExercise = Omit<Exercise, "id" | "modality" | "uuid" | "muscle_groups"> & {
  muscle_groups: MuscleGroup[];
};

// Modality is assigned at insert time: everything in SEED_EXERCISES is "musculacao";
// SEED_RUNNING_EXERCISES is "corrida".
export const SEED_RUNNING_EXERCISES: SeedExercise[] = [
  { name: "Correr", muscle_groups: ["cardio"], equipment: "bodyweight", type: "compound", is_custom: 0 },
];

export const SEED_EXERCISES: SeedExercise[] = [
  // Chest
  { name: "Barbell Bench Press", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Incline Barbell Bench Press", muscle_groups: ["chest", "shoulders", "triceps"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Decline Barbell Bench Press", muscle_groups: ["chest", "triceps"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Dumbbell Bench Press", muscle_groups: ["chest", "shoulders", "triceps"], equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Incline Dumbbell Fly", muscle_groups: ["chest"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Cable Crossover", muscle_groups: ["chest"], equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Pec Deck", muscle_groups: ["chest"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Push-Up", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "bodyweight", type: "compound", is_custom: 0 },

  // Back
  { name: "Deadlift", muscle_groups: ["back", "glutes", "femoral"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Barbell Row", muscle_groups: ["back", "biceps"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Pull-Up", muscle_groups: ["back", "biceps"], equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Chin-Up", muscle_groups: ["back", "biceps"], equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Lat Pulldown", muscle_groups: ["back", "biceps"], equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Seated Cable Row", muscle_groups: ["back", "biceps"], equipment: "cable", type: "compound", is_custom: 0 },
  { name: "T-Bar Row", muscle_groups: ["back", "biceps"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Single-Arm Dumbbell Row", muscle_groups: ["back", "biceps"], equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Face Pull", muscle_groups: ["shoulders", "back"], equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Straight-Arm Pulldown", muscle_groups: ["back"], equipment: "cable", type: "isolation", is_custom: 0 },

  // Shoulders
  { name: "Barbell Overhead Press", muscle_groups: ["shoulders", "triceps"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Dumbbell Shoulder Press", muscle_groups: ["shoulders", "triceps"], equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Arnold Press", muscle_groups: ["shoulders", "triceps"], equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Lateral Raise", muscle_groups: ["shoulders"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Cable Lateral Raise", muscle_groups: ["shoulders"], equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Front Raise", muscle_groups: ["shoulders"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Rear Delt Fly", muscle_groups: ["shoulders"], equipment: "dumbbell", type: "isolation", is_custom: 0 },

  // Biceps
  { name: "Barbell Curl", muscle_groups: ["biceps"], equipment: "barbell", type: "isolation", is_custom: 0 },
  { name: "EZ-Bar Curl", muscle_groups: ["biceps"], equipment: "barbell", type: "isolation", is_custom: 0 },
  { name: "Dumbbell Curl", muscle_groups: ["biceps"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Hammer Curl", muscle_groups: ["biceps"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Preacher Curl", muscle_groups: ["biceps"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Concentration Curl", muscle_groups: ["biceps"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Cable Curl", muscle_groups: ["biceps"], equipment: "cable", type: "isolation", is_custom: 0 },

  // Triceps
  { name: "Close-Grip Bench Press", muscle_groups: ["triceps", "chest", "shoulders"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Tricep Dip", muscle_groups: ["triceps", "chest", "shoulders"], equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Skull Crusher", muscle_groups: ["triceps"], equipment: "barbell", type: "isolation", is_custom: 0 },
  { name: "Tricep Pushdown", muscle_groups: ["triceps"], equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Overhead Tricep Extension", muscle_groups: ["triceps"], equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Diamond Push-Up", muscle_groups: ["triceps", "chest", "shoulders"], equipment: "bodyweight", type: "compound", is_custom: 0 },

  // Legs
  { name: "Barbell Back Squat", muscle_groups: ["legs", "glutes", "core"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Front Squat", muscle_groups: ["legs", "glutes", "core"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Leg Press", muscle_groups: ["legs", "glutes"], equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Romanian Deadlift", muscle_groups: ["femoral", "glutes", "back"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Hack Squat", muscle_groups: ["legs", "glutes"], equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Bulgarian Split Squat", muscle_groups: ["legs", "glutes"], equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Walking Lunge", muscle_groups: ["legs", "glutes"], equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Leg Extension", muscle_groups: ["legs"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Lying Leg Curl", muscle_groups: ["femoral"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Seated Leg Curl", muscle_groups: ["femoral"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Standing Calf Raise", muscle_groups: ["legs"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Seated Calf Raise", muscle_groups: ["legs"], equipment: "machine", type: "isolation", is_custom: 0 },

  // Glutes
  { name: "Hip Thrust", muscle_groups: ["glutes", "femoral"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Glute Bridge", muscle_groups: ["glutes", "femoral"], equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Cable Kickback", muscle_groups: ["glutes"], equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Hip Abduction Machine", muscle_groups: ["glutes"], equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Sumo Deadlift", muscle_groups: ["glutes", "femoral", "legs"], equipment: "barbell", type: "compound", is_custom: 0 },

  // Core
  { name: "Plank", muscle_groups: ["core"], equipment: "bodyweight", type: "isolation", is_custom: 0 },
  { name: "Crunch", muscle_groups: ["core"], equipment: "bodyweight", type: "isolation", is_custom: 0 },
  { name: "Cable Crunch", muscle_groups: ["core"], equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Hanging Leg Raise", muscle_groups: ["core"], equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Ab Wheel Rollout", muscle_groups: ["core", "shoulders"], equipment: "other", type: "compound", is_custom: 0 },
  { name: "Russian Twist", muscle_groups: ["core"], equipment: "bodyweight", type: "isolation", is_custom: 0 },

  // Full body
  { name: "Kettlebell Swing", muscle_groups: ["full_body"], equipment: "kettlebell", type: "compound", is_custom: 0 },
  { name: "Thruster", muscle_groups: ["full_body"], equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Burpee", muscle_groups: ["full_body"], equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Power Clean", muscle_groups: ["full_body"], equipment: "barbell", type: "compound", is_custom: 0 },

  // Cardio
  { name: "Treadmill Run", muscle_groups: ["cardio"], equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Rowing Machine", muscle_groups: ["cardio"], equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Stationary Bike", muscle_groups: ["cardio"], equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Jump Rope", muscle_groups: ["cardio"], equipment: "other", type: "compound", is_custom: 0 },
  { name: "Stair Master", muscle_groups: ["cardio"], equipment: "machine", type: "compound", is_custom: 0 },
];
