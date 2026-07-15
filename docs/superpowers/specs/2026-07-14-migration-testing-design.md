# Migration Testing Harness — Design

**Date:** 2026-07-14
**Status:** Approved (pending spec review)

## Context

open-training's schema evolves frequently (`SCHEMA_VERSION` is already at 11). `runMigrations()` (`src/db/migrations.ts`) mixes two strategies: idempotent `ensureColumn` calls (additive, run every launch) and `if (currentVersion < N)` gated blocks (used so far only for v3/v4, both destructive `DROP TABLE` operations tied to specific version numbers). There is no transaction wrapping the whole migration and no backup step — both were considered and explicitly deferred (see Out of Scope).

The user deploys via a signed APK installed with `adb install -r` (same signing key, same package name), which preserves the app's data directory across updates — so the realistic risk here is not app-level uninstall/reinstall wiping data, it's a future migration (destructive or transformative) shipping with a bug that silently loses or corrupts data already on the device, discovered only after the APK is already installed on the phone.

Today nothing exercises `runMigrations()` in the test suite: `src/db/importExport.test.ts` only tests pure functions (`validateExportPayload`, `planExerciseMerge`, ...), never touching the actual `db` singleton, because `src/db/client.ts` opens `expo-sqlite`'s native binding at module load time — this does not run under Jest.

This design adds a migration-testing harness that runs the real `runMigrations()` against frozen snapshots of past schema states, and gates the Android release build on it passing.

## Decisions (from brainstorming)

1. **Priority:** a test harness that catches destructive migration bugs before they reach the phone — not an automatic pre-migration backup, not transactional migrations. Both are real ideas but out of scope for this design (see Out of Scope).
2. **Where it runs:** a dedicated `test` job in `.github/workflows/android-build.yml`, gating the existing `build` job (`needs: test`). A broken migration test blocks the APK from being built at all.
3. **Test data:** hand-authored, frozen fixture files — one SQL snapshot per schema version worth retaining, not a copy of the user's real production export.
4. **Making migrations testable:** dependency injection. `runMigrations` accepts an optional `DbHandle` parameter (default: the production singleton), so tests can pass an in-memory fake without touching the call site in `app/_layout.tsx`.
5. **Test fixture driver:** `sql.js` (already a project dependency, already powers the real web build in `client.web.ts`) via a new, test-only adapter — not a shared refactor of `client.web.ts`, to avoid touching shipped production code for this.
6. **Fixture retention:** every schema version snapshot, once frozen, is kept and tested forever against the *current* `runMigrations()` — not just the immediately-prior version. This covers a device that skipped several releases before updating.

## Architecture

### `DbHandle` type and dependency injection

A new `src/db/dbHandle.ts` exports a `DbHandle` type describing the sync surface `migrations.ts` actually uses:

```ts
export interface DbHandle {
  execSync(sql: string): void;
  runSync(sql: string, params?: (string | number | null)[]): { lastInsertRowId: number; changes: number };
  getAllSync<T>(sql: string, params?: (string | number | null)[]): T[];
  getFirstSync<T>(sql: string, params?: (string | number | null)[]): T | null;
  prepareSync(sql: string): { executeSync(params: (string | number | null)[]): void; finalizeSync(): void };
}
```

`src/db/migrations.ts` changes shape as follows:

- `runMigrations(dbHandle: DbHandle = db): void` — the exported entry point takes an optional handle, defaulting to the existing production singleton import. `app/_layout.tsx`'s call site (`runMigrations()`) is unchanged.
- `hasColumn(dbHandle, table, column)` and `ensureColumn(dbHandle, table, column, decl)` become parameterized the same way, and every call site inside `runMigrations` passes `dbHandle` through.
- Every other `db.execSync(...)` / `db.runSync(...)` call inside the function body is rewritten to `dbHandle.execSync(...)` / `dbHandle.runSync(...)`.

This is a mechanical, low-risk refactor: production behavior is identical because the default parameter resolves to the same singleton that was previously imported and used directly.

### Test-only sql.js adapter

`src/db/__tests__/testDb.ts` exports:

```ts
export async function createInMemoryDb(): Promise<DbHandle>
```

It initializes `sql.js` (same package `client.web.ts` uses), creates a fresh `new SQL.Database()` with no `localStorage` persistence, and wraps it in an object implementing `DbHandle` — structurally the same shape as `client.web.ts`'s production adapter, but written standalone in the test file rather than extracted into a shared module. Each test gets its own fresh in-memory instance (no cross-test state).

## Fixture Strategy

### Directory layout

```
src/db/__fixtures__/
  v9-snapshot.sql
  v11-snapshot.sql
```

Each file is a **frozen** snapshot: `CREATE TABLE` statements matching that schema version's actual shape (copied from `schema.ts`/`migrations.ts` as they were at that point), plus `INSERT` statements with representative rows:

- 2-3 exercises (at least one custom, one seeded)
- one session with 2-3 sets
- one routine split with a unit and unit-exercises
- one training program with a week and entries
- `user_meta` row setting `schema_version` to that snapshot's version

Snapshot files are never edited after being frozen — they represent a real device's on-disk state at the moment someone stopped updating. New snapshots are added, old ones are never touched.

