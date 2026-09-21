import type { ThemePreference } from "./types";

/**
 * On web the preference lives in its own localStorage key rather than in
 * `user_meta`, for two reasons:
 *
 * 1. db/client.web.ts serialises the ENTIRE SQLite database to localStorage
 *    after every runSync. Writing a theme toggle through it would rewrite the
 *    whole database to flip one string.
 * 2. The anti-flash script in public/index.html has to read this synchronously
 *    from <head>, long before initSqlJs() has resolved.
 *
 * Keep this key in sync with that script.
 */
export const STORAGE_KEY = "open_training_theme";

function isPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    // Private mode / blocked site data.
    return "system";
  }
}

export function writePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Not fatal: the theme still applies for this session, it just won't survive
    // a reload.
  }
}
