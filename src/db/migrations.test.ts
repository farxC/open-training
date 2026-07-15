import * as fs from "fs";
import * as path from "path";
import { createInMemoryDb } from "./__tests__/testDb";
import { runMigrations } from "./migrations";
import { SCHEMA_VERSION } from "./schema";
import type { DbHandle } from "./dbHandle";

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");
}

describe("runMigrations upgrade from frozen snapshots", () => {
  it("upgrades a v8 device: preserves rows, adds new columns, drops nothing unexpectedly", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v8-snapshot.sql"));

    runMigrations(dbHandle);

    const exercises = dbHandle.getAllSync<{ id: number; name: string; uuid: string | null }>(
      "SELECT id, name, uuid FROM exercises ORDER BY id",
      []
    );
    expect(exercises.map((e) => e.name)).toEqual([
      "Supino reto",
      "Rosca direta customizada",
      "Correr",
    ]);
    expect(exercises.every((e) => typeof e.uuid === "string" && e.uuid!.length > 0)).toBe(true);

    const session = dbHandle.getFirstSync<{
      id: number;
      uuid: string | null;
      start_time: string | null;
      end_time: string | null;
    }>("SELECT id, uuid, start_time, end_time FROM sessions WHERE id = 1", []);
    expect(session).not.toBeNull();
    expect(typeof session!.uuid).toBe("string");
    expect(session!.start_time).toBeNull();
    expect(session!.end_time).toBeNull();

    const sets = dbHandle.getAllSync<{ id: number; failure: number }>(
      "SELECT id, failure FROM sets WHERE session_id = 1 ORDER BY id",
      []
    );
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.failure === 0)).toBe(true);

    const split = dbHandle.getFirstSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM routine_splits WHERE id = 1",
      []
    );
    expect(typeof split!.uuid).toBe("string");

    const program = dbHandle.getFirstSync<{ id: number; uuid: string | null }>(
      "SELECT id, uuid FROM training_programs WHERE id = 1",
      []
    );
    expect(typeof program!.uuid).toBe("string");

    const versionRow = dbHandle.getFirstSync<{ value: string }>(
      "SELECT value FROM user_meta WHERE key = 'schema_version'",
      []
    );
    expect(versionRow!.value).toBe(String(SCHEMA_VERSION));

    const exerciseCount = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercises",
      []
    );
    expect(exerciseCount!.count).toBe(3); // the unconditional 'Correr' seed matches the existing row by name — no duplicate
  });
});
