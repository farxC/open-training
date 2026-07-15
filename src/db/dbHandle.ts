export type BindParam = string | number | null;

export interface DbHandle {
  execSync(source: string): void;
  runSync(source: string, params: BindParam[]): { lastInsertRowId: number; changes: number };
  getAllSync<T>(source: string, params: BindParam[]): T[];
  getFirstSync<T>(source: string, params: BindParam[]): T | null;
  prepareSync(source: string): {
    executeSync(params: BindParam[]): void;
    finalizeSync(): void;
  };
}
