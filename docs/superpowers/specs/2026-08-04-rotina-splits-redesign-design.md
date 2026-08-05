# Rotina & splits — redesign

**Date:** 2026-08-04
**Scope:** `app/(tabs)/routine.tsx`, `RoutineCalendar`, `DayDetailModal` (removed), `app/routine/[id].tsx`, plus a `routine_splits.color` column and a prefill contract for `/session/new`.
**Out of scope:** `app/routine/new-split.tsx` beyond adding a colour row; `app/routine/program/*` screens.

## Problem

The Rotina tab answers "how is my routine configured?" when the question the user actually arrives with is **"what do I train today?"**. Three concrete failures:

1. **No today.** The screen opens with a list of split names and a month grid. Today's workout — the thing you came for — is buried in a calendar cell you must tap to open a modal.
2. **Unreadable on a phone.** `RoutineCalendar` renders cells at `width: 100/7%` with `aspectRatio: 0.78`, then puts two lines of 8px text inside. On a 390px viewport that is a ~53px cell holding unit labels at 8px, truncated, with `+N` overflow at 8px. The failure is *textual content at 8px*, not cell geometry.
3. **Coinciding splits are invisible.** A day can schedule musculação *and* corrida. Today the two collapse into two 8px truncated strings, and there is no way to look at one split in isolation.

The split editor (`app/routine/[id].tsx`, 405 lines) stacks identity, day structure, cycle schedule, and progression plans in a single column. Its cyclic configuration is *abstract*: `rest_weekdays` and `anchor_date` are edited as a weekday toggle row and a date string, with no visible consequence — you cannot tell from the editor how the cycle will actually land on the calendar.

## Goals

- Today's workout is legible without a tap.
- Coinciding splits are distinguishable at a glance, and filterable to one.
- Nothing in the calendar relies on type smaller than 10px.
- The cyclic configuration shows its own consequence where it is edited.
- `app/routine/[id].tsx` sheds the two sections that deserve their own components.

## Non-goals

- Redesigning the session wizard. It gains route params only.
- Redesigning progression-plan screens.
- Dark theme. The app is light-only today; that does not change here.
- Any change to how sessions are recorded or how `resolvedTargetsForUnit` computes targets.

## Data model: colour per split

Splits become visually identifiable by a user-chosen colour from a closed palette.

**New file `src/data/splitColors.ts`:**

```ts
export const SPLIT_COLORS = {
  terra:   { hex: "#b8563a", label: "Terra"   },
  musgo:   { hex: "#5f7a4a", label: "Musgo"   },
  indigo:  { hex: "#3f5a80", label: "Índigo"  },
  ambar:   { hex: "#b9791f", label: "Âmbar"   },
  ameixa:  { hex: "#7a4a6b", label: "Ameixa"  },
  ardosia: { hex: "#5c6670", label: "Ardósia" },
} as const;

export type SplitColor = keyof typeof SPLIT_COLORS;
export const SPLIT_COLOR_ORDER: SplitColor[] = ["terra", "musgo", "indigo", "ambar", "ameixa", "ardosia"];
export function splitColorHex(c: SplitColor): string;   // falls back to terra on unknown input
```

All six are chosen to sit on `surface #f4f2ee` at roughly equal weight and to stay distinguishable as 6px filled dots. `ambar` matches the existing `accent.amber`.

**Schema.** `SCHEMA_VERSION: 18 → 19`. `routine_splits` DDL gains:

```sql
color TEXT NOT NULL DEFAULT 'terra'
  CHECK(color IN ('terra','musgo','indigo','ambar','ameixa','ardosia'))
```

The `CHECK` is deliberate — a closed six-value enum, per this project's preference for SQL-level constraints on closed enums even where TS validation exists.

**Migration (v19).** Additive, gated on `hasColumn("routine_splits", "color")`, not on `schema_version`:

