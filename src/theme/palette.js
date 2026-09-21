/**
 * The only file in the repo allowed to hold a color literal.
 *
 * Plain CommonJS on purpose: tailwind.config.js is loaded by Tailwind's Node
 * config loader and cannot require() a .ts file. The app imports the same file
 * (expo/tsconfig.base sets allowJs), and palette.d.ts next door supplies the
 * types, so there is exactly one place a color is written down.
 *
 * The light column is byte-identical to the palette that shipped before dark
 * mode existed — see palette.test.ts, which freezes it. Dark is the "Caderno"
 * direction from docs/design/2026-09-21-ui-directions.html: the same warm paper,
 * at night. Not blue-grey.
 */

const light = {
  // ─── Surfaces ───────────────────────────────────────────────────────────────
  surface: "#f4f2ee",
  "surface-card": "#ffffff",
  "surface-elevated": "#ebe7df",
  /** The open/expanded panel inside a card — ExerciseSpecSheet's body,
   *  MuscleExerciseList's expanded rows. Absorbs the #f7f5f1 / #fdfcfa /
   *  #faf9f5 / #fffdf6 drift around the same intent. */
  "surface-raised": "#fbfaf7",
  /** Warm recess a step BELOW the page: the hover fill on a ghost chip.
   *  Absorbs #f0ede6 / #efece5, which were the same color typed twice. */
  "surface-tint": "#f0ede6",
  "surface-border": "#ddd8ce",
  /** The heavier rule used on inputs and pickers. Absorbed the #c9c3b6 /
   *  #c9c4b6 / #c9c3b7 / #c4bfb1 family, which differed by a single digit. */
  "surface-border-strong": "#c9c3b6",

  // ─── Text ───────────────────────────────────────────────────────────────────
  ink: "#26241f",
  "ink-soft": "#5c594f",
  "ink-mute": "#928d80",
  "ink-faint": "#bdb8aa",

  // ─── Brand: the fill scale (buttons, active chips, filled badges) ───────────
  // Shares #26241f with `ink` in light and diverges in dark, which is the whole
  // reason the two names exist. A fill inverts to a light slab; text inverts to
  // a light face. Classifying a call site as one or the other is the judgement
  // call of this migration.
  "brand-100": "#e7e4dc",
  "brand-200": "#cfcabf",
  "brand-300": "#a8a293",
  "brand-400": "#6f6b5f",
  "brand-500": "#26241f",
  "brand-600": "#1a1815",
  "brand-900": "#000000",
  /** Foreground ON a brand fill. Spelled 23× as `text-white` and ~40× as
   *  "#ffffff" today — the half of those #ffffff that are NOT card backgrounds. */
  "brand-ink": "#ffffff",

  // ─── Semantic accents ───────────────────────────────────────────────────────
  // Each is a triple: the saturated color, a tinted background, and a darkened
  // text color legible on that tint.
  "accent-green": "#2f9e6e",
  "accent-green-soft": "#e3efe8",
  "accent-green-ink": "#227a54",
  "accent-amber": "#b9791f",
  "accent-amber-soft": "#faf1de",
  "accent-amber-ink": "#8a5a12",
  /** Destructive. Absorbs the stray #dc2626 (Tailwind red-600) that six files
   *  used instead, and the one-off #d94f4f on the live-session dot. */
  "accent-red": "#bf3b30",
  "accent-red-soft": "#e8c9c5",
  "accent-red-ink": "#a8382d",

  // ─── Podium metals (records / trophy case) ──────────────────────────────────
  // Brass, pewter and copper rather than the saturated primaries a game would
  // use — they have to sit inside the warm paper palette.
  gold: "#d9a441",
  "gold-soft": "#f6e8c8",
  "gold-ink": "#8a5a12",
  pewter: "#b6b1a4",
  "pewter-soft": "#eae8e2",
  "pewter-ink": "#6f6b5f",
  copper: "#c08a5e",
  "copper-soft": "#f3e2d5",
  "copper-ink": "#8a5333",

  // ─── Modality dots ──────────────────────────────────────────────────────────
  // Blue, cyan and tan exist nowhere else in the palette, so they are their own
  // tokens rather than reuses. Musculação deliberately matches the ink/fill
  // color — it is the default modality and reads as "unmarked".
  "dot-musculacao": "#26241f",
  "dot-corrida": "#2f9e6e",
  "dot-ciclismo": "#2b6cb0",
  "dot-natacao": "#0e8ba8",
  "dot-caminhada": "#a1682c",

  /** What a shadow is cast in. Opaque because RN multiplies shadowColor by
   *  shadowOpacity — an rgba here would apply alpha twice. Unlike everything
   *  else in the palette this does not invert: a shadow is still a shadow at
   *  night, just deeper. */
  shadow: "#26241f",
};

