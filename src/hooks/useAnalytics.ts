import { useCallback, useMemo, useState } from "react";
import {
  getDistanceRecords,
  getExerciseDailyMaxes,
  getMuscleExerciseSeriesInRange,
  getMuscleSeriesInRange,
  getSessionDatesByModality,
  getSetsInRange,
  getStrengthRecords,
} from "@/db/queries";
import { isStrengthCategory, targetKindOf } from "@/data/modalities";
import type {
  AnalyticsSetRow,
  DateRange,
  DayBar,
  DayExerciseBreakdown,
  DistanceRecords,
  DistanceSummary,
  Granularity,
  Modality,
  MuscleExerciseRow,
  MuscleFrequencyRow,
  MuscleSeriesRow,
  StrengthSummary,
} from "@/types";
import type { MuscleRecordGroup } from "@/utils/analyticsRecords";
import {
  averageMuscleSeriesPerWeek,
  bucketSum,
  computeStreak,
  dayBars,
  dayBreakdown,
  muscleExerciseBreakdown,
  sumDistance,
  sumStrength,
  toMuscleSeriesRows,
  weeklyMuscleFrequency,
} from "@/utils/analyticsAgg";
import { groupRecordsByMuscle } from "@/utils/analyticsRecords";
import { hotExerciseIds } from "@/utils/recordsGamification";
import { todayISO } from "@/utils/cycle";
import {
  analysisComparisonLabel,
  analysisWeeks,
  analysisWindowLabel,
  previousAnalysisRange,
  trendBuckets,
} from "@/utils/periods";

const EMPTY_HOT: ReadonlySet<number> = new Set();
const ZERO_STRENGTH: StrengthSummary = { volume: 0, sessionCount: 0 };
const ZERO_DISTANCE: DistanceSummary = { distance: 0, runCount: 0, totalDuration: 0, avgPaceSec: null };
const EMPTY_DISTANCE_RECORDS: DistanceRecords = {
  longest_distance_km: null,
  longest_distance_on: null,
  fastest_pace_sec: null,
  fastest_pace_on: null,
  longest_duration_sec: null,
  longest_duration_on: null,
};

/** The window every number on the screen is measured over. */
export interface AnalysisWindow {
  range: DateRange;
  /** Mon–Sun weeks in the window — the divisor behind every "por semana" value. */
  weekCount: number;
  /** Ready-to-render caption, e.g. "últimas 4 semanas · 06/07 – 02/08". */
  label: string;
  /** Caption for the summary, e.g. "últimas 4 semanas vs 4 anteriores". */
  comparisonLabel: string;
}

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
  /** Bucketed totals for the trend chart: volume for strength, distance (km) for
   *  distance. Only the endurance long views still render these — strength long
   *  views show muscleSeries instead, and week views show dayBars. */
  trend: { label: string; value: number }[];
  /** Seven Mon–Sun bars for the active week. Only populated at week granularity. */
  dayBars: DayBar[];
  /** Per-exercise detail for one day, derived from the sets already fetched —
   *  opening the day-detail modal costs no query. */
  dayBreakdown: (dateISO: string) => DayExerciseBreakdown[];
  /** Records grouped by the exercise's current muscle groups; strength only. */
  recordsByGroup: MuscleRecordGroup[];
  /** Exercise ids whose load has climbed repeatedly in the recent window —
   *  drives the "QUENTE" stamp on a record. Empty for distance modalities. */
  hotExercises: ReadonlySet<number>;
  distanceRecords: DistanceRecords;
  /** Series (sum of counting_factor) per muscle group over the window. Populated
   *  only for the strength category; empty for endurance. Raw weekly totals at
   *  week granularity, average per week in the window otherwise. */
  muscleSeries: MuscleSeriesRow[];
  /** Sessions per muscle group over the window — raw count at week granularity,
   *  sessions-per-week otherwise. Strength category only. */
  muscleFreq: MuscleFrequencyRow[];
  /** Which exercises produced one muscle group's series, ranked. Derived from a
   *  rollup fetched with the rest of the window, so expanding a group in the
   *  panel costs no query. Empty for groups with nothing in the window, and for
   *  every group outside the strength category. */
  muscleBreakdown: (muscleGroup: string) => MuscleExerciseRow[];
  streak: number;
  streakDates: string[];
  analysisWindow: AnalysisWindow;
  refresh: () => void;
}

