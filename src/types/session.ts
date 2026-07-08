export interface Session {
  id: number;
  date: string;
  notes: string | null;
  duration_seconds: number | null;
  photo_uri: string | null;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
}

export interface SessionWithSets extends Session {
  sets: (WorkoutSet & { exercise_name: string })[];
}

export interface SessionSummary extends Session {
  total_volume: number | null;
  exercise_names: string[];
}
