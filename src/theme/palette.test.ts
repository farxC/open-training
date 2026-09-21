import { CLASS_TOKENS, dark, light, overlays } from "./palette";
import type { ColorToken } from "./palette";

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("palette", () => {
  /**
   * The dark-mode work was explicitly scoped to leave the light theme alone.
   * These are the values that shipped in tailwind.config.js before the token
   * layer existed; if one of them moves, that is a light-theme regression and
   * it should be a deliberate, separate change.
   */
  it("keeps the light theme byte-identical to what shipped before dark mode", () => {
    expect(light["surface"]).toBe("#f4f2ee");
    expect(light["surface-card"]).toBe("#ffffff");
    expect(light["surface-elevated"]).toBe("#ebe7df");
    expect(light["surface-border"]).toBe("#ddd8ce");
    expect(light["ink"]).toBe("#26241f");
    expect(light["ink-soft"]).toBe("#5c594f");
    expect(light["ink-mute"]).toBe("#928d80");
    expect(light["ink-faint"]).toBe("#bdb8aa");
    expect(light["brand-100"]).toBe("#e7e4dc");
    expect(light["brand-200"]).toBe("#cfcabf");
    expect(light["brand-300"]).toBe("#a8a293");
    expect(light["brand-400"]).toBe("#6f6b5f");
    expect(light["brand-500"]).toBe("#26241f");
    expect(light["brand-600"]).toBe("#1a1815");
    expect(light["brand-900"]).toBe("#000000");
    expect(light["accent-green"]).toBe("#2f9e6e");
    expect(light["accent-amber"]).toBe("#b9791f");
    expect(light["accent-red"]).toBe("#bf3b30");
  });

  it("defines every token in both schemes", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(Object.keys(overlays.dark).sort()).toEqual(Object.keys(overlays.light).sort());
  });

  /**
   * The Tailwind plugin splits each value into RGB channels with slice(), so
   * shorthand, uppercase or alpha-bearing values would silently produce garbage
   * variables rather than failing.
   */
  it("uses opaque lowercase #rrggbb for every class token", () => {
    for (const token of CLASS_TOKENS) {
      expect(light[token]).toMatch(/^#[0-9a-f]{6}$/);
      expect(dark[token]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps alpha-bearing values out of the class tokens", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const value of Object.values(overlays[scheme])) {
        expect(value).toMatch(/^rgba\(/);
      }
      expect(CLASS_TOKENS).not.toContain("scrim");
    }
  });

  /**
   * The failure this catches is the classic dark-palette mistake: a muted tone
   * that looked fine in a mock and vanishes on a real screen. Cheaper to assert
   * than to spot by eye across 81 files.
   */
  describe("contrast", () => {
    /**
     * Two bars, and the difference is deliberate.
     *
     * The dark values are new, so they are held to AA for body text (4.5:1).
     * Several light values are inherited verbatim from the pre-dark-mode
     * palette, which this change was explicitly scoped not to touch, and two of
     * those pairs land just under: accent-green-ink on -soft is 4.47 and
     * accent-red-ink on -soft is 4.16. They are pinned at the bar they actually
     * meet so a regression still fails, rather than quietly relaxing the bar for
     * dark too. Raising them is a light-theme change and belongs in its own
     * commit, alongside ink-mute (2.96:1) and ink-faint (1.98:1).
     */
    const cases: [ColorToken, ColorToken, number, number][] = [
      // fg, bg, min light, min dark
      ["ink", "surface-card", 4.5, 4.5],
      ["ink", "surface", 4.5, 4.5],
      ["ink-soft", "surface-card", 4.5, 4.5],
      // 10px uppercase labels — AA large-text is the honest bar here.
      ["ink-mute", "surface-card", 3.0, 4.5],
      ["brand-ink", "brand-500", 4.5, 4.5],
      ["accent-green-ink", "accent-green-soft", 4.4, 4.5],
      ["accent-amber-ink", "accent-amber-soft", 4.5, 4.5],
      ["accent-red-ink", "accent-red-soft", 4.1, 4.5],
      ["gold-ink", "gold-soft", 4.5, 4.5],
    ];

    for (const scheme of ["light", "dark"] as const) {
      const palette = scheme === "dark" ? dark : light;
      for (const [fg, bg, minLight, minDark] of cases) {
        const min = scheme === "dark" ? minDark : minLight;
        it(`${scheme}: ${fg} on ${bg} clears ${min}:1`, () => {
          expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min);
        });
      }
    }

    /** A hairline nobody can see is a bug the eye finds late. */
    it("keeps borders visible against their surface in both schemes", () => {
      expect(contrast(light["surface-border"], light["surface-card"])).toBeGreaterThanOrEqual(1.3);
      expect(contrast(dark["surface-border"], dark["surface-card"])).toBeGreaterThanOrEqual(1.3);
    });

    /** Modality dots are 6px — they only read as color, so they need real separation. */
    it("keeps modality dots visible on a card in both schemes", () => {
      const dots = CLASS_TOKENS.filter((t) => t.startsWith("dot-"));
      expect(dots.length).toBe(5);
      for (const dot of dots) {
        expect(contrast(dark[dot], dark["surface-card"])).toBeGreaterThanOrEqual(3);
        expect(contrast(light[dot], light["surface-card"])).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
