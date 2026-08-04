import type { DateRange, ExerciseDailyMax, StrengthRecord } from "@/types";
import { groupRecordsByMuscle } from "./analyticsRecords";
import {
  achievedInRange,
  crownRecord,
  daysSinceRecord,
  formatAgo,
  formatKg,
  freshCount,
  isStale,
  medalFor,
  milestoneStep,
  hotExerciseIds,
  monogramFor,
  nextMilestone,
  stampsFor,
  summarizeRecords,
} from "./recordsGamification";

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

const JULY: DateRange = { start: "2026-07-01", end: "2026-07-31" };

describe("milestoneStep", () => {
  it("scales the step with the load", () => {
    expect(milestoneStep(12)).toBe(2.5);
    expect(milestoneStep(20)).toBe(5);
    expect(milestoneStep(59.5)).toBe(5);
    expect(milestoneStep(60)).toBe(10);
    expect(milestoneStep(149)).toBe(10);
    expect(milestoneStep(150)).toBe(20);
  });
});

describe("nextMilestone", () => {
  it("aims at the smallest round mark above the load", () => {
    const m = nextMilestone(105);
    expect(m.previous).toBe(100);
    expect(m.next).toBe(110);
    expect(m.progress).toBeCloseTo(0.5);
    expect(m.justHit).toBe(false);
  });

  it("flags a load sitting exactly on a mark instead of showing an empty climb", () => {
    const m = nextMilestone(100);
    expect(m.justHit).toBe(true);
    expect(m.previous).toBe(100);
    expect(m.next).toBe(110);
    expect(m.progress).toBe(0);
  });

  it("survives the float division that makes 100/2.5 land at 39.999…", () => {
    expect(nextMilestone(10).previous).toBe(10);
    expect(nextMilestone(10).justHit).toBe(true);
    expect(nextMilestone(17.5).justHit).toBe(true);
  });

  it("keeps progress inside the bar just under a mark", () => {
    const m = nextMilestone(99);
    expect(m.next).toBe(100);
    expect(m.progress).toBeCloseTo(0.9);
  });
});

describe("formatKg", () => {
  it("prints a decimal only when the mark has one", () => {
    expect(formatKg(100)).toBe("100");
    expect(formatKg(17.5)).toBe("17.5");
  });
});

describe("daysSinceRecord / formatAgo / isStale", () => {
  it("counts days back to the record", () => {
    expect(daysSinceRecord("2026-07-25", "2026-08-04")).toBe(10);
    expect(daysSinceRecord(null, "2026-08-04")).toBeNull();
  });

  it("never reports a future record as negative days", () => {
    expect(daysSinceRecord("2026-08-10", "2026-08-04")).toBe(0);
  });

  it("reads as plain Portuguese at every scale", () => {
    expect(formatAgo(0)).toBe("hoje");
    expect(formatAgo(1)).toBe("ontem");
    expect(formatAgo(12)).toBe("há 12 dias");
    expect(formatAgo(30)).toBe("há 1 mês");
    expect(formatAgo(90)).toBe("há 3 meses");
    expect(formatAgo(400)).toBe("há 1 ano");
    expect(formatAgo(800)).toBe("há 2 anos");
  });

  it("goes cold at 90 days", () => {
    expect(isStale(89)).toBe(false);
    expect(isStale(90)).toBe(true);
    expect(isStale(null)).toBe(false);
  });
});

describe("achievedInRange", () => {
  it("includes both endpoints and rejects a missing date", () => {
    expect(achievedInRange("2026-07-01", JULY)).toBe(true);
    expect(achievedInRange("2026-07-31", JULY)).toBe(true);
    expect(achievedInRange("2026-08-01", JULY)).toBe(false);
    expect(achievedInRange(null, JULY)).toBe(false);
  });
});

describe("summarizeRecords", () => {
  it("counts an exercise once even when it files under several groups", () => {
    const groups = groupRecordsByMuscle([
      record({ exercise_id: 1, muscle_groups: ["chest", "triceps"] }),
      record({ exercise_id: 2, max_weight_kg: 60, muscle_groups: ["chest"] }),
    ]);
    expect(summarizeRecords(groups, JULY).total).toBe(2);
  });

  it("reports the heaviest record and how many landed in the window", () => {
    const groups = groupRecordsByMuscle([
      record({ exercise_id: 1, max_weight_kg: 100, achieved_on: "2026-07-10" }),
      record({ exercise_id: 2, max_weight_kg: 180, achieved_on: "2026-05-02", muscle_groups: ["legs"] }),
      record({ exercise_id: 3, max_weight_kg: 40, achieved_on: "2026-07-20", muscle_groups: ["biceps"] }),
    ]);
    const summary = summarizeRecords(groups, JULY);
    expect(summary.best?.max_weight_kg).toBe(180);
    expect(summary.fresh).toBe(2);
  });

  it("has no best record when there is nothing to show", () => {
    expect(summarizeRecords([], JULY)).toEqual({ total: 0, fresh: 0, best: null });
  });
});

