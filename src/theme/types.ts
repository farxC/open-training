import type { ColorScheme, ThemeColors } from "./palette";

/** What the user picked. `system` follows the OS and is the default. */
export type ThemePreference = ColorScheme | "system";

export interface Theme {
  /** Every color for the active scheme — palette tokens plus the alpha overlays. */
  colors: ThemeColors;
  /** The scheme actually in effect, with `system` already resolved. */
  scheme: ColorScheme;
  /** What the user chose, which may still be `system`. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export type { ColorScheme, ThemeColors };
