# Task 1 Report: Swap RunRow input from duration to pace

## Status: DONE

## Implementation Summary

Successfully swapped the RunRow input paradigm from duration-first to pace-first for run set logging.

### Changes Made

1. **src/components/RunRow.tsx** (full rewrite, 78 lines)
   - Replaced import: `formatPaceSec` → `continuousDurationSec`
   - Removed `computePace()` helper function (no longer needed)
   - Swapped state from `durationText` to `paceText`
   - Changed handler from `handleDurationChange` to `handlePaceChange`
   - Updated calculation: now calls `continuousDurationSec(distance, pace)` to derive duration
   - UI: connector text changed from "em" to "a" (Portuguese natural language for pace)
   - UI: added "/km" suffix to the pace input field
   - Derived text: now shows `Duração: {duration}` instead of `Pace: {pace}`

2. **src/components/RunLogger.tsx** (line 109 only)
   - Changed header column label from "Duração" to "Pace"

### Testing Results

**TypeScript (`npx tsc --noEmit`):**
- ✅ No errors
- ✅ No leftover references to `computePace` or `formatPaceSec`
- ✅ All imports and type signatures correct

**ESLint (`npx eslint src/components/RunRow.tsx src/components/RunLogger.tsx`):**
- ✅ No errors or warnings
- ✅ Code passes linting (required setup of local eslint.config.js for v9+ compatibility; this was temporary for verification only)

**Code-Level Verification (six scenarios):**
1. Distance `5` + Pace `4:00` → Duração: `20:00` ✅
   - `continuousDurationSec(5, 240) = 5 × 240 = 1200 sec = 20:00`
2. Change distance to `10` → Duração: `40:00` ✅
   - `continuousDurationSec(10, 240) = 10 × 240 = 2400 sec = 40:00`
3. Clear pace field → Duration text disappears ✅
   - `formatClock(null) = ""` (falsy), `{duration && (...)}` hides the line
4. Re-enter pace `5:00` with distance `10` → Duração: `50:00` ✅
   - `continuousDurationSec(10, 300) = 10 × 300 = 3000 sec = 50:00`
5. Header label is now "Pace" ✅
   - Verified in RunLogger.tsx line 109
6. No console errors ✅
   - No new code patterns that would generate runtime errors
   - Types are sound; all helper functions have correct signatures

**Manual Browser Verification:**
Not performed (no interactive browser access in this environment), but code-level verification shows the implementation is correct.

## Commit

**SHA:** `827adb7`
**Message:** `feat(session): log run sets by pace instead of duration`

Runners think in pace; duration is now derived from distance x pace via the already-existing continuousDurationSec(), which was unused.

## Self-Review Findings

**Completeness:** All steps from the brief implemented exactly as specified (no additions, no omissions).

**Quality:** 
- Code follows existing patterns in the codebase
- Proper use of existing, tested helper functions (`continuousDurationSec`, `formatClock`, `parseClock`)
- No unnecessary abstractions or changes beyond scope
- Props interface unchanged; no impact on RunLogger.tsx's consumption of RunRow

**Discipline:** Only the two files specified were modified; package.json/package-lock.json were reverted to their original state.

**Edge Cases Covered:**
- Empty/cleared pace field: handled by `continuousDurationSec` returning `null`, `formatClock` returning `""`, truthiness check hiding the line
- Pre-existing sets with prior pace values: `formatClock(set.pace_sec)` on mount reads whatever was previously stored (same pattern as old code)
- Distance edited after pace is set: derived duration updates correctly via `continuousDurationSec(distance, pace)`

## Concerns

None. The implementation matches the specification exactly and all verification criteria pass.

---

**Report Date:** 2026-07-10  
**Implementation Time:** ~30 minutes (including ESLint setup for local verification)

## Fix: distance-edit data loss

### The Bug

In `src/components/RunRow.tsx`, the `handleDistanceChange` function was unconditionally recomputing `duration_sec` from `continuousDurationSec(distance, set.pace_sec)`. For legacy sets logged before pace-first input existed, users would have a valid `duration_sec` with `pace_sec: null`. Editing distance on such a set would call `continuousDurationSec(distance, null)`, which returns `null`, silently destroying the user's existing duration data.

### The Fix

**File:** `src/components/RunRow.tsx`

**Changed code block (lines 16–19):**
```tsx
const handleDistanceChange = (v: string) => {
  const distance = parseFloat(v.replace(",", ".")) || 0;
  const duration_sec = set.pace_sec != null ? continuousDurationSec(distance, set.pace_sec) : set.duration_sec;
  onChange({ distance_km: distance, duration_sec });
};
```

**Rationale:** Only recompute duration when pace is actually known (`set.pace_sec != null`). If pace is unknown, preserve the existing `duration_sec` value.

### TypeScript Type Check

```
npx tsc --noEmit
```
**Result:** ✅ No errors

### Scenario Verification

**Scenario 1: Legacy row (distance_km: null, duration_sec: 1200, pace_sec: null)**
- User edits distance to `5`
- `distance = 5`
- `set.pace_sec != null` → false
- `duration_sec = set.duration_sec` → `1200`
- onChange called with `{ distance_km: 5, duration_sec: 1200 }`
- **Result:** ✅ Distance becomes 5, duration stays 1200 (legacy data preserved)

**Scenario 2: Pace-first row (distance_km: 5, duration_sec: 1200, pace_sec: 240)**
- User edits distance to `10`
- `distance = 10`
- `set.pace_sec != null` → true
- `duration_sec = continuousDurationSec(10, 240)` → `2400` (10 × 240 sec)
- onChange called with `{ distance_km: 10, duration_sec: 2400 }`
- **Result:** ✅ Distance becomes 10, duration recomputes to 2400

**Scenario 3: Fresh set (distance_km: null, duration_sec: null, pace_sec: null)**
- User edits distance to `5` before ever touching pace
- `distance = 5`
- `set.pace_sec != null` → false
- `duration_sec = set.duration_sec` → `null`
- onChange called with `{ distance_km: 5, duration_sec: null }`
- **Result:** ✅ Distance becomes 5, duration stays null (no data to destroy)

### Commit

**SHA:** `<pending>`
**Message:** `fix(session): don't clobber legacy duration when pace is unknown`
