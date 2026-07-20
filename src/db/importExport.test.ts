import {
  validateExportPayload,
  CURRENT_EXPORT_FORMAT_VERSION,
  planExerciseMerge,
  planSessionMerge,
} from "./importExport";
import type { ExportedExercise, ExportedSession } from "./importExport";

function validPayload() {
  return {
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-10T12:00:00.000Z",
    appSchemaVersion: 9,
    exercises: [],
    sessions: [],
    routineSplits: [],
    trainingPrograms: [],
  };
}

describe("validateExportPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(() => validateExportPayload(validPayload())).not.toThrow();
  });

  it("rejects non-object input", () => {
    expect(() => validateExportPayload(null)).toThrow();
    expect(() => validateExportPayload("not json")).toThrow();
    expect(() => validateExportPayload(42)).toThrow();
  });

  it("rejects an unknown exportFormatVersion", () => {
    expect(() => validateExportPayload({ ...validPayload(), exportFormatVersion: 99 })).toThrow();
    expect(() => validateExportPayload({ ...validPayload(), exportFormatVersion: undefined })).toThrow();
  });

  it("rejects a payload missing a data section", () => {
    const { exercises, ...rest } = validPayload();
    expect(() => validateExportPayload(rest)).toThrow();
  });
});

function exercise(overrides: Partial<ExportedExercise> = {}): ExportedExercise {
  return {
    uuid: "ex-uuid-1",
    name: "Supino reto",
    muscle_groups: ["chest"],
    equipment: "barbell",
    type: "compound",
    is_custom: 0,
    modality: "musculacao",
    ...overrides,
  };
}

describe("planExerciseMerge", () => {
  it("matches an existing exercise by uuid", () => {
    const existing = [{ id: 5, uuid: "ex-uuid-1", name: "Supino reto" }];
    const plan = planExerciseMerge(existing, [exercise()]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.matchedIds.get("ex-uuid-1")).toBe(5);
  });

  it("falls back to matching by name when uuid is unknown", () => {
    const existing = [{ id: 5, uuid: null, name: "Supino reto" }];
    const plan = planExerciseMerge(existing, [exercise({ uuid: "ex-uuid-2" })]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.matchedIds.get("ex-uuid-2")).toBe(5);
  });

  it("queues an exercise with no local match for insertion", () => {
    const plan = planExerciseMerge([], [exercise({ uuid: "ex-uuid-3", name: "Novo exercício" })]);
    expect(plan.toInsert).toEqual([exercise({ uuid: "ex-uuid-3", name: "Novo exercício" })]);
    expect(plan.matchedIds.size).toBe(0);
  });

  it("prefers a uuid match over a name match", () => {
    const existing = [
      { id: 1, uuid: "ex-uuid-1", name: "Old name" },
      { id: 2, uuid: null, name: "Supino reto" },
    ];
    const plan = planExerciseMerge(existing, [exercise({ name: "Supino reto" })]);
    expect(plan.matchedIds.get("ex-uuid-1")).toBe(1);
  });
});

function session(overrides: Partial<ExportedSession> = {}): ExportedSession {
  return {
    uuid: "session-uuid-1",
    date: "2026-07-01",
    name: null,
    notes: null,
    duration_seconds: null,
    start_time: null,
    end_time: null,
    modality: "musculacao",
    sets: [],
    ...overrides,
  };
}

describe("planSessionMerge", () => {
  it("keeps a session whose uuid isn't present locally", () => {
    const result = planSessionMerge(new Set(), [session()]);
    expect(result).toEqual([session()]);
  });

  it("skips a session whose uuid is already present locally (idempotent re-import)", () => {
    const result = planSessionMerge(new Set(["session-uuid-1"]), [session()]);
    expect(result).toEqual([]);
  });

  it("filters a mixed batch correctly", () => {
    const a = session({ uuid: "a" });
    const b = session({ uuid: "b" });
    const result = planSessionMerge(new Set(["a"]), [a, b]);
    expect(result).toEqual([b]);
  });
});
