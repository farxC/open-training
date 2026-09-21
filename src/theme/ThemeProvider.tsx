import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { applyScheme, subscribeToSystemScheme, systemScheme } from "./applyScheme";
import { dark, light, overlays } from "./palette";
import { readPreference, writePreference } from "./persistence";
import type { ColorScheme, Theme, ThemePreference } from "./types";

const ThemeContext = createContext<Theme | null>(null);

/**
 * Seeded synchronously, on purpose. Both persistence backends read without
 * awaiting anything (SQLite is opened at module load on native; localStorage is
 * sync on web), so the very first render already has the right theme and the
 * boot screens never flash the wrong color.
 */
function initialPreference(): ThemePreference {
  try {
    return readPreference();
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [osScheme, setOsScheme] = useState<ColorScheme>(systemScheme);

  // Push the preference into NativeWind on mount and on every change, so the
  // class-driven colors and the JS-driven ones are always decided by the same
  // value.
  useEffect(() => {
    applyScheme(preference);
  }, [preference]);

  // Only matters while following the OS, but the listener is cheap and keeping
  // it unconditional avoids a resubscribe on every preference change.
  useEffect(() => subscribeToSystemScheme(setOsScheme), []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      writePreference(next);
    } catch {
      // A failed write costs persistence, not the current session.
    }
  }, []);

  const value = useMemo<Theme>(() => {
    const scheme: ColorScheme = preference === "system" ? osScheme : preference;
    return {
      scheme,
      preference,
      setPreference,
      colors: { ...(scheme === "dark" ? dark : light), ...overlays[scheme] },
    };
  }, [preference, osScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Colors for anything a className cannot reach: icon `color` props,
 * ActivityIndicator, Victory's <Line>, shadowColor, and the conditional style
 * objects that have to stay objects (see src/hooks/useInteractionState.ts).
 *
 * Prefer a className where one exists — `bg-surface-card` costs nothing at
 * runtime and re-themes without a re-render.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used inside <ThemeProvider> (mounted in app/_layout.tsx)");
  }
  return theme;
}
