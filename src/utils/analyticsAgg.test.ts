import type { AnalyticsSetRow, TrendBucket } from "@/types";
import { bucketSum, computeStreak, delta, sumRunning, sumStrength } from "./analyticsAgg";

function strengthRow(overrides: Partial<AnalyticsSetRow> = {}): AnalyticsSetRow {
  return {
    session_id: 1,
    date: "2026-07-01",
    exercise_id: 1,
    exercise_name: "Supino",
    muscle_group: "peito",
    reps: 10,
    weight_kg: 20,
    distance_km: null,
    duration_sec: null,
    pace_sec: null,
    ...overrides,
  };
}

describe("sumStrength", () => {
  it("sums volume as reps * weight_kg, counts distinct sessions, and finds max weight", () => {
    const sets = [
      strengthRow({ session_id: 1, reps: 10, weight_kg: 20 }), // 200
      strengthRow({ session_id: 1, reps: 8, weight_kg: 25 }), // 200
      strengthRow({ session_id: 2, reps: 5, weight_kg: 40 }), // 200
    ];
    const summary = sumStrength(sets);
    expect(summary.volume).toBe(600);
    expect(summary.sessionCount).toBe(2);
    expect(summary.maxWeight).toBe(40);
  });

  it("returns zeros for an empty array", () => {
    expect(sumStrength([])).toEqual({ volume: 0, sessionCount: 0, maxWeight: 0 });
  });
});

describe("sumRunning", () => {
  it("computes weighted average pace across qualifying rows", () => {
    const sets = [
      strengthRow({ session_id: 1, distance_km: 5, duration_sec: 1200 }),
      strengthRow({ session_id: 2, distance_km: 10, duration_sec: 3000 }),
    ];
    const summary = sumRunning(sets);
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
    const summary = sumRunning(sets);
    expect(summary.distance).toBe(8); // 5 + 3, null treated as 0
    expect(summary.totalDuration).toBe(2100); // 1200 + 900, null treated as 0
    // only row 1 qualifies (both non-null, distance > 0): 1200/5 = 240
    expect(summary.avgPaceSec).toBe(240);
  });

  it("returns null avgPaceSec when there are no qualifying rows", () => {
    const sets = [strengthRow({ session_id: 1, distance_km: null, duration_sec: null })];
    expect(sumRunning(sets).avgPaceSec).toBeNull();
  });

  it("returns null avgPaceSec for an empty array", () => {
    expect(sumRunning([]).avgPaceSec).toBeNull();
    expect(sumRunning([])).toEqual({
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
    const summary = sumRunning(sets);
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
