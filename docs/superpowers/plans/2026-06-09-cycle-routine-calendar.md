# Cycle-based Routine on a Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed weekday routine with an arbitrary repeating cycle of workout/rest slots, displayed on a month calendar where tapping a day edits that day's slot.

**Architecture:** An ordered list of `routine_slots` forms a cycle anchored to a date (today = slot 1) stored in `user_meta`. A pure `cycleSlotIndex(anchor, date, N)` util maps any calendar date to a slot. The routine screen shows a month grid (`RoutineCalendar`); editing happens in a shared `SlotCard` reused by a `CycleBuilderModal` (manage the cycle) and a `SlotEditorModal` (calendar tap).

**Tech Stack:** Expo SQLite (sync API), React Native + Expo Router, NativeWind v4, TypeScript, Jest (jest-expo).

> **NOTE — no git:** This project is not a git repository, so the usual per-task `git commit` is replaced by a **Checkpoint** step running `npx tsc --noEmit` (and `npx jest` where noted). If git is initialized later, commit at each checkpoint.

> **Theme tokens in use** (light "editorial day mode"): primary text `text-ink` (#26241f), secondary `text-ink-soft` (#5c594f), muted `text-ink-mute` (#928d80), faint `text-ink-faint` (#bdb8aa); surfaces `bg-surface`/`bg-surface-card`; dark fills `bg-brand-500` (#26241f) with `text-white`; borders `#ddd8ce`; dashed accents `#c9c3b6`.

---

## File Structure

- **Create** `src/utils/cycle.ts` — pure date→slot math (`daysBetween`, `cycleSlotIndex`).
- **Create** `src/utils/cycle.test.ts` — unit tests for the math.
- **Create** `jest.config.js` — jest-expo preset (none exists yet).
- **Modify** `src/types/routine.ts` — replace `RoutineDay`/`RoutineExercise` with `RoutineSlot`/`RoutineSlotExercise`.
- **Modify** `src/types/index.ts` — update the routine re-export.
- **Modify** `src/db/schema.ts` — bump version to 3; swap routine tables.
- **Modify** `src/db/migrations.ts` — drop old routine tables at v3.
- **Modify** `src/db/queries.ts` — replace the routine query section.
- **Rewrite** `src/hooks/useRoutine.ts` — cycle-based surface.
- **Create** `src/components/SlotCard.tsx` — reusable slot editor body.
- **Create** `src/components/RoutineCalendar.tsx` — month grid.
- **Create** `src/components/CycleBuilderModal.tsx` — manage the cycle.
- **Create** `src/components/SlotEditorModal.tsx` — single-slot editor for calendar taps.
- **Rewrite** `app/(tabs)/routine.tsx` — wire calendar + modals.
- **Delete** `src/components/RoutineDayCard.tsx` — superseded by `SlotCard`.

---

## Task 1: Cycle date math (pure util + tests)

**Files:**
- Create: `src/utils/cycle.ts`
- Create: `src/utils/cycle.test.ts`
- Create: `jest.config.js`

- [ ] **Step 1: Create the jest config**

`jest.config.js`:
```js
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
};
```

- [ ] **Step 2: Write the failing test**

`src/utils/cycle.test.ts`:
```ts
import { cycleSlotIndex, daysBetween } from "./cycle";

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-06-09", "2026-06-12")).toBe(3);
  });
  it("is negative before the anchor", () => {
    expect(daysBetween("2026-06-09", "2026-06-07")).toBe(-2);
  });
  it("is zero for the same day", () => {
    expect(daysBetween("2026-06-09", "2026-06-09")).toBe(0);
  });
});

describe("cycleSlotIndex", () => {
  const anchor = "2026-06-09"; // slot 0

  it("maps the anchor date to slot 0", () => {
    expect(cycleSlotIndex(anchor, "2026-06-09", 6)).toBe(0);
  });
  it("advances one slot per day", () => {
    expect(cycleSlotIndex(anchor, "2026-06-12", 6)).toBe(3);
  });
  it("wraps around after the cycle length", () => {
    expect(cycleSlotIndex(anchor, "2026-06-15", 6)).toBe(0); // 6 days later
    expect(cycleSlotIndex(anchor, "2026-06-16", 6)).toBe(1);
  });
  it("handles dates before the anchor", () => {
    expect(cycleSlotIndex(anchor, "2026-06-08", 6)).toBe(5); // -1 mod 6
    expect(cycleSlotIndex(anchor, "2026-06-03", 6)).toBe(0); // -6 mod 6
  });
  it("returns 0 for a single-slot cycle", () => {
    expect(cycleSlotIndex(anchor, "2026-07-01", 1)).toBe(0);
  });
  it("returns -1 for a non-positive cycle length", () => {
    expect(cycleSlotIndex(anchor, "2026-06-10", 0)).toBe(-1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/utils/cycle.test.ts`
Expected: FAIL — `Cannot find module './cycle'`.

- [ ] **Step 4: Implement the util**

`src/utils/cycle.ts`:
```ts
/** Whole days from `fromISO` to `toISO` (both 'YYYY-MM-DD'); negative if `to` is earlier. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00").getTime();
  const to = new Date(toISO + "T00:00:00").getTime();
  return Math.round((to - from) / 86_400_000);
}

/** 0-based slot index for `dateISO` in a cycle of `cycleLength` slots anchored at `anchorISO`. */
export function cycleSlotIndex(anchorISO: string, dateISO: string, cycleLength: number): number {
  if (cycleLength <= 0) return -1;
  const days = daysBetween(anchorISO, dateISO);
  return ((days % cycleLength) + cycleLength) % cycleLength;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/utils/cycle.test.ts`
Expected: PASS (all 9 assertions).

- [ ] **Step 6: Checkpoint**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

---

## Task 2: Types

**Files:**
- Modify: `src/types/routine.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Replace the routine types**

`src/types/routine.ts` (full file):
```ts
export interface RoutineSlot {
  id: number;
  position: number; // 0-based order within the cycle
  label: string;
  is_rest: boolean; // stored 0/1 in SQLite, surfaced as boolean
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

- [ ] **Step 2: Update the re-export**

In `src/types/index.ts`, replace the routine line:
```ts
export type { RoutineSlot, RoutineSlotExercise } from "./routine";
```

- [ ] **Step 3: Checkpoint**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `queries.ts`, `useRoutine.ts`, `routine.tsx`, `RoutineDayCard.tsx` (they still import the old names). These are fixed in later tasks.

---

## Task 3: Schema + migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations.ts`

- [ ] **Step 1: Bump version and swap the routine tables**

In `src/db/schema.ts`: change `export const SCHEMA_VERSION = 2;` to `= 3;`. Then **remove** the `routine_days` and `routine_exercises` entries from `CREATE_TABLES` and **add** these two in their place:
```ts
  `CREATE TABLE IF NOT EXISTS routine_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    is_rest INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS routine_slot_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES routine_slots(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    "order" INTEGER NOT NULL DEFAULT 0,
    target_sets INTEGER NOT NULL DEFAULT 3,
    target_reps INTEGER NOT NULL DEFAULT 8,
    target_weight_kg REAL
  )`,
```

- [ ] **Step 2: Drop old tables at v3**

In `src/db/migrations.ts`, add this block AFTER the existing `if (currentVersion < 2)` block and BEFORE the final `if (currentVersion < SCHEMA_VERSION)` block:
```ts
  if (currentVersion < 3) {
    // Replace the weekday routine model with the cycle model. Old data is discarded.
    db.execSync("DROP TABLE IF EXISTS routine_exercises;");
    db.execSync("DROP TABLE IF EXISTS routine_days;");
  }
```

- [ ] **Step 3: Checkpoint**

Run: `npx tsc --noEmit`
Expected: same routine-related errors as Task 2 (schema/migrations themselves compile).

---

## Task 4: Queries

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Update the type imports**

At the top of `src/db/queries.ts`, in the `@/types` import, remove `RoutineDay` and `RoutineExercise` and add `RoutineSlot` and `RoutineSlotExercise`.

- [ ] **Step 2: Replace the entire routine section**

Delete everything from the `// ─── Routine ───` comment through `removeRoutineExercise` (the 6 old functions) and replace with:
```ts
// ─── Routine (cycle model) ──────────────────────────────────────────────────

interface SlotRow {
  id: number;
  position: number;
  label: string;
  is_rest: number;
}

export function getRoutineSlots(): RoutineSlot[] {
  const rows = db.getAllSync<SlotRow>(
    "SELECT * FROM routine_slots ORDER BY position"
  );
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    label: r.label,
    is_rest: !!r.is_rest,
  }));
}

export function createSlot(slot: { label: string; is_rest: boolean; position: number }): number {
  const result = db.runSync(
    "INSERT INTO routine_slots (position, label, is_rest) VALUES (?, ?, ?)",
    [slot.position, slot.label, slot.is_rest ? 1 : 0]
  );
  return result.lastInsertRowId;
}

export function updateSlot(id: number, patch: { label?: string; is_rest?: boolean }): void {
  if (patch.label !== undefined) {
    db.runSync("UPDATE routine_slots SET label = ? WHERE id = ?", [patch.label, id]);
  }
  if (patch.is_rest !== undefined) {
    db.runSync("UPDATE routine_slots SET is_rest = ? WHERE id = ?", [patch.is_rest ? 1 : 0, id]);
  }
}

export function deleteSlot(id: number): void {
  db.runSync("DELETE FROM routine_slots WHERE id = ?", [id]);
  // Repack positions so they stay contiguous 0..N-1.
  const rows = db.getAllSync<{ id: number }>(
    "SELECT id FROM routine_slots ORDER BY position"
  );
  rows.forEach((row, i) =>
    db.runSync("UPDATE routine_slots SET position = ? WHERE id = ?", [i, row.id])
  );
}

export function moveSlot(id: number, direction: "up" | "down"): void {
  const rows = db.getAllSync<{ id: number; position: number }>(
    "SELECT id, position FROM routine_slots ORDER BY position"
  );
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rows.length) return;
  const a = rows[idx];
  const b = rows[swapIdx];
  db.runSync("UPDATE routine_slots SET position = ? WHERE id = ?", [b.position, a.id]);
  db.runSync("UPDATE routine_slots SET position = ? WHERE id = ?", [a.position, b.id]);
}

export function getSlotExercises(slotId: number): RoutineSlotExercise[] {
  return db.getAllSync<RoutineSlotExercise>(
    `SELECT re.*, e.name AS exercise_name, e.muscle_group
     FROM routine_slot_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     WHERE re.slot_id = ?
     ORDER BY re."order"`,
    [slotId]
  );
}

export function addSlotExercise(
  re: Omit<RoutineSlotExercise, "id" | "exercise_name" | "muscle_group">
): number {
  const result = db.runSync(
    `INSERT INTO routine_slot_exercises
       (slot_id, exercise_id, "order", target_sets, target_reps, target_weight_kg)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [re.slot_id, re.exercise_id, re.order, re.target_sets, re.target_reps, re.target_weight_kg ?? null]
  );
  return result.lastInsertRowId;
}

