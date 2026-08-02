import { SEED_DISTANCE_EXERCISES } from "./exercises";
import {
  MODALITIES,
  MODALITY_CATEGORIES,
  categoryOf,
  continuousDurationSec,
  formatClock,
  formatDistanceValue,
  formatEffort,
  formatEffortInput,
  formatPaceSec,
  fromDisplayDistance,
  isDistanceModality,
  isStrengthCategory,
  modalitiesOfCategory,
  modalityConfig,
  modalityLabel,
  parseClock,
  parseEffort,
  targetKindOf,
  toDisplayDistance,
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

  it("classifies every registered modality by target kind", () => {
    expect(targetKindOf("musculacao")).toBe("strength");
    expect(isDistanceModality("musculacao")).toBe(false);
    for (const key of ["corrida", "ciclismo", "natacao", "caminhada"] as const) {
      expect(isDistanceModality(key)).toBe(true);
    }
  });

  it("gives every distance modality a display config and a seed exercise", () => {
    for (const m of MODALITIES.filter((x) => x.targetKind === "distance")) {
      expect(m.distance).toBeDefined();
      expect(m.defaultExerciseName).toBeTruthy();
    }
  });
});

// The second axis: what KIND OF TRAINING a modality is, as opposed to how its
// metrics are shaped. The two partition the registry identically today, so the
// point of these is to keep the distinction from silently collapsing.
describe("training category", () => {
  it("classifies every registered modality", () => {
    expect(categoryOf("musculacao")).toBe("strength");
    expect(isStrengthCategory("musculacao")).toBe(true);
    for (const key of ["corrida", "ciclismo", "natacao", "caminhada"] as const) {
      expect(categoryOf(key)).toBe("endurance");
      expect(isStrengthCategory(key)).toBe(false);
    }
  });

  it("declares a category on every entry, and every category has entries", () => {
    for (const m of MODALITIES) {
      expect(MODALITY_CATEGORIES.some((c) => c.key === m.category)).toBe(true);
    }
    for (const c of MODALITY_CATEGORIES) {
      expect(modalitiesOfCategory(c.key).length).toBeGreaterThan(0);
    }
  });

  it("partitions the registry exhaustively and without overlap", () => {
    const grouped = MODALITY_CATEGORIES.flatMap((c) => modalitiesOfCategory(c.key));
    expect(grouped.map((m) => m.key).sort()).toEqual(MODALITIES.map((m) => m.key).sort());
  });

  it("gives endurance seed exercises no muscle groups", () => {
    expect(SEED_DISTANCE_EXERCISES.length).toBeGreaterThan(0);
    for (const { modality, exercise } of SEED_DISTANCE_EXERCISES) {
      expect(isStrengthCategory(modality)).toBe(false);
      expect(exercise.muscle_groups).toEqual([]);
    }
  });
});

// Storage is canonical for every modality — km and seconds-per-km — so these
// conversions are the only place units differ. A sign/scale slip here silently
// corrupts logged data, hence the round-trips.
describe("distance conversion", () => {
  it("keeps km modalities 1:1", () => {
    expect(toDisplayDistance(5.2, "corrida")).toBeCloseTo(5.2);
    expect(fromDisplayDistance(5.2, "ciclismo")).toBeCloseTo(5.2);
  });

  it("shows natação in metres", () => {
    expect(toDisplayDistance(1.5, "natacao")).toBeCloseTo(1500);
    expect(fromDisplayDistance(1500, "natacao")).toBeCloseTo(1.5);
  });

  it("round-trips displayed input back to the same stored km", () => {
    for (const key of ["corrida", "ciclismo", "natacao", "caminhada"] as const) {
      const shown = toDisplayDistance(2.4, key);
      expect(fromDisplayDistance(shown, key)).toBeCloseTo(2.4);
    }
  });

  it("formats with the modality's unit", () => {
    expect(formatDistanceValue(5.2, "corrida")).toBe("5,2 km");
    expect(formatDistanceValue(1.5, "natacao")).toBe("1500 m");
    expect(formatDistanceValue(null, "corrida")).toBeNull();
  });
});

describe("effort conversion", () => {
  it("treats pace per km as-is", () => {
    expect(parseEffort("4:00", "corrida")).toBe(240);
    expect(formatEffort(240, "corrida")).toBe("4:00/km");
  });

  it("scales natação pace to a 100m basis", () => {
    // 2:00 per 100m is 20:00 per km.
    expect(parseEffort("2:00", "natacao")).toBe(1200);
    expect(formatEffort(1200, "natacao")).toBe("2:00/100m");
    expect(formatEffortInput(1200, "natacao")).toBe("2:00");
  });

  it("converts ciclismo speed to and from seconds per km", () => {
    expect(parseEffort("30", "ciclismo")).toBe(120); // 30 km/h -> 2:00/km
    expect(formatEffort(120, "ciclismo")).toBe("30 km/h");
    expect(parseEffort("28,4", "ciclismo")).toBe(Math.round(3600 / 28.4));
  });

  it("round-trips effort input for every distance modality", () => {
    for (const [key, text] of [
      ["corrida", "5:30"],
      ["caminhada", "9:00"],
      ["natacao", "1:45"],
      ["ciclismo", "24,5"],
    ] as const) {
      const stored = parseEffort(text, key);
      expect(stored).not.toBeNull();
      expect(formatEffortInput(stored, key)).toBe(text);
    }
  });

  it("returns null for blank/invalid effort", () => {
    expect(parseEffort("", "corrida")).toBeNull();
    expect(parseEffort("abc", "ciclismo")).toBeNull();
    expect(parseEffort("0", "ciclismo")).toBeNull();
    expect(formatEffort(null, "natacao")).toBeNull();
  });

  it("keeps duration derivable from canonical distance × pace in any modality", () => {
    // 1500m at 2:00/100m = 30:00.
    const km = fromDisplayDistance(1500, "natacao");
    const pace = parseEffort("2:00", "natacao");
    expect(formatClock(continuousDurationSec(km, pace))).toBe("30:00");
  });
});
