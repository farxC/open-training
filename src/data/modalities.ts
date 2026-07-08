import type { Modality } from "@/types";

export type TargetKind = "strength" | "distance";

export interface ModalityConfig {
  key: Modality;
  label: string;
  targetKind: TargetKind;
  icon: string; // MaterialCommunityIcons glyph name
}

// Fixed set of modalities. Add new ones here when needed.
export const MODALITIES: ModalityConfig[] = [
  { key: "musculacao", label: "Musculação", targetKind: "strength", icon: "dumbbell" },
  { key: "corrida", label: "Corrida", targetKind: "distance", icon: "run" },
];

export function modalityConfig(key: Modality): ModalityConfig {
  return MODALITIES.find((m) => m.key === key) ?? MODALITIES[0];
}

export function modalityLabel(key: Modality): string {
  return modalityConfig(key).label;
}

/** Parse "m:ss" / "mm:ss" / plain seconds into total seconds. Returns null if blank/invalid. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  if (t.includes(":")) {
    const [mStr, sStr = "0"] = t.split(":");
    const m = parseInt(mStr, 10);
    const s = parseInt(sStr, 10);
    if (Number.isNaN(m) || Number.isNaN(s)) return null;
    return m * 60 + s;
  }
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

/** Format total seconds as "m:ss" (minutes may exceed 60). */
export function formatClock(totalSec: number | null): string {
  if (totalSec == null || totalSec < 0) return "";
  const sec = Math.round(totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pace label "m:ss/km" from seconds-per-km. */
export function formatPaceSec(paceSec: number | null): string | null {
  if (!paceSec || paceSec <= 0) return null;
  return `${formatClock(paceSec)}/km`;
}

/** Total seconds for a continuous run = distance (km) × pace (sec/km). */
export function continuousDurationSec(distanceKm: number | null, paceSec: number | null): number | null {
  if (!distanceKm || !paceSec || distanceKm <= 0 || paceSec <= 0) return null;
  return distanceKm * paceSec;
}
