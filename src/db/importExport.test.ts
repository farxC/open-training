import { validateExportPayload, CURRENT_EXPORT_FORMAT_VERSION } from "./importExport";

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
    expect(() => validateExportPayload({ ...validPayload(), exportFormatVersion: 2 })).toThrow();
    expect(() => validateExportPayload({ ...validPayload(), exportFormatVersion: undefined })).toThrow();
  });

  it("rejects a payload missing a data section", () => {
    const { exercises, ...rest } = validPayload();
    expect(() => validateExportPayload(rest)).toThrow();
  });
});
