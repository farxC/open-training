import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("open_training.db");

// No-op on native — expo-sqlite opens synchronously above.
// The web version (client.web.ts) overrides this with async WASM init.
export async function initDatabase(): Promise<void> {}

