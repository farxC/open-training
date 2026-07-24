# Workout history import (WhatsApp log → app backup)

## Goal

Rafael has ~2.3 years of workout logs recorded as WhatsApp messages to himself
(a "chat with myself" used as a general scratchpad — it also contains work
notes, credentials, and personal messages unrelated to training). We want to
turn the workout-shaped messages into `sessions` + `sets` + (new custom)
`exercises` in open-training, without touching the live app or its SQLite
storage directly.

First pass: a 5-month sample (`treinos.txt`, ~611 lines) to validate the
parser and the exercise-alias workflow before running the full 2.3-year log.

## Non-goals

- No in-app UI for this import — it's a one-off personal data migration, run
  from the terminal.
- No attempt to parse or preserve any non-workout content from the chat
  export (work notes, secrets, personal messages). Those messages are
  discarded, not just filtered from the output.
- No fully-automatic exercise-name deduplication. Fuzzy matches are
  *suggested*, never auto-merged, because a wrong auto-merge silently
  corrupts historical data.
- No direct SQLite writes. Everything goes through the app's existing
  backup/import format and its existing merge-by-uuid logic
  (`src/db/importExport.ts`, `src/db/importExportApply.ts`).

## Architecture

A standalone script tree at `scripts/import-history/`, plain Node (no
TypeScript compilation, no new dependencies — this is throwaway tooling, not
app code). Three stages, each a separate script with a file handed off to the
next:

```
treinos.txt
   │  stage 1: parse
   ▼
raw-workouts.json  (parsed sessions/sets, raw exercise name strings)
unparsed-lines.txt (lines the parser couldn't confidently read)
   │  stage 2: aliases (reads src/data/exercises.ts directly, no export needed)
   ▼
exercise-aliases.json  (draft mapping, hand-reviewed/edited by Rafael)
   │  stage 3: build
   ▼
import-payload.json  (ExportPayload-shaped — imported via the app's existing
                       "Import" screen)
```

Each stage is a separate `node` invocation so Rafael can inspect/edit the
intermediate file before the next stage runs. Nothing is auto-chained.

### Stage 1 — Parse

- Split the file into WhatsApp messages using the header pattern
  `[DD/MM/YY, HH:MM:SS] <Sender>: <content>` (tolerating a leading U+200E
  mark before `[`, present on media-line messages). Lines with no header are
  a continuation of the previous message.
- A message is classified as a **workout message** if at least one of its
  lines matches the exercise-line grammar below. Anything else (media
  placeholders, phone numbers, links, unrelated notes, secrets) is dropped —
  not logged, not copied anywhere.
- Within a workout message, each line (or wrapped multi-line line, see
  edge cases) becomes one raw exercise entry:
  `{ date, time, rawName, setGroups: [...] }`.
- Lines inside a workout message that don't match the grammar with enough
  confidence are **not guessed** — they're written to `unparsed-lines.txt`
  with the source line number, for Rafael to fix in the `.txt` or ignore.

**Exercise-line grammar:**

- Name is everything before the first weight token (`\d+([.,]\d+)?\s*kg`),
  trimmed of trailing separators.
- Name→weight and weight→reps separators are interchangeable: `-`, `<-`, `<`.
- Sets are `/`-separated. A weight token before `<-`/`-`/`<` starts a new
  "current weight" that carries forward to subsequent sets until a new
  weight token appears.
- The reps unit word is not spell-checked — any word token following the
  number, other than `kg`/`RiR`/`rir`, counts as the reps unit. This covers
  observed typos (`rsps`, `rpes`, `eeps`, `rpss`, …) without a fixed list.
- Rep ranges `(8-9 reps)` → store the **lower** value as `reps`; the literal
  range text is appended to the set's `notes`.
- Bonus reps `10 + 1 reps` → store **10** as `reps`; the literal text is
  appended to `notes`.
- Modifiers, applied per set:
  - `(falha)` / `(FALHA)` (case-insensitive) → `failure = 1`.
  - `(N RiR)` / `(-N RiR)` / `(- N RiR)` → `rir = N` (literal value, sign
    preserved as written — no reinterpretation).
  - `[BACKOFF]`, `[BACKOFF-SET]`, and any other free text (`otimas`,
    `ajustado`, `com ajuda`, …) → appended to `notes` verbatim.
