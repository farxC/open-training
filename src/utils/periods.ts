import type { DateRange, Granularity, TrendBucket } from "@/types";
import { addDays, weekday } from "./cycle";

const MONTH_ABBR_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const DEFAULT_COUNT: Record<Granularity, number> = {
  week: 8,
  month: 6,
  semester: 4,
  year: 4,
};

/** Parses a local 'YYYY-MM-DD' string into its integer year/month(1-based)/day parts. */
function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function formatISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Last day-of-month number (28-31) for the given year/month(1-based), local-safe. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the *next* month is the last day of `month`.
  return new Date(year, month, 0).getDate();
}

function startOfMonthISO(year: number, month: number): string {
  return formatISO(year, month, 1);
}

function endOfMonthISO(year: number, month: number): string {
  return formatISO(year, month, daysInMonth(year, month));
}

/** Adds `n` months (may be negative) to a year/month pair, returning the normalized pair. */
function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const total = (month - 1) + n;
  const y = year + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12 + 1;
  return { year: y, month: m };
}

function mondayOnOrBeforeISO(iso: string): string {
  const daysFromMonday = (weekday(iso) + 6) % 7;
  return addDays(iso, -daysFromMonday);
}

function semesterOf(month: number): 1 | 2 {
  return month <= 6 ? 1 : 2;
}

export function periodRange(g: Granularity, refISO: string): DateRange {
  const { year, month } = parseISO(refISO);

  switch (g) {
    case "week": {
      const start = mondayOnOrBeforeISO(refISO);
      return { start, end: addDays(start, 6) };
    }
    case "month": {
      return { start: startOfMonthISO(year, month), end: endOfMonthISO(year, month) };
    }
    case "semester": {
      const half = semesterOf(month);
      return half === 1
        ? { start: formatISO(year, 1, 1), end: formatISO(year, 6, 30) }
        : { start: formatISO(year, 7, 1), end: formatISO(year, 12, 31) };
    }
    case "year": {
      return { start: formatISO(year, 1, 1), end: formatISO(year, 12, 31) };
    }
  }
}

export function previousPeriodRange(g: Granularity, refISO: string): DateRange {
  const { year, month } = parseISO(refISO);

  switch (g) {
    case "week": {
      const start = mondayOnOrBeforeISO(refISO);
      const prevStart = addDays(start, -7);
      return { start: prevStart, end: addDays(prevStart, 6) };
    }
    case "month": {
      const { year: y, month: m } = addMonths(year, month, -1);
      return { start: startOfMonthISO(y, m), end: endOfMonthISO(y, m) };
    }
    case "semester": {
      const half = semesterOf(month);
      if (half === 1) {
        // S1 -> S2 of prior year
        return { start: formatISO(year - 1, 7, 1), end: formatISO(year - 1, 12, 31) };
      }
      // S2 -> S1 of the same year
      return { start: formatISO(year, 1, 1), end: formatISO(year, 6, 30) };
    }
    case "year": {
      return { start: formatISO(year - 1, 1, 1), end: formatISO(year - 1, 12, 31) };
    }
  }
}

function weekLabel(mondayISO: string): string {
  const { month, day } = parseISO(mondayISO);
  return `${day}/${month}`;
}

function monthLabel(month: number): string {
  return MONTH_ABBR_PT[month - 1];
}

function semesterLabel(year: number, half: 1 | 2): string {
  return `S${half}/${String(year).slice(-2)}`;
}

/** The refISO shifted back by `stepsBack` periods of granularity `g` (0 = current period). */
function shiftedRefISO(g: Granularity, refISO: string, stepsBack: number): string {
  if (stepsBack === 0) return refISO;

  const { year, month, day } = parseISO(refISO);
  switch (g) {
    case "week":
      return addDays(refISO, -7 * stepsBack);
    case "month": {
      const { year: y, month: m } = addMonths(year, month, -stepsBack);
      // Clamp day to the target month's length (safe for our use: we only need
      // the bucket's containing period, not the exact day).
      return formatISO(y, m, Math.min(day, daysInMonth(y, m)));
    }
    case "semester":
      return addMonths_asISO(year, month, day, -6 * stepsBack);
    case "year":
      return formatISO(year - stepsBack, month, Math.min(day, daysInMonth(year - stepsBack, month)));
  }
}

function addMonths_asISO(year: number, month: number, day: number, n: number): string {
  const { year: y, month: m } = addMonths(year, month, n);
  return formatISO(y, m, Math.min(day, daysInMonth(y, m)));
}

export function trendBuckets(g: Granularity, refISO: string, count?: number): TrendBucket[] {
  const n = count ?? DEFAULT_COUNT[g];
  const buckets: TrendBucket[] = [];

  for (let stepsBack = n - 1; stepsBack >= 0; stepsBack--) {
    const bucketRefISO = shiftedRefISO(g, refISO, stepsBack);
    const range = periodRange(g, bucketRefISO);
    const { year, month } = parseISO(range.start);

    let label: string;
    switch (g) {
      case "week":
        label = weekLabel(range.start);
        break;
      case "month":
        label = monthLabel(month);
        break;
      case "semester":
        label = semesterLabel(year, semesterOf(month));
        break;
      case "year":
        label = String(year);
        break;
    }

    buckets.push({ ...range, label });
  }

  return buckets;
}
