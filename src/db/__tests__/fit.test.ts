import { createInMemoryDb } from "./testDb";
import { runMigrations } from "../migrations";
import type { DbHandle } from "../dbHandle";
import type { FitActivity } from "../../fit/types";
import { getFitImport, importFitActivity } from "../fit";
import { getHealthImport, importHealthWorkout } from "../healthConnect";
import { createSession, deleteSession, getSessionWithSets, updateSession } from "../queries";
import { buildExportPayload, applyImport } from "../importExportApply";
import { validateExportPayload } from "../importExport";

let mockDb: DbHandle;
jest.mock("../client", () => ({ get db() { return mockDb; } }));
const activity = (): FitActivity => ({
  version: 1, fileName: "running.fit", fileHash: "a".repeat(64), activityKey: "b".repeat(64), deviceName: "Bip 6",
  elapsedSeconds: 1200, timerSeconds: 1100, heartRateMaximum: 160, cadenceMaximum: 180.5,
  laps: [
    { start: "2026-10-10T10:00:00Z", end: "2026-10-10T10:10:00Z", distanceKm: 2, timerSeconds: 550 },
    { start: "2026-10-10T10:10:00Z", end: "2026-10-10T10:20:00Z", distanceKm: 3, timerSeconds: 550 },
  ],
  workout: { version: 1, externalId: "b".repeat(64), origin: "fit", title: "Corrida FIT",
    start: "2026-10-10T10:00:00Z", end: "2026-10-10T10:20:00Z", modifiedAt: null,
    distanceKm: 5, heartRateAverage: 145, cadenceAverage: 165,
    heartRate: [{ externalId: "hr", device: null, modifiedAt: null, samples: [{ time: Date.parse("2026-10-10T10:20:00Z"), value: 160 }] }],
    cadence: [{ externalId: "cad", device: null, modifiedAt: null, samples: [{ time: Date.parse("2026-10-10T10:00:00Z"), value: 160.5 }] }],
  },
});
beforeEach(async () => { mockDb = await createInMemoryDb(); runMigrations(mockDb); });

it("creates one run with lap sets, active duration and pace excluding pauses", () => {
  const id = importFitActivity(activity());
  const session = getSessionWithSets(id)!;
  expect(session.duration_seconds).toBe(1100);
  expect(session.sets.map((s) => s.distance_km)).toEqual([2, 3]);
  expect(session.sets.map((s) => s.pace_sec)).toEqual([275, 183]);
  expect(getFitImport(id)!.activity.workout.cadenceAverage).toBe(165);
});
it("reimports renamed and reexported files without duplicating or replacing manual edits", () => {
  const a = activity(), id = importFitActivity(a);
  const uuid = getFitImport(id)!.uuid;
  updateSession(id, { name: "Meus tiros", notes: "preservar", duration_seconds: 2222 });
  const changed = { ...a, fileName: "renamed.fit", fileHash: "c".repeat(64), cadenceMaximum: 190 };
  expect(importFitActivity(changed)).toBe(id);
  expect(getSessionWithSets(id)?.name).toBe("Meus tiros");
  expect(getSessionWithSets(id)?.notes).toBe("preservar");
  expect(getSessionWithSets(id)?.duration_seconds).toBe(2222);
  expect(getSessionWithSets(id)?.sets).toHaveLength(2);
  expect(getFitImport(id)!.uuid).toBe(uuid);
  expect(getFitImport(id)!.activity.cadenceMaximum).toBe(190);
});
it("uses a total set for partial or overlapping laps instead of double counting distance", () => {
  const a = activity(); a.laps = [a.laps[0], a.laps[0]];
  const id = importFitActivity(a);
  expect(getSessionWithSets(id)?.sets.map((s) => s.distance_km)).toEqual([5]);
  expect(getFitImport(id)!.activity.laps).toHaveLength(2);
});
it("links to the explicitly selected session and can coexist with Health Connect", () => {
  const a = activity();
  const id = createSession("2026-10-10", { modality: "corrida", notes: "manual" });
  importHealthWorkout({ ...a.workout, externalId: "health-run", origin: "zepp", heartRate: [], cadence: [] }, "phone", id);
  const health = getHealthImport(id);
  expect(importFitActivity(a, id)).toBe(id);
  expect(getHealthImport(id)).toEqual(health);
  expect(getSessionWithSets(id)?.sets).toHaveLength(0);
  expect(getSessionWithSets(id)?.notes).toBe("manual");
  const other = createSession("2026-10-10", { modality: "corrida" });
  expect(() => importFitActivity(a, other)).toThrow("outra sessão");
});
it("rolls back invalid imports and rejects linking to another modality", () => {
  const id = createSession("2026-10-10");
  expect(() => importFitActivity(activity(), id)).toThrow("sessão de corrida");
  const a = activity(); a.timerSeconds = -1;
  expect(() => importFitActivity(a)).toThrow("inválidos");
  expect(mockDb.getAllSync("SELECT * FROM session_fit_imports", [])).toHaveLength(0);
  expect(mockDb.getAllSync("SELECT * FROM sessions", [])).toHaveLength(1);
});
it("restores snapshots, summaries, samples and source identities through portable backup", async () => {
  const id = importFitActivity(activity());
  const original = getFitImport(id);
  const payload = validateExportPayload(JSON.parse(JSON.stringify(buildExportPayload())));
  expect(payload.exportFormatVersion).toBe(9);
  mockDb = await createInMemoryDb(); runMigrations(mockDb);
  applyImport(payload); applyImport(payload);
  const restored = mockDb.getFirstSync<{ id: number }>("SELECT id FROM sessions", [])!.id;
  expect(getFitImport(restored)).toEqual(original);
  expect(getSessionWithSets(restored)?.sets).toHaveLength(2);
  deleteSession(restored);
  expect(getFitImport(restored)).toBeNull();
});
it("validates FIT backup content and still accepts formats 7 and 8", () => {
  importFitActivity(activity());
  const payload = buildExportPayload();
  expect(() => validateExportPayload({ ...payload, exportFormatVersion: 8, sessions: [] })).not.toThrow();
  expect(() => validateExportPayload({ ...payload, exportFormatVersion: 7, sessions: [] })).not.toThrow();
  const duplicate = { ...payload.sessions[0], uuid: "another-session" };
  expect(() => validateExportPayload({ ...payload, sessions: [...payload.sessions, duplicate] })).toThrow("duplicado");
  const invalid = JSON.parse(JSON.stringify(payload));
  invalid.sessions[0].fitImport.activity.cadenceMaximum = -1;
  expect(() => validateExportPayload(invalid)).toThrow("inválidos");
});