export function removeSlotExercise(id: number): void {
  db.runSync("DELETE FROM routine_slot_exercises WHERE id = ?", [id]);
}

export function getCycleAnchor(): string | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM user_meta WHERE key = 'routine_cycle_anchor'"
  );
  return row ? row.value : null;
}

export function startCycleToday(): void {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  db.runSync(
    "INSERT OR REPLACE INTO user_meta (key, value) VALUES ('routine_cycle_anchor', ?)",
    [iso]
  );
}
```

- [ ] **Step 3: Checkpoint**

Run: `npx tsc --noEmit`
Expected: errors now ONLY in `useRoutine.ts`, `routine.tsx`, `RoutineDayCard.tsx`.

---

## Task 5: useRoutine hook

**Files:**
- Rewrite: `src/hooks/useRoutine.ts`

- [ ] **Step 1: Replace the hook**

`src/hooks/useRoutine.ts` (full file):
```ts
import { useCallback, useState } from "react";
import {
  getRoutineSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  moveSlot as moveSlotQuery,
  getSlotExercises,
  addSlotExercise,
  removeSlotExercise,
  getCycleAnchor,
  startCycleToday as startCycleTodayQuery,
} from "@/db/queries";
import type { Exercise, RoutineSlot, RoutineSlotExercise } from "@/types";

