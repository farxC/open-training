// pt-BR labels for an exercise's identity fields. The seed exercise names are
// English, but every label the UI writes itself is Portuguese — these used to be
// rendered as raw column values ("barbell", "compound") wherever they showed up.

import type { Equipment, ExerciseType } from "@/types";

export const EQUIPMENT_OPTIONS: Equipment[] = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "other",
];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  machine: "Máquina",
  cable: "Cabo",
  bodyweight: "Peso corporal",
  kettlebell: "Kettlebell",
  band: "Elástico",
  other: "Outro",
};

/** MaterialCommunityIcons glyph per equipment — the identity chip's mark. */
export const EQUIPMENT_ICONS: Record<Equipment, string> = {
  barbell: "weight-lifter",
  dumbbell: "dumbbell",
  machine: "cog-outline",
  cable: "arrow-up-down",
  bodyweight: "human-handsup",
  kettlebell: "kettlebell",
  band: "vector-polyline",
  other: "shape-outline",
};

export const TYPE_OPTIONS: ExerciseType[] = ["compound", "isolation"];

export const TYPE_LABELS: Record<ExerciseType, string> = {
  compound: "Composto",
  isolation: "Isolado",
};
