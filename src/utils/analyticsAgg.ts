import type {
  AnalyticsSetRow,
  DateRange,
  DayBar,
  DayExerciseBreakdown,
  Delta,
  MuscleFrequencyRow,
  MuscleSeriesRaw,
  MuscleSeriesRow,
  DistanceSummary,
  StrengthSummary,
  TrendBucket,
} from "@/types";
import { addDays, todayISO } from "./cycle";

export function sumStrength(sets: AnalyticsSetRow[]): StrengthSummary {
  let volume = 0;
  const sessionIds = new Set<number>();

  for (const s of sets) {
    volume += s.reps * s.weight_kg;
    sessionIds.add(s.session_id);
  }

  return { volume, sessionCount: sessionIds.size };
}

/** Works for every distance modality — the inputs are canonical km/seconds, so
 *  the weighted average pace comes out in seconds-per-km regardless of how the
 *  modality displays it (min/km, min/100m, km/h). */
export function sumDistance(sets: AnalyticsSetRow[]): DistanceSummary {
  let distance = 0;
  let totalDuration = 0;
  let paceDurationSum = 0;
  let paceDistanceSum = 0;
  const sessionIds = new Set<number>();

  for (const s of sets) {
    distance += s.distance_km ?? 0;
    totalDuration += s.duration_sec ?? 0;
    sessionIds.add(s.session_id);

    if (s.duration_sec != null && s.distance_km != null && s.distance_km > 0) {
      paceDurationSum += s.duration_sec;
      paceDistanceSum += s.distance_km;
    }
  }

  const avgPaceSec = paceDistanceSum > 0 ? Math.round(paceDurationSum / paceDistanceSum) : null;

  return { distance, runCount: sessionIds.size, totalDuration, avgPaceSec };
}

export function bucketSum(
  sets: AnalyticsSetRow[],
  buckets: TrendBucket[],
  pick: (s: AnalyticsSetRow) => number
): number[] {
  const sums = new Array(buckets.length).fill(0) as number[];

  for (const s of sets) {
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (s.date >= b.start && s.date <= b.end) {
        sums[i] += pick(s);
        break;
      }
    }
  }

  return sums;
}

/** Weekday initials, Monday-first, matching the Mon–Sun weeks periods.ts produces. */
const WEEKDAY_INITIALS_PT = ["S", "T", "Q", "Q", "S", "S", "D"];

/**
 * One bar per day of `week`, always seven of them, Monday→Sunday — a rest day
 * keeps its slot instead of collapsing the chart. Sets outside the week are
 * ignored, so the caller can pass the whole fetched range.
 */
export function dayBars(
  sets: AnalyticsSetRow[],
  week: DateRange,
  pick: (s: AnalyticsSetRow) => number
): DayBar[] {
  const bars: DayBar[] = [];

  for (let i = 0; i < 7; i++) {
    const dateISO = addDays(week.start, i);
    let value = 0;
    let hasData = false;
    for (const s of sets) {
      if (s.date !== dateISO) continue;
      value += pick(s);
      hasData = true;
    }
    bars.push({ dateISO, label: WEEKDAY_INITIALS_PT[i], value, hasData });
  }

  return bars;
}

/**
 * One row per exercise trained on `dateISO`, in the order the session listed
 * them (`exercise_order`); rows with no order fall to the end, broken by volume.
 * Distance and duration are summed only where present, so a strength day leaves
 * them null instead of reporting a misleading zero.
 */
export function dayBreakdown(sets: AnalyticsSetRow[], dateISO: string): DayExerciseBreakdown[] {
  const byExercise = new Map<number, DayExerciseBreakdown>();

  for (const s of sets) {
    if (s.date !== dateISO) continue;

    let row = byExercise.get(s.exercise_id);
    if (!row) {
      row = {
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name,
        setCount: 0,
        volume: 0,
        distanceKm: null,
        durationSec: null,
        order: s.exercise_order,
      };
      byExercise.set(s.exercise_id, row);
    }

    row.setCount += 1;
    row.volume += s.reps * s.weight_kg;
    if (s.distance_km != null) row.distanceKm = (row.distanceKm ?? 0) + s.distance_km;
    if (s.duration_sec != null) row.durationSec = (row.durationSec ?? 0) + s.duration_sec;
  }

  return Array.from(byExercise.values()).sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order;
    if (a.order != null) return -1;
    if (b.order != null) return 1;
    return b.volume - a.volume;
  });
}

