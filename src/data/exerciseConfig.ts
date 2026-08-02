import type {
  ExerciseConfig,
  GripType,
  GripWidth,
  Laterality,
  LoadMode,
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
  grip_type: null,
  grip_width: null,
  uses_bodyweight: 0,
  load_mode: null,
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

export const GRIP_TYPE_OPTIONS: GripType[] = ["pronated", "supinated", "neutral", "mixed"];

export const GRIP_TYPE_LABELS: Record<GripType, string> = {
  pronated: "Pronada",
  supinated: "Supinada",
  neutral: "Neutra",
  mixed: "Mista",
};

export const GRIP_WIDTH_OPTIONS: GripWidth[] = ["close", "medium", "wide"];

export const GRIP_WIDTH_LABELS: Record<GripWidth, string> = {
  close: "Fechada",
  medium: "Média",
  wide: "Aberta",
};

export const LOAD_MODE_OPTIONS: LoadMode[] = ["total", "added", "assisted"];

export const LOAD_MODE_LABELS: Record<LoadMode, string> = {
  total: "Carga total",
  added: "Peso adicionado",
  assisted: "Assistido",
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
  // Grip width alone ("Aberta") reads as a fragment, so the two grip fields are
  // joined into one part when both are set.
  const grip = [
    config.grip_type && GRIP_TYPE_LABELS[config.grip_type],
    config.grip_width && GRIP_WIDTH_LABELS[config.grip_width].toLowerCase(),
  ].filter(Boolean);
  if (grip.length) parts.push(`Pegada ${grip.join(" ")}`);
  if (config.uses_bodyweight && config.load_mode) parts.push(LOAD_MODE_LABELS[config.load_mode]);
  return parts.join(" · ");
}

/** Enforces the config's cross-field invariants: a dependent field is null
 *  whenever the field that enables it is off. Applied on every write so a
 *  toggle flipped back off can never leave a stale value behind. */
export function normalizeExerciseConfig(config: ExerciseConfig): ExerciseConfig {
  return {
    ...config,
    pulley_type: config.load_type === "pulley" ? config.pulley_type : null,
    bench_angle_degrees: config.uses_bench ? config.bench_angle_degrees : null,
    load_mode: config.uses_bodyweight ? config.load_mode : null,
  };
}
