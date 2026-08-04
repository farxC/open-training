// Pure helpers behind the records "trophy case". Separate from analyticsRecords.ts,
// which only files records under muscle groups: everything here turns a record into
// something to chase — the next plate milestone, how cold it's gone, what rank it
// holds in its group.

import type { DateRange, ExerciseDailyMax, StrengthRecord } from "@/types";
import type { MuscleRecordGroup } from "@/utils/analyticsRecords";
import { daysBetween } from "@/utils/cycle";

/** A record that hasn't moved in this long reads as cold — a nudge, not an alarm. */
export const STALE_AFTER_DAYS = 90;

export function achievedInRange(dateISO: string | null, range: DateRange): boolean {
  return dateISO != null && dateISO >= range.start && dateISO <= range.end;
}

/**
 * How far apart the plate milestones sit at a given load. Coarse at the top so a
 * 180 kg squat isn't chasing 2.5 kg, fine at the bottom so a light accessory still
 * has a mark within reach.
 */
export function milestoneStep(weightKg: number): number {
  if (weightKg < 20) return 2.5;
  if (weightKg < 60) return 5;
  if (weightKg < 150) return 10;
  return 20;
}

export interface Milestone {
  step: number;
  /** The mark below `next` — the bar's zero point. */
  previous: number;
  /** The smallest milestone strictly above the current load. */
  next: number;
  /** 0..1 across the span between `previous` and `next`. */
  progress: number;
  /** The load sits exactly on a milestone: the bar reads empty, so celebrate the
   *  mark just taken instead of showing a climb that hasn't started. */
  justHit: boolean;
}

/** The next round number worth chasing from `weightKg`. */
export function nextMilestone(weightKg: number): Milestone {
  const step = milestoneStep(weightKg);
  // Round before flooring: 100/2.5 lands on 39.999… in binary float, which would
  // otherwise put a clean 100 kg one step short of where it belongs.
  const steps = Math.floor(Number((weightKg / step).toFixed(6)));
  const previous = steps * step;
  const justHit = Math.abs(weightKg - previous) < 1e-6;
  const next = previous + step;
  return {
    step,
    previous,
    next,
    progress: justHit ? 0 : (weightKg - previous) / step,
    justHit,
  };
}

/** Milestones step by 2.5 kg down at the light end, so a mark can be fractional —
 *  print the decimal only when there is one. */
export function formatKg(weightKg: number): string {
  return Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1);
}

/** Days since the record was set, or null when the date is missing. */
export function daysSinceRecord(achievedOn: string | null, todayISO: string): number | null {
  if (achievedOn == null) return null;
  return Math.max(0, daysBetween(achievedOn, todayISO));
}

/** "hoje" / "ontem" / "há 12 dias" / "há 3 meses" / "há 2 anos". */
export function formatAgo(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  }
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

export function isStale(days: number | null): boolean {
  return days != null && days >= STALE_AFTER_DAYS;
}

/** Gains inside the same window that decides staleness, so the two stamps read
 *  as opposite ends of one question: what has this lift done in three months? */
export const HOT_WINDOW_DAYS = STALE_AFTER_DAYS;
/** One increase is a good day; two is a trend. Below this, "em progressão"
 *  would be claiming more than the data supports. */
export const HOT_MIN_GAINS = 2;

/**
 * Exercises whose load actually climbed at least twice inside the hot window.
 *
 * Walks each exercise's daily bests in order, keeping the running all-time max:
 * a day counts as a gain only when it beats every day before it. The first day
 * an exercise ever appears is skipped — a debut sets the bar, it doesn't raise
 * it, and counting it would brand every newly-added exercise as progressing.
 */
