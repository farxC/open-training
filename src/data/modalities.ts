import type { Modality } from "@/types";

/**
 * What KIND OF TRAINING a modality is. Musculação is resistance training;
 * corrida, ciclismo, natação and caminhada are endurance work.
 *
 * Distinct from {@link TargetKind}, which answers a different question — see
 * the note above MODALITIES for which of the two any given branch wants.
 */
export type ModalityCategory = "strength" | "endurance";

/** How a modality's METRICS ARE SHAPED: sets × reps × load, or distance + effort. */
export type TargetKind = "strength" | "distance";

/** Categories in render order, for the modality selectors. */
export const MODALITY_CATEGORIES: { key: ModalityCategory; label: string }[] = [
  { key: "strength", label: "Força" },
  { key: "endurance", label: "Endurance" },
];

/**
 * How a distance modality presents its metrics.
 *
 * Storage stays canonical for EVERY modality: `sets.distance_km` is always
 * kilometres and `sets.pace_sec` is always seconds-per-kilometre. This config
 * only governs input parsing and display, so aggregates (Σ distance, MIN pace)
 * stay comparable across modalities and no schema change is needed.
 */
export interface DistanceDisplay {
  /** Unit shown next to distance inputs. */
  distanceUnit: "km" | "m";
  /** Kilometres in one displayed distance unit: km → 1, m → 0.001. */
  kmPerUnit: number;
  /** "pace" = time per basis distance (4:00/km, 2:00/100m); "speed" = km/h. */
  effortMode: "pace" | "speed";
  /** Basis of the displayed pace, in km: 1 for /km, 0.1 for /100m. Unused when effortMode is "speed". */
  paceBasisKm: number;
  /** Suffix rendered next to the effort input/value. */
  effortSuffix: string;
  /** Label of the analytics summary tile for effort. */
  effortTileLabel: string;
  /** Label of the personal-record card for effort. */
  effortRecordLabel: string;
  /** Placeholder for the effort input. */
  effortPlaceholder: string;
}

export interface ModalityConfig {
  key: Modality;
  label: string;
  category: ModalityCategory;
  targetKind: TargetKind;
  icon: string; // MaterialCommunityIcons glyph name
  /** Accent dot shown next to the modality name on session cards/detail. */
  dotColor: string;
  /** Plural noun for the session-count tile ("Treinos", "Corridas", …). */
  sessionNoun: string;
  /** Auto-provisioned exercise — distance modalities have no exercise picker,
   *  the session *is* the activity. Undefined for strength modalities. */
  defaultExerciseName?: string;
  /** Present iff targetKind === "distance". */
  distance?: DistanceDisplay;
}

const PACE_PER_KM: Omit<DistanceDisplay, "effortTileLabel" | "effortRecordLabel"> = {
  distanceUnit: "km",
  kmPerUnit: 1,
  effortMode: "pace",
  paceBasisKm: 1,
  effortSuffix: "/km",
  effortPlaceholder: "mm:ss",
};

/**
 * The single source of truth for modalities. The app never branches on a
 * modality literal — it reads the metadata below — so adding a modality is a
 * matter of adding an entry here (plus its seed exercise, which migrations
 * pick up from `defaultExerciseName`).
 *
 * TWO AXES, and a branch must pick the one that states WHY it branches. They
 * partition this list identically today, but they diverge at the first
 * roadmap modality: calistenia is strength training measured in reps, not in
 * distance.
 *
 *   category === "strength"   muscle groups (picker form, per-group series,
 *                             frequency chart), the exercise's physical
 *                             config, grouping in the modality selectors
 *   targetKind === "distance" which logger renders, units and parsing,
 *                             summary/records/trend shape, plan targets, and
 *                             the auto-provisioned session exercise
 *
 * Deliberately NOT mirrored by a SQL CHECK on the `modality` columns: the list
 * is expected to grow, and each new value would otherwise cost a full rebuild
 * of exercises/sessions/routine_splits.
 */
export const MODALITIES: ModalityConfig[] = [
  {
    key: "musculacao",
    label: "Musculação",
    category: "strength",
    targetKind: "strength",
    icon: "dumbbell",
    dotColor: "#26241f",
    sessionNoun: "Treinos",
  },
  {
    key: "corrida",
    label: "Corrida",
    category: "endurance",
    targetKind: "distance",
    icon: "run",
    dotColor: "#2f9e6e",
    sessionNoun: "Corridas",
    defaultExerciseName: "Correr",
    distance: { ...PACE_PER_KM, effortTileLabel: "Pace médio", effortRecordLabel: "Pace mais rápido" },
  },
  {
    key: "ciclismo",
    label: "Ciclismo",
    category: "endurance",
    targetKind: "distance",
    icon: "bike",
    dotColor: "#2b6cb0",
    sessionNoun: "Pedaladas",
    defaultExerciseName: "Pedalar",
    distance: {
      distanceUnit: "km",
      kmPerUnit: 1,
      effortMode: "speed",
      paceBasisKm: 1,
      effortSuffix: "km/h",
      effortTileLabel: "Velocidade média",
      effortRecordLabel: "Maior velocidade",
      effortPlaceholder: "0,0",
    },
  },
  {
    key: "natacao",
    label: "Natação",
    category: "endurance",
    targetKind: "distance",
    icon: "swim",
    dotColor: "#0e8ba8",
    sessionNoun: "Nados",
    defaultExerciseName: "Nadar",
    distance: {
      distanceUnit: "m",
      kmPerUnit: 0.001,
      effortMode: "pace",
      paceBasisKm: 0.1,
      effortSuffix: "/100m",
      effortTileLabel: "Pace médio",
      effortRecordLabel: "Pace mais rápido",
      effortPlaceholder: "mm:ss",
    },
  },
  {
    key: "caminhada",
    label: "Caminhada",
    category: "endurance",
    targetKind: "distance",
    icon: "walk",
    dotColor: "#a1682c",
    sessionNoun: "Caminhadas",
    defaultExerciseName: "Caminhar",
    distance: { ...PACE_PER_KM, effortTileLabel: "Pace médio", effortRecordLabel: "Pace mais rápido" },
  },
];

