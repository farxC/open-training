import type { MuscleFrequencyRow, MuscleSeriesRow } from "@/types";

/** The two muscle-group readings for one group, joined. Both are measured over
 *  the same window, so they share one `isAverage` flag: raw totals at week
 *  granularity, per-week averages above it. */
export interface MuscleLoadRow {
  muscle_group: string;
  /** Series (sum of counting_factor) — raw total or per-week average. */
  series: number;
  /** Sessions that touched the group — raw count or per-week average. */
  frequency: number;
  isAverage: boolean;
}

export type LoadSortKey = "series" | "frequency";

/** Past this many ticks the grooves are thinner than the plates between them,
 *  so the bar reads as noise — it degrades to one continuous fill instead. */
export const TICK_CEILING = 28;

/** Counting pips only beats reading a number while the pips are countable at a
 *  glance; past this the row shows the number alone. */
export const PIP_CEILING = 5;

/** A rack needs a few slots to read as one. Without a floor, a window whose
 *  busiest group averages 0.8 séries/week gets a single tick — and the leader
 *  then fills the whole bar for less than one série, which reads as maxed out. */
export const TICK_FLOOR = 4;

/** Joins the series and frequency readings into one row per muscle group,
 *  ranked by series. Both readings derive from the same sets, but through
 *  different paths (SQL rollup vs. session ids in JS), so a group can surface
 *  in one and not the other — the union keeps it, with the absent side at zero
 *  rather than dropping a group that was genuinely trained. */
export function mergeMuscleLoad(
  series: MuscleSeriesRow[],
  frequency: MuscleFrequencyRow[]
): MuscleLoadRow[] {
  const rows = new Map<string, MuscleLoadRow>();

  for (const row of series) {
    rows.set(row.muscle_group, {
      muscle_group: row.muscle_group,
      series: row.value,
      frequency: 0,
      isAverage: row.isAverage,
    });
  }

  for (const row of frequency) {
    const existing = rows.get(row.muscle_group);
    if (existing) {
      existing.frequency = row.value;
    } else {
      rows.set(row.muscle_group, {
        muscle_group: row.muscle_group,
        series: 0,
        frequency: row.value,
        isAverage: row.isAverage,
      });
    }
  }

  return sortMuscleLoad(Array.from(rows.values()), "series");
}

/** Ranks the panel by either reading. Series is the tiebreaker for frequency
 *  because frequency clusters hard — half the groups sit on the same 2×/week,
 *  and volume is what separates them. */
export function sortMuscleLoad(rows: MuscleLoadRow[], key: LoadSortKey): MuscleLoadRow[] {
  return [...rows].sort((a, b) =>
    key === "series" ? b.series - a.series : b.frequency - a.frequency || b.series - a.series
  );
}

/** How many unit ticks the shared bar track is cut into — one per série, up to
 *  the largest row rounded *up* to a whole série. The rounding matters: the
 *  track's capacity is this slot count, not the raw max, so one tick is exactly
 *  one série in every row instead of one-fifteenth of 14.2. Null asks for a
 *  continuous bar (see TICK_CEILING). */
export function tickSlots(maxSeries: number): number | null {
  const slots = Math.max(TICK_FLOOR, Math.ceil(Math.max(maxSeries, 0)));
  return slots > TICK_CEILING ? null : slots;
}

/** How many session pips a row shows — one per session of the most-trained
 *  group. Null asks for the bare number (see PIP_CEILING). */
export function pipSlots(maxFrequency: number): number | null {
  const slots = Math.ceil(Math.max(maxFrequency, 0));
  if (slots < 1) return 1;
  return slots > PIP_CEILING ? null : slots;
}

export interface MuscleLoadSummary {
  /** Sum of every group's series — muscle-series load, not sets performed:
   *  a set counts into each group it works, at its counting factor. */
  totalSeries: number;
  groupCount: number;
  /** The most-trained group, which the series ranking below would bury. */
  topFrequency: MuscleLoadRow | null;
}

export function summarizeMuscleLoad(rows: MuscleLoadRow[]): MuscleLoadSummary {
  const ranked = sortMuscleLoad(rows, "frequency");

  return {
    totalSeries: rows.reduce((sum, row) => sum + row.series, 0),
    groupCount: rows.length,
    topFrequency: ranked[0] ?? null,
  };
}
