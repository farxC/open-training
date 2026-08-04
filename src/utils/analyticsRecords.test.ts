import type { StrengthRecord } from "@/types";
import { UNGROUPED_KEY, groupRecordsByMuscle } from "./analyticsRecords";

function record(overrides: Partial<StrengthRecord> = {}): StrengthRecord {
  return {
    exercise_id: 1,
    exercise_name: "Supino",
    max_weight_kg: 100,
    reps_at_max: 5,
    achieved_on: "2026-07-01",
    muscle_groups: ["chest"],
    ...overrides,
  };
}

describe("groupRecordsByMuscle", () => {
  it("files a multi-group exercise under each of its groups", () => {
    const bench = record({ exercise_id: 1, muscle_groups: ["chest", "triceps"] });
    const groups = groupRecordsByMuscle([bench]);
    expect(groups.map((g) => g.muscle_group).sort()).toEqual(["chest", "triceps"]);
    expect(groups.every((g) => g.records[0].exercise_id === 1)).toBe(true);
  });

  it("orders groups by how many records they hold", () => {
    const records = [
      record({ exercise_id: 1, muscle_groups: ["chest"] }),
      record({ exercise_id: 2, muscle_groups: ["chest"] }),
      record({ exercise_id: 3, muscle_groups: ["chest"] }),
      record({ exercise_id: 4, muscle_groups: ["back"] }),
      record({ exercise_id: 5, muscle_groups: ["back"] }),
      record({ exercise_id: 6, muscle_groups: ["legs"] }),
    ];
    expect(groupRecordsByMuscle(records).map((g) => g.muscle_group)).toEqual([
      "chest",
      "back",
      "legs",
    ]);
  });

  it("orders records within a group by weight, heaviest first", () => {
    const records = [
      record({ exercise_id: 1, max_weight_kg: 60 }),
      record({ exercise_id: 2, max_weight_kg: 120 }),
      record({ exercise_id: 3, max_weight_kg: 90 }),
    ];
    const chest = groupRecordsByMuscle(records)[0];
    expect(chest.records.map((r) => r.max_weight_kg)).toEqual([120, 90, 60]);
  });

  it("puts records with no muscle group in their own bucket, always last", () => {
    const records = [
      record({ exercise_id: 1, muscle_groups: [] }),
      record({ exercise_id: 2, muscle_groups: [] }),
      record({ exercise_id: 3, muscle_groups: [] }),
      record({ exercise_id: 4, muscle_groups: ["chest"] }),
    ];
    const groups = groupRecordsByMuscle(records);
    expect(groups.map((g) => g.muscle_group)).toEqual(["chest", UNGROUPED_KEY]);
    expect(groups[1].records).toHaveLength(3);
  });

  it("returns an empty array for no records", () => {
    expect(groupRecordsByMuscle([])).toEqual([]);
  });
});
