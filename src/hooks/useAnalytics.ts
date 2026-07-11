import { useCallback, useMemo, useState } from "react";
import {
  getRunningRecords,
  getSessionDatesByModality,
  getSetsInRange,
  getStrengthRecords,
} from "@/db/queries";
import type {
  AnalyticsSetRow,
  DateRange,
  Granularity,
  Modality,
  RunningRecords,
  RunningSummary,
  StrengthRecord,
  StrengthSummary,
} from "@/types";
import { bucketSum, computeStreak, sumRunning, sumStrength } from "@/utils/analyticsAgg";
import { todayISO } from "@/utils/cycle";
import { periodRange, previousPeriodRange, trendBuckets } from "@/utils/periods";

const ZERO_STRENGTH: StrengthSummary = { volume: 0, sessionCount: 0, maxWeight: 0 };
const ZERO_RUNNING: RunningSummary = { distance: 0, runCount: 0, totalDuration: 0, avgPaceSec: null };
const EMPTY_RUNNING_RECORDS: RunningRecords = {
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
  /** Meaningful when modality === "musculacao"; zeroed otherwise. */
  strengthCurrent: StrengthSummary;
  strengthPrevious: StrengthSummary;
  /** Meaningful when modality === "corrida"; zeroed otherwise. */
  runningCurrent: RunningSummary;
  runningPrevious: RunningSummary;
  trend: { label: string; value: number }[];
  strengthRecords: StrengthRecord[];
  runningRecords: RunningRecords;
  muscleFreq: { muscle_group: string; count: number }[];
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
    let sessions = bySessionByMuscle.get(s.muscle_group);
    if (!sessions) {
      sessions = new Set<number>();
      bySessionByMuscle.set(s.muscle_group, sessions);
    }
    sessions.add(s.session_id);
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
    let runningCurrent = ZERO_RUNNING;
    let runningPrevious = ZERO_RUNNING;
    let strengthRecords: StrengthRecord[] = [];
    let runningRecords: RunningRecords = EMPTY_RUNNING_RECORDS;
    let muscleFreq: { muscle_group: string; count: number }[] = [];
    let trend: { label: string; value: number }[];

    if (modality === "musculacao") {
      strengthCurrent = sumStrength(curSets);
      strengthPrevious = sumStrength(prevSets);
      const volumes = bucketSum(sets, buckets, (s) => s.reps * s.weight_kg);
      trend = buckets.map((b, i) => ({ label: b.label, value: volumes[i] }));
      strengthRecords = getStrengthRecords();
      muscleFreq = muscleFrequency(curSets);
    } else {
      runningCurrent = sumRunning(curSets);
      runningPrevious = sumRunning(prevSets);
      const distances = bucketSum(sets, buckets, (s) => s.distance_km ?? 0);
      trend = buckets.map((b, i) => ({ label: b.label, value: distances[i] }));
      runningRecords = getRunningRecords();
    }

    const streakDates = getSessionDatesByModality(modality);
    const streak = computeStreak(streakDates, today);

    return {
      strengthCurrent,
      strengthPrevious,
      runningCurrent,
      runningPrevious,
      trend,
      strengthRecords,
      runningRecords,
      muscleFreq,
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