const dark = {
  // ─── Surfaces ───────────────────────────────────────────────────────────────
  // Warm near-black, not neutral grey: the paper is the same stock, unlit.
  surface: "#15140f",
  "surface-card": "#1c1b15",
  "surface-elevated": "#1d1c16",
  "surface-raised": "#24231c",
  // Hover has to LIFT off the page here, where in light it sinks into it.
  "surface-tint": "#272620",
  /** Lifted from the mock's #332f26, which scored 1.29:1 against the card —
   *  hairlines were effectively invisible. #3d392d clears 1.5:1. */
  "surface-border": "#3d392d",
  "surface-border-strong": "#4a4537",

  // ─── Text ───────────────────────────────────────────────────────────────────
  ink: "#f0ece1",
  "ink-soft": "#b6b0a1",
  /** Lifted from the mock's #807b6d (4.09:1) to clear WCAG AA on 10px labels. */
  "ink-mute": "#8d8779",
  "ink-faint": "#5a564b",

  // ─── Brand ──────────────────────────────────────────────────────────────────
  // 100-200 are tints that stay recessive, so they go darker. 300-400 are
  // mid-greys used as foregrounds, so they go lighter. 500+ are fills and fully
  // invert.
  "brand-100": "#2b2921",
  "brand-200": "#3a3730",
  "brand-300": "#6d675c",
  "brand-400": "#948d80",
  "brand-500": "#f0ece1",
  "brand-600": "#f7f5ef",
  "brand-900": "#ffffff",
  "brand-ink": "#15140f",

  // ─── Semantic accents ───────────────────────────────────────────────────────
  // Saturated hues lighten; the "-soft" tints become deep washes of the same
  // hue; the "-ink" text colors flip to the light end so they stay legible on
  // those washes.
  "accent-green": "#5bc191",
  "accent-green-soft": "#1b3227",
  "accent-green-ink": "#8fd9b4",
  "accent-amber": "#d9a24a",
  "accent-amber-soft": "#332818",
  "accent-amber-ink": "#e8c184",
  "accent-red": "#e0705f",
  "accent-red-soft": "#331b18",
  "accent-red-ink": "#f0a094",

  // ─── Podium metals ──────────────────────────────────────────────────────────
  gold: "#e0b45f",
  "gold-soft": "#332a18",
  "gold-ink": "#f0d9a0",
  pewter: "#9a958a",
  "pewter-soft": "#26251f",
  "pewter-ink": "#cdc8bb",
  copper: "#cf9a6e",
  "copper-soft": "#2e231b",
  "copper-ink": "#e0ae86",

  // ─── Modality dots ──────────────────────────────────────────────────────────
  // The light values are unusable here: musculação's #26241f scores 1.11:1
  // against the dark card, i.e. invisible.
  "dot-musculacao": "#f0ece1",
  "dot-corrida": "#5bc191",
  "dot-ciclismo": "#6aa6e8",
  "dot-natacao": "#3fc0dd",
  "dot-caminhada": "#d49a5a",

  shadow: "#000000",
};

/**
 * Alpha-bearing values. Deliberately NOT Tailwind tokens: they are consumed as
 * JS values by scrim backgrounds and hairline borders, and the
 * `rgb(var(--x) / <alpha-value>)` plumbing the class tokens use only carries
 * opaque channels.
 */
const overlays = {
  light: {
    /** The near-invisible rule used instead of a full border on nested rows. */
    hairline: "rgba(38, 36, 31, 0.07)",
    scrim: "rgba(38, 36, 31, 0.5)",
  },
  dark: {
    hairline: "rgba(240, 236, 225, 0.06)",
    scrim: "rgba(0, 0, 0, 0.65)",
  },
};

/**
 * The tokens that become CSS custom properties and therefore Tailwind classes.
 * Every entry must be an opaque `#rrggbb` — the var plugin splits it into RGB
 * channels. `overlays` are excluded by construction.
 */
const CLASS_TOKENS = Object.keys(light);

module.exports = { light, dark, overlays, CLASS_TOKENS };
