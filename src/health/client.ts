import type { HealthRun, HealthWorkout } from "./types";

export const healthConnectSupported = false;
export async function connectHealth(): Promise<void> {
  throw new Error("Health Connect está disponível no aplicativo Android.");
}
export async function listHealthRuns(): Promise<HealthRun[]> { return []; }
export async function readHealthWorkout(_run: HealthRun): Promise<HealthWorkout> {
  throw new Error("Health Connect está disponível no aplicativo Android.");
}
export async function openHealthSettings(): Promise<void> {}
