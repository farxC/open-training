import type { Modality } from "./exercise";

export interface Session {
  id: number;
  date: string;
  name: string | null;
  notes: string | null;
  duration_seconds: number | null;
  /** @deprecated superseded by session_photos (multi-photo). Read-only; new code must not write it. */
  photo_uri: string | null;
  modality: Modality;
  split_id: number | null;
  unit_id: number | null;
  program_week_id: number | null;
  uuid: string;
}

export interface SessionPhoto {
  id: number;
  session_id: number;
  uri: string;
  order: number;
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
  distance_km: number | null;
  duration_sec: number | null;
  pace_sec: number | null;
}

export interface SessionWithSets extends Session {
  sets: (WorkoutSet & { exercise_name: string })[];
  photos: SessionPhoto[];
  split_name: string | null;
  unit_label: string | null;
}

export interface SessionSummary extends Session {
  total_volume: number | null;
  total_distance_km: number | null;
  exercise_names: string[];
  cover_photo_uri: string | null;
}
