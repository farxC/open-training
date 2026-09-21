import { Appearance } from "react-native";
import { colorScheme } from "nativewind";
import type { ColorScheme, ThemePreference } from "./types";

/**
 * Native can hand `system` straight through: colorScheme.set("system") calls
 * Appearance.setColorScheme(null), which restores OS tracking, and the runtime's
 * cssVariableObservable falls back to the system observable. There is no class
 * to keep in sync, so JS and styles cannot disagree.
 *
 * The web build (applyScheme.web.ts) cannot do this — see the note there.
 */
export function applyScheme(preference: ThemePreference): void {
  colorScheme.set(preference);
}

export function systemScheme(): ColorScheme {
  return Appearance.getColorScheme() ?? "light";
}

/** Fires when the OS theme changes. Only consulted while preference is `system`. */
export function subscribeToSystemScheme(onChange: (scheme: ColorScheme) => void): () => void {
  const subscription = Appearance.addChangeListener(({ colorScheme: next }) => {
    onChange(next ?? "light");
  });
  return () => subscription.remove();
}
