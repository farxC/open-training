// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require("sql.js");
import type { Database as SqlJsDatabase } from "sql.js";
import wasmBase64 from "./sql-wasm";

type Param = string | number | null | undefined;

let _db: SqlJsDatabase | null = null;

// Suppresses the per-statement persist() below while a withTransactionSync is in
// flight — calling db.export() mid-transaction ends the transaction out from under
// SQLite (COMMIT/ROLLBACK afterwards fail with "no transaction is active"), so every
// statement issued between BEGIN and COMMIT must defer persisting to the transaction
// wrapper itself, which persists once after COMMIT succeeds.
let inTransaction = false;

const STORAGE_KEY = "open_training_sqlite_v1";

function requireDb(): SqlJsDatabase {
  if (!_db) throw new Error("SQLite not initialized. Call initDatabase() first.");
  return _db;
}

function persist(): void {
  try {
    const data = requireDb().export();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(data)));
  } catch {
    // storage quota exceeded or unavailable — silently skip
  }
}

// Decode the inline base64 WASM so we never need to fetch a separate file.
function decodeWasm(): Uint8Array {
  const binary = atob(wasmBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function initDatabase(): Promise<void> {
  const wasmBinary = decodeWasm();
  const initFn: typeof import("sql.js").default =
    typeof initSqlJs === "function" ? initSqlJs : initSqlJs.default;
  const SQL = await initFn({ wasmBinary: wasmBinary.buffer as ArrayBuffer });

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      _db = new SQL.Database(new Uint8Array(JSON.parse(saved) as number[]));
    } catch {
      _db = new SQL.Database();
    }
  } else {
    _db = new SQL.Database();
  }
}

// Matches the expo-sqlite sync API surface used in queries.ts
export const db = {
  getAllSync<T>(sql: string, params: Param[] = []): T[] {
    const stmt = requireDb().prepare(sql);
    stmt.bind(params as (string | number | null)[]);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  },

  getFirstSync<T>(sql: string, params: Param[] = []): T | null {
    const rows = db.getAllSync<T>(sql, params);
    return rows[0] ?? null;
  },

  runSync(sql: string, params: Param[] = []) {
    const d = requireDb();
    d.run(sql, params as (string | number | null)[]);
    const idResult = d.exec("SELECT last_insert_rowid()");
    const lastInsertRowId = (idResult[0]?.values[0]?.[0] as number) ?? 0;
    if (!inTransaction) persist();
    return { lastInsertRowId, changes: 0 };
  },

  // execSync is used for DDL (CREATE TABLE) and PRAGMAs — no persist needed here,
  // as these statements don't change user data that needs to survive a crash.
  execSync(sql: string) {
    try {
      requireDb().run(sql);
    } catch {
      // Some PRAGMAs (e.g. journal_mode=WAL) are no-ops in sql.js — ignore.
    }
  },

  prepareSync(sql: string) {
    const stmt = requireDb().prepare(sql);
    return {
      executeSync(params: Param[]) {
        stmt.run(params as (string | number | null)[]);
        // Intentionally no persist() here — caller must call finalizeSync() to commit.
      },
      finalizeSync() {
        stmt.free();
        persist(); // One persist for the whole batch.
      },
    };
  },

  // Matches expo-sqlite's SQLiteDatabase.withTransactionSync — BEGIN/COMMIT wrapping a
  // synchronous task, ROLLBACK and rethrow on failure. Needed so import can run as one
  // atomic unit on both the native and web drivers.
  withTransactionSync(task: () => void): void {
    const d = requireDb();
    d.run("BEGIN");
    inTransaction = true;
    try {
      task();
      inTransaction = false;
      d.run("COMMIT");
      persist();
    } catch (err) {
      inTransaction = false;
      d.run("ROLLBACK");
      throw err;
    }
  },
};
