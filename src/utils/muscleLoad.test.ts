import type { MuscleExerciseRow, MuscleFrequencyRow, MuscleSeriesRow } from "@/types";
import {
  PIP_CEILING,
  TICK_CEILING,
  TICK_FLOOR,
  EXERCISE_HEAD,
  mergeMuscleLoad,
  pipSlots,
  splitExerciseRows,
  sortMuscleLoad,
  summarizeMuscleLoad,
  tickSlots,
} from "./muscleLoad";

function series(muscle_group: string, value: number, isAverage = false): MuscleSeriesRow {
  return { muscle_group, value, weeks: isAverage ? 4 : 1, isAverage };
}

function freq(muscle_group: string, value: number, isAverage = false): MuscleFrequencyRow {
  return { muscle_group, value, weeks: isAverage ? 4 : 1, isAverage };
}

describe("mergeMuscleLoad", () => {
  it("joins the two readings into one row per muscle group", () => {
    const rows = mergeMuscleLoad(
      [series("chest", 14), series("back", 11)],
      [freq("chest", 2), freq("back", 3)]
    );

    expect(rows).toEqual([
      { muscle_group: "chest", series: 14, frequency: 2, isAverage: false },
      { muscle_group: "back", series: 11, frequency: 3, isAverage: false },
    ]);
  });

  it("orders by series, descending", () => {
    const rows = mergeMuscleLoad(
      [series("back", 8), series("chest", 20)],
      [freq("back", 1), freq("chest", 2)]
    );

    expect(rows.map((r) => r.muscle_group)).toEqual(["chest", "back"]);
  });

  it("keeps a group present in only one reading, zeroing the other", () => {
    const rows = mergeMuscleLoad([series("chest", 6)], [freq("core", 2)]);

    expect(rows).toEqual([
      { muscle_group: "chest", series: 6, frequency: 0, isAverage: false },
      { muscle_group: "core", series: 0, frequency: 2, isAverage: false },
    ]);
  });

  it("carries the averaged flag through", () => {
    const rows = mergeMuscleLoad([series("chest", 10.25, true)], [freq("chest", 2.5, true)]);

    expect(rows[0].isAverage).toBe(true);
  });

  it("returns nothing when both readings are empty", () => {
    expect(mergeMuscleLoad([], [])).toEqual([]);
  });
});

describe("sortMuscleLoad", () => {
  const rows = mergeMuscleLoad(
    [series("chest", 14), series("back", 11), series("core", 4)],
    [freq("chest", 1), freq("back", 2), freq("core", 3)]
  );

  it("ranks by series", () => {
    expect(sortMuscleLoad(rows, "series").map((r) => r.muscle_group)).toEqual([
      "chest",
      "back",
      "core",
    ]);
  });

  it("ranks by frequency, breaking ties on series", () => {
    expect(sortMuscleLoad(rows, "frequency").map((r) => r.muscle_group)).toEqual([
      "core",
      "back",
      "chest",
    ]);
  });

  it("does not mutate the input order", () => {
    const input = [...rows];
    sortMuscleLoad(input, "frequency");
    expect(input).toEqual(rows);
  });
});

describe("tickSlots", () => {
  it("gives one groove-separated tick per whole unit of the largest row", () => {
    expect(tickSlots(14)).toBe(14);
    expect(tickSlots(10.2)).toBe(11);
  });

  it("keeps enough slots to read as a rack when the window is nearly empty", () => {
    expect(tickSlots(0)).toBe(TICK_FLOOR);
    expect(tickSlots(0.8)).toBe(TICK_FLOOR);
    expect(tickSlots(TICK_FLOOR + 1)).toBe(TICK_FLOOR + 1);
  });

  it("falls back to a continuous bar once ticks would be unreadable", () => {
    expect(tickSlots(TICK_CEILING)).toBe(TICK_CEILING);
    expect(tickSlots(TICK_CEILING + 0.1)).toBeNull();
  });
});

describe("pipSlots", () => {
  it("gives one pip per session, rounded up", () => {
    expect(pipSlots(2)).toBe(2);
    expect(pipSlots(2.3)).toBe(3);
  });

  it("always offers at least one pip", () => {
    expect(pipSlots(0)).toBe(1);
  });

  it("drops the pips when there are too many to read at a glance", () => {
    expect(pipSlots(PIP_CEILING)).toBe(PIP_CEILING);
    expect(pipSlots(PIP_CEILING + 0.1)).toBeNull();
  });
});

describe("summarizeMuscleLoad", () => {
  it("totals the series, counts the groups and names the most frequent", () => {
    const rows = mergeMuscleLoad(
      [series("chest", 14, true), series("back", 11, true), series("core", 4, true)],
      [freq("chest", 1, true), freq("back", 2, true), freq("core", 3, true)]
    );

    expect(summarizeMuscleLoad(rows)).toEqual({
      totalSeries: 29,
      groupCount: 3,
      topFrequency: { muscle_group: "core", series: 4, frequency: 3, isAverage: true },
    });
  });

  it("has no leader when nothing was trained", () => {
    expect(summarizeMuscleLoad([])).toEqual({
      totalSeries: 0,
      groupCount: 0,
      topFrequency: null,
    });
  });
});

describe("splitExerciseRows", () => {
  function exerciseRows(count: number): MuscleExerciseRow[] {
    // Descending series, so the head is always the meaningful end of the list.
    return Array.from({ length: count }, (_, i) => ({
      exercise_id: i + 1,
      exercise_name: `Exercicio ${i + 1}`,
      series: count - i,
      sessionCount: 2,
      share: (count - i) / ((count * (count + 1)) / 2),
      halved: false,
      weeks: 4,
      isAverage: true,
    }));
  }

  it("keeps every row when the list already fits", () => {
    const rows = exerciseRows(EXERCISE_HEAD);
    expect(splitExerciseRows(rows)).toEqual({ head: rows, tail: null });
  });

  it("keeps the last row rather than folding a single exercise into a tail", () => {
    // Folding one row costs a row and loses its name — a bad trade.
    const rows = exerciseRows(EXERCISE_HEAD + 1);
    expect(splitExerciseRows(rows)).toEqual({ head: rows, tail: null });
  });

  it("folds the tail once at least two rows collapse, keeping their series", () => {
    const rows = exerciseRows(10);
    const { head, tail } = splitExerciseRows(rows, 6);

    expect(head).toHaveLength(6);
    expect(head.map((r) => r.exercise_id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tail).not.toBeNull();
    expect(tail!.count).toBe(4);
    // Rows 7..10 carry series 4, 3, 2, 1.
    expect(tail!.series).toBe(10);
  });

  it("head plus tail still sums to the group total, which is the whole point", () => {
    const rows = exerciseRows(21);
    const { head, tail } = splitExerciseRows(rows);
    const total = rows.reduce((sum, r) => sum + r.series, 0);

    expect(head.reduce((sum, r) => sum + r.series, 0) + tail!.series).toBe(total);
    expect(head.reduce((sum, r) => sum + r.share, 0) + tail!.share).toBeCloseTo(1);
  });

  it("handles an empty list", () => {
    expect(splitExerciseRows([])).toEqual({ head: [], tail: null });
  });
});