export function modalityConfig(key: Modality): ModalityConfig {
  return MODALITIES.find((m) => m.key === key) ?? MODALITIES[0];
}

export function modalityLabel(key: Modality): string {
  return modalityConfig(key).label;
}

export function categoryOf(key: Modality): ModalityCategory {
  return modalityConfig(key).category;
}

/** True for resistance training. The gate for everything muscle-group- and
 *  exercise-configuration-shaped — NOT the gate for how metrics are logged. */
export function isStrengthCategory(key: Modality): boolean {
  return categoryOf(key) === "strength";
}

export function targetKindOf(key: Modality): TargetKind {
  return modalityConfig(key).targetKind;
}

export function isDistanceModality(key: Modality): boolean {
  return targetKindOf(key) === "distance";
}

/** Display config for a distance modality. Falls back to corrida's (km, /km)
 *  so callers that reach here with a strength modality still render sanely. */
export function distanceDisplay(key: Modality): DistanceDisplay {
  return modalityConfig(key).distance ?? (modalityConfig("corrida").distance as DistanceDisplay);
}

/** Modalities of a given kind, in registry order. */
export function modalitiesOfKind(kind: TargetKind): ModalityConfig[] {
  return MODALITIES.filter((m) => m.targetKind === kind);
}

/** Modalities of a given category, in registry order. */
export function modalitiesOfCategory(category: ModalityCategory): ModalityConfig[] {
  return MODALITIES.filter((m) => m.category === category);
}

// ─── Distance & effort conversion ─────────────────────────────────────────────
// Canonical (stored) values are km and seconds-per-km; displayed values are
// whatever the modality declares. Every conversion goes through these four.

/** Canonical km → the modality's displayed distance number (e.g. 1.5 → 1500 for natação). */
export function toDisplayDistance(km: number | null, modality: Modality): number | null {
  if (km == null) return null;
  return km / distanceDisplay(modality).kmPerUnit;
}

/** The modality's displayed distance number → canonical km. */
export function fromDisplayDistance(value: number | null, modality: Modality): number | null {
  if (value == null) return null;
  return value * distanceDisplay(modality).kmPerUnit;
}

/** Fixed-decimal, trailing zeros trimmed, comma as the decimal separator. */
function formatNumber(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  return (fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed).replace(".", ",");
}

/** "5,2 km" / "1500 m". Returns null when there's nothing to show. */
export function formatDistanceValue(km: number | null, modality: Modality): string | null {
  if (km == null) return null;
  const d = distanceDisplay(modality);
  const value = km / d.kmPerUnit;
  return `${formatNumber(value, d.distanceUnit === "m" ? 0 : 2)} ${d.distanceUnit}`;
}

/** Canonical seconds-per-km → "4:00/km" | "2:00/100m" | "28,4 km/h". */
export function formatEffort(paceSecPerKm: number | null, modality: Modality): string | null {
  if (!paceSecPerKm || paceSecPerKm <= 0) return null;
  const d = distanceDisplay(modality);
  if (d.effortMode === "speed") return `${formatNumber(3600 / paceSecPerKm, 1)} ${d.effortSuffix}`;
  return `${formatClock(paceSecPerKm * d.paceBasisKm)}${d.effortSuffix}`;
}

/** The effort value alone, for text inputs — no suffix. */
export function formatEffortInput(paceSecPerKm: number | null, modality: Modality): string {
  if (!paceSecPerKm || paceSecPerKm <= 0) return "";
  const d = distanceDisplay(modality);
  if (d.effortMode === "speed") return formatNumber(3600 / paceSecPerKm, 1);
  return formatClock(paceSecPerKm * d.paceBasisKm);
}

/** User input in the modality's effort unit → canonical seconds-per-km. */
export function parseEffort(text: string, modality: Modality): number | null {
  const d = distanceDisplay(modality);
  if (d.effortMode === "speed") {
    const kmh = parseFloat(text.trim().replace(",", "."));
    if (!Number.isFinite(kmh) || kmh <= 0) return null;
    return Math.round(3600 / kmh);
  }
  const perBasis = parseClock(text);
  if (perBasis == null) return null;
  return Math.round(perBasis / d.paceBasisKm);
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

/** Pace label "m:ss/km" from seconds-per-km. The /km special case of formatEffort. */
export function formatPaceSec(paceSec: number | null): string | null {
  if (!paceSec || paceSec <= 0) return null;
  return `${formatClock(paceSec)}/km`;
}

/** Total seconds for a continuous effort = distance (km) × pace (sec/km). Valid
 *  for every modality, since both operands are canonical. */
export function continuousDurationSec(distanceKm: number | null, paceSec: number | null): number | null {
  if (!distanceKm || !paceSec || distanceKm <= 0 || paceSec <= 0) return null;
  return distanceKm * paceSec;
}
