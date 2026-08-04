import type { AnalyticsSetRow, MuscleSeriesRaw, TrendBucket } from "@/types";
import {
  averageMuscleSeriesPerWeek,
  bucketSum,
  computeStreak,
  dayBars,
  dayBreakdown,
  delta,
  sumDistance,
  sumStrength,
  toMuscleSeriesRows,
  weeklyMuscleFrequency,
} from "./analyticsAgg";

function strengthRow(overrides: Partial<AnalyticsSetRow> = {}): AnalyticsSetRow {
  return {
    session_id: 1,
    date: "2026-07-01",
    exercise_id: 1,
    exercise_name: "Supino",
    muscle_groups: ["chest"],
    exercise_order: null,
    reps: 10,
    weight_kg: 20,
    distance_km: null,
    duration_sec: null,
    pace_sec: null,
    ...overrides,
  };
}

describe("sumStrength", () => {
  it("sums volume as reps * weight_kg and counts distinct sessions", () => {
    const sets = [
      strengthRow({ session_id: 1, reps: 10, weight_kg: 20 }), // 200
      strengthRow({ session_id: 1, reps: 8, weight_kg: 25 }), // 200
      strengthRow({ session_id: 2, reps: 5, weight_kg: 40 }), // 200
    ];
    const summary = sumStrength(sets);
    expect(summary.volume).toBe(600);
    expect(summary.sessionCount).toBe(2);
  });

  it("returns zeros for an empty array", () => {
    expect(sumStrength([])).toEqual({ volume: 0, sessionCount: 0 });
  });
});

describe("sumDistance", () => {
  it("computes weighted average pace across qualifying rows", () => {
    const sets = [
      strengthRow({ session_id: 1, distance_km: 5, duration_sec: 1200 }),
      strengthRow({ session_id: 2, distance_km: 10, duration_sec: 3000 }),
    ];
    const summary = sumDistance(sets);
    expect(summary.distance).toBe(15);
    expect(summary.runCount).toBe(2);
    expect(summary.totalDuration).toBe(4200);
    // 4200 / 15 = 280
    expect(summary.avgPaceSec).toBe(280);
  });

  it("excludes rows with null duration or null distance from the pace calc, but still sums distance", () => {
    const sets = [
      strengthRow({ session_id: 1, distance_km: 5, duration_sec: 1200 }),
      strengthRow({ session_id: 2, distance_km: 3, duration_sec: null }),
      strengthRow({ session_id: 3, distance_km: null, duration_sec: 900 }),
    ];
    const summary = sumDistance(sets);
    expect(summary.distance).toBe(8); // 5 + 3, null treated as 0
    expect(summary.totalDuration).toBe(2100); // 1200 + 900, null treated as 0
    // only row 1 qualifies (both non-null, distance > 0): 1200/5 = 240
    expect(summary.avgPaceSec).toBe(240);
  });

  it("returns null avgPaceSec when there are no qualifying rows", () => {
    const sets = [strengthRow({ session_id: 1, distance_km: null, duration_sec: null })];
    expect(sumDistance(sets).avgPaceSec).toBeNull();
  });

  it("returns null avgPaceSec for an empty array", () => {
    expect(sumDistance([]).avgPaceSec).toBeNull();
    expect(sumDistance([])).toEqual({
      distance: 0,
      runCount: 0,
      totalDuration: 0,
      avgPaceSec: null,
    });
  });

  it("excludes rows where distance_km is 0 from the pace calc", () => {
    const sets = [
      strengthRow({ session_id: 1, distance_km: 0, duration_sec: 500 }),
      strengthRow({ session_id: 2, distance_km: 5, duration_sec: 1000 }),
    ];
    const summary = sumDistance(sets);
    expect(summary.avgPaceSec).toBe(200); // only row 2 qualifies: 1000/5
  });
});

