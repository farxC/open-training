import { connectHealth, listHealthRuns, readHealthWorkout } from "./client.android";
import * as hc from "react-native-health-connect";

jest.mock("react-native-health-connect", () => ({
  getSdkStatus: jest.fn(), initialize: jest.fn(), requestPermission: jest.fn(), getGrantedPermissions: jest.fn(),
  readRecords: jest.fn(), aggregateRecord: jest.fn(),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 }, ExerciseType: { RUNNING: 56, RUNNING_TREADMILL: 57 },
}));
const read = jest.fn();
const aggregate = jest.fn();
const metadata = { id: "run", dataOrigin: "zepp", lastModifiedTime: "2026-11-04T12:00:00Z" };
const run = { externalId: "run", origin: "zepp", title: "Corrida", start: "2026-11-04T10:00:00Z", end: "2026-11-04T10:30:00Z" };
const exercise = { metadata, startTime: run.start, endTime: run.end, exerciseType: 56 };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hc.readRecords).mockImplementation(read);
  jest.mocked(hc.aggregateRecord).mockImplementation(aggregate);
  jest.mocked(hc.getSdkStatus).mockResolvedValue(3);
  jest.mocked(hc.initialize).mockResolvedValue(true);
  jest.mocked(hc.getGrantedPermissions).mockResolvedValue([{ accessType: "read", recordType: "ExerciseSession" }]);
});

it("requests only read permissions and accepts optional metric denials", async () => {
  jest.mocked(hc.requestPermission).mockResolvedValue([{ accessType: "read", recordType: "ExerciseSession" }]);
  await connectHealth();
  expect(hc.requestPermission).toHaveBeenCalledWith([
    { accessType: "read", recordType: "ExerciseSession" }, { accessType: "read", recordType: "Distance" },
    { accessType: "read", recordType: "HeartRate" }, { accessType: "read", recordType: "StepsCadence" },
  ]);
  jest.mocked(hc.requestPermission).mockResolvedValue([]);
  await expect(connectHealth()).rejects.toThrow("Permita a leitura");
});

it("handles an unavailable SDK before requesting permissions", async () => {
  jest.mocked(hc.getSdkStatus).mockResolvedValue(2);
  await expect(connectHealth()).rejects.toThrow("Instale ou atualize");
  expect(hc.requestPermission).not.toHaveBeenCalled();
});

it("reads every page, filters running types and keeps source identity", async () => {
  read.mockResolvedValueOnce({ records: [exercise], pageToken: "next" });
  read.mockResolvedValueOnce({ records: [{ ...exercise, exerciseType: 1 }, { ...exercise, exerciseType: 57,
    metadata: { ...metadata, id: "treadmill" } }] });
  const runs = await listHealthRuns();
  expect(runs.map((r) => r.externalId)).toEqual(["run", "treadmill"]);
  expect(read.mock.calls[1][1].pageToken).toBe("next");
  const range = read.mock.calls[0][1].timeRangeFilter;
  expect(range.operator).toBe("between");
});

it("does not request denied metrics and represents them as unread, not zero", async () => {
  read.mockResolvedValueOnce({ records: [exercise] });
  const w = await readHealthWorkout(run);
  expect(w.heartRate).toBeNull(); expect(w.cadence).toBeNull(); expect(w.distanceKm).toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0][1].dataOriginFilter).toEqual(["zepp"]);
});

it("clips samples to the workout and reads provider averages for the same source", async () => {
  jest.mocked(hc.getGrantedPermissions).mockResolvedValue([
    { accessType: "read", recordType: "ExerciseSession" }, { accessType: "read", recordType: "HeartRate" },
    { accessType: "read", recordType: "StepsCadence" }, { accessType: "read", recordType: "Distance" },
  ]);
  read.mockResolvedValueOnce({ records: [exercise] });
  read.mockResolvedValueOnce({ records: [{ metadata: { ...metadata, id: "hr" }, startTime: run.start, endTime: run.end,
    samples: [{ time: run.start, beatsPerMinute: 140 }, { time: run.end, beatsPerMinute: 160 }] }] });
  read.mockResolvedValueOnce({ records: [{ metadata: { ...metadata, id: "cad" }, startTime: run.start, endTime: run.end,
    samples: [{ time: run.start, rate: 0 }, { time: "2026-11-04T10:10:00Z", rate: 170.5 }] }] });
  read.mockResolvedValueOnce({ records: [{ metadata, startTime: run.start, endTime: run.end,
    distance: { inMeters: 5000, inKilometers: 5, inMiles: 3, inInches: 1, inFeet: 1 } }] });
  aggregate.mockResolvedValueOnce({ BPM_AVG: 140, BPM_MAX: 140, BPM_MIN: 140, MEASUREMENTS_COUNT: 1, dataOrigins: ["zepp"] });
  aggregate.mockResolvedValueOnce({ RATE_AVG: 85.25, RATE_MAX: 170.5, RATE_MIN: 0, dataOrigins: ["zepp"] });
  const w = await readHealthWorkout(run);
  expect(w.heartRate![0].samples).toEqual([{ time: Date.parse(run.start), value: 140 }]);
  expect(w.cadence![0].samples[0].value).toBe(0);
  expect(w.cadenceAverage).toBe(85.25); expect(w.distanceKm).toBe(5);
  for (const [, options] of read.mock.calls) expect(options.dataOriginFilter).toEqual(["zepp"]);
  for (const [options] of jest.mocked(hc.aggregateRecord).mock.calls) expect(options.dataOriginFilter).toEqual(["zepp"]);
});

it("rejects overlapping exercises instead of associating measurements by time alone", async () => {
  read.mockResolvedValueOnce({ records: [exercise, { ...exercise, metadata: { ...metadata, id: "another" } }] });
  await expect(readHealthWorkout(run)).rejects.toThrow("sobrepostos");
});
