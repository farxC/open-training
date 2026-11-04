import type { Permission, RecordType, ReadRecordsOptions, RecordResult } from "react-native-health-connect";
import type { HealthRun, HealthSeries, HealthWorkout } from "./types";
import { validateHealthImport } from "./model";

export const healthConnectSupported = true;
const permissions: Permission[] = (["ExerciseSession", "Distance", "HeartRate", "StepsCadence"] as const).map(
  (recordType) => ({ accessType: "read", recordType })
);

async function sdk() {
  try {
    // Load only on an explicit Android action, so opening Settings in Expo Go
    // still works and can explain that a native build is required.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module: typeof import("react-native-health-connect") = require("react-native-health-connect");
    return module;
  } catch {
    throw new Error("Instale um novo build Android com Health Connect. A integração não funciona no Expo Go.");
  }
}

export async function connectHealth(): Promise<void> {
  const hc = await sdk();
  const status = await hc.getSdkStatus();
  if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new Error("Instale ou atualize o Health Connect no celular e tente novamente. É necessário Android 9 ou superior.");
  }
  if (!await hc.initialize()) throw new Error("Não foi possível iniciar o Health Connect.");
  const granted = await hc.requestPermission(permissions);
  if (!granted.some((p) => p.accessType === "read" && p.recordType === "ExerciseSession")) {
    throw new Error("Permita a leitura de exercícios para buscar suas corridas. As demais métricas são opcionais.");
  }
}

async function readAll<T extends RecordType>(type: T, options: ReadRecordsOptions): Promise<RecordResult<T>[]> {
  const hc = await sdk();
  const records: RecordResult<T>[] = [];
  let pageToken: string | undefined;
  do {
    const page = await hc.readRecords(type, { ...options, pageSize: 1000, pageToken });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

export async function listHealthRuns(): Promise<HealthRun[]> {
  const hc = await sdk();
  const end = new Date();
  // Stay within the default 30-day history permission, with a small clock margin.
  const start = new Date(end.getTime() - 29 * 86400000);
  const records = await readAll("ExerciseSession", {
    timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
  });
  return records.filter((r) => r.exerciseType === hc.ExerciseType.RUNNING || r.exerciseType === hc.ExerciseType.RUNNING_TREADMILL)
    .filter((r) => r.metadata?.id && r.metadata.dataOrigin)
    .map((r) => ({ externalId: r.metadata!.id!, origin: r.metadata!.dataOrigin!, title: r.title || "Corrida",
      start: r.startTime, end: r.endTime }))
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

export async function readHealthWorkout(run: HealthRun): Promise<HealthWorkout> {
  const hc = await sdk();
  const granted = await hc.getGrantedPermissions();
  const canRead = (type: string) => granted.some((p) => p.accessType === "read" && p.recordType === type);
  if (!canRead("ExerciseSession")) throw new Error("A permissão de exercícios foi revogada. Conecte novamente.");
  const options: ReadRecordsOptions = {
    timeRangeFilter: { operator: "between", startTime: run.start, endTime: run.end },
    dataOriginFilter: [run.origin],
  };
  const sessions = await readAll("ExerciseSession", options);
  const current = sessions.find((s) => s.metadata?.id === run.externalId);
  if (!current || current.startTime !== run.start || current.endTime !== run.end) {
    throw new Error("A corrida foi alterada ou removida na origem. Busque novamente.");
  }
  if (sessions.some((s) => s.metadata?.id !== run.externalId && Date.parse(s.startTime) < Date.parse(run.end) &&
      Date.parse(s.endTime) > Date.parse(run.start))) {
    throw new Error("Há exercícios sobrepostos nesta fonte. Resolva a duplicação no Health Connect antes de importar.");
  }
  const [hr, cadence, distance] = await Promise.all([
    canRead("HeartRate") ? readAll("HeartRate", options) : null,
    canRead("StepsCadence") ? readAll("StepsCadence", options) : null,
    canRead("Distance") ? readAll("Distance", options) : null,
  ]);
  const start = Date.parse(run.start), end = Date.parse(run.end);
  const inRange = (time: string) => Date.parse(time) >= start && Date.parse(time) < end;
  const metadata = (r: { metadata?: { id?: string; lastModifiedTime?: string; device?: { manufacturer?: string; model?: string; type?: number } } }) => ({
    externalId: r.metadata?.id ?? "",
    modifiedAt: r.metadata?.lastModifiedTime ?? null,
    device: r.metadata?.device ? JSON.stringify([r.metadata.device.manufacturer ?? null,
      r.metadata.device.model ?? null, r.metadata.device.type ?? null]) : null,
  });
  const heartRate: HealthSeries[] | null = hr?.map((r) => ({ ...metadata(r), samples: r.samples
    .filter((s) => inRange(s.time) && Number.isFinite(s.beatsPerMinute) && s.beatsPerMinute > 0)
    .map((s) => ({ time: Date.parse(s.time), value: s.beatsPerMinute })) })) ?? null;
  const cadenceSeries: HealthSeries[] | null = cadence?.map((r) => ({ ...metadata(r), samples: r.samples
    .filter((s) => inRange(s.time) && Number.isFinite(s.rate) && s.rate >= 0)
    .map((s) => ({ time: Date.parse(s.time), value: s.rate })) })) ?? null;
  // Do not prorate partially overlapping distance records or add competing sensors.
  const distances = distance?.filter((r) => Date.parse(r.startTime) >= start && Date.parse(r.endTime) <= end)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const distanceValid = distances?.length && distances.length === distance?.length &&
    Date.parse(distances[0].startTime) === start && Date.parse(distances[distances.length - 1].endTime) === end &&
    new Set(distances.map((r) => metadata(r).device)).size === 1 &&
    distances.every((r, i) => Number.isFinite(r.distance.inMeters) && r.distance.inMeters >= 0 &&
      (i === 0 || Date.parse(r.startTime) === Date.parse(distances[i - 1].endTime)));
  const workout: HealthWorkout = {
    version: 1, ...run, modifiedAt: current.metadata?.lastModifiedTime ?? null,
    distanceKm: distanceValid ? distances!.reduce((sum, r) => sum + r.distance.inMeters, 0) / 1000 : null,
    heartRate, cadence: cadenceSeries, heartRateAverage: null, cadenceAverage: null,
  };
  // Check sensor ambiguity before asking the provider for an aggregate of this source.
  validateHealthImport({ uuid: "validation", sourceScope: "validation", workout });
  if (heartRate?.some((r) => r.samples.length)) {
    const average = (await hc.aggregateRecord({ recordType: "HeartRate", ...options })).BPM_AVG;
    workout.heartRateAverage = Number.isFinite(average) && average > 0 ? average : null;
  }
  if (cadenceSeries?.some((r) => r.samples.length)) {
    const result = await hc.aggregateRecord({ recordType: "StepsCadence", ...options });
    // The v3 bridge serializes an absent aggregate as zero. Origin attribution
    // distinguishes that absence from a real all-zero cadence series.
    const average = result.RATE_AVG;
    workout.cadenceAverage = result.dataOrigins.includes(run.origin) && Number.isFinite(average) && average >= 0 ? average : null;
  }
  return workout;
}

export async function openHealthSettings(): Promise<void> {
  (await sdk()).openHealthConnectSettings();
}
