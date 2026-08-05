// Turns the flat list of sets behind one exercise into what the exercise screen
// actually shows: the training ledger, grouped by the session it was logged in.
//
// A flat list of sets is unreadable — the same set means something different on a
// day you went up 5 kg than on a deload. So the session is the unit here: it
// carries its own totals, how it moved against the session before it, and whether
// the all-time best lives inside it.

import { isDistanceModality } from "@/data/modalities";
import type { Modality, WorkoutSet } from "@/types";

export type DatedSet = WorkoutSet & { date: string };

export interface HistorySet {
  set: DatedSet;
  /** Load as a fraction of this exercise's all-time best — the row's bar. 0 when unloaded. */
  intensity: number;
  /** The all-time best set of the exercise. Exactly one per history, at most. */
  isRecord: boolean;
  /** The heaviest (or longest) set of its own session. */
  isTopSet: boolean;
}

export interface HistorySession {
  sessionId: number;
  date: string;
  /** Ordered by set_number, as logged. */
  sets: HistorySet[];
  volumeKg: number;
  /** Heaviest load of the session; null when nothing in it carried load. */
  topWeightKg: number | null;
  distanceKm: number;
  /** Fastest pace of the session, in seconds per km. */
  bestPaceSec: number | null;
  /** Top load against the previous session of this exercise — null with nothing to compare. */
  deltaKg: number | null;
  containsRecord: boolean;
}

export interface ExerciseHistory {
  /** Newest session first — the order the screen reads in. */
  sessions: HistorySession[];
  setCount: number;
  sessionCount: number;
  /** The set worth bragging about: heaviest load, or longest distance for endurance. */
  recordSet: DatedSet | null;
  bestWeightKg: number | null;
  bestDistanceKm: number | null;
  bestPaceSec: number | null;
  totalVolumeKg: number;
  totalDistanceKm: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Top-set load per session, oldest first — the progression chart's series. */
  topSetTrend: { date: string; value: number }[];
}

const EMPTY: ExerciseHistory = {
  sessions: [],
  setCount: 0,
  sessionCount: 0,
  recordSet: null,
  bestWeightKg: null,
  bestDistanceKm: null,
  bestPaceSec: null,
  totalVolumeKg: 0,
  totalDistanceKm: 0,
  firstDate: null,
  lastDate: null,
  topSetTrend: [],
};

/** Calendar months the ledger touches, however many sessions each holds. */
export function monthsCovered(sessions: HistorySession[]): number {
  return new Set(sessions.map((s) => s.date.slice(0, 7))).size;
}

/**
 * The most recent `monthCount` calendar months of a newest-first session list.
 *
 * Months rather than a fixed session count: how much of the ledger is worth
 * opening with is a question about how far back you're reading, and twelve
 * sessions can be three weeks of a push/pull split or a year of squats.
 * Untrained months don't consume a slot — a two-month window ending in a layoff
 * would otherwise show nothing.
 */
export function sessionsWithinMonths(
  sessions: HistorySession[],
  monthCount: number
): HistorySession[] {
  const months = new Set<string>();
  const kept: HistorySession[] = [];

  for (const session of sessions) {
    const month = session.date.slice(0, 7);
    if (!months.has(month)) {
      if (months.size >= monthCount) break;
      months.add(month);
    }
    kept.push(session);
  }

  return kept;
}

/**
 * Monthly totals across the ledger, oldest first — the accumulation chart's
 * series. Months with no training are skipped rather than zero-filled: a bar of
 * nothing between two blocks would read as a month of empty sessions.
 */
export function monthlyTotals(
  sessions: HistorySession[],
  kind: "volume" | "distance"
): { month: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const month = session.date.slice(0, 7);
    const add = kind === "volume" ? session.volumeKg : session.distanceKm;
    totals.set(month, (totals.get(month) ?? 0) + add);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));
}

/** How much of a set counts as "the metric" for this modality. */
function metricOf(set: DatedSet, isDistance: boolean): number {
  return isDistance ? set.distance_km ?? 0 : set.weight_kg;
}

/**
 * Which of two sets is the better one. Load (or distance) decides it; reps break
 * a tie, so 100 kg × 8 outranks the 100 kg × 5 that came before it. Between two
 * identical sets the earlier one keeps the record — that's the day it was set.
 */
function beats(candidate: DatedSet, best: DatedSet, isDistance: boolean): boolean {
  const a = metricOf(candidate, isDistance);
  const b = metricOf(best, isDistance);
  if (a !== b) return a > b;
  return candidate.reps > best.reps;
}

