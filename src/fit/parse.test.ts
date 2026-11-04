import { readFileSync } from "node:fs";
import { parseFitFile } from "./parse";
import { MAX_FIT_BYTES } from "./types";

const fixture = (name = "running.fit") => new Uint8Array(readFileSync(`${__dirname}/__fixtures__/${name}`));

it("decodes a real FIT binary, preserves summaries, and converts strides into steps/min once", () => {
  const activity = parseFitFile(fixture(), "Zepp.fit");
  expect(activity.workout.start).toBe("2026-10-10T10:00:00.000Z");
  expect(activity.workout.end).toBe("2026-10-10T10:20:00.000Z");
  expect(activity.workout.distanceKm).toBe(5);
  expect(activity.elapsedSeconds).toBe(1200);
  expect(activity.timerSeconds).toBe(1100);
  expect(activity.workout.heartRateAverage).toBe(145);
  expect(activity.heartRateMaximum).toBe(160);
  expect(activity.workout.cadenceAverage).toBe(165);
  expect(activity.cadenceMaximum).toBe(180.5);
  expect(activity.workout.cadence![0].samples.map((s) => s.value)).toEqual([160.5, 171, 0, 180]);
  // A real sample at the activity's exact end must be retained.
  expect(activity.workout.heartRate![0].samples).toHaveLength(4);
  expect(activity.laps.map((l) => l.distanceKm)).toEqual([2, 3]);
  expect(activity.deviceName).toBe("Synthetic runner");
});

it("allows summaries without inventing samples or a curve", () => {
  const activity = parseFitFile(fixture("summary.fit"), "summary.fit");
  expect(activity.workout.heartRate).toEqual([]);
  expect(activity.workout.cadence).toEqual([]);
  expect(activity.workout.cadenceAverage).toBe(165);
  expect(activity.cadenceMaximum).toBe(180.5);
});

it("reads high-resolution cadence256 without losing its fractional steps", () => {
  const a = parseFitFile(fixture("packed-cadence.fit"), "packed.fit");
  expect(a.workout.cadence![0].samples.map((s) => s.value)).toEqual([160.5, 171, 0, 180]);
});

it("uses content and creator identities rather than filenames for deduplication", () => {
  const a = parseFitFile(fixture(), "a.fit"), renamed = parseFitFile(fixture(), "renamed.fit");
  const reexported = parseFitFile(fixture("summary.fit"), "new.fit");
  expect(a.activityKey).toBe(renamed.activityKey);
  expect(a.fileHash).toBe(renamed.fileHash);
  expect(reexported.fileHash).not.toBe(a.fileHash);
  expect(reexported.activityKey).toBe(a.activityKey);
  expect(parseFitFile(fixture("no-identity.fit"), "unknown.fit").activityKey).toMatch(/^[a-f0-9]{64}$/);
});

it("rejects corrupt, truncated, unrelated and oversize files before persistence", () => {
  expect(() => parseFitFile(new Uint8Array(), "empty.fit")).toThrow("incompleto");
  const broken = fixture(); broken[broken.length - 1] ^= 1;
  expect(() => parseFitFile(broken, "broken.fit")).toThrow("integridade");
  expect(() => parseFitFile(fixture().slice(0, 30), "truncated.fit")).toThrow();
  expect(() => parseFitFile(new Uint8Array(MAX_FIT_BYTES + 1), "large.fit")).toThrow("20 MB");
  expect(() => parseFitFile(fixture("cycling.fit"), "bike.fit")).toThrow("corrida");
  expect(() => parseFitFile(fixture("multisport.fit"), "multi.fit")).toThrow("única sessão");
});