function inRange(row: AnalyticsSetRow, range: DateRange): boolean {
  return row.date >= range.start && row.date <= range.end;
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
    const weeks = analysisWeeks(granularity, today);
    const cur: DateRange = { start: weeks[0].start, end: weeks[weeks.length - 1].end };
    const prev = previousAnalysisRange(granularity, today);
    const buckets = trendBuckets(granularity, today);
    // The window and the trend buckets disagree on where history starts — fetch
    // from whichever reaches furthest back and slice in JS from there.
    const fetchStart = [buckets[0].start, prev.start, cur.start].sort()[0];

    const sets = getSetsInRange(modality, fetchStart, today);
    const curSets = sets.filter((s) => inRange(s, cur));
    const prevSets = sets.filter((s) => inRange(s, prev));

    const isStrengthMetric = targetKindOf(modality) === "strength";

    let strengthCurrent = ZERO_STRENGTH;
    let strengthPrevious = ZERO_STRENGTH;
    let distanceCurrent = ZERO_DISTANCE;
    let distancePrevious = ZERO_DISTANCE;
    let recordsByGroup: MuscleRecordGroup[] = [];
    let hotExercises: ReadonlySet<number> = EMPTY_HOT;
    let distanceRecords: DistanceRecords = EMPTY_DISTANCE_RECORDS;
    let muscleFreq: MuscleFrequencyRow[] = [];
    let muscleSeries: MuscleSeriesRow[] = [];
    let muscleExercises = new Map<string, MuscleExerciseRow[]>();
    let trend: { label: string; value: number }[];

    if (isStrengthMetric) {
      strengthCurrent = sumStrength(curSets);
      strengthPrevious = sumStrength(prevSets);
      const volumes = bucketSum(sets, buckets, (s) => s.reps * s.weight_kg);
      trend = buckets.map((b, i) => ({ label: b.label, value: volumes[i] }));
      recordsByGroup = groupRecordsByMuscle(getStrengthRecords(modality));
      // Needs every load ever logged, not just the window: a lift only counts as
      // climbing if today's weight beats all of its history, not the last month of it.
      hotExercises = hotExerciseIds(getExerciseDailyMaxes(modality), today);
    } else {
      distanceCurrent = sumDistance(curSets);
      distancePrevious = sumDistance(prevSets);
      const distances = bucketSum(sets, buckets, (s) => s.distance_km ?? 0);
      trend = buckets.map((b, i) => ({ label: b.label, value: distances[i] }));
      distanceRecords = getDistanceRecords(modality);
    }

    // Day bars only mean something for the one-week window; the longer views
    // would need dozens of bars to say less than the per-week lists do.
    const bars =
      granularity === "week"
        ? dayBars(curSets, weeks[0], (s) => (isStrengthMetric ? s.reps * s.weight_kg : s.distance_km ?? 0))
        : [];

    // Muscle-group breakdowns hang off the training type, not off the metric
    // shape — an endurance modality has neither, however its sets are measured.
    if (isStrengthCategory(modality)) {
      const weeklyRaw = weeks.map((w) => getMuscleSeriesInRange(modality, w.start, w.end));
      muscleSeries =
        weeks.length === 1
          ? toMuscleSeriesRows(weeklyRaw[0])
          : averageMuscleSeriesPerWeek(weeklyRaw, weeks.length);
      muscleFreq = weeklyMuscleFrequency(curSets, weeks.length);
      // One query over the whole window, divided by the same week count the
      // group rows use — analysisWeeks() tiles the range exactly, so this sums
      // to what the per-week queries above produce, and the drill-down adds up
      // to the row it sits under.
      muscleExercises = muscleExerciseBreakdown(
        getMuscleExerciseSeriesInRange(modality, cur.start, cur.end),
        weeks.length
      );
    }

    const streakDates = getSessionDatesByModality(modality);
    const streak = computeStreak(streakDates, today);

    return {
      strengthCurrent,
      strengthPrevious,
      distanceCurrent,
      distancePrevious,
      trend,
      dayBars: bars,
      dayBreakdown: (dateISO: string) => dayBreakdown(curSets, dateISO),
      recordsByGroup,
      hotExercises,
      distanceRecords,
      muscleFreq,
      muscleSeries,
      muscleBreakdown: (muscleGroup: string) => muscleExercises.get(muscleGroup) ?? [],
      streak,
      streakDates,
      analysisWindow: {
        range: cur,
        weekCount: weeks.length,
        label: analysisWindowLabel(granularity, weeks),
        comparisonLabel: analysisComparisonLabel(granularity, weeks.length),
      },
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
