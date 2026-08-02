import { useCallback, useMemo, useState } from "react";
import {
  getDistanceRecords,
  getMuscleSeriesInRange,
  getSessionDatesByModality,
  getSetsInRange,
  getStrengthRecords,
} from "@/db/queries";
import { isStrengthCategory, targetKindOf } from "@/data/modalities";
import type {
  AnalyticsSetRow,
  DateRange,
  DistanceRecords,
  DistanceSummary,
  Granularity,
  Modality,
  MuscleSeriesRow,
  StrengthRecord,
  StrengthSummary,
} from "@/types";
import {
  averageMuscleSeriesPerWeek,
  bucketSum,
  computeStreak,
  sumDistance,
  sumStrength,
  toMuscleSeriesRows,
} from "@/utils/analyticsAgg";
import { todayISO } from "@/utils/cycle";
import { periodRange, previousPeriodRange, trendBuckets, weeksInRange } from "@/utils/periods";

const ZERO_STRENGTH: StrengthSummary = { volume: 0, sessionCount: 0, maxWeight: 0 };
const ZERO_DISTANCE: DistanceSummary = { distance: 0, runCount: 0, totalDuration: 0, avgPaceSec: null };
const EMPTY_DISTANCE_RECORDS: DistanceRecords = {
  longest_distance_km: null,
  longest_distance_on: null,
  fastest_pace_sec: null,
  fastest_pace_on: null,
  longest_duration_sec: null,
  longest_duration_on: null,
};

export interface AnalyticsView {
  modality: Modality;
  granularity: Granularity;
  setModality: (m: Modality) => void;
  setGranularity: (g: Granularity) => void;
  /** Meaningful when the modality's targetKind is "strength"; zeroed otherwise. */
  strengthCurrent: StrengthSummary;
  strengthPrevious: StrengthSummary;
  /** Meaningful when the modality's targetKind is "distance"; zeroed otherwise.
   *  Canonical units (km, sec/km) — formatted per modality at render time. */
  distanceCurrent: DistanceSummary;
  distancePrevious: DistanceSummary;
  /** Bucketed totals for the trend chart: volume for strength, distance (km) for distance. */
  trend: { label: string; value: number }[];
  strengthRecords: StrengthRecord[];
  distanceRecords: DistanceRecords;
  muscleFreq: { muscle_group: string; count: number }[];
  /** Series (sum of counting_factor) per muscle group. Populated only for the
   *  strength category; empty for endurance. For "week" granularity this is the period's raw total; for
   *  month/semester/year it's the AVERAGE per calendar week in the period
   *  (denominator = total weeks in the period, including weeks with zero series). */
  muscleSeries: MuscleSeriesRow[];
  streak: number;
  streakDates: string[];
  /** The active period's date range — used to badge records achieved within it. */
  currentRange: DateRange;
  refresh: () => void;
}

function inRange(row: AnalyticsSetRow, range: DateRange): boolean {
  return row.date >= range.start && row.date <= range.end;
}

function muscleFrequency(sets: AnalyticsSetRow[]): { muscle_group: string; count: number }[] {
  const bySessionByMuscle = new Map<string, Set<number>>();

  for (const s of sets) {
    for (const mg of s.muscle_groups) {
      let sessions = bySessionByMuscle.get(mg);
      if (!sessions) {
        sessions = new Set<number>();
        bySessionByMuscle.set(mg, sessions);
      }
      sessions.add(s.session_id);
    }
  }

  return Array.from(bySessionByMuscle.entries())
    .map(([muscle_group, sessions]) => ({ muscle_group, count: sessions.size }))
    .sort((a, b) => b.count - a.count);
}

export function useAnalytics(): AnalyticsView {
  const [modality, setModality] = useState<Modality>("musculacao");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const derived = useMemo(() => {
    const today = todayISO();
    const buckets = trendBuckets(granularity, today);
    const cur = periodRange(granularity, today);
    const prev = previousPeriodRange(granularity, today);
    const fetchStart = [buckets[0].start, prev.start].sort()[0];

    const sets = getSetsInRange(modality, fetchStart, today);
    const curSets = sets.filter((s) => inRange(s, cur));
    const prevSets = sets.filter((s) => inRange(s, prev));

    let strengthCurrent = ZERO_STRENGTH;
    let strengthPrevious = ZERO_STRENGTH;
    let distanceCurrent = ZERO_DISTANCE;
    let distancePrevious = ZERO_DISTANCE;
    let strengthRecords: StrengthRecord[] = [];
    let distanceRecords: DistanceRecords = EMPTY_DISTANCE_RECORDS;
    let muscleFreq: { muscle_group: string; count: number }[] = [];
    let muscleSeries: MuscleSeriesRow[] = [];
    let trend: { label: string; value: number }[];

    if (targetKindOf(modality) === "strength") {
      strengthCurrent = sumStrength(curSets);
      strengthPrevious = sumStrength(prevSets);
      const volumes = bucketSum(sets, buckets, (s) => s.reps * s.weight_kg);
      trend = buckets.map((b, i) => ({ label: b.label, value: volumes[i] }));
      strengthRecords = getStrengthRecords(modality);
    } else {
      distanceCurrent = sumDistance(curSets);
      distancePrevious = sumDistance(prevSets);
      const distances = bucketSum(sets, buckets, (s) => s.distance_km ?? 0);
      trend = buckets.map((b, i) => ({ label: b.label, value: distances[i] }));
      distanceRecords = getDistanceRecords(modality);
    }

    // Muscle-group breakdowns hang off the training type, not off the metric
    // shape — an endurance modality has neither, however its sets are measured.
    if (isStrengthCategory(modality)) {
      muscleFreq = muscleFrequency(curSets);
      if (granularity === "week") {
        muscleSeries = toMuscleSeriesRows(getMuscleSeriesInRange(modality, cur.start, cur.end));
      } else {
        const periodWeeks = weeksInRange(cur.start, cur.end);
        const weeklyRaw = periodWeeks.map((w) => getMuscleSeriesInRange(modality, w.start, w.end));
        muscleSeries = averageMuscleSeriesPerWeek(weeklyRaw, periodWeeks.length);
      }
    }

    const streakDates = getSessionDatesByModality(modality);
    const streak = computeStreak(streakDates, today);

    return {
      strengthCurrent,
      strengthPrevious,
      distanceCurrent,
      distancePrevious,
      trend,
      strengthRecords,
      distanceRecords,
      muscleFreq,
      muscleSeries,
      streak,
      streakDates,
      currentRange: cur,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modality, granularity, refreshKey]);

  return {
    modality,
    granularity,
    setModality,
    setGranularity,
    ...derived,
    refresh,
  };
}