describe("crownRecord / freshCount", () => {
  const groups = groupRecordsByMuscle([
    record({ exercise_id: 1, max_weight_kg: 100, achieved_on: "2026-07-10" }),
    record({ exercise_id: 2, max_weight_kg: 140, achieved_on: "2026-02-01" }),
  ]);

  it("crowns the heaviest lift in the group", () => {
    expect(crownRecord(groups[0])?.max_weight_kg).toBe(140);
  });

  it("counts only the records set inside the window", () => {
    expect(freshCount(groups[0], JULY)).toBe(1);
  });

  it("has no crown for an empty group", () => {
    expect(crownRecord({ muscle_group: "chest", records: [] })).toBeNull();
  });
});

describe("hotExerciseIds", () => {
  const TODAY = "2026-08-04";
  const day = (exercise_id: number, date: string, max_weight_kg: number): ExerciseDailyMax => ({
    exercise_id,
    date,
    max_weight_kg,
  });

  it("marks a lift whose load climbed twice inside the window", () => {
    const hot = hotExerciseIds(
      [day(1, "2026-06-01", 80), day(1, "2026-07-01", 85), day(1, "2026-07-28", 90)],
      TODAY
    );
    expect(hot.has(1)).toBe(true);
  });

  it("does not count the debut as a gain", () => {
    // First appearance sets the bar plus one real increase — one gain, not two.
    const hot = hotExerciseIds([day(1, "2026-06-01", 80), day(1, "2026-07-01", 85)], TODAY);
    expect(hot.has(1)).toBe(false);
  });

  it("ignores days that only match or fall short of the standing best", () => {
    const hot = hotExerciseIds(
      [
        day(1, "2026-05-01", 80),
        day(1, "2026-06-01", 85),
        day(1, "2026-06-15", 85),
        day(1, "2026-07-01", 70),
        day(1, "2026-07-20", 84),
      ],
      TODAY
    );
    expect(hot.has(1)).toBe(false);
  });

  it("ignores gains that fell outside the window", () => {
    const hot = hotExerciseIds(
      [day(1, "2025-01-01", 60), day(1, "2025-03-01", 70), day(1, "2025-06-01", 80)],
      TODAY
    );
    expect(hot.has(1)).toBe(false);
  });

  it("needs the full history to tell a gain from a comeback", () => {
    // 100 in April means July's 95 is not a record, however recent it is.
    const hot = hotExerciseIds(
      [
        day(1, "2026-04-01", 100),
        day(1, "2026-06-10", 90),
        day(1, "2026-07-05", 92),
        day(1, "2026-07-25", 95),
      ],
      TODAY
    );
    expect(hot.has(1)).toBe(false);
  });

  it("keeps exercises apart and tolerates unordered rows", () => {
    const hot = hotExerciseIds(
      [
        day(2, "2026-07-20", 45),
        day(1, "2026-07-01", 85),
        day(2, "2026-06-01", 40),
        day(1, "2026-06-01", 80),
        day(1, "2026-07-28", 90),
      ],
      TODAY
    );
    expect([...hot]).toEqual([1]);
  });
});

describe("stampsFor", () => {
  const TODAY = "2026-08-04";
  const NONE: ReadonlySet<number> = new Set();

  it("gives a plain record no stamps", () => {
    expect(stampsFor(record({ achieved_on: "2026-06-20" }), JULY, TODAY, NONE)).toEqual([]);
  });

  it("stamps a record set inside the window as new", () => {
    expect(stampsFor(record({ achieved_on: "2026-07-30" }), JULY, TODAY, NONE)).toEqual(["new"]);
  });

  it("stamps a long-untouched record as cold", () => {
    expect(stampsFor(record({ achieved_on: "2026-01-10" }), JULY, TODAY, NONE)).toEqual(["cold"]);
  });

  it("carries new and hot together — just landed, and climbing for months", () => {
    const hot = new Set([1]);
    expect(stampsFor(record({ achieved_on: "2026-07-30" }), JULY, TODAY, hot)).toEqual([
      "new",
      "hot",
    ]);
  });

  it("never contradicts itself with hot and cold at once", () => {
    // A wide window can make an old record "new"; being hot must still win.
    const wideWindow: DateRange = { start: "2026-01-01", end: "2026-08-04" };
    const tones = stampsFor(record({ achieved_on: "2026-01-10" }), wideWindow, TODAY, new Set([1]));
    expect(tones).toEqual(["new", "hot"]);
    expect(tones).not.toContain("cold");
  });
});

describe("medalFor / monogramFor", () => {
  it("hands out metal for the podium only", () => {
    expect(medalFor(0)?.ink).toBe("#8a5a12");
    expect(medalFor(2)).not.toBeNull();
    expect(medalFor(3)).toBeNull();
  });

  it("keeps Back and Biceps distinguishable", () => {
    expect(monogramFor("back", "Back")).toBe("BK");
    expect(monogramFor("biceps", "Biceps")).toBe("BI");
  });

  it("falls back to the label for an unknown group", () => {
    expect(monogramFor("__ungrouped__", "Sem grupo")).toBe("SE");
  });
});