1. `ALTER TABLE routine_splits ADD COLUMN color TEXT NOT NULL DEFAULT 'terra'`.
   SQLite cannot add a `CHECK` via `ALTER TABLE`; the constraint therefore exists only in fresh-install DDL. Upgraded databases enforce it in TS (`queries.ts` validates against `SPLIT_COLOR_ORDER` before writing). This asymmetry is accepted rather than rebuilding the table — a rebuild would cascade through `routine_units`, `training_programs`, and `sessions.split_id`.
2. Backfill: assign colours by the split's existing `"order"`, cycling `SPLIT_COLOR_ORDER`. Written once, so reordering or deleting a split later never changes another split's colour.

`PRAGMA foreign_key_check` in tests, if used, is scoped to `routine_splits` only.

**Export.** `CURRENT_EXPORT_FORMAT_VERSION: 6 → 7`. `color` is included in the split payload; import of a v7 payload with an unknown colour slug falls back to `terra` rather than rejecting the import.

**Types.** `RoutineSplit` gains `color: SplitColor`. `createSplit` accepts an optional `color` (defaults to the first unused colour in `SPLIT_COLOR_ORDER`, falling back to cycling when all six are taken); `updateSplit` accepts `color`.

## Rotina tab

One surface with one piece of navigational state: **the selected day** (defaults to today). Everything below the calendar describes that day.

```
┌──────────────────────────────────────┐
│ TRAINING SPLIT                       │
│ Minha Rotina              + split    │
│                                      │
│ ● ABC   ● Corrida   ○ Natação        │  ← filter chips, left-aligned
│ ────────────────────────────────────│
│ AGOSTO                     mês  ⌄    │
│  seg  ter  qua  qui  sex  sáb  dom   │
│   3    4   ┌─5─┐  6    7    8    9   │
│  ●●   ●    │●●│  ●    ●●   ·    ·   │
│            └───┘                     │
│ ────────────────────────────────────│
│ HOJE · TER, 5 AGO      2 treinos     │
│                                      │
│ ┌─● Push A ──────────────── ABC ─┐  │
│ │ Semana 3 de 8                   │  │
│ │ Supino reto      4 × 6–8 @ 80kg │  │
│ │ Desenvolvimento  3 × 8–10 @ 30kg│  │
│ │ Tríceps corda    3 × 12         │  │
│ │ [    Iniciar treino    ] editar›│  │
│ └─────────────────────────────────┘  │
│ ┌─● Longo 8km ─────────── Corrida ┐  │
│ │ 8,0 km · 5:40 /km               │  │
│ │ [    Iniciar treino    ] editar›│  │
│ └─────────────────────────────────┘  │
│                                      │
│ o que aconteceu: [Treinei][Descansei]│
└──────────────────────────────────────┘
```

### Selected day replaces `DayDetailModal`

`DayDetailModal.tsx` is **deleted**. Tapping a day — in the week strip or the expanded month — sets `selectedDate`; the header line and the cards below re-render for it. The override buttons act on the selected day.

- When `selectedDate` is today the header reads `HOJE · TER, 5 AGO`; otherwise `TER, 5 AGO` with a `voltar para hoje` link.
- Editing a day's exercises is no longer possible from this tab. Each card's `editar ›` navigates to `/routine/[id]?unitId=N`, which opens the split editor with that unit expanded. Structure is edited where structure lives.

This trades one extra tap (adjusting a target from the calendar) for removing a second mode from the tab. Explicitly approved.

### Split filter

`activeSplitId: number | null` is single state governing **three** things at once: which chip is filled, which pips the calendar draws, and which day cards render. There is no separate calendar filter. Chips are left-aligned and content-sized (not stretched, not centred), each showing a filled dot in its split colour when active and an outlined dot when not. A chip labelled `Todos` clears the filter; tapping the active chip also clears it.

The chips row replaces the current list of split rows, which was the tab's only route into a split editor. Reachability is preserved two ways: `editar ›` on a day card, and — when a filter is active — an `abrir ABC ›` link under the chips row. The second matters for a split that happens to schedule nothing in the visible range; without it such a split would be unreachable from this tab.

