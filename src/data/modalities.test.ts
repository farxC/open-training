import {
  continuousDurationSec,
  formatClock,
  formatPaceSec,
  modalityConfig,
  modalityLabel,
  parseClock,
} from "./modalities";

describe("parseClock", () => {
  it("parses m:ss into seconds", () => {
    expect(parseClock("4:00")).toBe(240);
    expect(parseClock("5:30")).toBe(330);
    expect(parseClock("0:45")).toBe(45);
  });
  it("parses plain seconds", () => {
    expect(parseClock("90")).toBe(90);
  });
  it("returns null for blank/invalid", () => {
    expect(parseClock("")).toBeNull();
    expect(parseClock("   ")).toBeNull();
    expect(parseClock("abc")).toBeNull();
  });
});

describe("formatClock", () => {
  it("formats seconds as m:ss with zero-padded seconds", () => {
    expect(formatClock(1200)).toBe("20:00");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(5)).toBe("0:05");
  });
  it("allows minutes beyond 60", () => {
    expect(formatClock(3690)).toBe("61:30");
  });
  it("returns empty for null/negative", () => {
    expect(formatClock(null)).toBe("");
    expect(formatClock(-1)).toBe("");
  });
});

describe("formatPaceSec", () => {
  it("appends /km", () => {
    expect(formatPaceSec(240)).toBe("4:00/km");
  });
  it("returns null for missing/zero", () => {
    expect(formatPaceSec(null)).toBeNull();
    expect(formatPaceSec(0)).toBeNull();
  });
});

describe("continuousDurationSec", () => {
  it("multiplies distance by pace", () => {
    expect(continuousDurationSec(5, 240)).toBe(1200); // 5km @ 4:00 -> 20:00
    expect(formatClock(continuousDurationSec(5, 240))).toBe("20:00");
  });
  it("returns null when data missing", () => {
    expect(continuousDurationSec(null, 240)).toBeNull();
    expect(continuousDurationSec(5, null)).toBeNull();
    expect(continuousDurationSec(0, 240)).toBeNull();
  });
});

describe("modality helpers", () => {
  it("returns config and label, falling back safely", () => {
    expect(modalityConfig("corrida").targetKind).toBe("distance");
    expect(modalityConfig("musculacao").targetKind).toBe("strength");
    expect(modalityLabel("corrida")).toBe("Corrida");
  });
});
