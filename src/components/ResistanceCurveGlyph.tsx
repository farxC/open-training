import { View } from "react-native";
import { resistanceCurvePoints } from "@/data/resistanceCurves";
import type { ResistanceCurve } from "@/types";

/** Sparse enough to read as a shape at 40px wide; more columns just smear. */
const COLUMNS = 7;

interface Props {
  variant: ResistanceCurve;
  width?: number;
  height?: number;
  /** Tone of the columns — dimmed when the spec row it sits in is a default. */
  color?: string;
}

/**
 * The resistance curve as a thumbnail: seven columns sampled along the range of
 * motion, tall where the movement is hard.
 *
 * The full Skia chart says the same thing in 160px of vertical space with two
 * axis labels; inside a spec cell that's a chart pretending to be a value. Plain
 * Views also mean the glyph costs nothing to render and renders identically on
 * web, where Skia needs its WASM to have loaded.
 */
export function ResistanceCurveGlyph({
  variant,
  width = 40,
  height = 15,
  color = "#26241f",
}: Props) {
  const points = resistanceCurvePoints(variant);
  const step = (points.length - 1) / (COLUMNS - 1);
  const samples = Array.from({ length: COLUMNS }, (_, i) => points[Math.round(i * step)].y);

  const gap = 2;
  const barWidth = Math.max((width - gap * (COLUMNS - 1)) / COLUMNS, 1);

  return (
    <View
      className="flex-row items-end"
      style={{ width, height, gap }}
      accessibilityLabel={`Curva de resistência ${variant}`}
    >
      {samples.map((y, index) => (
        <View
          key={index}
          style={{
            width: barWidth,
            height: Math.max(y * height, 2),
            borderRadius: 1,
            backgroundColor: color,
            // The peak of the curve is the point of the glyph, so the columns
            // fade toward the shallow end instead of all reading equally loud.
            opacity: 0.35 + 0.65 * y,
          }}
        />
      ))}
    </View>
  );
}
