/**
 * Types for palette.js. Kept as a hand-written declaration rather than letting
 * TS infer from the .js so that `ColorToken` is a precise union — module-level
 * maps store token *names* instead of colors (see MEDALS in
 * src/utils/recordsGamification.ts), and a typo there should not compile.
 */

export type ColorToken =
  | "surface"
  | "surface-card"
  | "surface-elevated"
  | "surface-raised"
  | "surface-tint"
  | "surface-border"
  | "surface-border-strong"
  | "ink"
  | "ink-soft"
  | "ink-mute"
  | "ink-faint"
  | "brand-100"
  | "brand-200"
  | "brand-300"
  | "brand-400"
  | "brand-500"
  | "brand-600"
  | "brand-900"
  | "brand-ink"
  | "accent-green"
  | "accent-green-soft"
  | "accent-green-ink"
  | "accent-amber"
  | "accent-amber-soft"
  | "accent-amber-ink"
  | "accent-red"
  | "accent-red-soft"
  | "accent-red-ink"
  | "gold"
  | "gold-soft"
  | "gold-ink"
  | "pewter"
  | "pewter-soft"
  | "pewter-ink"
  | "copper"
  | "copper-soft"
  | "copper-ink"
  | "cold-soft"
  | "cold-ink"
  | "on-media"
  | "dot-musculacao"
  | "dot-corrida"
  | "dot-natacao"
  | "dot-ciclismo"
  | "dot-caminhada"
  | "shadow";

export type OverlayToken = "hairline" | "scrim" | "media-scrim";

export type ColorScheme = "light" | "dark";

export type Palette = Record<ColorToken, string>;
export type Overlays = Record<OverlayToken, string>;

/** Every color the app can draw, for one scheme. */
export type ThemeColors = Palette & Overlays;

export const light: Palette;
export const dark: Palette;
export const overlays: Record<ColorScheme, Overlays>;
export const CLASS_TOKENS: ColorToken[];
