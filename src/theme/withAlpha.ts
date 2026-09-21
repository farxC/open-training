/**
 * Translucent variant of a theme color.
 *
 * Replaces the hex-suffix trick the codebase used to reach for — e.g.
 * `` `${intensityColor(set)}1a` `` in ExerciseSessionCard — which only works
 * while the value is literally a 6-digit hex string. Theme colors come from
 * palette.js and are hex today, but going through this helper means a call site
 * never depends on that.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Already rgb()/rgba() — restate it with the new alpha rather than nesting.
  const channels = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (channels) {
    const [r, g, b] = channels[1].split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}
