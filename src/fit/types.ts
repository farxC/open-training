import type { HealthWorkout } from "../health/types";

export interface FitLap {
  start: string;
  end: string;
  distanceKm: number | null;
  timerSeconds: number | null;
}

export interface FitActivity {
  version: 1;
  fileName: string;
  fileHash: string;
  /** File creator identity + session start, or file hash when identity is absent. */
  activityKey: string;
  deviceName: string | null;
  elapsedSeconds: number;
  timerSeconds: number | null;
  heartRateMaximum: number | null;
  cadenceMaximum: number | null;
  laps: FitLap[];
  workout: HealthWorkout;
}

export interface FitImport {
  uuid: string;
  activity: FitActivity;
}

export const MAX_FIT_BYTES = 20 * 1024 * 1024;
