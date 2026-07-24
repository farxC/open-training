import type { ResistanceCurve } from "@/types";

export interface CurvePoint {
  x: number;
  y: number;
}

const STEPS = 10; // 11 points, x = 0, 0.1, 0.2, ... 1.0

/**
 * Schematic 2D resistance-curve presets — x is normalized range-of-motion
 * (0 = start of the movement, 1 = full extension/contraction), y is relative
 * resistance (0..1). These are illustrative shapes, not biomechanically
 * measured data: picking a variant just picks which preset to draw and store.
 */
export function resistanceCurvePoints(variant: ResistanceCurve): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = i / STEPS;
    points.push({ x, y: curveY(variant, x) });
  }
  return points;
}

function curveY(variant: ResistanceCurve, x: number): number {
  switch (variant) {
    case "ascending":
      // Resistance builds through the movement — lowest at the start, highest at the end.
      return 0.2 + 0.7 * x;
    case "descending":
      // Resistance is highest at the start and eases off through the movement.
      return 0.9 - 0.7 * x;
    case "constant":
      // Roughly flat resistance throughout (e.g. a well-cammed machine).
      return 0.65;
    case "bell":
      // Sino / U invertido (∩) — resistance peaks at mid-range, lower at both ends.
      return 0.3 + 0.6 * Math.sin(Math.PI * x);
  }
}
