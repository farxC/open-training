import type { AnalyticsSetRow, Delta, RunningSummary, StrengthSummary, TrendBucket } from "@/types";
import { addDays, todayISO } from "./cycle";

export function sumStrength(sets: AnalyticsSetRow[]): StrengthSummary {
  let volume = 0;
  let maxWeight = 0;
  const sessionIds = new Set<number>();

  for (const s of sets) {
    volume += s.reps * s.weight_kg;
    if (s.weight_kg > maxWeight) maxWeight = s.weight_kg;
    sessionIds.add(s.session_id);
  }

  return { volume, sessionCount: sessionIds.size, maxWeight };
}

export function sumRunning(sets: AnalyticsSetRow[]): RunningSummary {
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

/**
 * Counts consecutive calendar days ending at `todayISO_` (defaults to the real
 * today, via cycle.ts todayISO()) for which `datesDesc[i]` (distinct session
 * dates, descending) equals `todayISO_` minus `i` days. Breaks on the first
 * gap — mirrors src/db/queries.ts getStreakDays exactly, just as a pure
 * function taking the dates array (so it's deterministic in tests).
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

export function delta(cur: number, prev: number, higherIsBetter: boolean): Delta {
  const absChange = cur - prev;
  const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
  const better =
    pct === null || cur === prev ? null : higherIsBetter ? cur > prev : cur < prev;

  return { better, pct, absChange };
}
