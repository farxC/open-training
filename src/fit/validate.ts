import { validateHealthImport } from "../health/model";
import type { FitImport } from "./types";

export function validateFitImport(value: unknown): asserts value is FitImport {
  const fail = () => { throw new Error("Dados da importação FIT inválidos."); };
  if (!value || typeof value !== "object") return fail();
  const link = value as FitImport, a = link.activity;
  if (typeof link.uuid !== "string" || !link.uuid || !a || a.version !== 1 ||
      typeof a.fileName !== "string" || !a.fileName || typeof a.fileHash !== "string" || !/^[a-f0-9]{64}$/.test(a.fileHash) ||
      typeof a.activityKey !== "string" || !/^[a-f0-9]{64}$/.test(a.activityKey) ||
      !(a.deviceName === null || typeof a.deviceName === "string")) return fail();
  validateHealthImport({ uuid: link.uuid, sourceScope: "fit", workout: a.workout }, "FIT", true);
  if (a.workout.externalId !== a.activityKey || a.workout.origin !== "fit" ||
      !Number.isFinite(a.elapsedSeconds) || a.elapsedSeconds <= 0 ||
      Math.abs(a.elapsedSeconds - (Date.parse(a.workout.end) - Date.parse(a.workout.start)) / 1000) > 0.001) return fail();
  for (const n of [a.timerSeconds, a.heartRateMaximum, a.cadenceMaximum]) {
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0)) return fail();
  }
  if (a.timerSeconds !== null && (a.timerSeconds <= 0 || a.timerSeconds > a.elapsedSeconds + 1)) return fail();
  if (a.heartRateMaximum !== null && a.heartRateMaximum <= 0) return fail();
  if (a.heartRateMaximum !== null && a.workout.heartRateAverage !== null && a.workout.heartRateAverage > a.heartRateMaximum) return fail();
  if (a.cadenceMaximum !== null && a.workout.cadenceAverage !== null && a.workout.cadenceAverage > a.cadenceMaximum) return fail();
  if (!Array.isArray(a.laps)) return fail();
  for (const lap of a.laps) {
    if (!lap || typeof lap.start !== "string" || typeof lap.end !== "string") return fail();
    const start = Date.parse(lap.start), end = Date.parse(lap.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < Date.parse(a.workout.start) || end <= start || end > Date.parse(a.workout.end)) return fail();
    for (const n of [lap.distanceKm, lap.timerSeconds]) {
      if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0)) return fail();
    }
    if (lap.timerSeconds !== null && lap.timerSeconds > (end - start) / 1000 + 1) return fail();
  }
}
