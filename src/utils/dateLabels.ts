// pt-BR date labels. Deliberately hand-rolled rather than toLocaleString: Hermes
// ships without full ICU on Android, where locale formatting silently falls back
// to English.

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

/** Midday, not midnight: a date-only string parsed as UTC lands on the previous
 *  day in negative offsets, which would shift every weekday by one. */
function parse(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** "QUA 14 JUL" — the ledger's day stamp. The year is added when it isn't the current one. */
export function dayStamp(iso: string, currentYear?: number): string {
  const d = parse(iso);
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const year = d.getFullYear();
  return currentYear != null && year !== currentYear ? `${base} ${year}` : base;
}

/** "hoje" / "ontem" / "4d" / "3sem" / "5m" / "2a" — fits a stat tile, where
 *  formatAgo's "há 12 dias" would wrap. */
export function compactAgo(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}sem`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}a`;
}

/** "jul 2026" — axis-scale label for a YYYY-MM bucket. */
export function monthStamp(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  return `${MONTHS[Number(month) - 1] ?? "?"} ${year.slice(2)}`;
}