export function hotExerciseIds(rows: ExerciseDailyMax[], todayISO: string): Set<number> {
  const byExercise = new Map<number, ExerciseDailyMax[]>();
  for (const row of rows) {
    const bucket = byExercise.get(row.exercise_id);
    if (bucket) bucket.push(row);
    else byExercise.set(row.exercise_id, [row]);
  }

  const hot = new Set<number>();
  for (const [exerciseId, days] of byExercise) {
    const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
    let best: number | null = null;
    let gains = 0;

    for (const day of ordered) {
      if (best == null) {
        best = day.max_weight_kg;
        continue;
      }
      if (day.max_weight_kg > best) {
        best = day.max_weight_kg;
        if (daysBetween(day.date, todayISO) <= HOT_WINDOW_DAYS) gains += 1;
      }
    }

    if (gains >= HOT_MIN_GAINS) hot.add(exerciseId);
  }

  return hot;
}

/** The stamps a record row can carry. "new" and "hot" can land together — a lift
 *  can set a record this week and have been climbing for months — but "hot" and
 *  "cold" are mutually exclusive by construction: a gain inside the window is
 *  exactly what staleness is the absence of. */
export type StampTone = "new" | "hot" | "cold";

/** The stamps one record carries, in display order. */
export function stampsFor(
  record: StrengthRecord,
  range: DateRange,
  todayISO: string,
  hot: ReadonlySet<number>
): StampTone[] {
  const tones: StampTone[] = [];
  if (achievedInRange(record.achieved_on, range)) tones.push("new");
  if (hot.has(record.exercise_id)) tones.push("hot");
  else if (isStale(daysSinceRecord(record.achieved_on, todayISO))) tones.push("cold");
  return tones;
}

export interface TrophyCase {
  /** Distinct exercises holding a record — groups double-count by design, since a
   *  bench press files under chest AND triceps. */
  total: number;
  /** Distinct records set inside the active window. */
  fresh: number;
  /** The heaviest record across every group. */
  best: StrengthRecord | null;
}

export function summarizeRecords(groups: MuscleRecordGroup[], range: DateRange): TrophyCase {
  const seen = new Map<number, StrengthRecord>();
  for (const group of groups) {
    for (const record of group.records) seen.set(record.exercise_id, record);
  }

  let best: StrengthRecord | null = null;
  let fresh = 0;
  for (const record of seen.values()) {
    if (best == null || record.max_weight_kg > best.max_weight_kg) best = record;
    if (achievedInRange(record.achieved_on, range)) fresh += 1;
  }

  return { total: seen.size, fresh, best };
}

/** Records within a group arrive sorted by weight, so the first one is the group's
 *  crown lift and index doubles as podium rank. */
export function crownRecord(group: MuscleRecordGroup): StrengthRecord | null {
  return group.records[0] ?? null;
}

export function freshCount(group: MuscleRecordGroup, range: DateRange): number {
  return group.records.filter((r) => achievedInRange(r.achieved_on, range)).length;
}

export interface Medal {
  /** Circle fill. */
  bg: string;
  /** Circle ring. */
  ring: string;
  /** Numeral colour, and the row's left accent bar. */
  ink: string;
}

/** Podium metals pitched into the app's warm paper palette — brass, pewter, copper
 *  rather than the saturated primaries a game would use. */
export const MEDALS: Medal[] = [
  { bg: "#f6e8c8", ring: "#d9a441", ink: "#8a5a12" }, // brass
  { bg: "#eae8e2", ring: "#b6b1a4", ink: "#6f6b5f" }, // pewter
  { bg: "#f3e2d5", ring: "#c08a5e", ink: "#8a5333" }, // copper
];

/** Metal for a podium rank, or null past third place — beyond the podium the rank
 *  is just an index and shouldn't compete with the top three for attention. */
export function medalFor(rank: number): Medal | null {
  return MEDALS[rank] ?? null;
}

/** Two-letter monogram for a muscle group, stamped into the shelf tile. Explicit
 *  rather than sliced from the label so Back and Biceps don't collide. */
const MONOGRAMS: Record<string, string> = {
  chest: "CH",
  back: "BK",
  shoulders: "SH",
  biceps: "BI",
  triceps: "TR",
  legs: "LG",
  femoral: "FM",
  glutes: "GL",
  core: "CR",
  cardio: "CD",
  full_body: "FB",
};

export function monogramFor(muscleGroup: string, label: string): string {
  return MONOGRAMS[muscleGroup] ?? label.slice(0, 2).toUpperCase();
}