### Day cards

`DayPlanCard` renders one `DayScheduleEntry`:

- Left border/dot in the split's colour, split name on the right.
- `unit.label` as the card title in `font-display`.
- When the split has an active program covering the selected date, a `Semana N de M` line (from `resolvedTargetsForUnit`'s `programWeekId` and the active program).
- Exercise rows from `resolvedTargetsForUnit(unit, split, selectedDate).exercises` — resolved targets, so the program's week overrides are what you read. Strength rows use the existing `describeTarget` shape (`4 × 6–8 @ 80kg`); distance rows use `formatDistanceValue` + `formatEffort`.
- Numeric targets in `font-data` (JetBrains Mono), right-aligned in a column so the numbers line up down the card.
- Primary `Iniciar treino` button; `editar ›` as a quiet secondary.
- Rest entries collapse to a single short row (`Corrida · descanso`), never a full card.

When every entry is a rest day, one rest card renders with the next scheduled workout announced (`próximo: Pull B, qua 6 ago`), found by walking forward with `scheduleForDate` up to 14 days and giving up quietly past that.

### `Iniciar treino` → wizard prefill

`/session/new` gains three optional route params: `splitId`, `modality`, `date`. When `splitId` is present it starts at the `resolvedDay` step with that split and date already resolved, skipping `modality` and `splitChoice`. Params are ignored when `recorder.sessionId != null` — a live session already in progress still resumes into `details`, unchanged.

## Responsiveness

Driven by `useWindowDimensions()`, **not** `Platform.OS` — a narrow browser window suffers exactly like a phone, and the app must have web parity.

- **Week strip (default below 640px):** a 7-cell row, `flex: 1` each, fixed height ~64px. Day number at 15px, a row of 6px colour pips beneath. No text below 10px anywhere. Tap target ≥ 44px.
- **Month grid:** `aspectRatio: 1` (square, replacing the current `0.78`), pips only. Unit-label text renders **only** at width ≥ 640px.
- **Mês toggle:** below 640px the month grid is collapsed by default and expands on tapping `mês ⌄`. At ≥ 640px it is expanded by default and the strip is not rendered.
- **Overflow:** at most 3 pips per cell, then `+N` at 10px.
- **Today** is marked by a 1.5px `#26241f` ring; the **selected** day by a filled `#26241f` cell with inverted text. Today-and-selected is the filled state plus the ring.
- Override marks keep their current meaning (green = trained, red = rest) but move to a small glyph in the cell corner so they never compete with split pips for the same space.

### New primitive: `WeekGrid`

A 7-column responsive grid handling weekday headers, Monday-based leading offset, square cells, and today/selected states — with cell **content** supplied by a render prop. Two consumers:

- Rotina tab → colour pips.
- Split editor → cycle-day labels (`D1`, `D2`, `D3`, `·`).

It is the shared geometry, not a shared cell renderer.

Date math for the strip goes in `src/utils/cycle.ts` as `weekDaysAround(dateISO): string[]` — the Monday-based 7 ISO dates containing `dateISO` — so it is unit-testable without rendering.

## Split editor (`app/routine/[id].tsx`)

Single scroll, but sectioned into cards, and the cyclic configuration gains a visible consequence.

```
┌────────────────────────────────────┐
│ ‹  ABC Push/Pull/Legs        🗑    │
│    ▸ Musculação · Cíclico   ● cor  │
│ ──────────────────────────────────│
│  3 dias · descanso dom · plano ativo│
│                                     │
│  seg  ter  qua  qui  sex  sáb  dom  │
│  D1   D2   D3   D1   D2   D3   ·    │
│  ↑ hoje                             │
└────────────────────────────────────┘
┌─ DIAS DO CICLO ────────────────────┐
│ ① Push A        4×6–8 +5   ⋮   ⌄  │
│ ② Pull B        4×8   +4   ⋮   ⌄  │
│ ③ Legs          3×10  +5   ⋮   ⌄  │
│ + adicionar dia                     │
└────────────────────────────────────┘
┌─ AGENDA ───────────────────────────┐
│ Descanso fixo  S T Q Q S S [D]     │
│ Dia 1 cai em   4 ago     alterar   │
└────────────────────────────────────┘
  ⌄ Planos de progressão   Ativo · sem 3/8
```

Two extractions from the 405-line file:

- **`SplitIdentityPanel`** — modality/mode chip, colour picker, the one-line summary (`3 dias · descanso dom · plano ativo`), and the 7-day preview. The preview uses `WeekGrid` with `scheduleForDate` narrowed to this split, so toggling a rest weekday or changing the anchor date visibly re-lands the cycle immediately.
- **`CycleScheduleCard`** — wraps `WeekdayPicker` and the anchor-date row, currently loose in the scroll.

`StrengthPlanTable` / `DistancePlanTable` keep their current responsibilities and stay where they are. The weekly-mode branch (7 stacked `UnitCard`s / dashed placeholders) keeps its structure; only the surrounding section framing changes.

**Deep link.** `/routine/[id]?unitId=N` sets `expandedUnitId` on mount, so `editar ›` from a day card lands on the right day.

**Colour picker.** A row of six swatches in `SplitIdentityPanel`; tapping one calls `updateSplit(id, { color })`. `app/routine/new-split.tsx` gains the same swatch row and nothing else.

## Files

**New:** `src/data/splitColors.ts`, `src/components/WeekGrid.tsx`, `src/components/DayPlanCard.tsx`, `src/components/SplitFilterChips.tsx`, `src/components/SplitColorPicker.tsx`, `src/components/SplitIdentityPanel.tsx`, `src/components/CycleScheduleCard.tsx`.

**Deleted:** `src/components/DayDetailModal.tsx`.

**Modified:** `src/db/schema.ts`, `src/db/migrations.ts`, `src/db/queries.ts`, `src/db/importExport.ts`, `src/db/importExportApply.ts`, `src/types/routine.ts`, `src/utils/cycle.ts`, `src/components/RoutineCalendar.tsx` (rewritten over `WeekGrid`), `app/(tabs)/routine.tsx`, `app/routine/[id].tsx`, `app/routine/new-split.tsx`, `app/session/new.tsx`.

## Testing

Logic-first, matching the repo's existing test shape (`src/db/migrations.test.ts`, `src/utils/*.test.ts`):

- **Migration:** a v18 DB upgrades to v19; `color` exists; existing splits are backfilled cycling `SPLIT_COLOR_ORDER` by `"order"`; a re-run is idempotent; a fresh install rejects an invalid colour via `CHECK`; the double-migration guard already covered at line ~313 of `migrations.test.ts` still holds.
- **Queries:** `createSplit` defaults to the first unused colour; `createSplit` with an explicit colour round-trips; `updateSplit` rejects an unknown slug in TS.
- **Export/import:** a v7 payload round-trips `color`; a v7 payload with an unknown slug imports as `terra`.
- **`weekDaysAround`:** returns Monday-based weeks; correct across month and year boundaries; a Sunday input returns the week *ending* that Sunday.
- **`splitColorHex`:** unknown input falls back to `terra`.
- **Next-workout lookahead:** the forward walk finds the next workout, and returns null past 14 days.

Rendering is verified in the browser at 390px and at desktop width — the strip/month breakpoint, pip overflow, and tap targets are visual properties, and this repo has learned not to trust that web behaviour matches expectation without looking.

## Risks

- **`CHECK` asymmetry** between fresh installs and upgraded DBs, described above. Mitigated by TS validation on every write path.
- **Losing in-tab exercise editing.** Accepted; `editar ›` is the replacement path.
- **Colour as the only distinguishing signal** is a problem for colour-vision deficiency. Mitigated by every colour-coded element also carrying text: chips are labelled, cards name their split. The pips are a *scanning* aid, never the sole carrier of meaning.