### Bootstrapping the initial two fixtures

The freeze ritual described below is prospective (triggered by future `SCHEMA_VERSION` bumps), so this design's initial implementation hand-creates two starter fixtures once, to establish the pattern and give the harness real coverage from day one:

- **`v11-snapshot.sql`** — trivial: the *current* `CREATE_TABLES` shape (today's `schema.ts`), populated with representative rows. This is the baseline every future migration gets tested against immediately.
- **`v9-snapshot.sql`** — reconstructed once from git history (`git show <commit-before-v10-migration>:src/db/schema.ts`), the schema version right before the uuid columns/backfill shipped. Chosen deliberately: it exercises a device that skipped two versions, and its upgrade path includes the uuid-backfill logic already in `runMigrations()` — a good early regression target.

No other historical versions are reconstructed retroactively (see Out of Scope). Every fixture after these two comes from the prospective ritual below.

### The freeze ritual (recorded here, executed by hand going forward)

Every time `SCHEMA_VERSION` is bumped and a new migration block is added to `migrations.ts`:

1. Before writing the new migration, copy the *current* `CREATE_TABLES` shape plus a few representative rows into a new `src/db/__fixtures__/v<N>-snapshot.sql`, where `N` is the schema version *before* your change.
2. Write the migration as usual, bump `SCHEMA_VERSION`.
3. Add a per-snapshot case (see below) if the new migration does anything more than an additive `ensureColumn` — i.e. anything destructive or data-transforming deserves an explicit assertion in `migrations.test.ts` about what happens to the frozen rows.

This keeps fixture-authoring cheap (copy-paste + a few inserts) and ties it to the moment the developer already has the old shape fresh in mind.

## `migrations.test.ts`

Located at `src/db/migrations.test.ts`. Two kinds of cases:

**1. Per-snapshot upgrade test**, parameterized over every file in `__fixtures__/`:

```ts
describe.each(SNAPSHOTS)("upgrade from %s", (snapshot) => {
  it("preserves existing data and reaches the current schema version", async () => {
    const dbHandle = await createInMemoryDb();
    dbHandle.execSync(snapshot.sql);
    runMigrations(dbHandle);

    // representative rows from the snapshot still exist with correct values
    // new columns exist with expected defaults
    // user_meta.schema_version === current SCHEMA_VERSION
    // any intentional destructive change (e.g. old v3/v4 DROP TABLE) is asserted
    // explicitly as expected, never just "absence of error"
  });
});
```

**2. Idempotency test**, no fixture needed — builds a populated in-memory DB via the current `CREATE_TABLES`, runs `runMigrations(dbHandle)` twice in a row, and asserts row counts and column values are identical after both runs. This catches a future backfill query written without a `WHERE NOT EXISTS`/`INSERT OR IGNORE` guard before it ships.

## CI Integration

`.github/workflows/android-build.yml` gets a new job:

```yaml
jobs:
  test:
    name: Run test suite
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx jest

  build:
    name: Build signed release APK
    needs: test
    runs-on: ubuntu-latest
    steps:
      # ...unchanged
```

If `npx jest` fails — a migration test included — the `build` job never starts, so no APK is produced or uploaded. `make android-release` (local builds) is not gated automatically; the CI job is the actual backstop before a build reaches the phone.

## Error Handling

No new error-handling paths are introduced. A failing fixture assertion is a normal Jest test failure with the standard diff output (expected row/column values vs. actual). This is sufficient: the goal is to fail loudly in CI before a bad migration reaches a real device, not to recover gracefully at runtime.

## Testing

This design *is* the testing work — no separate test-the-tests layer. Verification on delivery:

- `npx jest src/db/migrations.test.ts` passes locally against the two initial frozen snapshots.
- A deliberately broken migration (e.g. a `DROP TABLE` on a column with existing data, added temporarily) makes the per-snapshot test fail, confirming the harness actually catches the failure mode it's meant to catch. Reverted before merge.
- Confirm `app/_layout.tsx`'s existing `runMigrations()` call site still type-checks and behaves identically (no argument passed, default `db` handle used).

## Out of Scope

- **Automatic backup before migrating.** Considered during brainstorming; not built here. `src/db/importExport.ts` already provides a manual export the user can run before installing a new build. A future design could wire an automatic pre-migration snapshot using that same export format, but it's a separate piece of work.
- **Transactional/atomic migrations.** Wrapping `runMigrations()` in a single transaction (so a mid-migration crash rolls back cleanly) was raised and deferred — today's migrations are additive/idempotent enough that partial-failure risk is low, and this harness's job is to catch bugs *before* they ship, which reduces the need for runtime rollback. Worth revisiting if migrations grow more transformative.
- **Refactoring `client.web.ts`** to share adapter code with the test harness. The test adapter is intentionally standalone to avoid touching shipped production code.
- **Historical reconstruction of every schema version since v1.** Only v9 and v11 are reconstructed as starting fixtures (see Bootstrapping above); versions before the export/import feature (pre-v9) are not retroactively reconstructed.
- **Gating `make android-release` locally.** Only the CI `test` → `build` dependency is in scope.
