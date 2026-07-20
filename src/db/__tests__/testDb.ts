// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require("sql.js");
import wasmBase64 from "../sql-wasm";
import type { DbHandle, BindParam } from "../dbHandle";

function decodeWasm(): Uint8Array {
  return new Uint8Array(Buffer.from(wasmBase64, "base64"));
}

export async function createInMemoryDb(): Promise<DbHandle> {
  const initFn: typeof import("sql.js").default =
    typeof initSqlJs === "function" ? initSqlJs : initSqlJs.default;
  const SQL = await initFn({ wasmBinary: decodeWasm().buffer as ArrayBuffer });
  const raw = new SQL.Database();

  function getAllSync<T>(sql: string, params: BindParam[]): T[] {
    const stmt = raw.prepare(sql);
    stmt.bind(params as (string | number | null)[]);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  return {
    execSync(sql: string) {
      raw.run(sql);
    },
    runSync(sql: string, params: BindParam[]) {
      raw.run(sql, params as (string | number | null)[]);
      const idResult = raw.exec("SELECT last_insert_rowid()");
      const lastInsertRowId = (idResult[0]?.values[0]?.[0] as number) ?? 0;
      return { lastInsertRowId, changes: 0 };
    },
    getAllSync,
    getFirstSync<T>(sql: string, params: BindParam[]): T | null {
      return getAllSync<T>(sql, params)[0] ?? null;
    },
    prepareSync(sql: string) {
      const stmt = raw.prepare(sql);
      return {
        executeSync(params: BindParam[]) {
          stmt.run(params as (string | number | null)[]);
        },
        finalizeSync() {
          stmt.free();
        },
      };
    },
    withTransactionSync(task: () => void) {
      raw.run("BEGIN");
      try {
        task();
        raw.run("COMMIT");
      } catch (err) {
        raw.run("ROLLBACK");
        throw err;
      }
    },
  };
}