function buildMap(): Record<number, RoutineSlotExercise[]> {
  const map: Record<number, RoutineSlotExercise[]> = {};
  for (const s of getRoutineSlots()) map[s.id] = getSlotExercises(s.id);
  return map;
}

export function useRoutine() {
  const [slots, setSlots] = useState<RoutineSlot[]>(() => getRoutineSlots());
  const [exercisesBySlot, setExercisesBySlot] = useState<Record<number, RoutineSlotExercise[]>>(
    () => buildMap()
  );
  const [anchor, setAnchor] = useState<string | null>(() => getCycleAnchor());

  const refreshAll = useCallback(() => {
    setSlots(getRoutineSlots());
    setExercisesBySlot(buildMap());
    setAnchor(getCycleAnchor());
  }, []);

  const addSlot = useCallback(() => {
    const count = getRoutineSlots().length;
    createSlot({ label: `Day ${count + 1}`, is_rest: false, position: count });
    refreshAll();
  }, [refreshAll]);

  // Optimistic: avoid re-reading the DB on every keystroke (mirrors SetLogger).
  const updateSlotLabel = useCallback((id: number, label: string) => {
    updateSlot(id, { label });
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }, []);

  const toggleSlotRest = useCallback(
    (id: number) => {
      const slot = getRoutineSlots().find((s) => s.id === id);
      if (!slot) return;
      updateSlot(id, { is_rest: !slot.is_rest });
      refreshAll();
    },
    [refreshAll]
  );

  const moveSlot = useCallback(
    (id: number, dir: "up" | "down") => {
      moveSlotQuery(id, dir);
      refreshAll();
    },
    [refreshAll]
  );

  const removeSlot = useCallback(
    (id: number) => {
      deleteSlot(id);
      refreshAll();
    },
    [refreshAll]
  );

  const addExercise = useCallback(
    (slotId: number, exercise: Exercise) => {
      const existing = getSlotExercises(slotId);
      addSlotExercise({
        slot_id: slotId,
        exercise_id: exercise.id,
        order: existing.length,
        target_sets: 3,
        target_reps: 8,
        target_weight_kg: null,
      });
      refreshAll();
    },
    [refreshAll]
  );

  const removeExercise = useCallback(
    (id: number) => {
      removeSlotExercise(id);
      refreshAll();
    },
    [refreshAll]
  );

  const startCycleToday = useCallback(() => {
    startCycleTodayQuery();
    setAnchor(getCycleAnchor());
  }, []);

  return {
    slots,
    exercisesBySlot,
    anchor,
    cycleLength: slots.length,
    refreshAll,
    addSlot,
    updateSlotLabel,
    toggleSlotRest,
    moveSlot,
    removeSlot,
    addExercise,
    removeExercise,
    startCycleToday,
  };
}
```

- [ ] **Step 2: Checkpoint**

Run: `npx tsc --noEmit`
Expected: errors now ONLY in `routine.tsx` and `RoutineDayCard.tsx`.

---

## Task 6: SlotCard component

**Files:**
- Create: `src/components/SlotCard.tsx`

- [ ] **Step 1: Create the component**

`src/components/SlotCard.tsx`:
```tsx
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import type { RoutineSlot, RoutineSlotExercise } from "@/types";

