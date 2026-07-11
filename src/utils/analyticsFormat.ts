// Pure, unit-testable formatting helpers for the analytics screen. No JSX, no
// data-fetching — just number/Delta -> display string. Keeps app/(tabs)/analytics.tsx
// and its section components free of inline string formatting.

import { formatClock } from "@/data/modalities";
import type { Delta } from "@/types";

/** Formats a kg volume as "1.2t" once it crosses 1000kg, else "842 kg". */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

/** Formats a distance in km to one decimal, e.g. "12.3 km". */
export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

/** Formats a plain count (sessions, runs, etc). */
export function formatCount(n: number): string {
  return String(n);
}

export type DeltaKind = "percent" | "count" | "pace";

/**
 * Turns a Delta into the arrow+value string shown under a ComparisonTile.
 *
 * - "percent": "↑ 11%" / "↓ 8%" — arrow follows the sign of pct.
 * - "count":   "+1" / "-2" — arrow-less signed integer.
 * - "pace":    "↓ 0:12/km" / "↑ 0:12/km" using formatClock on the absolute
 *   change — a NEGATIVE absChange (faster pace) is the down-arrow improvement,
 *   regardless of Delta.better (which already encodes higherIsBetter=false).
 *
 * Returns null when there's no baseline to compare against (Delta.pct is
 * null, i.e. the previous period had no usable data).
 */
export function formatDeltaText(d: Delta, kind: DeltaKind): string | null {
  if (d.pct == null) return null;

  if (kind === "percent") {
    const arrow = d.pct >= 0 ? "↑ " : "↓ ";
    return `${arrow}${Math.abs(d.pct)}%`;
  }

  const change = d.absChange ?? 0;

  if (kind === "count") {
    return `${change >= 0 ? "+" : ""}${change}`;
  }

  // pace
  const arrow = change <= 0 ? "↓ " : "↑ ";
  return `${arrow}${formatClock(Math.abs(change))}/km`;
}
