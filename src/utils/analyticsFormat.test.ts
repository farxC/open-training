import type { Delta } from "@/types";
import { formatCount, formatDeltaText, formatDistance, formatVolume } from "./analyticsFormat";

function d(overrides: Partial<Delta> = {}): Delta {
  return { better: null, pct: null, absChange: null, ...overrides };
}

describe("formatVolume", () => {
  it("formats sub-1000kg as rounded kg", () => {
    expect(formatVolume(842.4)).toBe("842 kg");
  });

  it("formats >=1000kg as tonnes with one decimal", () => {
    expect(formatVolume(1234)).toBe("1.2t");
  });

  it("formats exactly 1000kg as tonnes", () => {
    expect(formatVolume(1000)).toBe("1.0t");
  });
});

describe("formatDistance", () => {
  it("formats km to one decimal", () => {
    expect(formatDistance(12.34)).toBe("12.3 km");
  });

  it("formats zero", () => {
    expect(formatDistance(0)).toBe("0.0 km");
  });
});

describe("formatCount", () => {
  it("stringifies a count", () => {
    expect(formatCount(7)).toBe("7");
  });
});

describe("formatDeltaText", () => {
  describe("no baseline", () => {
    it("returns null for percent when pct is null", () => {
      expect(formatDeltaText(d({ pct: null, absChange: 50 }), "percent")).toBeNull();
    });

    it("returns null for count when pct is null", () => {
      expect(formatDeltaText(d({ pct: null, absChange: 3 }), "count")).toBeNull();
    });

    it("returns null for pace when pct is null", () => {
      expect(formatDeltaText(d({ pct: null, absChange: -12 }), "pace")).toBeNull();
    });
  });

  describe("percent kind", () => {
    it("renders an up arrow for a positive pct", () => {
      expect(formatDeltaText(d({ pct: 11, absChange: 100 }), "percent")).toBe("↑ 11%");
    });

    it("renders a down arrow for a negative pct, using the absolute value", () => {
      expect(formatDeltaText(d({ pct: -8, absChange: -20 }), "percent")).toBe("↓ 8%");
    });

    it("renders an up arrow for a flat (zero) pct", () => {
      expect(formatDeltaText(d({ pct: 0, absChange: 0 }), "percent")).toBe("↑ 0%");
    });
  });

  describe("count kind", () => {
    it("renders a plus-prefixed positive change", () => {
      expect(formatDeltaText(d({ pct: 50, absChange: 1 }), "count")).toBe("+1");
    });

    it("renders a negative change with its native minus sign, no extra prefix", () => {
      expect(formatDeltaText(d({ pct: -33, absChange: -2 }), "count")).toBe("-2");
    });

    it("renders a plus-prefixed zero change", () => {
      expect(formatDeltaText(d({ pct: 0, absChange: 0 }), "count")).toBe("+0");
    });
  });

  describe("pace kind", () => {
    it("renders a down arrow when absChange is negative (faster = improvement)", () => {
      expect(formatDeltaText(d({ pct: -10, absChange: -12 }), "pace")).toBe("↓ 0:12/km");
    });

    it("renders an up arrow when absChange is positive (slower = regression)", () => {
      expect(formatDeltaText(d({ pct: 10, absChange: 75 }), "pace")).toBe("↑ 1:15/km");
    });

    it("renders a down arrow for a flat (zero) absChange", () => {
      expect(formatDeltaText(d({ pct: 0, absChange: 0 }), "pace")).toBe("↓ 0:00/km");
    });
  });
});
