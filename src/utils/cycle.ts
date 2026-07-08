/** Whole days from `fromISO` to `toISO` (both 'YYYY-MM-DD'); negative if `to` is earlier. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00").getTime();
  const to = new Date(toISO + "T00:00:00").getTime();
  return Math.round((to - from) / 86_400_000);
}

/** JS weekday: 0=Sun .. 6=Sat. */
export function weekday(iso: string): number {
  return new Date(iso + "T00:00:00").getDay();
}

/** ISO date `n` days after `iso` (local), e.g. addDays('2026-06-30',1) === '2026-07-01'. */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 0-based slot index for `dateISO` in a cyclic split of `unitCount` slots anchored at `anchorISO`,
 * where weekdays in `restWeekdays` (0=Sun..6=Sat) are skipped (they do NOT consume a slot).
 * Returns -1 if the date is a rest weekday, unitCount<=0, or all weekdays are rest.
 */
export function cyclicSlotIndex(
  anchorISO: string,
  dateISO: string,
  unitCount: number,
  restWeekdays: number[]
): number {
  if (unitCount <= 0) return -1;
  if (restWeekdays.length >= 7) return -1;
  if (restWeekdays.includes(weekday(dateISO))) return -1;

  // First eligible (non-rest) day on or after the anchor.
  let firstEligible = anchorISO;
  for (let i = 0; i < 7 && restWeekdays.includes(weekday(firstEligible)); i++) {
    firstEligible = addDays(firstEligible, 1);
  }

  // Signed count of eligible days between firstEligible (=0) and dateISO.
  const delta = daysBetween(firstEligible, dateISO);
  let ordinal = 0;
  if (delta > 0) {
    for (let i = 1; i <= delta; i++) {
      if (!restWeekdays.includes(weekday(addDays(firstEligible, i)))) ordinal++;
    }
  } else if (delta < 0) {
    for (let i = -1; i >= delta; i--) {
      if (!restWeekdays.includes(weekday(addDays(firstEligible, i)))) ordinal--;
    }
  }
  return ((ordinal % unitCount) + unitCount) % unitCount;
}

/** 0-based count of full weeks elapsed from `anchorISO` to `dateISO` (negative if `dateISO` is earlier). */
export function weekIndexSince(anchorISO: string, dateISO: string): number {
  return Math.floor(daysBetween(anchorISO, dateISO) / 7);
}