describe("bucketSum", () => {
  const buckets: TrendBucket[] = [
    { start: "2026-06-01", end: "2026-06-30", label: "Jun" },
    { start: "2026-07-01", end: "2026-07-31", label: "Jul" },
  ];

  it("assigns rows to the correct bucket by date and sums the picked value", () => {
    const sets = [
      strengthRow({ date: "2026-06-15", reps: 10, weight_kg: 10 }), // 100 -> Jun
      strengthRow({ date: "2026-07-10", reps: 5, weight_kg: 20 }), // 100 -> Jul
      strengthRow({ date: "2026-07-20", reps: 5, weight_kg: 10 }), // 50 -> Jul
    ];
    const result = bucketSum(sets, buckets, (s) => s.reps * s.weight_kg);
    expect(result).toEqual([100, 150]);
  });

  it("includes boundary dates (start and end inclusive)", () => {
    const sets = [
      strengthRow({ date: "2026-06-01", reps: 1, weight_kg: 1 }),
      strengthRow({ date: "2026-06-30", reps: 1, weight_kg: 1 }),
    ];
    const result = bucketSum(sets, buckets, (s) => s.reps * s.weight_kg);
    expect(result).toEqual([2, 0]);
  });

  it("ignores rows outside every bucket", () => {
    const sets = [
      strengthRow({ date: "2026-05-31", reps: 100, weight_kg: 100 }),
      strengthRow({ date: "2026-08-01", reps: 100, weight_kg: 100 }),
    ];
    const result = bucketSum(sets, buckets, (s) => s.reps * s.weight_kg);
    expect(result).toEqual([0, 0]);
  });

  it("respects the pick function, e.g. summing distance_km", () => {
    const sets = [
      strengthRow({ date: "2026-06-10", distance_km: 5 }),
      strengthRow({ date: "2026-06-20", distance_km: 3 }),
      strengthRow({ date: "2026-07-05", distance_km: 10 }),
    ];
    const result = bucketSum(sets, buckets, (s) => s.distance_km ?? 0);
    expect(result).toEqual([8, 10]);
  });

  it("returns an array aligned to an empty buckets list", () => {
    expect(bucketSum([strengthRow()], [], (s) => s.reps)).toEqual([]);
  });
});