- **Multi-line wrap:** if a line ends with a dangling separator (e.g. `<-`
  with nothing after it) and the next line has no exercise-name prefix, it's
  a continuation of the same exercise entry (observed once: "Extensora - 60kg
  <-" / "9 reps (falha) / 7 reps (falha) / 7 reps (falha)").

### Stage 2 — Aliases

- Reads `src/data/exercises.ts` directly (`SEED_EXERCISES` +
  `SEED_RUNNING_EXERCISES`) as the source of "exercises that already exist in
  the app" — no export/import round-trip needed, since this repo's seed data
  *is* Rafael's current catalog.
- Collects every unique `rawName` from stage 1, normalizes each (lowercase,
  strip accents/diacritics, strip punctuation, collapse whitespace).
- Groups raw names with an **identical** normalized form automatically (e.g.
  "Rosca Direta" / "Rosca direta" — same letters, differ only in case).
- For normalized forms that are *similar but not identical* (edit-distance /
  token-overlap above a threshold) — e.g. "Rosca direta" vs the typo'd "Rpsca
  direta" — the draft file lists them as a suggested group for Rafael to
  confirm or reject in `suggestedFuzzyMerges`; they start out as separate
  singleton groups and are never merged automatically.
- For each group, suggest a canonical `name`:
  - If a seed exercise's name matches (after the same normalization) →
    suggest that **exact existing name string**, since the app's merge logic
    (`planExerciseMerge`) matches by literal string equality, not
    case/accent-insensitively. Reusing the exact seed string is what avoids
    creating a duplicate.
  - Otherwise → marked `"new": true` with empty `equipment` / `type` /
    `muscle_groups` for Rafael to fill in (values must be one of the
    `Equipment` / `ExerciseType` / `MuscleGroup` unions in
    `src/types/exercise.ts`).
- Output: `exercise-aliases.json`, e.g.:

```json
{
  "groups": [
    {
      "canonicalName": "Hack Squat",
      "matchedSeedExercise": "Hack Squat",
      "rawNames": ["Hack squat", "Hack Squat", "Hack"]
    },
    {
      "canonicalName": null,
      "matchedSeedExercise": null,
      "new": true,
      "equipment": "",
      "type": "",
      "muscle_groups": [],
      "rawNames": ["Pantu joelho flexionado", "Pantu burrinho"]
    }
  ],
  "suggestedFuzzyMerges": [
    { "a": "Sup. Inclinado", "b": "Sup. Inc", "similarity": 0.8 }
  ]
}
```

  Rafael edits this file directly — merging `rawNames` arrays he agrees are
  the same exercise, splitting ones the script wrongly grouped, and filling
  in `equipment`/`type`/`muscle_groups` for every `"new": true` group.

### Stage 3 — Build

- Takes the approved `exercise-aliases.json` + `raw-workouts.json`, resolves
  every raw exercise name to a canonical exercise (existing seed name or new
  custom one, each new one gets a generated uuid), and emits
  `import-payload.json` matching `ExportPayload` from `src/db/importExport.ts`
  exactly (`exportFormatVersion: 3`, `appSchemaVersion` read from the repo's
  current `SCHEMA_VERSION`, `exercises`, `sessions`, empty `routineSplits` and
  `trainingPrograms` arrays).
- Session mapping, one per workout message:
  - `date` = message date, `start_time` = message time, `end_time` = `null`,
    `duration_seconds` = `null` (no data available), `name` = `null`,
    `modality` = `"musculacao"`, no `split_id`/`unit_id`/`program_week_id`.
  - `sets[]` in message order, `set_number` per exercise starting at 1.
  - `exercises[]` (the ordering join) in the order exercises first appear in
    the message.
- New custom exercises get `is_custom: 1`, `modality: "musculacao"`,
  `muscle_groups` from the alias file (`counting_factor` defaults to `1`
  unless the alias file overrides it).
- Every entity gets a freshly generated opaque id string (same shape as
  `generateUuid()` in `src/utils/uuid.ts` — doesn't need to be RFC4122, just
  unique) so re-running stage 3 twice reuses the same uuids and re-importing
  is a no-op (`planSessionMerge` dedupes by uuid).

### Applying the import

Rafael opens the app, uses the existing Import screen
(`src/db/importFile.ts` → `applyImport`), picks `import-payload.json`. The
app's existing merge-by-uuid logic handles insertion; nothing new is needed
on the app side.

## Testing

Stage 1's line/message parsing and stage 2's name-normalization/grouping are
pure functions — straightforward to unit-test with Jest (existing
`jest.config.js`), using representative lines lifted directly from
`treinos.txt` (the ones with weight-carry-forward, rep ranges, bonus reps,
typo'd rep units, multi-line wrap, and the one known-ambiguous line). Written
test-first, following this repo's TDD convention.

## Open risk / judgment calls carried into implementation

- The fuzzy-merge similarity threshold (stage 2) is a tuning knob — start
  conservative (fewer suggested merges, more singleton groups for Rafael to
  merge by hand) since false-positive merges are worse than false negatives
  here.
- `unparsed-lines.txt` and `exercise-aliases.json` may be non-trivial in size
  for 2.3 years of data; the 5-month sample is explicitly the trial run to
  see how much manual review this actually requires before committing to the
  full log.
