import type {
  ExerciseConfig,
  Laterality,
  LoadType,
  PulleyType,
  RangeOfMotion,
  ResistanceCurve,
} from "@/types";

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
  resistance_curve: "descending",
  load_type: "free",
  pulley_type: null,
  laterality: "bilateral",
  rom: "full",
  uses_bench: 0,
  bench_angle_degrees: null,
};

export const RESISTANCE_CURVE_OPTIONS: ResistanceCurve[] = [
  "ascending",
  "descending",
  "constant",
  "bell",
];

export const RESISTANCE_CURVE_LABELS: Record<ResistanceCurve, string> = {
  ascending: "Ascendente",
  descending: "Descendente",
  constant: "Constante",
  bell: "Sino (U invertido)",
};

export const LOAD_TYPE_OPTIONS: LoadType[] = ["free", "plate", "pulley"];

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  free: "Livre",
  plate: "Anilha",
  pulley: "Polia",
};

export const PULLEY_TYPE_OPTIONS: PulleyType[] = ["mobile", "fixed"];

export const PULLEY_TYPE_LABELS: Record<PulleyType, string> = {
  mobile: "Móvel",
  fixed: "Fixa",
};

export const LATERALITY_OPTIONS: Laterality[] = ["bilateral", "unilateral"];

export const LATERALITY_LABELS: Record<Laterality, string> = {
  bilateral: "Bilateral",
  unilateral: "Unilateral",
};

export const ROM_OPTIONS: RangeOfMotion[] = ["full", "partial"];

export const ROM_LABELS: Record<RangeOfMotion, string> = {
  full: "Completa",
  partial: "Parcial",
};

// Common bench angles offered as one-tap chips; anything else is entered as a
// custom degree value (positive = incline, negative = decline, 0 = flat).
export const BENCH_ANGLE_PRESETS: number[] = [-15, 0, 15, 30, 45, 60];

export function benchAngleLabel(degrees: number): string {
  if (degrees === 0) return "Reto";
  if (degrees > 0) return `Inclinado ${degrees}°`;
  return `Declinado ${Math.abs(degrees)}°`;
}

/** Short, human-scannable summary of a resolved config, e.g. "Descendente · Polia móvel". */
export function exerciseConfigSummary(config: ExerciseConfig): string {
  const parts = [RESISTANCE_CURVE_LABELS[config.resistance_curve], LOAD_TYPE_LABELS[config.load_type]];
  if (config.load_type === "pulley" && config.pulley_type) {
    parts.push(PULLEY_TYPE_LABELS[config.pulley_type]);
  }
  if (config.laterality === "unilateral") parts.push(LATERALITY_LABELS.unilateral);
  if (config.rom === "partial") parts.push(ROM_LABELS.partial);
  if (config.uses_bench && config.bench_angle_degrees != null) {
    parts.push(`Banco: ${benchAngleLabel(config.bench_angle_degrees)}`);
  }
  return parts.join(" · ");
}