export function buildExerciseHistory(sets: DatedSet[], modality: Modality): ExerciseHistory {
  if (sets.length === 0) return EMPTY;

  const isDistance = isDistanceModality(modality);

  // The record has to be resolved before the rows are built: every bar is drawn
  // relative to it.
  let recordSet: DatedSet | null = null;
  for (const set of sets) {
    if (metricOf(set, isDistance) <= 0) continue;
    if (recordSet == null || beats(set, recordSet, isDistance)) recordSet = set;
  }
  const scale = recordSet ? metricOf(recordSet, isDistance) : 0;

  // Sets arrive oldest-first, grouped by session in insertion order. Grouping by
  // session_id rather than by date keeps two sessions on the same day apart.
  const groups = new Map<number, DatedSet[]>();
  for (const set of sets) {
    const bucket = groups.get(set.session_id);
    if (bucket) bucket.push(set);
    else groups.set(set.session_id, [set]);
  }

  const built: HistorySession[] = [];

  for (const [sessionId, group] of groups) {
    const ordered = [...group].sort((a, b) => a.set_number - b.set_number);

    const loaded = ordered.filter((s) => metricOf(s, isDistance) > 0);
    const topMetric = loaded.length
      ? loaded.reduce((max, s) => Math.max(max, metricOf(s, isDistance)), 0)
      : null;
    const topWeightKg = isDistance
      ? null
      : loaded.length
        ? loaded.reduce((max, s) => Math.max(max, s.weight_kg), 0)
        : null;

    // Only the first set at the top load is marked, so a session of five sets at
    // the same weight doesn't come back with five crowns.
    let topSetTaken = false;

    const historySets: HistorySet[] = ordered.map((set) => {
      const metric = metricOf(set, isDistance);
      const isTop = topMetric != null && metric === topMetric && !topSetTaken;
      if (isTop) topSetTaken = true;
      return {
        set,
        intensity: scale > 0 && metric > 0 ? metric / scale : 0,
        isRecord: recordSet != null && set.id === recordSet.id,
        isTopSet: isTop,
      };
    });

    const paces = ordered.map((s) => s.pace_sec).filter((p): p is number => p != null && p > 0);

    built.push({
      sessionId,
      date: ordered[0].date,
      sets: historySets,
      volumeKg: ordered.reduce((sum, s) => sum + s.reps * s.weight_kg, 0),
      topWeightKg,
      distanceKm: ordered.reduce((sum, s) => sum + (s.distance_km ?? 0), 0),
      bestPaceSec: paces.length ? Math.min(...paces) : null,
      deltaKg: null,
      containsRecord: historySets.some((s) => s.isRecord),
    });
  }

  // Dates, not insertion order: a session recorded after the fact for last month
  // belongs at its own place in the ledger, not on top of it.
  const byDateDesc = [...built].sort((a, b) =>
    a.date === b.date ? b.sessionId - a.sessionId : b.date.localeCompare(a.date)
  );
  const byDateAsc = [...byDateDesc].reverse();

  // Chronological, so the delta compares against the session actually trained
  // before it — filled in after sorting, since sets arrive grouped by insertion.
  // Deloads and PRs are the same shape of information, so it stays signed, and
  // only exists where both sessions carried load.
  let previousTop: number | null = null;
  for (const session of byDateAsc) {
    if (isDistance) continue;
    if (session.topWeightKg != null && previousTop != null) {
      session.deltaKg = session.topWeightKg - previousTop;
    }
    if (session.topWeightKg != null) previousTop = session.topWeightKg;
  }

  const distances = sets.map((s) => s.distance_km ?? 0).filter((d) => d > 0);
  const paces = sets.map((s) => s.pace_sec).filter((p): p is number => p != null && p > 0);

  return {
    sessions: byDateDesc,
    setCount: sets.length,
    sessionCount: byDateDesc.length,
    recordSet,
    bestWeightKg: isDistance ? null : recordSet?.weight_kg ?? null,
    bestDistanceKm: distances.length ? Math.max(...distances) : null,
    bestPaceSec: paces.length ? Math.min(...paces) : null,
    totalVolumeKg: sets.reduce((sum, s) => sum + s.reps * s.weight_kg, 0),
    totalDistanceKm: distances.reduce((sum, d) => sum + d, 0),
    firstDate: byDateAsc[0]?.date ?? null,
    lastDate: byDateDesc[0]?.date ?? null,
    topSetTrend: byDateAsc
      .filter((s) => (isDistance ? s.distanceKm > 0 : s.topWeightKg != null))
      .map((s) => ({ date: s.date, value: isDistance ? s.distanceKm : s.topWeightKg ?? 0 })),
  };
}
