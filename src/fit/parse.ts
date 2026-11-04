import { Decoder, Stream } from "@garmin/fitsdk";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import type { HealthSample } from "../health/types";
import { MAX_FIT_BYTES, type FitActivity } from "./types";
import { validateFitImport } from "./validate";

function nonnegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function positive(value: unknown): number | null {
  const n = nonnegative(value);
  return n !== null && n > 0 ? n : null;
}
function time(value: unknown): number | null {
  const n = value instanceof Date ? value.getTime() : typeof value === "number" ? Date.UTC(1989, 11, 31) + value * 1000 : NaN;
  return Number.isFinite(n) ? n : null;
}
function cadence(whole: unknown, fractional: unknown): number | null {
  const n = nonnegative(whole);
  // SDK already applies fractional field's /128 scale. Running cadence is
  // strides/min in FIT; our canonical unit counts both feet, steps/min.
  return n === null ? null : (n + (nonnegative(fractional) ?? 0)) * 2;
}

export function parseFitFile(bytes: Uint8Array, fileName: string): FitActivity {
  if (bytes.byteLength > MAX_FIT_BYTES) throw new Error("O arquivo FIT excede o limite de 20 MB.");
  if (bytes.byteLength < 14) throw new Error("Arquivo FIT vazio ou incompleto.");
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error("Arquivo FIT inválido ou corrompido (verificação de integridade).");
  const { messages, errors } = decoder.read({ convertTypesToStrings: false, convertDateTimesToDates: true,
    applyScaleAndOffset: true, expandSubFields: true, expandComponents: true, includeUnknownData: false });
  if (errors.length) throw new Error("Não foi possível decodificar o arquivo FIT completo.");
  const file = messages.fileIdMesgs?.[0];
  if (messages.fileIdMesgs?.length !== 1 || file?.type !== 4) throw new Error("Selecione um arquivo FIT de atividade, não de rota ou planejamento.");
  if (messages.sessionMesgs?.length !== 1) throw new Error("Importe um FIT com uma única sessão. Arquivos multiesporte ainda não são suportados.");
  const session = messages.sessionMesgs[0];
  if (session.sport !== 1) throw new Error("Este importador aceita arquivos FIT de corrida. Outras modalidades ainda não são suportadas.");
  const start = time(session.startTime);
  const end = time(session.timestamp) ?? (start !== null && positive(session.totalElapsedTime) !== null ? start + session.totalElapsedTime! * 1000 : null);
  if (start === null || end === null || end <= start) throw new Error("O FIT não informa início e fim válidos da corrida.");
  const fileHash = bytesToHex(sha256(bytes));
  const identity = file.manufacturer !== undefined && positive(file.serialNumber) !== null && time(file.timeCreated) !== null
    ? JSON.stringify([file.manufacturer, file.product ?? null, file.serialNumber, time(file.timeCreated), start]) : fileHash;
  const activityKey = bytesToHex(sha256(identity));
  const creator = messages.deviceInfoMesgs?.find((d) => d.deviceIndex === 0);
  const deviceName = creator?.productName || file.productName || null;
  const heart: HealthSample[] = [], steps: HealthSample[] = [];
  for (const record of messages.recordMesgs ?? []) {
    const at = time(record.timestamp);
    if (at === null || at < start || at > end) continue;
    const hr = positive(record.heartRate);
    const highResolutionCadence = nonnegative(record.cadence256);
    const cad = highResolutionCadence === null ? cadence(record.cadence, record.fractionalCadence) : highResolutionCadence * 2;
    if (hr !== null) heart.push({ time: at, value: hr });
    if (cad !== null) steps.push({ time: at, value: cad });
  }
  const series = (samples: HealthSample[], metric: string) => samples.length ? [{ externalId: `${activityKey}:${metric}`,
    modifiedAt: null, device: deviceName, samples }] : [];
  const activity: FitActivity = {
    version: 1, fileName, fileHash, activityKey, deviceName,
    elapsedSeconds: (end - start) / 1000,
    timerSeconds: positive(session.totalTimerTime),
    heartRateMaximum: positive(session.maxHeartRate),
    cadenceMaximum: cadence(session.maxCadence, session.maxFractionalCadence),
    laps: (messages.lapMesgs ?? []).map((lap) => {
      const from = time(lap.startTime), to = time(lap.timestamp);
      if (from === null || to === null || from < start || to > end || to <= from) throw new Error("O FIT contém voltas com horários inválidos.");
      const distance = nonnegative(lap.totalDistance);
      return { start: new Date(from).toISOString(), end: new Date(to).toISOString(),
        distanceKm: distance === null ? null : distance / 1000, timerSeconds: positive(lap.totalTimerTime) };
    }),
    workout: {
      version: 1, externalId: activityKey, origin: "fit", title: "Corrida importada de FIT",
      start: new Date(start).toISOString(), end: new Date(end).toISOString(), modifiedAt: null,
      distanceKm: nonnegative(session.totalDistance) === null ? null : session.totalDistance! / 1000,
      heartRate: series(heart, "heart-rate"), cadence: series(steps, "cadence"),
      heartRateAverage: positive(session.avgHeartRate), cadenceAverage: cadence(session.avgCadence, session.avgFractionalCadence),
    },
  };
  validateFitImport({ uuid: "preview", activity });
  return activity;
}
