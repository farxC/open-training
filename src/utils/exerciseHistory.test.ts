import {
  buildExerciseHistory,
  monthlyTotals,
  monthsCovered,
  sessionsWithinMonths,
  type DatedSet,
} from "@/utils/exerciseHistory";

let nextId = 1;

function set(
  sessionId: number,
  date: string,
  setNumber: number,
  fields: Partial<DatedSet> = {}
): DatedSet {
  return {
    id: nextId++,
    session_id: sessionId,
    exercise_id: 1,
    set_number: setNumber,
    reps: 10,
    weight_kg: 50,
    rpe: null,
    rir: null,
    notes: null,
    distance_km: null,
    duration_sec: null,
    pace_sec: null,
    failure: 0,
    date,
    ...fields,
  };
}

beforeEach(() => {
  nextId = 1;
});

describe("buildExerciseHistory", () => {
  it("returns an empty history for no sets", () => {
    const h = buildExerciseHistory([], "musculacao");
    expect(h.sessions).toEqual([]);
    expect(h.recordSet).toBeNull();
    expect(h.sessionCount).toBe(0);
  });

  it("groups sets by session and lists the newest session first", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1),
        set(1, "2026-07-01", 2),
        set(2, "2026-07-08", 1),
      ],
      "musculacao"
    );

    expect(h.sessions.map((s) => s.date)).toEqual(["2026-07-08", "2026-07-01"]);
    expect(h.sessions[1].sets).toHaveLength(2);
    expect(h.sessionCount).toBe(2);
    expect(h.setCount).toBe(3);
    expect(h.firstDate).toBe("2026-07-01");
    expect(h.lastDate).toBe("2026-07-08");
  });

  it("keeps two sessions on the same day apart", () => {
    const h = buildExerciseHistory(
      [set(1, "2026-07-01", 1), set(2, "2026-07-01", 1)],
      "musculacao"
    );
    expect(h.sessionCount).toBe(2);
    // Newest-first within a shared day means the later-recorded session leads.
    expect(h.sessions.map((s) => s.sessionId)).toEqual([2, 1]);
  });

  it("picks the heaviest set as the record, breaking ties on reps", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 100, reps: 5 }),
        set(1, "2026-07-01", 2, { weight_kg: 100, reps: 8 }),
        set(1, "2026-07-01", 3, { weight_kg: 90, reps: 12 }),
      ],
      "musculacao"
    );
    expect(h.recordSet?.reps).toBe(8);
    expect(h.bestWeightKg).toBe(100);
  });

  it("scales intensity against the all-time best", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 50 }),
        set(2, "2026-07-08", 1, { weight_kg: 100 }),
      ],
      "musculacao"
    );
    const [newer, older] = h.sessions;
    expect(newer.sets[0].intensity).toBe(1);
    expect(older.sets[0].intensity).toBe(0.5);
  });

  it("marks only the first set at the session's top load", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 80 }),
        set(1, "2026-07-01", 2, { weight_kg: 80 }),
        set(1, "2026-07-01", 3, { weight_kg: 70 }),
      ],
      "musculacao"
    );
    expect(h.sessions[0].sets.map((s) => s.isTopSet)).toEqual([true, false, false]);
  });

  it("signs the delta against the previous session in date order", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 80 }),
        set(2, "2026-07-08", 1, { weight_kg: 85 }),
        set(3, "2026-07-15", 1, { weight_kg: 75 }),
      ],
      "musculacao"
    );
    // sessions are newest-first: 15th, 8th, 1st
    expect(h.sessions.map((s) => s.deltaKg)).toEqual([-10, 5, null]);
  });

  it("compares against the session actually trained before, not the one logged before", () => {
    // The July 8th session was entered last, after the 15th was already recorded.
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 80 }),
        set(3, "2026-07-15", 1, { weight_kg: 100 }),
        set(2, "2026-07-08", 1, { weight_kg: 90 }),
      ],
      "musculacao"
    );
    expect(h.sessions.map((s) => ({ date: s.date, delta: s.deltaKg }))).toEqual([
      { date: "2026-07-15", delta: 10 },
      { date: "2026-07-08", delta: 10 },
      { date: "2026-07-01", delta: null },
    ]);
  });

  it("sums volume per session and overall", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 50, reps: 10 }),
        set(1, "2026-07-01", 2, { weight_kg: 60, reps: 8 }),
      ],
      "musculacao"
    );
    expect(h.sessions[0].volumeKg).toBe(980);
    expect(h.totalVolumeKg).toBe(980);
  });

  it("ignores unloaded sets when picking the record and the top set", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 0 }),
        set(1, "2026-07-01", 2, { weight_kg: 40 }),
      ],
      "musculacao"
    );
    expect(h.recordSet?.weight_kg).toBe(40);
    expect(h.sessions[0].sets[0].intensity).toBe(0);
    expect(h.sessions[0].sets.map((s) => s.isTopSet)).toEqual([false, true]);
  });

  it("survives an exercise with no load logged at all", () => {
    const h = buildExerciseHistory([set(1, "2026-07-01", 1, { weight_kg: 0 })], "musculacao");
    expect(h.recordSet).toBeNull();
    expect(h.bestWeightKg).toBeNull();
    expect(h.sessions[0].topWeightKg).toBeNull();
    expect(h.sessions[0].sets[0].intensity).toBe(0);
    expect(h.topSetTrend).toEqual([]);
  });

  it("ranks distance modalities by distance and keeps the fastest pace", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 0, reps: 0, distance_km: 5, pace_sec: 320 }),
        set(2, "2026-07-08", 1, { weight_kg: 0, reps: 0, distance_km: 10, pace_sec: 350 }),
      ],
      "corrida"
    );
    expect(h.recordSet?.distance_km).toBe(10);
    expect(h.bestDistanceKm).toBe(10);
    expect(h.bestPaceSec).toBe(320);
    expect(h.totalDistanceKm).toBe(15);
    // Distance work has no load to compare, so no session carries a delta.
    expect(h.sessions.every((s) => s.deltaKg === null)).toBe(true);
    expect(h.topSetTrend).toEqual([
      { date: "2026-07-01", value: 5 },
      { date: "2026-07-08", value: 10 },
    ]);
  });

  describe("sessionsWithinMonths", () => {
    const history = () =>
      buildExerciseHistory(
        [
          set(1, "2026-04-10", 1),
          set(2, "2026-05-04", 1),
          set(3, "2026-05-22", 1),
          set(4, "2026-07-02", 1),
          set(5, "2026-07-19", 1),
        ],
        "musculacao"
      ).sessions;

    it("keeps every session of the most recent months, however many there are", () => {
      expect(sessionsWithinMonths(history(), 2).map((s) => s.date)).toEqual([
        "2026-07-19",
        "2026-07-02",
        "2026-05-22",
        "2026-05-04",
      ]);
    });

    it("counts trained months, not calendar months — June is skipped, not spent", () => {
      // June holds no session, so a two-month window reaches back into May.
      expect(monthsCovered(sessionsWithinMonths(history(), 2))).toBe(2);
    });

    it("returns everything when the window is wider than the ledger", () => {
      expect(sessionsWithinMonths(history(), 12)).toHaveLength(5);
    });

    it("returns nothing for a zero-month window", () => {
      expect(sessionsWithinMonths(history(), 0)).toEqual([]);
    });
  });

  it("counts the months the ledger touches", () => {
    const h = buildExerciseHistory(
      [set(1, "2026-05-02", 1), set(2, "2026-05-20", 1), set(3, "2026-07-03", 1)],
      "musculacao"
    );
    expect(monthsCovered(h.sessions)).toBe(2);
  });

  it("totals by month, oldest first, skipping untrained months", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-05-02", 1, { weight_kg: 50, reps: 10 }),
        set(2, "2026-05-20", 1, { weight_kg: 60, reps: 10 }),
        set(3, "2026-07-03", 1, { weight_kg: 70, reps: 10 }),
      ],
      "musculacao"
    );
    expect(monthlyTotals(h.sessions, "volume")).toEqual([
      { month: "2026-05", value: 1100 },
      { month: "2026-07", value: 700 },
    ]);
  });

  it("totals distance by month", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-05-02", 1, { weight_kg: 0, reps: 0, distance_km: 5 }),
        set(2, "2026-05-09", 1, { weight_kg: 0, reps: 0, distance_km: 7.5 }),
      ],
      "corrida"
    );
    expect(monthlyTotals(h.sessions, "distance")).toEqual([{ month: "2026-05", value: 12.5 }]);
  });

  it("builds the progression series oldest-first from each session's top load", () => {
    const h = buildExerciseHistory(
      [
        set(1, "2026-07-01", 1, { weight_kg: 80 }),
        set(1, "2026-07-01", 2, { weight_kg: 90 }),
        set(2, "2026-07-08", 1, { weight_kg: 95 }),
      ],
      "musculacao"
    );
    expect(h.topSetTrend).toEqual([
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-08", value: 95 },
    ]);
  });
});
