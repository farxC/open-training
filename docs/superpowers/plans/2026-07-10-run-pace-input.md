# Run Set Pace Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the direct-entry field in the live run-set logger from total duration to pace, deriving duration from distance × pace instead of the other way around.

**Architecture:** UI-only rewire inside two existing components (`RunRow.tsx`, `RunLogger.tsx`). No schema, type, or query changes — `WorkoutSet` already stores `distance_km`, `duration_sec`, and `pace_sec`; only which field the user edits directly changes. Reuses `continuousDurationSec`, `formatClock`, and `parseClock`, all already implemented and unit-tested in `src/data/modalities.ts` / `src/data/modalities.test.ts`.

**Tech Stack:** React Native + React Native Web (single implementation, no `.web.tsx` split needed — neither file has one today), TypeScript strict mode.

## Global Constraints

- No new dependencies.
- No schema/type changes — spec explicitly rules this out.
- TypeScript strict mode must pass (`npx tsc --noEmit`).
- No automated test additions — the spec states the underlying pure functions (`continuousDurationSec`, `formatClock`, `parseClock`) are already covered by `src/data/modalities.test.ts`; verification here is typecheck, lint, and manual walkthrough.

---

### Task 1: Swap RunRow input from duration to pace

**Files:**
- Modify: `src/components/RunRow.tsx` (full file, 78 lines)
- Modify: `src/components/RunLogger.tsx:109` (header column label only)

**Interfaces:**
- Consumes: `continuousDurationSec(distanceKm: number | null, paceSec: number | null): number | null`, `formatClock(totalSec: number | null): string`, `parseClock(text: string): number | null` — all exported from `src/data/modalities.ts`, unchanged signatures.
- Produces: `RunRow` keeps its existing public `Props` interface (`set`, `onChange`, `onDelete`) — no consumer of `RunRow` (only `RunLogger.tsx`) needs to change how it's rendered.

- [ ] **Step 1: Rewrite state and change handlers in `RunRow.tsx`**

Replace the full contents of `src/components/RunRow.tsx` with:

```tsx
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { continuousDurationSec, formatClock, parseClock } from "@/data/modalities";
import type { WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  onChange: (patch: Partial<Pick<WorkoutSet, "distance_km" | "duration_sec" | "pace_sec">>) => void;
  onDelete: () => void;
}

export function RunRow({ set, onChange, onDelete }: Props) {
  const [paceText, setPaceText] = useState(formatClock(set.pace_sec));

  const handleDistanceChange = (v: string) => {
    const distance = parseFloat(v.replace(",", ".")) || 0;
    onChange({ distance_km: distance, duration_sec: continuousDurationSec(distance, set.pace_sec) });
  };

  const handlePaceChange = (v: string) => {
    setPaceText(v);
    const pace = parseClock(v);
    onChange({ pace_sec: pace, duration_sec: continuousDurationSec(set.distance_km, pace) });
  };

  const duration = formatClock(set.duration_sec);

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#ddd8ce', paddingVertical: 10 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text className="text-ink-mute text-sm text-center" style={{ width: 20 }}>
          {set.set_number}
        </Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={set.distance_km ? String(set.distance_km) : ""}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={handleDistanceChange}
          />
          <Text className="text-ink-mute text-xs">km</Text>
        </View>

        <Text className="text-ink-faint text-sm">a</Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={paceText}
            placeholder="mm:ss"
            placeholderTextColor="#bdb8aa"
            onChangeText={handlePaceChange}
          />
          <Text className="text-ink-mute text-xs">/km</Text>
        </View>

        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#928d80" />
        </TouchableOpacity>
      </View>

      {duration && (
        <Text className="text-ink-mute text-xs mt-1.5" style={{ paddingLeft: 28 }}>
          Duração: {duration}
        </Text>
      )}
    </View>
  );
}
```

Notes on this rewrite, so the reviewer isn't guessing at intent:
- `formatClock` returns `""` for a `null`/negative input (never `null`), so `{duration && (...)}` hides the derived line exactly the same way the old `{pace && (...)}` did (`formatPaceSec` returned `null` for falsy pace) — same truthiness-based hide/show, just against the new derived value.
- The connector text between the two inputs changes from "em" ("5km **in** 20:00") to "a" ("5km **at** 4:00/km") — "em" only reads correctly in front of a duration, not a pace; "a" is the natural Portuguese connector for a pace ("correr a 4:00/km").
- `computePace` (the old duration→pace helper) is deleted outright — nothing else in the file uses it.
- `formatPaceSec` import is dropped since nothing formats a pace with a `/km` suffix anymore (the `/km` is now a static label, matching how "km" is already a static label next to the distance field).

- [ ] **Step 2: Change the header column label in `RunLogger.tsx`**

In `src/components/RunLogger.tsx`, find this line (around line 109):

```tsx
          <Text className="text-ink-mute text-xs flex-1 text-center">Duração</Text>
```

Replace it with:

```tsx
          <Text className="text-ink-mute text-xs flex-1 text-center">Pace</Text>
```

This is the only change needed in `RunLogger.tsx` — it renders `RunRow` per set and passes through `onChange`/`onDelete` unchanged; its own state (`sets`, `addSet`/`updateSet`/`deleteSet` calls) doesn't reference `duration_sec` or `pace_sec` directly.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. In particular, confirm there's no leftover reference to `computePace` or `formatPaceSec` in `RunRow.tsx` (both were removed in Step 1) and no unused-import error for `formatPaceSec`.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/RunRow.tsx src/components/RunLogger.tsx`
Expected: no errors or warnings.

- [ ] **Step 5: Manual verification (web)**

Run: `npx expo start --web`

In the browser:
1. Open the app, tap **+** to start a new session, choose modality **Corrida**.
2. Proceed through the wizard to the details/live-logging step (skip split selection if prompted, per existing corrida flow).
3. Add a run exercise if not auto-added; confirm one run row is seeded.
4. In the row, type `5` in the distance field and `4:00` in the pace field (labeled "Pace" in the column header now).
5. Confirm the text below the row reads `Duração: 20:00` (5km × 4:00/km = 20:00).
6. Change distance to `10` without touching pace; confirm the text updates to `Duração: 40:00`.
7. Clear the pace field entirely; confirm the `Duração: ...` text disappears.
8. Re-enter a pace (e.g. `5:00`) with distance `10` still set; confirm `Duração: 50:00` reappears.

Expected: all six checks pass with no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/RunRow.tsx src/components/RunLogger.tsx
git commit -m "$(cat <<'EOF'
feat(session): log run sets by pace instead of duration

Runners think in pace; duration is now derived from distance x pace
via the already-existing continuousDurationSec(), which was unused.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Distance + pace as inputs, duration derived → Step 1.
- Derived text changes from "Pace: X" to "Duração: X" → Step 1 (JSX).
- Header label change → Step 2.
- No schema/type changes → confirmed, no such step exists.
- Edge cases (pace cleared, distance edited after pace set, pre-existing sets loading correctly) → covered by manual verification Step 5 (checks 6, 7 for clear/re-set; pre-existing sets need no special test since `formatClock(set.pace_sec)` on mount already reads whatever `pace_sec` was previously stored, same as the old code did for `duration_sec`).
- No new automated tests needed → confirmed against spec's Testing section; typecheck + lint + manual walkthrough stand in for it.

**Placeholder scan:** none — every step has literal code or exact commands.

**Type consistency:** `Props` interface unchanged between old and new `RunRow.tsx` (`onChange` patch shape identical); `RunLogger.tsx` passes the same `onChange`/`onDelete` callables it always did, untouched by this plan.
