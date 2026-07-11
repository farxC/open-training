# Export / Import (Backup) — Design

**Date:** 2026-07-10
**Status:** Approved (pending spec review)

## Context

open-training is self-hosted and offline-first — there is no server-side copy of a user's data and no network calls to external services. Today there is no way to get data out of the app at all: no export, no backup, no way to move a training history to a new device or protect against data loss (app uninstalled, storage corrupted, device lost).

A survey of the current codebase (see brainstorming session) found this to be the highest-priority gap: the data layer is otherwise mature (versioned schema, self-healing migrations, all queries centralized in `src/db/queries.ts`), but nothing lets a user extract or restore that data.

This design adds a JSON export and a merge-based import, reachable from a new Settings screen.

## Decisions (from brainstorming)

1. **Use case:** serves both device migration and preventive backup with the same mechanism — no separate flows.
2. **Photos are out of scope.** `session_photos.uri` points at a local filesystem path (native) or object URL (web); it is not portable. Exported photo rows omit `uri`; restored sessions simply have no cover photo until the user re-adds one.
3. **Identity strategy:** stable UUIDs on top-level entities (schema v9), not content hashing. Survives edits made after export, and gives the data model a stable identity for any future sync/backup work.
4. **Import behavior: merge, not replace.** Importing into a non-empty device adds what's missing rather than wiping local data.
5. **No preview/confirmation step.** Import applies the merge immediately on file selection; a summary of what changed is shown afterward.
6. **Location:** a new Settings screen (`app/settings.tsx`), reached via a gear icon in the Feed header — not a 5th tab bar entry, since export/import is used rarely.

## Data Model

**Schema v9** adds a `uuid TEXT UNIQUE` column, generated at creation time, to the four top-level entities that participate in merge:

```sql
ALTER TABLE exercises        ADD COLUMN uuid TEXT UNIQUE;
ALTER TABLE sessions         ADD COLUMN uuid TEXT UNIQUE;
ALTER TABLE routine_splits   ADD COLUMN uuid TEXT UNIQUE;
ALTER TABLE training_programs ADD COLUMN uuid TEXT UNIQUE;
```

Existing rows (pre-v9) are backfilled with a generated UUID during migration so every row has one going forward.

Child rows — `sets`, `session_photos`, `routine_units`, `routine_unit_exercises`, `program_weeks`, `program_entries` — do **not** get their own `uuid`. Their identity is implicit: they travel with their parent during merge (parent is new → children inserted; parent already exists locally → the whole subtree is skipped).

## Export Flow

A single **Exportar dados** button in Settings serializes the full dataset to JSON:

```json
{
  "exportFormatVersion": 1,
  "exportedAt": "2026-07-10T14:32:00.000Z",
  "appSchemaVersion": 9,
  "exercises": [...],
  "sessions": [...],
  "routineSplits": [...],
  "trainingPrograms": [...]
}
```

`exportFormatVersion` is versioned independently of `appSchemaVersion` — it describes the shape of the export file itself, so import can reason about compatibility without coupling to the internal SQL schema.

Platform handling follows the existing `PhotoAttachment` / `PhotoAttachment.web.tsx` split pattern:

- **Native:** write the JSON to a temp file via `expo-file-system`, then hand off to `expo-sharing`'s share sheet (Drive, email, AirDrop, etc.).
- **Web:** build a `Blob` and trigger a download via a temporary `<a download>`, filename `open-training-backup-<date>.json`.

No network call in either path.

## Import / Merge Flow

**Importar dados** button in Settings. File selection:

- **Native:** `expo-document-picker`, filtered to `application/json`.
- **Web:** `<input type="file" accept="application/json">`.

On selection, the file is parsed and validated (`exportFormatVersion` must be known; unknown/future versions are rejected with a clear message), then merged inside a **single SQLite transaction**:

1. **Exercises:** match each imported exercise by `uuid` first, then by `name` (covers exercises created before v9 backfill ran, or files from an earlier `exportFormatVersion`). No match → insert as a new custom exercise, carrying over its `uuid`.
2. **Sessions:** match by `uuid`. Already present locally → skip the entire session (this is what makes re-importing the same file a no-op instead of a duplicate). Not present → insert the session, remap each set's `exercise_id` through the exercise map from step 1, insert `sets` and `session_photos` rows (`uri` omitted/null).
3. **Routine splits and training programs:** same match-by-`uuid`-then-skip-or-insert logic, applied to the whole subtree (units → unit exercises; weeks → entries), remapping `exercise_id` as in step 2.

Any failure (malformed JSON, a broken internal reference) rolls back the whole transaction — never a partial import. Errors surface as a simple alert ("Não foi possível importar: arquivo inválido").

After a successful merge, a summary alert reports counts per category (e.g. "12 sessões novas, 3 exercícios novos, 1 rotina nova").

## UI

New route `app/settings.tsx`, pushed from a gear icon in the Feed header (not a tab). Contents (scoped to this design):

- A "Dados" section with **Exportar dados** and **Importar dados** buttons, each with a short description — the import button's description states plainly that data will be merged into what's already on the device.
- A loading state during export (serialization) and import (transaction) — expected to be brief even at thousands of sessions, since it's JSON serialization plus batched inserts.
- Result of import shown via `Alert.alert` (native) / equivalent web dialog.

This screen becomes the home for any future preferences, but only export/import is in scope here.

## Edge Cases

- **Re-importing the same file:** every session/exercise/split/program matches by `uuid` and is skipped — net no-op.
- **Importing on a fresh install (empty DB):** every entity is new; behaves like a full restore.
- **Exercise renamed after export, then re-imported:** matched by `uuid`, so the rename is not overwritten and no duplicate is created (uuid match takes priority over name match).
- **Pre-v9 backup file (no uuids) imported into a v9+ app:** exercises fall back to name matching; sessions/splits/programs have no prior uuid to match against, so they always insert as new (acceptable — no such export files exist yet in practice since v9 ships in the same release as export/import).
- **Unknown `exportFormatVersion`:** import rejected up front, before touching the database.

## Testing

- **Unit tests for the merge logic**, extracted as pure functions in `src/db/importExport.ts` (or similar) operating over an in-memory representation of "local rows" vs. "imported rows":
  - new exercise matched by name (no uuid)
  - existing exercise matched by uuid
  - new session inserted, `exercise_id` remapped correctly
  - duplicate session (same uuid) skipped
  - full routine split / training program subtree insert with remapping
- **Round-trip test:** export a populated test database, import into an empty one, assert equivalence (excluding photo `uri`, expected null).
- **Invalid file test:** malformed JSON and unknown `exportFormatVersion` both reject without mutating the database.

This does not close the project's overall test-coverage gap, but establishes a precedent for testing database logic on a feature that writes directly to the user's data.

## Out of Scope

- Photo/image portability across devices.
- An import preview/confirmation step before applying the merge.
- Automatic/scheduled backups (this is a manual, user-triggered action only).
- Cloud storage integration of any kind (stays consistent with the no-network-calls constraint).
- Two-way sync between devices — this is one-shot export/import, not continuous synchronization.
