import type { HealthImport, HealthSeries, HealthWorkout } from "./types";

export function samplesOf(records: HealthSeries[] | null) {
  const samples = (records ?? []).flatMap((r) => r.samples);
  const byTime = new Map<number, number>();
  for (const sample of samples) {
    if (byTime.has(sample.time) && byTime.get(sample.time) !== sample.value) {
      throw new Error("Há medições conflitantes no mesmo horário. Verifique a fonte no Health Connect.");
    }
    byTime.set(sample.time, sample.value);
  }
  return [...byTime].map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);
}

export function maxOf(records: HealthSeries[] | null): number | null {
  return samplesOf(records).reduce<number | null>((max, s) => max === null ? s.value : Math.max(max, s.value), null);
}

/** Also used on backup input, before opening a write transaction. */
export function validateHealthImport(value: unknown, source = "Health Connect", includeEnd = false): asserts value is HealthImport {
  const fail = () => { throw new Error(`Dados de ${source} inválidos.`); };
  if (!value || typeof value !== "object") return fail();
  const link = value as HealthImport;
  if (!link.uuid || typeof link.uuid !== "string" || !link.sourceScope || typeof link.sourceScope !== "string") return fail();
  const w = link.workout;
  if (!w || w.version !== 1 || typeof w.externalId !== "string" || !w.externalId ||
      typeof w.origin !== "string" || !w.origin || typeof w.title !== "string" ||
      !validTime(w.start) || !validTime(w.end) || Date.parse(w.start) >= Date.parse(w.end) ||
      !(w.modifiedAt === null || validTime(w.modifiedAt))) return fail();
  for (const n of [w.distanceKm, w.heartRateAverage, w.cadenceAverage]) {
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0)) return fail();
  }
  if (w.heartRateAverage !== null && w.heartRateAverage <= 0) return fail();
  for (const key of ["heartRate", "cadence"] as const) {
    const records = w[key];
    if (records === null) continue;
    if (!Array.isArray(records)) return fail();
    const ids = new Set<string>();
    const devices = new Set<string>();
    for (const r of records) {
      if (!r || typeof r.externalId !== "string" || !r.externalId || ids.has(r.externalId) ||
          !(r.modifiedAt === null || validTime(r.modifiedAt)) ||
          !(r.device === null || typeof r.device === "string") || !Array.isArray(r.samples)) return fail();
      ids.add(r.externalId);
      if (r.samples.length) devices.add(r.device ?? "unknown");
      for (const s of r.samples) {
        if (!s || !Number.isFinite(s.time) || !Number.isFinite(s.value) ||
            s.time < Date.parse(w.start) || (includeEnd ? s.time > Date.parse(w.end) : s.time >= Date.parse(w.end)) ||
            s.value < 0 || (key === "heartRate" && s.value === 0)) return fail();
      }
    }
    if (devices.size > 1) throw new Error("Há dados de mais de um dispositivo nesta fonte. Verifique a origem no Health Connect antes de importar.");
    samplesOf(records);
  }
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/** Preserve data for a metric whose permission was denied after an earlier sync. */
export function mergeWorkout(previous: HealthWorkout | null, next: HealthWorkout): HealthWorkout {
  return {
    ...next,
    heartRate: next.heartRate ?? previous?.heartRate ?? null,
    cadence: next.cadence ?? previous?.cadence ?? null,
    heartRateAverage: next.heartRate === null ? previous?.heartRateAverage ?? null : next.heartRateAverage,
    cadenceAverage: next.cadence === null ? previous?.cadenceAverage ?? null : next.cadenceAverage,
    distanceKm: next.distanceKm ?? previous?.distanceKm ?? null,
  };
}
