# Cycle-based Routine on a Calendar — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)

## Context

The routine feature currently models a training split as a **fixed weekly schedule**: `routine_days` is keyed by `day_of_week` (0–6, UNIQUE) and the UI (`app/(tabs)/routine.tsx`) renders a fixed Sunday–Saturday list. This cannot express common splits whose period is not 7 days — e.g. "3 workout days, 1 rest, 2 workout days" (a 6-day cycle).

This change replaces the weekday model with an **arbitrary repeating cycle** displayed on a month **calendar**, where each calendar date shows the split config for that day. This is what the user asked for: arbitrary split config, shown as a calendar.

## Decisions (from brainstorming)

1. **Split model:** a rotating cycle anchored to a date (not weekday-based).
2. **Calendar view:** a month grid; tapping a day opens that day's slot for editing (shared template).
3. **Rest days:** rest is a slot *type* — each slot is either a named workout (with exercises) or a named rest (no exercises).
4. **Anchor:** "today = slot 1." Starting/restarting the cycle sets the anchor to today.
5. **Migration:** replace the weekday model entirely; existing weekday routine data is discarded (early-stage).

## Concept

The routine is an **ordered list of slots** forming a cycle that repeats forever. The cycle is anchored to a date such that the anchor date = slot index 0. Any calendar date maps to a slot by counting whole days from the anchor, modulo the cycle length. Editing a slot edits a shared template — every calendar date that lands on that slot reflects the change.

## Data Model

Replaces `routine_days` and `routine_exercises`.

```sql
CREATE TABLE routine_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL,          -- 0-based order within the cycle
  label TEXT NOT NULL,                -- "Push", "Rest", ...
  is_rest INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE routine_slot_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL REFERENCES routine_slots(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER NOT NULL DEFAULT 8,
  target_weight_kg REAL
);
```

- Cycle length `N` = number of rows in `routine_slots`.
- Anchor stored in `user_meta` under key `routine_cycle_anchor` as `'YYYY-MM-DD'`. Absent ⇒ cycle not started.
- `"order"` is a reserved word — always quoted in DDL and queries.

### Date → slot mapping

Pure, unit-testable util (no DB):

```ts
// src/utils/cycle.ts
export function cycleSlotIndex(anchorISO: string, dateISO: string, cycleLength: number): number {
  if (cycleLength <= 0) return -1;
  const days = daysBetween(anchorISO, dateISO);        // whole days, can be negative
  return ((days % cycleLength) + cycleLength) % cycleLength;
}
```

`daysBetween` parses both as local midnight (`new Date(iso + "T00:00:00")`) and divides the ms delta by 86_400_000, rounded. The double-mod yields a correct 0..N-1 index even for dates before the anchor.

## Migration

- Bump `SCHEMA_VERSION` from 2 to 3.
- Remove `routine_days` and `routine_exercises` from the always-run `CREATE_TABLES`; add `routine_slots` and `routine_slot_exercises`.
- In a `currentVersion < 3` block: `DROP TABLE IF EXISTS routine_exercises;` then `DROP TABLE IF EXISTS routine_days;` (order respects FK). The new tables are created by the `CREATE_TABLES` loop that runs every launch.

## Query / Hook Surface

`src/db/queries.ts` (replaces the routine section):
- `getRoutineSlots(): RoutineSlot[]` — ordered by `position`.
- `createSlot({ label, is_rest, position }): number`
- `updateSlot(id, { label?, is_rest? }): void`
- `deleteSlot(id): void` — deletes the slot (cascades exercises) and repacks remaining `position` values to stay contiguous.
- `moveSlot(id, direction: "up" | "down"): void` — swaps `position` with the adjacent slot.
- `getSlotExercises(slotId): RoutineSlotExercise[]`
- `addSlotExercise(...)`, `removeSlotExercise(id)`
- `getCycleAnchor(): string | null`, `startCycleToday(): void` (writes today's ISO date to `user_meta`; used for both first start and restart).

`src/hooks/useRoutine.ts` (rewrite) exposes: `slots`, `exercisesBySlot`, `anchor`, `cycleLength`, and mutators `addSlot`, `updateSlot`, `removeSlot`, `moveSlot`, `startCycleToday`, `addExercise`, `removeExercise`.

## Types

`src/types/routine.ts` (replace):
```ts
export interface RoutineSlot {
  id: number;
  position: number;
  label: string;
  is_rest: boolean;        // stored as 0/1, surfaced as boolean
}

export interface RoutineSlotExercise {
  id: number;
  slot_id: number;
  exercise_id: number;
  order: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  exercise_name?: string;
  muscle_group?: string;
}
```

## UI

`app/(tabs)/routine.tsx` rewrite + new components, matching the existing light "editorial day mode" theme (ink text scale, `font-display` titles).

- **Header**: "My Routine" + cycle summary — e.g. *"6-day cycle · day 3 today"*. If no slots: empty state with a **Build your split** call to action.
- **`RoutineCalendar`** (new, no new dependencies): a month grid (weeks as rows, 7 columns). Computes first-of-month weekday offset and day count; each cell maps its date via `cycleSlotIndex` and shows the slot's short label. Rest cells muted; today ringed; days outside the current cycle (no anchor) render neutral. Prev/next month navigation via local state. Tapping a date opens that slot's editor.
- **`SlotCard`** (adapted from current `RoutineDayCard`): edit a slot — rename label, toggle workout/rest, add/remove exercises with target sets/reps (reuses `ExercisePickerModal`).
- **`CycleBuilderModal`** (new): the ordered slot list — add slot (name + workout/rest), reorder via up/down, delete, open each slot's exercise editor. Includes **Start / Restart cycle (today = day 1)** showing the current anchor date.

## Edge Cases

- **No cycle started / no slots:** calendar renders neutral (no slot labels); header shows the build/start prompt.
- **Cycle length 1:** every date is the same slot; mapping returns 0.
- **Dates before the anchor:** handled by the double-mod.
- **Deleting a slot:** repack positions so they remain contiguous 0..N-1.
- **Today highlight:** purely a date check, independent of which slot today maps to.

## Testing

- **Unit:** `cycleSlotIndex` — forward wrap-around, exact multiples, dates before the anchor, `N = 1`, `N <= 0` guard. (`npx jest`)
- **Manual (web):** build a 3-on / 1-rest / 2-on cycle (6 slots), start the cycle, verify month-grid labels rotate correctly and that tapping a workout day opens its shared slot editor while a rest day shows as rest. Navigate months to confirm wrap-around.

## Out of Scope

- Converting/preserving existing weekday routine data.
- Per-date overrides (a one-off change to a single calendar date) — slots are always shared templates.
- Reordering exercises within a slot (kept as insertion order, matching current behavior).
- Drag-to-reorder slots (use up/down controls).
