# Run Set Logging: Pace as the Input, Duration Derived — Design

**Date:** 2026-07-10
**Status:** Approved (pending spec review)

## Context

Live logging of a running (corrida) set happens in `src/components/RunRow.tsx`, rendered per-set inside `RunLogger.tsx` in the new-session wizard. Today the user enters **distance** (km) and **duration** (mm:ss) directly; `pace_sec` is derived (`computePace = duration / distance`) and shown as read-only text below the row ("Pace: 4:00/km").

The desired input for a run is pace, not total duration — pace is what a runner thinks in terms of, and total duration is what's derived from pace × distance. `continuousDurationSec(distanceKm, paceSec)` already exists in `src/data/modalities.ts:57` for exactly this calculation and is already unit-tested in `src/data/modalities.test.ts`; it is just unused today.

## Decision

Swap which field is the direct input and which is derived in `RunRow.tsx`:

- **Inputs:** distance (km, unchanged) and pace (mm:ss, representing sec/km).
- **Derived, read-only:** duration, computed via `continuousDurationSec(distance_km, pace_sec)`, shown as "Duração: X" below the row (replacing today's "Pace: X").

No schema or type change — `WorkoutSet` already has `distance_km`, `duration_sec`, `pace_sec`. Only which field the user types into changes. Existing stored sets remain valid and display unchanged everywhere else (`app/session/[id].tsx` already shows distance + duration + pace together, read-only).

## Implementation

`src/components/RunRow.tsx`:
- Replace the `durationText` local state with `paceText`, initialized from `formatClock(set.pace_sec)` (mm:ss, no `/km` suffix — the suffix renders as a static unit label next to the input, mirroring the existing "km" label next to the distance field).
- `handleDistanceChange(v)`: parse distance as today; recompute `duration_sec` from the *stored* `pace_sec` via `continuousDurationSec(distance, set.pace_sec)` (today it recomputes pace from duration — this is the mirror image).
- New `handlePaceChange(v)`: `setPaceText(v)`; parse via `parseClock(v)` into `pace_sec`; recompute `duration_sec` via `continuousDurationSec(set.distance_km, pace_sec)`; call `onChange({ pace_sec, duration_sec })`.
- Bottom derived-text line: replace `formatPaceSec(set.pace_sec)` with `formatClock(set.duration_sec)`, label "Duração" instead of "Pace". Hidden when `duration_sec` is null, same as today's pace text.

`src/components/RunLogger.tsx`:
- Header row column label changes from "Duração" to "Pace" (line ~109).

## Edge Cases

- **Pace cleared, distance present:** `duration_sec` becomes null (via `continuousDurationSec` returning null when `paceSec` is falsy); derived text hidden.
- **Distance edited after pace already set:** duration recalculates from the existing pace, consistent with the new "pace is the source of truth" model.
- **Pre-existing sets** (logged before this change, i.e. duration was the original input): `pace_sec` was already computed and stored at the time, so they load into the new pace field correctly with no migration needed.

## Testing

No new pure-function tests needed — `continuousDurationSec`, `formatClock`, and `parseClock` are all already covered by `src/data/modalities.test.ts`. This change only rewires which existing, tested functions are called from `RunRow.tsx`.

**Manual verification (web):** open a corrida session in the wizard, add a run exercise, enter distance + pace and confirm duration calculates and displays correctly; edit distance afterward and confirm duration recalculates from the same pace; clear the pace field and confirm the derived duration text disappears.

## Out of Scope

- Routine/program run targets (`target_pace_sec` etc.) — already pace-based, untouched.
- Interval run targets/logging — not part of per-set live logging today; unaffected.
- Session detail view (`app/session/[id].tsx`) — already displays distance, duration, and pace together; no change needed.
