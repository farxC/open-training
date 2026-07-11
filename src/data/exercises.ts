import type { Exercise } from "@/types";

// Modality is assigned at insert time: everything in SEED_EXERCISES is "musculacao";
// SEED_RUNNING_EXERCISES is "corrida".
export const SEED_RUNNING_EXERCISES: Omit<Exercise, "id" | "modality" | "uuid">[] = [
  { name: "Correr", muscle_group: "cardio", equipment: "bodyweight", type: "compound", is_custom: 0 },
];

export const SEED_EXERCISES: Omit<Exercise, "id" | "modality" | "uuid">[] = [
  // Chest
  { name: "Barbell Bench Press", muscle_group: "chest", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Incline Barbell Bench Press", muscle_group: "chest", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Decline Barbell Bench Press", muscle_group: "chest", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Dumbbell Bench Press", muscle_group: "chest", equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Incline Dumbbell Fly", muscle_group: "chest", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Cable Crossover", muscle_group: "chest", equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Pec Deck", muscle_group: "chest", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Push-Up", muscle_group: "chest", equipment: "bodyweight", type: "compound", is_custom: 0 },

  // Back
  { name: "Deadlift", muscle_group: "back", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Barbell Row", muscle_group: "back", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Pull-Up", muscle_group: "back", equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Chin-Up", muscle_group: "back", equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Lat Pulldown", muscle_group: "back", equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Seated Cable Row", muscle_group: "back", equipment: "cable", type: "compound", is_custom: 0 },
  { name: "T-Bar Row", muscle_group: "back", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Single-Arm Dumbbell Row", muscle_group: "back", equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Face Pull", muscle_group: "back", equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Straight-Arm Pulldown", muscle_group: "back", equipment: "cable", type: "isolation", is_custom: 0 },

  // Shoulders
  { name: "Barbell Overhead Press", muscle_group: "shoulders", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Dumbbell Shoulder Press", muscle_group: "shoulders", equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Arnold Press", muscle_group: "shoulders", equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Lateral Raise", muscle_group: "shoulders", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Cable Lateral Raise", muscle_group: "shoulders", equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Front Raise", muscle_group: "shoulders", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Rear Delt Fly", muscle_group: "shoulders", equipment: "dumbbell", type: "isolation", is_custom: 0 },

  // Biceps
  { name: "Barbell Curl", muscle_group: "biceps", equipment: "barbell", type: "isolation", is_custom: 0 },
  { name: "EZ-Bar Curl", muscle_group: "biceps", equipment: "barbell", type: "isolation", is_custom: 0 },
  { name: "Dumbbell Curl", muscle_group: "biceps", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Hammer Curl", muscle_group: "biceps", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Preacher Curl", muscle_group: "biceps", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Concentration Curl", muscle_group: "biceps", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Cable Curl", muscle_group: "biceps", equipment: "cable", type: "isolation", is_custom: 0 },

  // Triceps
  { name: "Close-Grip Bench Press", muscle_group: "triceps", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Tricep Dip", muscle_group: "triceps", equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Skull Crusher", muscle_group: "triceps", equipment: "barbell", type: "isolation", is_custom: 0 },
  { name: "Tricep Pushdown", muscle_group: "triceps", equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Overhead Tricep Extension", muscle_group: "triceps", equipment: "dumbbell", type: "isolation", is_custom: 0 },
  { name: "Diamond Push-Up", muscle_group: "triceps", equipment: "bodyweight", type: "compound", is_custom: 0 },

  // Legs
  { name: "Barbell Back Squat", muscle_group: "legs", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Front Squat", muscle_group: "legs", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Leg Press", muscle_group: "legs", equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Romanian Deadlift", muscle_group: "legs", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Hack Squat", muscle_group: "legs", equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Bulgarian Split Squat", muscle_group: "legs", equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Walking Lunge", muscle_group: "legs", equipment: "dumbbell", type: "compound", is_custom: 0 },
  { name: "Leg Extension", muscle_group: "legs", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Lying Leg Curl", muscle_group: "legs", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Seated Leg Curl", muscle_group: "legs", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Standing Calf Raise", muscle_group: "legs", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Seated Calf Raise", muscle_group: "legs", equipment: "machine", type: "isolation", is_custom: 0 },

  // Glutes
  { name: "Hip Thrust", muscle_group: "glutes", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Glute Bridge", muscle_group: "glutes", equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Cable Kickback", muscle_group: "glutes", equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Hip Abduction Machine", muscle_group: "glutes", equipment: "machine", type: "isolation", is_custom: 0 },
  { name: "Sumo Deadlift", muscle_group: "glutes", equipment: "barbell", type: "compound", is_custom: 0 },

  // Core
  { name: "Plank", muscle_group: "core", equipment: "bodyweight", type: "isolation", is_custom: 0 },
  { name: "Crunch", muscle_group: "core", equipment: "bodyweight", type: "isolation", is_custom: 0 },
  { name: "Cable Crunch", muscle_group: "core", equipment: "cable", type: "isolation", is_custom: 0 },
  { name: "Hanging Leg Raise", muscle_group: "core", equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Ab Wheel Rollout", muscle_group: "core", equipment: "other", type: "compound", is_custom: 0 },
  { name: "Russian Twist", muscle_group: "core", equipment: "bodyweight", type: "isolation", is_custom: 0 },

  // Full body
  { name: "Kettlebell Swing", muscle_group: "full_body", equipment: "kettlebell", type: "compound", is_custom: 0 },
  { name: "Thruster", muscle_group: "full_body", equipment: "barbell", type: "compound", is_custom: 0 },
  { name: "Burpee", muscle_group: "full_body", equipment: "bodyweight", type: "compound", is_custom: 0 },
  { name: "Power Clean", muscle_group: "full_body", equipment: "barbell", type: "compound", is_custom: 0 },

  // Cardio
  { name: "Treadmill Run", muscle_group: "cardio", equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Rowing Machine", muscle_group: "cardio", equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Stationary Bike", muscle_group: "cardio", equipment: "machine", type: "compound", is_custom: 0 },
  { name: "Jump Rope", muscle_group: "cardio", equipment: "other", type: "compound", is_custom: 0 },
  { name: "Stair Master", muscle_group: "cardio", equipment: "machine", type: "compound", is_custom: 0 },
];
