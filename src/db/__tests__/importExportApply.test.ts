import { createInMemoryDb } from "./testDb";
import { CREATE_TABLES } from "../schema";
import type { DbHandle } from "../dbHandle";

let mockDb: DbHandle;

jest.mock("../client", () => ({
  get db() {
    return mockDb;
  },
}));

import { applyImport } from "../importExportApply";
import { CURRENT_EXPORT_FORMAT_VERSION } from "../importExport";
import type { ExportPayload } from "../importExport";
import { DEFAULT_EXERCISE_CONFIG } from "../../data/exerciseConfig";
import { CONFIG_COLUMN_LIST } from "../configColumns";
import { rowToConfig } from "../configColumns";

beforeEach(async () => {
  mockDb = await createInMemoryDb();
  for (const ddl of CREATE_TABLES) mockDb.execSync(ddl);
});

/** A payload whose exercise config predates the newest config dimensions —
 *  hand-built payloads and older backups both look like this. Typed loosely on
 *  purpose: the point is that runtime input isn't guaranteed key-complete. */
function payloadWithPartialConfig(): ExportPayload {
  return {
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt: "2026-08-01T00:00:00.000Z",
    appSchemaVersion: 17,
    exercises: [
      {
        uuid: "ex-uuid-1",
        name: "Supino reto",
        muscle_groups: [{ muscle_group: "chest", counting_factor: 1 }],
        equipment: "barbell",
        type: "compound",
        is_custom: 0,
        modality: "musculacao",
        // Only the pre-grip/bodyweight dimensions.
        config: {
          resistance_curve: "descending",
          load_type: "free",
          pulley_type: null,
          laterality: "bilateral",
          rom: "full",
          uses_bench: 1,
          bench_angle_degrees: 30,
        },
      },
    ],
    routineSplits: [],
    sessions: [
      {
        uuid: "se-uuid-1",
        date: "2026-07-30",
        name: "Peito",
        notes: null,
        modality: "musculacao",
        start_time: null,
        end_time: null,
        sets: [
          {
            exercise_uuid: "ex-uuid-1",
            set_number: 1,
            reps: 10,
            weight_kg: 60,
            rpe: null,
            rir: null,
            notes: null,
            distance_km: null,
            duration_sec: null,
            pace_sec: null,
            failure: 0,
          },
        ],
        // No per-exercise config snapshot at all — the other way a payload can
        // arrive short of the current shape.
        exercises: [{ exercise_uuid: "ex-uuid-1", order: 0 }],
      },
    ],
    trainingPrograms: [],
  } as unknown as ExportPayload;
}

describe("applyImport tolerates configs missing the newest dimensions", () => {
  it("imports without a driver-level bind error", () => {
    expect(() => applyImport(payloadWithPartialConfig())).not.toThrow();

    const summary = mockDb.getFirstSync<{ exercises: number; sessions: number; sets: number }>(
      `SELECT (SELECT COUNT(*) FROM exercises) AS exercises,
              (SELECT COUNT(*) FROM sessions) AS sessions,
              (SELECT COUNT(*) FROM sets) AS sets`,
      []
    );
    expect(summary).toEqual({ exercises: 1, sessions: 1, sets: 1 });
  });

  it("fills the absent config columns from the defaults, keeping the ones supplied", () => {
    applyImport(payloadWithPartialConfig());

    const row = mockDb.getFirstSync<Record<string, unknown>>(
      `SELECT ${CONFIG_COLUMN_LIST} FROM exercise_config`,
      []
    );
    const config = rowToConfig(row as never);
    expect(config.uses_bench).toBe(1);
    expect(config.bench_angle_degrees).toBe(30);
    expect(config.grip_type).toBe(DEFAULT_EXERCISE_CONFIG.grip_type);
    expect(config.grip_width).toBe(DEFAULT_EXERCISE_CONFIG.grip_width);
    expect(config.uses_bodyweight).toBe(DEFAULT_EXERCISE_CONFIG.uses_bodyweight);
    expect(config.load_mode).toBe(DEFAULT_EXERCISE_CONFIG.load_mode);
  });

  it("writes a full snapshot row for a session exercise that carries no config", () => {
    applyImport(payloadWithPartialConfig());

    const row = mockDb.getFirstSync<Record<string, unknown>>(
      `SELECT ${CONFIG_COLUMN_LIST} FROM session_exercise_config`,
      []
    );
    expect(row).not.toBeNull();
    expect(rowToConfig(row as never)).toEqual(DEFAULT_EXERCISE_CONFIG);
  });
});
