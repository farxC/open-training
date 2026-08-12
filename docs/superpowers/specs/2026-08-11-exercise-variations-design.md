# Exercise Variations — Design

## Context

Today the exercise catalog treats close variants of the same movement (e.g.
"Incline Barbell Bench Press", "Decline Barbell Bench Press") as fully
independent rows in `exercises`, with no relationship between them. There is
no way to say "this exercise has variations by grip/angle/equipment" or to
pick a variation while building a routine or recording a live session.

This feature introduces a lightweight parent/variation relationship on top
of the existing exercise model: a variation is a grip/angle/equipment
difference of a parent exercise (e.g. "Supino Reto" → "Supino com
Halteres", "Supino Pegada Fechada"), not an unrelated movement. Each
variation keeps its own independent history, PRs, and analytics — it is not
aggregated into the parent. The user can mark one variation as the default
for its parent, pick a specific variation while building a routine or
recording a session, and correct which variation was actually used after a
session is saved.

Reorganizing existing catalog rows (e.g. the seed data's separate bench
press variants) into parent/variation groups is explicitly out of scope —
this feature only adds the capability going forward.

## Data model

Migration `v18 → v19` in `src/db/schema.ts` / `src/db/migrations.ts`, adding
two columns to `exercises`:

```sql
ALTER TABLE exercises ADD COLUMN parent_exercise_id INTEGER REFERENCES exercises(id);
ALTER TABLE exercises ADD COLUMN is_default_variation INTEGER NOT NULL DEFAULT 0 CHECK (is_default_variation IN (0,1));

CREATE UNIQUE INDEX idx_one_default_variation_per_parent
  ON exercises(parent_exercise_id) WHERE is_default_variation = 1;
```

- `parent_exercise_id IS NULL` → a root exercise (may or may not have
  variations).
- `parent_exercise_id = X` → this row is a variation of exercise `X`.
- Variations cannot themselves have variations (no nesting). This is
  enforced only at the application layer — when creating a variation, the
  parent picker only offers root exercises (`parent_exercise_id IS NULL`).
- The partial unique index guarantees at the DB level that at most one
  variation per parent has `is_default_variation = 1`.
- A variation is an ordinary row in `exercises`: it has its own
  `exercise_config`, `exercise_muscle_groups`, `sets`, history, and PRs.
  Nothing about sets, session recording, or analytics changes — a variation
  is just another `exercise_id`.
- `exercises.name` remains globally UNIQUE, so each variation needs its own
  distinct name.

Following the migration pattern in `src/db/migrations.ts` (see the v17→v18
block): guard with `hasColumn` checks (self-healing, not solely gated on
`schema_version`), run `PRAGMA foreign_key_check(exercises)` after altering,
and bump `user_meta.schema_version` at the end.

## Queries (`src/db/queries.ts`)

- `getExercises(filter?)` — now returns `parent_exercise_id` and
  `is_default_variation` on every `Exercise`. Grouping parents with their
  variations is done by the caller (hook/UI), not inside this query.
- `createVariation(parentExerciseId, { name, equipment, type, muscle_groups?, config? })`
  — like `createExercise`, but sets `parent_exercise_id`. If
  `muscle_groups`/`config` are omitted, clones the parent's current values
  as a starting point. If this is the parent's first variation, it is
  created with `is_default_variation = 1`.
- `setDefaultVariation(exerciseId)` — in a transaction: looks up
  `parent_exercise_id`, clears `is_default_variation` on all siblings, sets
  it on the chosen exercise.
- `getVariations(parentExerciseId)` — lists all variations of a parent
  (used by the management screen and the picker).
- `resolveDefaultExercise(exerciseId)` — if `exerciseId` is a root with
  variations, returns the default variation's id; otherwise returns
  `exerciseId` unchanged. Used when resolving a routine entry into a
  concrete exercise for a new session.
- `swapSessionExerciseVariation(sessionExerciseId, newExerciseId)` — the
  "correct variation after the fact" operation: updates
  `session_exercises.exercise_id`, migrates every `sets` row for that
  session-exercise from the old `exercise_id` to `newExerciseId`, and
  re-snapshots `session_exercise_config`/`session_exercise_muscle_groups`
  from `newExerciseId`'s current defaults (mirrors
  `snapshotSessionExercise`/`resetSessionExerciseConfig`). Validates that
  `newExerciseId` is either the parent or a sibling variation (shares
  `parent_exercise_id`), and that it doesn't collide with the existing
  `UNIQUE(session_id, exercise_id)` constraint on `session_exercises`.

## UI — ExercisePickerModal (grouped, expandable)

- `useExercises()` still returns a flat list; the picker builds the
  parent/variation tree locally by grouping on `parent_exercise_id`.
- A root with no variations behaves exactly as today (a plain row,
  selecting it selects itself).
- A root with variations renders as a group row: shows the root's name plus
  the current default variation as a subtitle, with a chevron to expand.
  Tapping the group row (without expanding) selects the default variation.
  Expanding reveals each variation (plus the root itself) as individually
  selectable rows.
- `selectedIds` keeps storing concrete exercise ids (root or variation) —
  no change to `onConfirm` → `addExercisesToSession` → `addSessionExercise`,
  since a variation is just another `exercise_id`.
- Inline custom-exercise creation in the picker is unchanged and always
  creates a root exercise. Creating a variation is only available from the
  new management screen (below) — not duplicated in the picker.

## New screen — "Gerenciar variações"

- Route: `app/exercises/[id]/variations.tsx`, pushed (plain stack push, like
  `app/routine/[id].tsx`), using the shared `ScreenHeader`.
- Entry point: a new ghost-button "Variações" in the `SectionHeader` on
  `app/exercises/[id].tsx`, shown only when the exercise is a root
  (`parent_exercise_id === null`). If the currently viewed exercise is
  itself a variation, that slot instead shows "Variação de: {parent name}"
  with a link to the parent's detail screen.
- Screen content: list of variations (name + "default" badge on the current
  one); tapping a variation sets it as default (`setDefaultVariation`); a
  "+ Nova variação" button opens a small form (name, equipment, type —
  muscle groups/config are cloned from the parent and then edited normally
  from that variation's own exercise detail screen).

## Routine → session resolution

- When `startResolvedSession` (via `useSessionRecorder`) turns
  `routine_unit_exercises` / `program_entries` into initial
  `session_exercises`, each referenced `exercise_id` is passed through
  `resolveDefaultExercise` first. A routine pointing at "Supino Reto" starts
  the session with its current default variation.

## Swapping variation after a session is saved

- `app/session/[id].tsx` gains an edit mode (toggled the same way
  `ExerciseEditSheet` is opened elsewhere — a pencil affordance). Per
  exercise row, it opens a picker restricted to the parent plus sibling
  variations.
- Choosing a different one calls `swapSessionExerciseVariation`, which
  migrates already-logged sets to the new exercise (so they count toward
  the new exercise/variation's history and PRs, per design) and
  re-synchronizes the session's config/muscle-group snapshot with the new
  exercise's current defaults.
- This edit mode is scoped strictly to the variation swap — it does not
  open up editing/reordering/removing sets or exercises, which stay out of
  scope.

## Out of scope

- Reorganizing existing catalog exercises (seed or custom) into
  parent/variation groups.
- Nested variations (a variation of a variation).
- Aggregating a variation's history back into the parent's stats/charts.