/**
 * How often each muscle group was trained: distinct sessions that worked it,
 * divided by `weekCount`. A `weekCount` of 1 (week granularity) returns the raw
 * count with isAverage false — "2 treinos nesta semana" needs no averaging.
 * An exercise carrying two muscle groups credits a session to each of them once,
 * however many sets it had.
 */
export function weeklyMuscleFrequency(
  sets: AnalyticsSetRow[],
  weekCount: number
): MuscleFrequencyRow[] {
  const sessionsByMuscle = new Map<string, Set<number>>();

  for (const s of sets) {
    for (const mg of s.muscle_groups) {
      let sessions = sessionsByMuscle.get(mg);
      if (!sessions) {
        sessions = new Set<number>();
        sessionsByMuscle.set(mg, sessions);
      }
      sessions.add(s.session_id);
    }
  }

  const weeks = Math.max(weekCount, 1);
  const isAverage = weeks > 1;

  return Array.from(sessionsByMuscle.entries())
    .map(([muscle_group, sessions]) => ({
      muscle_group,
      value: isAverage ? sessions.size / weeks : sessions.size,
      weeks,
      isAverage,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Counts consecutive calendar days ending at `todayISO_` (defaults to the real
 * today, via cycle.ts todayISO()) for which `datesDesc[i]` (distinct session
 * dates, descending) equals `todayISO_` minus `i` days. Breaks on the first
 * gap. Deterministic in tests since it takes the dates array directly rather
 * than reading from the DB.
 */
export function computeStreak(datesDesc: string[], todayISO_: string = todayISO()): number {
  let streak = 0;

  for (let i = 0; i < datesDesc.length; i++) {
    const expected = addDays(todayISO_, -i);
    if (datesDesc[i] === expected) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/** Raw rows (a single session, or a single week) → UI rows, unaveraged (weeks:
 *  1, isAverage: false). Single conversion point shared by the live recorder,
 *  session detail, and the analytics week-granularity path. */
export function toMuscleSeriesRows(raw: MuscleSeriesRaw[]): MuscleSeriesRow[] {
  return raw.map((r) => ({ muscle_group: r.muscle_group, value: r.total_series, weeks: 1, isAverage: false }));
}

/**
 * Averages per-week muscle-series rows into one row per muscle group.
 * `weeklyRows` is one MuscleSeriesRaw[] per calendar week in the period
 * (typically produced by calling getMuscleSeriesInRange once per week from
 * analysisWeeks()); a week with no series for a muscle group simply omits it.
 * `totalWeeks` is the fixed denominator — it does NOT shrink per muscle
 * group, so a muscle trained in only 2 of 4 weeks is still divided by 4.
 */
export function averageMuscleSeriesPerWeek(
  weeklyRows: MuscleSeriesRaw[][],
  totalWeeks: number
): MuscleSeriesRow[] {
  const totals = new Map<string, number>();
  for (const week of weeklyRows) {
    for (const row of week) {
      totals.set(row.muscle_group, (totals.get(row.muscle_group) ?? 0) + row.total_series);
    }
  }

  const denom = Math.max(totalWeeks, 1);
  return Array.from(totals.entries())
    .map(([muscle_group, sum]) => ({ muscle_group, value: sum / denom, weeks: totalWeeks, isAverage: true }))
    .sort((a, b) => b.value - a.value);
}

export function delta(cur: number, prev: number, higherIsBetter: boolean): Delta {
  const absChange = cur - prev;
  const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
  const better =
    pct === null || cur === prev ? null : higherIsBetter ? cur > prev : cur < prev;

  return { better, pct, absChange };
}
