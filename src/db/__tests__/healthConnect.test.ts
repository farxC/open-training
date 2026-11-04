import { createInMemoryDb } from "./testDb";
import { runMigrations } from "../migrations";
import type { DbHandle } from "../dbHandle";
import type { HealthWorkout } from "../../health/types";
import { getHealthImport, importHealthWorkout, writeHealthImport } from "../healthConnect";
import { buildExportPayload, applyImport } from "../importExportApply";
import { validateExportPayload } from "../importExport";
import { createSession, updateSession, deleteSession, getSessionWithSets } from "../queries";

let mockDb: DbHandle;
jest.mock("../client", () => ({ get db() { return mockDb; } }));

const workout = (): HealthWorkout => ({
  version: 1, externalId: "run-1", origin: "com.huami.watch.hmwatchmanager", title: "Corrida matinal",
  start: "2026-11-04T10:00:00Z", end: "2026-11-04T10:30:00Z", modifiedAt: null,
  distanceKm: 5, heartRateAverage: 140, cadenceAverage: 165.5,
  heartRate: [{ externalId: "hr-1", modifiedAt: null, device: "Bip 6", samples: [{ time: Date.parse("2026-11-04T10:05:00Z"), value: 140 }] }],
  cadence: [{ externalId: "cad-1", modifiedAt: null, device: "Bip 6", samples: [{ time: Date.parse("2026-11-04T10:05:00Z"), value: 165.5 }] }],
});

beforeEach(async () => { mockDb = await createInMemoryDb(); runMigrations(mockDb); });

it("migrates an existing database without altering sessions and remains idempotent", () => {
  const id = createSession("2026-11-04", { modality: "corrida", notes: "preservar" });
  runMigrations(mockDb);
  runMigrations(mockDb);
  expect(getSessionWithSets(id)?.notes).toBe("preservar");
  expect(getHealthImport(id)).toBeNull();
});

it("reimports one external workout without duplicating sets or overwriting manual edits", () => {
  const id = importHealthWorkout(workout(), "phone-1");
  const uuid = getHealthImport(id)!.uuid;
  updateSession(id, { notes: "minha nota", name: "Minha corrida" });
  const changed = workout(); changed.cadence![0].samples[0].value = 170;
  expect(importHealthWorkout(changed, "phone-1")).toBe(id);
  const session = getSessionWithSets(id)!;
  expect(session.sets).toHaveLength(1);
  expect(session.notes).toBe("minha nota");
  expect(session.name).toBe("Minha corrida");
  expect(session.duration_seconds).toBe(1800);
  expect(session.sets[0].distance_km).toBe(5);
  expect(session.sets[0].pace_sec).toBeNull();
  expect(getHealthImport(id)!.uuid).toBe(uuid);
  expect(getHealthImport(id)!.workout.cadence![0].samples[0].value).toBe(170);
});

it("links only the explicitly selected running session and preserves manual data", () => {
  const id = createSession("2026-11-04", { modality: "corrida", notes: "tiros" });
  updateSession(id, { duration_seconds: 42 });
  importHealthWorkout(workout(), "phone-1", id);
  expect(getSessionWithSets(id)?.sets).toHaveLength(0);
  expect(getSessionWithSets(id)?.duration_seconds).toBe(42);
  const other = createSession("2026-11-04", { modality: "corrida" });
  expect(() => importHealthWorkout(workout(), "phone-1", other)).toThrow("já está vinculada");
  const strength = createSession("2026-11-04");
  expect(() => importHealthWorkout({ ...workout(), externalId: "run-2" }, "phone-1", strength)).toThrow("sessão de corrida");
  expect(getHealthImport(strength)).toBeNull();
});

it("does not erase previous samples after a metric permission is revoked", () => {
  const id = importHealthWorkout(workout(), "phone-1");
  importHealthWorkout({ ...workout(), cadence: null, cadenceAverage: null }, "phone-1");
  expect(getHealthImport(id)!.workout.cadenceAverage).toBe(165.5);
  importHealthWorkout({ ...workout(), cadence: [], cadenceAverage: null }, "phone-1");
  expect(getHealthImport(id)!.workout.cadence).toEqual([]);
});

it("rolls back malformed samples and prevents switching the source of a linked session", () => {
  const invalid = workout(); invalid.cadence![0].samples[0].value = -1;
  const before = mockDb.getAllSync("SELECT * FROM sessions", []);
  expect(() => importHealthWorkout(invalid, "phone-1")).toThrow("inválidos");
  expect(mockDb.getAllSync("SELECT * FROM sessions", [])).toEqual(before);
  const id = importHealthWorkout(workout(), "phone-1");
  expect(() => importHealthWorkout({ ...workout(), externalId: "other" }, "phone-1", id)).toThrow("outra corrida");
});

it("exports and restores samples, origins, UUIDs and elapsed duration; deleting cascades", async () => {
  const id = importHealthWorkout(workout(), "phone-1");
  const link = getHealthImport(id);
  const payload = validateExportPayload(JSON.parse(JSON.stringify(buildExportPayload())));
  mockDb = await createInMemoryDb(); runMigrations(mockDb);
  applyImport(payload);
  const restoredId = mockDb.getFirstSync<{ id: number }>("SELECT id FROM sessions", [])!.id;
  expect(getHealthImport(restoredId)).toEqual(link);
  expect(getSessionWithSets(restoredId)?.duration_seconds).toBe(1800);
  applyImport(payload);
  expect(mockDb.getAllSync("SELECT * FROM session_health_connect", [])).toHaveLength(1);
  deleteSession(restoredId);
  expect(getHealthImport(restoredId)).toBeNull();
});

it("rejects conflicting source identities during restore", () => {
  const id = importHealthWorkout(workout(), "phone-1");
  const second = createSession("2026-11-04", { modality: "corrida" });
  expect(() => writeHealthImport(second, { ...getHealthImport(id)!, uuid: "other" })).toThrow();
});
