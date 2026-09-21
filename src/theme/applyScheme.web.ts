import { colorScheme } from "nativewind";
import type { ColorScheme, ThemePreference } from "./types";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * `system` must be resolved here rather than handed to NativeWind.
 *
 * On web, colorScheme.set() adds the `dark` class to <html> only when the value
 * is exactly "dark", and removes it for everything else — including "system".
 * But colorScheme.get() falls back to the OS observable. So "system" while the
 * OS is dark would leave useTheme() reporting dark (JS colors flip) with no
 * `dark` class on <html> (every Tailwind class stays light). The two halves of
 * the theme would disagree, silently, on web only.
 *
 * Passing an explicit "light" | "dark" keeps the class and the JS in lockstep.
 */
export function applyScheme(preference: ThemePreference): void {
  colorScheme.set(preference === "system" ? systemScheme() : preference);
}

export function systemScheme(): ColorScheme {
  try {
    return window.matchMedia(QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function subscribeToSystemScheme(onChange: (scheme: ColorScheme) => void): () => void {
  try {
    const media = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => onChange(event.matches ? "dark" : "light");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  } catch {
    return () => {};
  }
}