interface Props {
  slot: RoutineSlot;
  exercises: RoutineSlotExercise[];
  expanded: boolean;
  onToggleExpand: () => void;
  onRename: (label: string) => void;
  onToggleRest: () => void;
  onAddExercise: () => void;
  onRemoveExercise: (id: number) => void;
  // Builder-only controls. Omit to hide the reorder/delete cluster.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
}

export function SlotCard({
  slot,
  exercises,
  expanded,
  onToggleExpand,
  onRename,
  onToggleRest,
  onAddExercise,
  onRemoveExercise,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const [label, setLabel] = useState(slot.label);

  return (
    <View
      className="bg-surface-card rounded-2xl mb-3 overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      <View className="flex-row items-center p-4">
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: slot.is_rest ? "#ebe7df" : "#26241f",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ color: slot.is_rest ? "#928d80" : "#ffffff", fontSize: 12, fontWeight: "700" }}>
            {slot.position + 1}
          </Text>
        </View>

        <TextInput
          value={label}
          onChangeText={(v) => {
            setLabel(v);
            onRename(v);
          }}
          placeholder="Slot name"
          placeholderTextColor="#bdb8aa"
          className="flex-1 text-ink font-semibold text-base"
        />

        {onDelete && (
          <View className="flex-row items-center" style={{ gap: 10 }}>
            {onMoveUp && (
              <TouchableOpacity onPress={onMoveUp} className="px-1">
                <Text className="text-ink-mute text-base">↑</Text>
              </TouchableOpacity>
            )}
            {onMoveDown && (
              <TouchableOpacity onPress={onMoveDown} className="px-1">
                <Text className="text-ink-mute text-base">↓</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onDelete} className="px-1">
              <Text className="text-red-600 text-base">✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between px-4 pb-3">
        <TouchableOpacity
          onPress={onToggleRest}
          className="flex-row rounded-lg overflow-hidden"
          style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
        >
          <View className="px-3 py-1" style={{ backgroundColor: slot.is_rest ? "transparent" : "#26241f" }}>
            <Text style={{ color: slot.is_rest ? "#928d80" : "#ffffff", fontSize: 12, fontWeight: "600" }}>
              Workout
            </Text>
          </View>
          <View className="px-3 py-1" style={{ backgroundColor: slot.is_rest ? "#26241f" : "transparent" }}>
            <Text style={{ color: slot.is_rest ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
              Rest
            </Text>
          </View>
        </TouchableOpacity>

        {!slot.is_rest && (
          <TouchableOpacity onPress={onToggleExpand}>
            <Text className="text-ink-mute text-sm">
              {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"} {expanded ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!slot.is_rest && expanded && (
        <View className="px-4 pb-4">
          {exercises.map((re) => (
            <View
              key={re.id}
              className="flex-row items-center py-3"
              style={{ borderTopWidth: 1, borderTopColor: "#ddd8ce" }}
            >
              <View className="flex-1">
                <Text className="text-ink text-sm">{re.exercise_name}</Text>
                <Text className="text-ink-mute text-xs mt-0.5">
                  {re.target_sets} × {re.target_reps} reps
                  {re.target_weight_kg ? ` · ${re.target_weight_kg} kg` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onRemoveExercise(re.id)} className="px-2 py-1">
                <Text className="text-ink-mute text-xl">×</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            className="mt-3 py-2.5 rounded-xl items-center"
            style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
            onPress={onAddExercise}
          >
            <Text className="text-ink text-sm font-medium">+ Add Exercise</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Checkpoint**

Run: `npx tsc --noEmit`
Expected: unchanged (errors still only in `routine.tsx`, `RoutineDayCard.tsx`). `SlotCard` itself compiles.

---

## Task 7: RoutineCalendar component

**Files:**
- Create: `src/components/RoutineCalendar.tsx`

- [ ] **Step 1: Create the component**

`src/components/RoutineCalendar.tsx`:
```tsx
import { Text, TouchableOpacity, View } from "react-native";
import type { RoutineSlot } from "@/types";
import { cycleSlotIndex } from "@/utils/cycle";

interface Props {
  slots: RoutineSlot[];
  anchor: string | null;
  monthDate: Date; // any date within the displayed month
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectSlot: (slotId: number) => void;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RoutineCalendar({
  slots,
  anchor,
  monthDate,
  onPrevMonth,
  onNextMonth,
  onSelectSlot,
}: Props) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay(): 0=Sun..6=Sat. Convert to Monday-based leading offset.
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = iso(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View className="mx-4">
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onPrevMonth} className="px-2 py-1">
          <Text className="text-ink-mute text-lg">‹</Text>
        </TouchableOpacity>
        <Text className="text-ink font-display font-semibold text-lg">
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={onNextMonth} className="px-2 py-1">
          <Text className="text-ink-mute text-lg">›</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-1">
        {WEEKDAYS.map((w) => (
          <View key={w} className="flex-1 items-center">
            <Text className="text-ink-faint text-xs">{w}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day == null) {
            return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          }
          const cellISO = iso(new Date(year, month, day));
          const idx =
            anchor && slots.length > 0 ? cycleSlotIndex(anchor, cellISO, slots.length) : -1;
          const slot = idx >= 0 ? slots.find((s) => s.position === idx) ?? null : null;
          const isToday = cellISO === todayISO;
          const isRest = slot?.is_rest ?? false;
          return (
            <TouchableOpacity
              key={i}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
              disabled={!slot}
              onPress={() => slot && onSelectSlot(slot.id)}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: slot && !isRest ? "#ffffff" : "transparent",
                  borderWidth: isToday ? 1.5 : slot && !isRest ? 1 : 0,
                  borderColor: isToday ? "#26241f" : "#ddd8ce",
                }}
              >
                <Text
                  style={{ color: "#26241f", fontSize: 12, fontWeight: isToday ? "700" : "500" }}
                >
                  {day}
                </Text>
                {slot && (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: isRest ? "#bdb8aa" : "#928d80",
                      fontSize: 8,
                      fontWeight: "600",
                      marginTop: 1,
                    }}
                  >
                    {slot.label}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Checkpoint**

Run: `npx tsc --noEmit`
Expected: unchanged (errors still only in `routine.tsx`, `RoutineDayCard.tsx`).

---

## Task 8: CycleBuilderModal + SlotEditorModal

**Files:**
- Create: `src/components/CycleBuilderModal.tsx`
- Create: `src/components/SlotEditorModal.tsx`

- [ ] **Step 1: Create CycleBuilderModal**

`src/components/CycleBuilderModal.tsx`:
```tsx
import { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SlotCard } from "./SlotCard";
import { ExercisePickerModal } from "./ExercisePickerModal";
import type { Exercise, RoutineSlot, RoutineSlotExercise } from "@/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  slots: RoutineSlot[];
  exercisesBySlot: Record<number, RoutineSlotExercise[]>;
  anchor: string | null;
  onAddSlot: () => void;
  onRename: (slotId: number, label: string) => void;
  onToggleRest: (slotId: number) => void;
  onMoveSlot: (slotId: number, dir: "up" | "down") => void;
  onDeleteSlot: (slotId: number) => void;
  onAddExercise: (slotId: number, exercise: Exercise) => void;
  onRemoveExercise: (id: number) => void;
  onStartCycle: () => void;
}

export function CycleBuilderModal(props: Props) {
  const { visible, onClose, slots, exercisesBySlot, anchor } = props;
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pickerSlotId, setPickerSlotId] = useState<number | null>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            Edit Split
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-ink-soft text-base">Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View className="bg-surface-card rounded-2xl p-4 mb-4" style={{ borderWidth: 1, borderColor: "#ddd8ce" }}>
            <Text className="text-ink-mute text-xs" style={{ letterSpacing: 1, fontWeight: "700" }}>
              CYCLE
            </Text>
            <Text className="text-ink text-sm mt-1">
              {slots.length > 0 ? `${slots.length}-day cycle` : "No slots yet"}
              {anchor ? ` · started ${anchor}` : " · not started"}
            </Text>
            <TouchableOpacity
              className="mt-3 py-2.5 rounded-xl items-center bg-brand-500"
              onPress={props.onStartCycle}
            >
              <Text className="text-white font-semibold text-sm">
                {anchor ? "Restart cycle (today = day 1)" : "Start cycle (today = day 1)"}
              </Text>
            </TouchableOpacity>
          </View>

          {slots.map((slot, i) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              exercises={exercisesBySlot[slot.id] ?? []}
              expanded={expandedId === slot.id}
              onToggleExpand={() => setExpandedId(expandedId === slot.id ? null : slot.id)}
              onRename={(label) => props.onRename(slot.id, label)}
              onToggleRest={() => props.onToggleRest(slot.id)}
              onAddExercise={() => setPickerSlotId(slot.id)}
              onRemoveExercise={props.onRemoveExercise}
              onMoveUp={i > 0 ? () => props.onMoveSlot(slot.id, "up") : undefined}
              onMoveDown={i < slots.length - 1 ? () => props.onMoveSlot(slot.id, "down") : undefined}
              onDelete={() => props.onDeleteSlot(slot.id)}
            />
          ))}

          <TouchableOpacity
            className="py-3 rounded-xl items-center"
            style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
            onPress={props.onAddSlot}
          >
            <Text className="text-ink text-sm font-medium">+ Add Slot</Text>
          </TouchableOpacity>
        </ScrollView>

        <ExercisePickerModal
          visible={pickerSlotId != null}
          onSelect={(ex) => {
            if (pickerSlotId != null) props.onAddExercise(pickerSlotId, ex);
          }}
          onClose={() => setPickerSlotId(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}
```

- [ ] **Step 2: Create SlotEditorModal**

`src/components/SlotEditorModal.tsx`:
```tsx
import { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SlotCard } from "./SlotCard";
import { ExercisePickerModal } from "./ExercisePickerModal";
import type { Exercise, RoutineSlot, RoutineSlotExercise } from "@/types";

interface Props {
  slot: RoutineSlot | null;
  exercises: RoutineSlotExercise[];
  onClose: () => void;
  onRename: (slotId: number, label: string) => void;
  onToggleRest: (slotId: number) => void;
  onAddExercise: (slotId: number, exercise: Exercise) => void;
  onRemoveExercise: (id: number) => void;
}

export function SlotEditorModal({
  slot,
  exercises,
  onClose,
  onRename,
  onToggleRest,
  onAddExercise,
  onRemoveExercise,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Modal visible={slot != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            Edit Day
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-ink-soft text-base">Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {slot && (
            <SlotCard
              slot={slot}
              exercises={exercises}
              expanded={true}
              onToggleExpand={() => {}}
              onRename={(label) => onRename(slot.id, label)}
              onToggleRest={() => onToggleRest(slot.id)}
              onAddExercise={() => setPickerOpen(true)}
              onRemoveExercise={onRemoveExercise}
            />
          )}
        </ScrollView>
        <ExercisePickerModal
          visible={pickerOpen}
          onSelect={(ex) => {
            if (slot) onAddExercise(slot.id, ex);
          }}
          onClose={() => setPickerOpen(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}
```

- [ ] **Step 3: Checkpoint**

Run: `npx tsc --noEmit`
Expected: unchanged (errors still only in `routine.tsx`, `RoutineDayCard.tsx`). Both modals compile.

---

## Task 9: Rewrite the routine screen + delete RoutineDayCard

**Files:**
- Rewrite: `app/(tabs)/routine.tsx`
- Delete: `src/components/RoutineDayCard.tsx`

- [ ] **Step 1: Rewrite the screen**

`app/(tabs)/routine.tsx` (full file):
```tsx
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoutineCalendar } from "@/components/RoutineCalendar";
import { CycleBuilderModal } from "@/components/CycleBuilderModal";
import { SlotEditorModal } from "@/components/SlotEditorModal";
import { useRoutine } from "@/hooks/useRoutine";
import { cycleSlotIndex } from "@/utils/cycle";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RoutineScreen() {
  const r = useRoutine();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      r.refreshAll();
    }, [r.refreshAll])
  );

  const todayIdx =
    r.anchor && r.cycleLength > 0 ? cycleSlotIndex(r.anchor, todayISO(), r.cycleLength) : -1;
  const editingSlot = r.slots.find((s) => s.id === editingSlotId) ?? null;

  const summary =
    r.cycleLength === 0
      ? "No cycle yet"
      : r.anchor
        ? `${r.cycleLength}-day cycle · day ${todayIdx + 1} today`
        : `${r.cycleLength}-day cycle · not started`;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-3 pb-4 flex-row items-start">
          <View className="flex-1">
            <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 2 }}>
              TRAINING SPLIT
            </Text>
            <Text className="text-ink font-display font-semibold text-3xl" style={{ letterSpacing: -0.6 }}>
              My Routine
            </Text>
            <Text className="text-ink-mute text-xs mt-0.5">{summary}</Text>
          </View>
          <TouchableOpacity className="px-3 py-2 rounded-xl bg-brand-500" onPress={() => setBuilderOpen(true)}>
            <Text className="text-white text-sm font-medium">Edit split</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 1, backgroundColor: "#ddd8ce", marginHorizontal: 16, marginBottom: 16 }} />

        {r.cycleLength === 0 ? (
          <View className="items-center justify-center px-8" style={{ paddingTop: 60 }}>
            <Text className="text-ink-soft text-base font-medium text-center">Build your split</Text>
            <Text className="text-ink-mute text-sm mt-1 text-center">
              Create a repeating cycle of workout and rest days, then start it.
            </Text>
            <TouchableOpacity
              className="mt-4 px-4 py-2.5 rounded-xl bg-brand-500"
              onPress={() => setBuilderOpen(true)}
            >
              <Text className="text-white text-sm font-medium">+ Build split</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <RoutineCalendar
            slots={r.slots}
            anchor={r.anchor}
            monthDate={monthDate}
            onPrevMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            onSelectSlot={(slotId) => setEditingSlotId(slotId)}
          />
        )}
      </ScrollView>

      <CycleBuilderModal
        visible={builderOpen}
        onClose={() => setBuilderOpen(false)}
        slots={r.slots}
        exercisesBySlot={r.exercisesBySlot}
        anchor={r.anchor}
        onAddSlot={r.addSlot}
        onRename={r.updateSlotLabel}
        onToggleRest={r.toggleSlotRest}
        onMoveSlot={r.moveSlot}
        onDeleteSlot={r.removeSlot}
        onAddExercise={r.addExercise}
        onRemoveExercise={r.removeExercise}
        onStartCycle={r.startCycleToday}
      />

      <SlotEditorModal
        slot={editingSlot}
        exercises={editingSlot ? r.exercisesBySlot[editingSlot.id] ?? [] : []}
        onClose={() => setEditingSlotId(null)}
        onRename={r.updateSlotLabel}
        onToggleRest={r.toggleSlotRest}
        onAddExercise={r.addExercise}
        onRemoveExercise={r.removeExercise}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Delete the obsolete component**

Run: `rm src/components/RoutineDayCard.tsx`

- [ ] **Step 3: Confirm nothing else references the old component or APIs**

Run: `grep -rn "RoutineDayCard\|getRoutineDays\|RoutineDay\b\|RoutineExercise\b\|routine_days\|routine_exercises" app src --include="*.tsx" --include="*.ts"`
Expected: NO matches (empty output).

- [ ] **Step 4: Checkpoint**

Run: `npx tsc --noEmit`
Expected: clean (exit 0) — all routine errors resolved.

---

## Task 10: Verification

**Files:** none (manual + automated checks)

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: PASS (the `cycle.test.ts` suite).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: tsc clean; eslint clean (or only pre-existing warnings unrelated to new files).

- [ ] **Step 3: Manual web flow**

Run: `npx expo start --web` (or reuse the running server). Then in the browser, go to the Routine tab and verify:
1. Empty state shows "Build your split"; tapping **Build split** opens the builder.
2. Add 6 slots; rename them `Push, Pull, Legs, Rest, Upper, Lower`; toggle slot 4 to **Rest**. The "Rest" slot hides its exercise editor.
3. Add a couple of exercises to a workout slot via the picker; they appear under that slot.
4. Tap **Start cycle (today = day 1)**; the CYCLE line shows `6-day cycle · started <today>`.
5. Close the builder. The month calendar shows labels rotating Push→Pull→Legs→Rest→Upper→Lower; today's cell is ringed; rest cells are muted.
6. Tap a **Push** day in the calendar → the Edit Day sheet opens showing the shared Push slot with its exercises. Add an exercise; close; tap a different Push day → the same exercise is present (shared template confirmed).
7. Use the month `‹`/`›` arrows to move to next/previous month and confirm the cycle continues/wraps correctly across the month boundary.
8. In the builder, use ↑/↓ to reorder a slot and ✕ to delete one; confirm positions repack (numbers stay 1..N) and the calendar updates.

- [ ] **Step 4: Checkpoint**

All automated checks green and the manual flow behaves as described. Feature complete.

---

## Self-Review Notes

- **Spec coverage:** cycle model (Tasks 3–5), date→slot mapping (Task 1), month calendar + tap-to-edit (Tasks 7, 9), rest-as-slot-type (Task 6 toggle), today=slot-1 anchor + restart (Task 4 `startCycleToday`, Task 8 button), replace-entirely migration (Task 3), edge cases (Task 1 tests: N≤0, N=1, before-anchor; Task 4 `deleteSlot` repack), testing (Tasks 1 & 10).
- **Type consistency:** `RoutineSlot`/`RoutineSlotExercise` used identically across types, queries, hook, and components; hook method names (`updateSlotLabel`, `toggleSlotRest`, `moveSlot`, `removeSlot`, `addExercise`, `removeExercise`, `addSlot`, `startCycleToday`, `refreshAll`) match exactly the props passed in `routine.tsx`.
- **No placeholders:** every code step contains full file or full replacement block.
