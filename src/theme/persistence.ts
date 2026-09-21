import { getMeta, setMeta } from "@/db/queries";
import type { ThemePreference } from "./types";

const KEY = "theme_preference";

function isPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Readable before the first render, which is what keeps native free of a theme
 * flash: src/db/client.ts opens the database with openDatabaseSync at module
 * load, so by the time RootLayout runs there is a real handle — no waiting on
 * initDatabase(), no boot screen in the wrong colors.
 */
export function readPreference(): ThemePreference {
  const stored = getMeta(KEY);
  return isPreference(stored) ? stored : "system";
}

export function writePreference(preference: ThemePreference): void {
  setMeta(KEY, preference);
}