describe("dayBars", () => {
  // 2026-07-06 is a Monday.
  const week = { start: "2026-07-06", end: "2026-07-12" };
  const volume = (s: AnalyticsSetRow) => s.reps * s.weight_kg;

  it("always returns seven Mon-Sun bars, labelled S T Q Q S S D", () => {
    const bars = dayBars([], week, volume);
    expect(bars).toHaveLength(7);
    expect(bars.map((b) => b.label)).toEqual(["S", "T", "Q", "Q", "S", "S", "D"]);
    expect(bars.map((b) => b.dateISO)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });

  it("sums the picked value per day and keeps rest days as empty slots", () => {
    const sets = [
      strengthRow({ date: "2026-07-06", reps: 10, weight_kg: 20 }), // 200
      strengthRow({ date: "2026-07-06", reps: 5, weight_kg: 20 }), // 100
      strengthRow({ date: "2026-07-08", reps: 10, weight_kg: 10 }), // 100
    ];
    const bars = dayBars(sets, week, volume);
    expect(bars.map((b) => b.value)).toEqual([300, 0, 100, 0, 0, 0, 0]);
    expect(bars.map((b) => b.hasData)).toEqual([true, false, true, false, false, false, false]);
  });

  it("marks a day with sets but zero value as having data", () => {
    const sets = [strengthRow({ date: "2026-07-07", reps: 10, weight_kg: 0 })];
    const bars = dayBars(sets, week, volume);
    expect(bars[1]).toEqual({ dateISO: "2026-07-07", label: "T", value: 0, hasData: true });
  });

  it("ignores sets outside the week", () => {
    const sets = [
      strengthRow({ date: "2026-07-05", reps: 10, weight_kg: 100 }),
      strengthRow({ date: "2026-07-13", reps: 10, weight_kg: 100 }),
    ];
    expect(dayBars(sets, week, volume).every((b) => !b.hasData)).toBe(true);
  });

  it("picks distance for endurance modalities", () => {
    const sets = [
      strengthRow({ date: "2026-07-09", distance_km: 5 }),
      strengthRow({ date: "2026-07-09", distance_km: 3 }),
    ];
    const bars = dayBars(sets, week, (s) => s.distance_km ?? 0);
    expect(bars[3].value).toBe(8);
  });
});

describe("dayBreakdown", () => {
  it("groups sets by exercise, counting sets and summing volume", () => {
    const sets = [
      strengthRow({ exercise_id: 1, exercise_name: "Supino", exercise_order: 0, reps: 10, weight_kg: 20 }),
      strengthRow({ exercise_id: 1, exercise_name: "Supino", exercise_order: 0, reps: 8, weight_kg: 20 }),
      strengthRow({ exercise_id: 2, exercise_name: "Remada", exercise_order: 1, reps: 10, weight_kg: 30 }),
    ];
    expect(dayBreakdown(sets, "2026-07-01")).toEqual([
      {
        exercise_id: 1,
        exercise_name: "Supino",
        setCount: 2,
        volume: 360,
        distanceKm: null,
        durationSec: null,
        order: 0,
      },
      {
        exercise_id: 2,
        exercise_name: "Remada",
        setCount: 1,
        volume: 300,
        distanceKm: null,
        durationSec: null,
        order: 1,
      },
    ]);
  });

  it("orders by exercise_order, with unordered exercises last, ranked by volume", () => {
    const sets = [
      strengthRow({ exercise_id: 3, exercise_name: "Sem ordem leve", exercise_order: null, reps: 1, weight_kg: 1 }),
      strengthRow({ exercise_id: 4, exercise_name: "Sem ordem pesado", exercise_order: null, reps: 10, weight_kg: 50 }),
      strengthRow({ exercise_id: 2, exercise_name: "Segundo", exercise_order: 5 }),
      strengthRow({ exercise_id: 1, exercise_name: "Primeiro", exercise_order: 2 }),
    ];
    expect(dayBreakdown(sets, "2026-07-01").map((r) => r.exercise_name)).toEqual([
      "Primeiro",
      "Segundo",
      "Sem ordem pesado",
      "Sem ordem leve",
    ]);
  });

  it("ignores other days and sums distance/duration only where present", () => {
    const sets = [
      strengthRow({ date: "2026-07-01", exercise_id: 1, distance_km: 5, duration_sec: 1200 }),
      strengthRow({ date: "2026-07-01", exercise_id: 1, distance_km: 3, duration_sec: null }),
      strengthRow({ date: "2026-07-02", exercise_id: 1, distance_km: 99 }),
    ];
    const rows = dayBreakdown(sets, "2026-07-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].distanceKm).toBe(8);
    expect(rows[0].durationSec).toBe(1200);
  });

  it("returns an empty array for a day with no sets", () => {
    expect(dayBreakdown([strengthRow({ date: "2026-07-01" })], "2026-07-02")).toEqual([]);
  });
});

describe("weeklyMuscleFrequency", () => {
  it("counts distinct sessions per muscle group, raw, for a single week", () => {
    const sets = [
      strengthRow({ session_id: 1, muscle_groups: ["chest", "triceps"] }),
      strengthRow({ session_id: 1, muscle_groups: ["chest"] }), // same session, no double count
      strengthRow({ session_id: 2, muscle_groups: ["chest"] }),
    ];
    expect(weeklyMuscleFrequency(sets, 1)).toEqual([
      { muscle_group: "chest", value: 2, weeks: 1, isAverage: false },
      { muscle_group: "triceps", value: 1, weeks: 1, isAverage: false },
    ]);
  });

  it("credits a multi-group exercise to each of its groups once per session", () => {
    const sets = [
      strengthRow({ session_id: 1, muscle_groups: ["chest", "triceps"] }),
      strengthRow({ session_id: 1, muscle_groups: ["chest", "triceps"] }),
    ];
    const rows = weeklyMuscleFrequency(sets, 1);
    expect(rows.map((r) => r.value)).toEqual([1, 1]);
  });

  it("divides by the week count and sorts descending when averaging", () => {
    const sets = [
      strengthRow({ session_id: 1, muscle_groups: ["chest"] }),
      strengthRow({ session_id: 2, muscle_groups: ["chest"] }),
      strengthRow({ session_id: 3, muscle_groups: ["chest"] }),
      strengthRow({ session_id: 4, muscle_groups: ["chest"] }),
      strengthRow({ session_id: 5, muscle_groups: ["back"] }),
      strengthRow({ session_id: 6, muscle_groups: ["back"] }),
    ];
    expect(weeklyMuscleFrequency(sets, 4)).toEqual([
      { muscle_group: "chest", value: 1, weeks: 4, isAverage: true },
      { muscle_group: "back", value: 0.5, weeks: 4, isAverage: true },
    ]);
  });

  it("ignores sets with no muscle groups and guards a zero week count", () => {
    expect(weeklyMuscleFrequency([strengthRow({ muscle_groups: [] })], 0)).toEqual([]);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const dates = ["2026-07-10", "2026-07-09", "2026-07-08"];
    expect(computeStreak(dates, "2026-07-10")).toBe(3);
  });

  it("breaks on the first gap", () => {
    const dates = ["2026-07-10", "2026-07-09", "2026-07-06"];
    expect(computeStreak(dates, "2026-07-10")).toBe(2);
  });

  it("returns 0 when the latest date is older than yesterday", () => {
    const dates = ["2026-07-05"];
    expect(computeStreak(dates, "2026-07-10")).toBe(0);
  });

  it("counts a streak that starts yesterday (today has no session yet)", () => {
    const dates = ["2026-07-09", "2026-07-08"];
    expect(computeStreak(dates, "2026-07-10")).toBe(0);
  });

  it("returns 0 for an empty array", () => {
    expect(computeStreak([], "2026-07-10")).toBe(0);
  });
});

describe("toMuscleSeriesRows", () => {
  it("maps total_series to value, tagging each row as an unaveraged single week", () => {
    const raw: MuscleSeriesRaw[] = [
      { muscle_group: "chest", total_series: 4 },
      { muscle_group: "back", total_series: 2.5 },
    ];
    expect(toMuscleSeriesRows(raw)).toEqual([
      { muscle_group: "chest", value: 4, weeks: 1, isAverage: false },
      { muscle_group: "back", value: 2.5, weeks: 1, isAverage: false },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(toMuscleSeriesRows([])).toEqual([]);
  });
});

describe("averageMuscleSeriesPerWeek", () => {
  it("divides each muscle group's summed series by the total week count, not just weeks it appeared in", () => {
    const weeklyRows: MuscleSeriesRaw[][] = [
      [{ muscle_group: "chest", total_series: 8 }],
      [], // no series at all this week
      [{ muscle_group: "chest", total_series: 4 }],
      [], // no series at all this week
    ];
    const result = averageMuscleSeriesPerWeek(weeklyRows, 4);
    expect(result).toEqual([{ muscle_group: "chest", value: 3, weeks: 4, isAverage: true }]);
  });

  it("sums across weeks per muscle group and sorts descending by average", () => {
    const weeklyRows: MuscleSeriesRaw[][] = [
      [
        { muscle_group: "chest", total_series: 2 },
        { muscle_group: "back", total_series: 10 },
      ],
      [
        { muscle_group: "chest", total_series: 6 },
      ],
    ];
    const result = averageMuscleSeriesPerWeek(weeklyRows, 2);
    expect(result).toEqual([
      { muscle_group: "back", value: 5, weeks: 2, isAverage: true }, // 10/2
      { muscle_group: "chest", value: 4, weeks: 2, isAverage: true }, // (2+6)/2
    ]);
  });

  it("omits a muscle group entirely if it never appears in any week", () => {
    const result = averageMuscleSeriesPerWeek([[], []], 2);
    expect(result).toEqual([]);
  });

  it("guards against a zero week count to avoid dividing by zero", () => {
    const weeklyRows: MuscleSeriesRaw[][] = [[{ muscle_group: "chest", total_series: 5 }]];
    const result = averageMuscleSeriesPerWeek(weeklyRows, 0);
    expect(result).toEqual([{ muscle_group: "chest", value: 5, weeks: 0, isAverage: true }]);
  });
});

describe("delta", () => {
  it("higherIsBetter=true: an increase is an improvement", () => {
    const d = delta(120, 100, true);
    expect(d.better).toBe(true);
    expect(d.pct).toBe(20);
    expect(d.absChange).toBe(20);
  });

  it("higherIsBetter=true: a decrease is a regression", () => {
    const d = delta(80, 100, true);
    expect(d.better).toBe(false);
    expect(d.pct).toBe(-20);
    expect(d.absChange).toBe(-20);
  });

  it("higherIsBetter=false (pace): a decrease is an improvement", () => {
    const d = delta(240, 300, false);
    expect(d.better).toBe(true);
    expect(d.pct).toBe(-20);
    expect(d.absChange).toBe(-60);
  });

  it("higherIsBetter=false (pace): an increase is a regression", () => {
    const d = delta(300, 240, false);
    expect(d.better).toBe(false);
  });

  it("flat: cur === prev -> better is null", () => {
    const d = delta(100, 100, true);
    expect(d.better).toBeNull();
    expect(d.pct).toBe(0);
    expect(d.absChange).toBe(0);
  });

  it("no baseline: prev is 0 -> pct and better are null, absChange is still cur - prev", () => {
    const d = delta(50, 0, true);
    expect(d.pct).toBeNull();
    expect(d.better).toBeNull();
    expect(d.absChange).toBe(50);
  });

  it("rounds pct to 1 decimal", () => {
    const d = delta(110, 90, true);
    // (110-90)/90*100 = 22.222...
    expect(d.pct).toBe(22.2);
  });
});
