import { resistanceCurvePoints } from "./resistanceCurves";

describe("resistanceCurvePoints", () => {
  it("returns 11 points spanning x = 0..1 for every variant", () => {
    for (const variant of ["ascending", "descending", "constant", "bell"] as const) {
      const points = resistanceCurvePoints(variant);
      expect(points).toHaveLength(11);
      expect(points[0].x).toBe(0);
      expect(points[points.length - 1].x).toBe(1);
      for (const p of points) {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("ascending grows monotonically from start to end", () => {
    const points = resistanceCurvePoints("ascending");
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeGreaterThan(points[i - 1].y);
    }
    expect(points[points.length - 1].y).toBeGreaterThan(points[0].y);
  });

  it("descending shrinks monotonically from start to end", () => {
    const points = resistanceCurvePoints("descending");
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeLessThan(points[i - 1].y);
    }
    expect(points[points.length - 1].y).toBeLessThan(points[0].y);
  });

  it("constant stays flat throughout", () => {
    const points = resistanceCurvePoints("constant");
    const first = points[0].y;
    for (const p of points) {
      expect(p.y).toBeCloseTo(first, 10);
    }
  });

  it("bell (U invertido) peaks at mid-range, lower at both ends", () => {
    const points = resistanceCurvePoints("bell");
    const start = points[0].y;
    const end = points[points.length - 1].y;
    const mid = points[Math.floor(points.length / 2)].y;
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeGreaterThan(end);
    // Symmetric around the midpoint.
    expect(points[0].y).toBeCloseTo(points[points.length - 1].y, 10);
  });
});
