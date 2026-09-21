# Rotina & Splits Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Rotina tab into a "what do I train today?" surface with a phone-readable calendar, make coinciding splits distinguishable by a user-chosen colour and filterable with one control, and recompose the split editor so its cyclic configuration shows its own consequence.

**Architecture:** A `routine_splits.color` column (schema v19, export v7) gives every split a stable identity from a closed six-colour palette. A new `WeekGrid` primitive owns responsive 7-column geometry; the Rotina tab renders colour pips into it, the split editor renders cycle-day labels. The tab holds one piece of state — the selected day — and `DayDetailModal` is deleted in favour of day cards that re-render inline. Date math and lookahead logic live in pure, unit-tested utils; components stay thin.

**Tech Stack:** Expo 52, Expo Router 4, expo-sqlite 15 (synchronous API), NativeWind v4 + Tailwind v3, TypeScript, jest + jest-expo, sql.js for in-memory migration tests.

## Global Constraints

- **Web parity is mandatory.** Every feature must work in the browser, not only on native.
- **Never use `Platform.OS` for responsive layout.** Use `useWindowDimensions()`. A narrow browser window must behave like a phone. `Platform.OS` stays confined to leaf components and `*.web.tsx` files.
- **Breakpoint: 640px.** Below it, week strip default + month collapsed + no unit-label text. At or above it, month expanded + labels shown + no strip.
- **No text below 10px anywhere.** The current 8px unit labels and 8px `+N` are the bug being fixed.
- **Minimum tap target 44px** on every calendar cell.
- **Never pass a function as a `style` prop.** NativeWind discards function styles on native. `src/components/styleProps.test.ts` scans for this and will fail the build. Use `src/hooks/useInteractionState.ts` for pressed/hovered state.
- **`"order"` is a SQL reserved word** — always quote it: `"order"`.
- **Never use `Alert.alert`** — it is a no-op on web. Use `confirmAction` / `notify` from `src/components/AppModal.tsx`.
- **All SQL lives in `src/db/queries.ts`.** No raw SQL in components or hooks.
- **Migrations gate on `hasColumn` / `hasTable`, never on `schema_version`**, so an install whose version was bumped without the change landing self-heals.
- **`PRAGMA foreign_key_check` is always scoped to a table**, never run unscoped.
- Palette hexes, verbatim: `terra #b8563a`, `musgo #5f7a4a`, `indigo #3f5a80`, `ambar #b9791f`, `ameixa #7a4a6b`, `ardosia #5c6670`.
- Theme colours already in use, verbatim: ink `#26241f`, ink-soft `#5c594f`, ink-mute `#928d80`, ink-faint `#bdb8aa`, surface `#f4f2ee`, card `#ffffff`, elevated `#ebe7df`, border `#ddd8ce`, green `#2f9e6e`, red `#bf3b30`.
- UI copy is **Portuguese**, matching the existing app.
- Run tests with `npx jest`, a single file with `npx jest path/to/file.test.ts`, typecheck with `npx tsc --noEmit`, lint with `npx eslint .`.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/data/splitColors.ts` | The closed colour palette registry: slugs, hexes, labels, validation. |
| `src/data/splitColors.test.ts` | Registry invariants and fallback behaviour. |
| `src/utils/routineLookahead.ts` | Pure forward-walk to find the next scheduled workout. |
| `src/utils/routineLookahead.test.ts` | Lookahead behaviour including the give-up bound. |
| `src/components/WeekGrid.tsx` | Responsive 7-column grid geometry with render-prop cell content. |
| `src/components/SplitColorPicker.tsx` | Row of six colour swatches. |
| `src/components/SplitFilterChips.tsx` | `Todos` + one chip per split; single filter control. |
| `src/components/DayPlanCard.tsx` | One split's plan for the selected day, with `Iniciar treino` / `editar ›`. |
| `src/components/SplitIdentityPanel.tsx` | Split editor header card: chips, colour, summary line, 7-day cycle preview. |
| `src/components/CycleScheduleCard.tsx` | Split editor `AGENDA` card: rest weekdays + anchor date. |

**Deleted:** `src/components/DayDetailModal.tsx`.

**Modified:** `src/db/schema.ts`, `src/db/migrations.ts`, `src/db/migrations.test.ts`, `src/db/queries.ts`, `src/db/__tests__/queries.test.ts`, `src/db/importExport.ts`, `src/db/importExportApply.ts`, `src/db/importExport.test.ts`, `src/types/routine.ts`, `src/hooks/useRoutine.ts`, `src/utils/cycle.ts`, `src/utils/periods.test.ts` (no — see Task 2: new tests go in `src/utils/cycle.test.ts`, created if absent), `src/components/RoutineCalendar.tsx`, `app/(tabs)/routine.tsx`, `app/routine/[id].tsx`, `app/routine/new-split.tsx`, `app/session/new.tsx`.

---

### Task 1: Split colour palette registry

A pure module with no dependencies — everything downstream imports from here, so it goes first.

**Files:**
- Create: `src/data/splitColors.ts`
- Test: `src/data/splitColors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SPLIT_COLORS: Readonly<Record<SplitColor, { hex: string; label: string }>>`
  - `type SplitColor = "terra" | "musgo" | "indigo" | "ambar" | "ameixa" | "ardosia"`
  - `SPLIT_COLOR_ORDER: readonly SplitColor[]` — length 6, canonical assignment order
  - `isSplitColor(v: unknown): v is SplitColor`
  - `splitColorHex(v: unknown): string` — falls back to terra's hex
  - `splitColorLabel(v: unknown): string` — falls back to terra's label

- [ ] **Step 1: Write the failing test**

Create `src/data/splitColors.test.ts`:

```ts
import {
  SPLIT_COLORS,
  SPLIT_COLOR_ORDER,
  isSplitColor,
  splitColorHex,
  splitColorLabel,
} from "./splitColors";

describe("split colour palette", () => {
  it("has exactly six colours, and the order lists each one once", () => {
    const keys = Object.keys(SPLIT_COLORS);
    expect(keys).toHaveLength(6);
    expect(SPLIT_COLOR_ORDER).toHaveLength(6);
    expect(SPLIT_COLOR_ORDER.slice().sort()).toEqual(keys.slice().sort());
  });

  it("gives every colour a distinct 6-digit hex and a non-empty label", () => {
    const hexes = SPLIT_COLOR_ORDER.map((c) => SPLIT_COLORS[c].hex);
    expect(new Set(hexes).size).toBe(6);
    for (const c of SPLIT_COLOR_ORDER) {
      expect(SPLIT_COLORS[c].hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(SPLIT_COLORS[c].label.length).toBeGreaterThan(0);
    }
  });

  it("recognises valid slugs and rejects everything else", () => {
    expect(isSplitColor("terra")).toBe(true);
    expect(isSplitColor("ardosia")).toBe(true);
    expect(isSplitColor("roxo")).toBe(false);
    expect(isSplitColor("")).toBe(false);
    expect(isSplitColor(null)).toBe(false);
    expect(isSplitColor(7)).toBe(false);
  });

  // A split row written by a future build, or a hand-edited import, must render
  // as *something* rather than crashing the calendar.
  it("falls back to terra for unknown input", () => {
    expect(splitColorHex("musgo")).toBe("#5f7a4a");
    expect(splitColorHex("roxo")).toBe(SPLIT_COLORS.terra.hex);
    expect(splitColorHex(null)).toBe(SPLIT_COLORS.terra.hex);
    expect(splitColorLabel("roxo")).toBe(SPLIT_COLORS.terra.label);
  });

  it("keeps the exact hexes the design specifies", () => {
    expect(SPLIT_COLORS.terra.hex).toBe("#b8563a");
    expect(SPLIT_COLORS.musgo.hex).toBe("#5f7a4a");
    expect(SPLIT_COLORS.indigo.hex).toBe("#3f5a80");
    expect(SPLIT_COLORS.ambar.hex).toBe("#b9791f");
    expect(SPLIT_COLORS.ameixa.hex).toBe("#7a4a6b");
    expect(SPLIT_COLORS.ardosia.hex).toBe("#5c6670");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/splitColors.test.ts`
Expected: FAIL — `Cannot find module './splitColors'`.

- [ ] **Step 3: Write the implementation**

Create `src/data/splitColors.ts`:

```ts
/**
 * A split's visual identity in the calendar. Six values, closed on purpose: the
 * palette has to stay distinguishable as 6px dots on the warm paper surface
 * (#f4f2ee), which an open colour picker cannot guarantee. `ambar` matches the
 * theme's existing accent.amber.
 */
export const SPLIT_COLORS = {
  terra: { hex: "#b8563a", label: "Terra" },
  musgo: { hex: "#5f7a4a", label: "Musgo" },
  indigo: { hex: "#3f5a80", label: "Índigo" },
  ambar: { hex: "#b9791f", label: "Âmbar" },
  ameixa: { hex: "#7a4a6b", label: "Ameixa" },
  ardosia: { hex: "#5c6670", label: "Ardósia" },
} as const;

export type SplitColor = keyof typeof SPLIT_COLORS;

/** Canonical assignment order — createSplit and the v19 backfill both walk this. */
export const SPLIT_COLOR_ORDER: readonly SplitColor[] = [
  "terra",
  "musgo",
  "indigo",
  "ambar",
  "ameixa",
  "ardosia",
];

export const DEFAULT_SPLIT_COLOR: SplitColor = "terra";

export function isSplitColor(v: unknown): v is SplitColor {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SPLIT_COLORS, v);
}

export function splitColorHex(v: unknown): string {
  return SPLIT_COLORS[isSplitColor(v) ? v : DEFAULT_SPLIT_COLOR].hex;
}

export function splitColorLabel(v: unknown): string {
  return SPLIT_COLORS[isSplitColor(v) ? v : DEFAULT_SPLIT_COLOR].label;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/splitColors.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/splitColors.ts src/data/splitColors.test.ts
git commit -m "feat(routine): add the closed split-colour palette"
```

---

### Task 2: Calendar date math in `cycle.ts`

`WeekGrid` needs its date arithmetic testable without rendering. Two pure functions, added to the existing `src/utils/cycle.ts`.

**Files:**
- Modify: `src/utils/cycle.ts` (append; keep existing exports untouched)
- Test: `src/utils/cycle.test.ts` (create — `cycle.ts` has no test file yet)

**Interfaces:**
- Consumes: `addDays`, `weekday`, `dateToISO` — already exported from `src/utils/cycle.ts`.
- Produces:
  - `weekDaysAround(dateISO: string): string[]` — exactly 7 ISO dates, Monday→Sunday, for the week containing `dateISO`.
  - `monthGridCells(year: number, month: number): (string | null)[]` — ISO dates for a Monday-based month grid, `null` for leading/trailing filler, length always a multiple of 7. `month` is 0-based, matching `Date#getMonth`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/cycle.test.ts`:

```ts
import { weekDaysAround, monthGridCells } from "./cycle";

describe("weekDaysAround", () => {
  // 2026-08-05 is a Wednesday.
  it("returns the Monday-based week containing the date", () => {
    expect(weekDaysAround("2026-08-05")).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05",
      "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09",
    ]);
  });

  it("returns the same week for every day in it", () => {
    const week = weekDaysAround("2026-08-05");
    for (const day of week) expect(weekDaysAround(day)).toEqual(week);
  });

  // The trap in Monday-based maths: JS getDay() makes Sunday 0, so a naive
  // offset puts Sunday at the *start* of the following week.
  it("puts a Sunday at the end of the week it closes", () => {
    expect(weekDaysAround("2026-08-09")[6]).toBe("2026-08-09");
    expect(weekDaysAround("2026-08-09")[0]).toBe("2026-08-03");
  });

  it("crosses a month boundary", () => {
    expect(weekDaysAround("2026-09-01")).toEqual([
      "2026-08-31", "2026-09-01", "2026-09-02",
      "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(weekDaysAround("2027-01-01")).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30",
      "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });
});

describe("monthGridCells", () => {
  // August 2026: the 1st is a Saturday, 31 days.
  it("pads the leading days of the month with nulls", () => {
    const cells = monthGridCells(2026, 7);
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cells[5]).toBe("2026-08-01");
    expect(cells[6]).toBe("2026-08-02");
  });

  it("returns a whole number of weeks, trailing-padded with nulls", () => {
    const cells = monthGridCells(2026, 7);
    expect(cells.length % 7).toBe(0);
    expect(cells[cells.length - 1]).toBeNull();
  });

  it("contains every day of the month exactly once, in order", () => {
    const days = monthGridCells(2026, 7).filter((c): c is string => c != null);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe("2026-08-01");
    expect(days[30]).toBe("2026-08-31");
  });

  // February 2027 starts on a Monday and has 28 days — exactly four weeks,
  // so a correct implementation adds no padding at all.
  it("needs no padding for a month that starts on Monday and fits four weeks", () => {
    const cells = monthGridCells(2027, 1);
    expect(cells).toHaveLength(28);
    expect(cells[0]).toBe("2027-02-01");
    expect(cells[27]).toBe("2027-02-28");
  });

  it("handles a leap February", () => {
    const days = monthGridCells(2028, 1).filter((c): c is string => c != null);
    expect(days).toHaveLength(29);
    expect(days[28]).toBe("2028-02-29");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/cycle.test.ts`
Expected: FAIL — `weekDaysAround is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/utils/cycle.ts`:

```ts
/**
 * The seven ISO dates of the Monday-based week containing `dateISO`.
 * Monday-based because the whole app displays weeks Seg→Dom; JS getDay() is
 * Sunday-based, hence the (day + 6) % 7 shift.
 */
export function weekDaysAround(dateISO: string): string[] {
  const offsetFromMonday = (weekday(dateISO) + 6) % 7;
  const monday = addDays(dateISO, -offsetFromMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Cells for a Monday-based month grid: ISO dates for real days, `null` for the
 * leading and trailing filler. Length is always a multiple of 7 so callers can
 * lay it out as complete rows. `month` is 0-based (Date#getMonth).
 */
export function monthGridCells(year: number, month: number): (string | null)[] {
  const first = dateToISO(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (weekday(first) + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 0; d < daysInMonth; d++) cells.push(addDays(first, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/cycle.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/cycle.ts src/utils/cycle.test.ts
git commit -m "feat(routine): add week and month grid date maths"
```

---

### Task 3: Schema v19 and the colour migration

**Files:**
- Modify: `src/db/schema.ts:1` (`SCHEMA_VERSION`), and the `routine_splits` DDL at `src/db/schema.ts:133-142`
- Modify: `src/db/migrations.ts` (append a v19 block before the final `schema_version` write)
- Test: `src/db/migrations.test.ts`

**Interfaces:**
- Consumes: `SPLIT_COLOR_ORDER` from Task 1; `ensureColumn` and `hasColumn`, already private helpers in `src/db/migrations.ts:9-27`.
- Produces: a `routine_splits.color` column, non-null on every row after migration.

**Design note — deliberate deviation from the spec.** The spec wrote the `ALTER TABLE` as `color TEXT NOT NULL DEFAULT 'terra'`. Adding the column **nullable** instead, then backfilling `WHERE color IS NULL`, is strictly better: with a `'terra'` default there is no way to distinguish "never assigned" from "the user chose terra", so the backfill could not be made idempotent. Fresh installs still get `NOT NULL DEFAULT 'terra'` plus the `CHECK` from the DDL. The asymmetry — `CHECK` present on fresh installs, absent on upgraded ones, because SQLite cannot add a `CHECK` via `ALTER TABLE` — is accepted; `queries.ts` validates on every write path (Task 4).

- [ ] **Step 1: Write the failing test**

Add to `src/db/migrations.test.ts`, inside the top-level `describe("runMigrations upgrade from frozen snapshots")` block:

```ts
  it("v19: adds routine_splits.color and backfills existing splits by order", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v8-snapshot.sql"));
    runMigrations(dbHandle);

    // Fresh splits created *after* the column exists, to prove the backfill only
    // touches rows that never had one. Seven of them, so the cycle wraps.
    for (let i = 0; i < 7; i++) {
      dbHandle.runSync(
        `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid, color)
         VALUES (?, 'cyclic', 'musculacao', NULL, '', ?, ?, NULL)`,
        [`Split ${i}`, i, `uuid-color-${i}`]
      );
    }

    // Re-running is how a real device reaches the backfill for rows inserted by
    // a build that predates the colour writer.
    runMigrations(dbHandle);

    const rows = dbHandle.getAllSync<{ name: string; order: number; color: string | null }>(
      `SELECT name, "order", color FROM routine_splits WHERE uuid LIKE 'uuid-color-%' ORDER BY "order"`,
      []
    );
    expect(rows.map((r) => r.color)).toEqual([
      "terra", "musgo", "indigo", "ambar", "ameixa", "ardosia", "terra",
    ]);
  });

  it("v19: leaves an already-assigned colour alone across re-runs", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v8-snapshot.sql"));
    runMigrations(dbHandle);

    dbHandle.runSync(
      `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid, color)
       VALUES ('Escolhido', 'cyclic', 'musculacao', NULL, '', 0, 'uuid-chosen', 'ameixa')`,
      []
    );
    runMigrations(dbHandle);

    const row = dbHandle.getFirstSync<{ color: string | null }>(
      "SELECT color FROM routine_splits WHERE uuid = 'uuid-chosen'",
      []
    );
    expect(row!.color).toBe("ameixa");
  });

  it("v19: leaves no split without a colour", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    dbHandle.execSync(loadFixture("v8-snapshot.sql"));
    runMigrations(dbHandle);

    const row = dbHandle.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM routine_splits WHERE color IS NULL",
      []
    );
    expect(row!.count).toBe(0);
  });
```

Add to the same file, as its own top-level `describe`:

```ts
describe("fresh-install split colour constraint", () => {
  it("rejects a colour outside the palette", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    runMigrations(dbHandle);

    expect(() =>
      dbHandle.runSync(
        `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid, color)
         VALUES ('Ruim', 'cyclic', 'musculacao', NULL, '', 0, 'uuid-bad-colour', 'roxo')`,
        []
      )
    ).toThrow();
  });

  it("defaults an unspecified colour to terra", async () => {
    const dbHandle: DbHandle = await createInMemoryDb();
    runMigrations(dbHandle);

    dbHandle.runSync(
      `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid)
       VALUES ('Padrão', 'cyclic', 'musculacao', NULL, '', 0, 'uuid-default-colour')`,
      []
    );
    const row = dbHandle.getFirstSync<{ color: string }>(
      "SELECT color FROM routine_splits WHERE uuid = 'uuid-default-colour'",
      []
    );
    expect(row!.color).toBe("terra");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/migrations.test.ts -t "colour"`
Expected: FAIL — `no such column: color`.

- [ ] **Step 3: Bump the version and the DDL**

In `src/db/schema.ts`, line 1:

```ts
export const SCHEMA_VERSION = 19;
```

Replace the `routine_splits` DDL (currently `src/db/schema.ts:133-142`) with:

```sql
  `CREATE TABLE IF NOT EXISTS routine_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    modality TEXT NOT NULL DEFAULT 'musculacao',
    anchor_date TEXT,
    rest_weekdays TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    uuid TEXT UNIQUE,
    color TEXT NOT NULL DEFAULT 'terra'
      CHECK (color IN ('terra','musgo','indigo','ambar','ameixa','ardosia'))
  )`,
```

- [ ] **Step 4: Write the migration**

In `src/db/migrations.ts`, add the import near the other `../data/*` imports:

```ts
import { SPLIT_COLOR_ORDER } from "../data/splitColors";
```

Insert this block in `runMigrations`, immediately **before** the closing `if (currentVersion < SCHEMA_VERSION)` write:

```ts
  // v19: every split carries a colour, so coinciding splits stay
  // distinguishable as pips in the calendar. Added nullable rather than with a
  // NOT NULL DEFAULT: a 'terra' default would make "never assigned" and "the
  // user picked terra" indistinguishable, and the backfill below could not then
  // be idempotent. Fresh installs get NOT NULL + CHECK from CREATE_TABLES;
  // SQLite cannot add a CHECK via ALTER TABLE, so upgraded databases rely on
  // queries.ts validating every write instead. Rebuilding routine_splits to gain
  // the CHECK would cascade through routine_units, training_programs and
  // sessions.split_id — not worth it for a six-value enum guarded in TS.
  ensureColumn(dbHandle, "routine_splits", "color", "TEXT");

  // Assigned by "order" so the palette walks in the same sequence the user sees,
  // and written once — reordering or deleting a split later never repaints
  // another split. Unconditional and idempotent (WHERE color IS NULL), the same
  // self-healing shape as the v18 backfills above: a split inserted by a build
  // that predates the colour writer still gets one on the next launch.
  const uncoloured = dbHandle.getAllSync<{ id: number; order: number }>(
    `SELECT id, "order" FROM routine_splits WHERE color IS NULL ORDER BY "order"`,
    []
  );
  for (const split of uncoloured) {
    const colour = SPLIT_COLOR_ORDER[split.order % SPLIT_COLOR_ORDER.length];
    dbHandle.runSync("UPDATE routine_splits SET color = ? WHERE id = ?", [colour, split.id]);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/db/migrations.test.ts`
Expected: PASS — the whole file, including the pre-existing snapshot and checksum tests. The `SCHEMA_VERSION` assertions at lines ~103, ~201, ~293, ~398, ~507 and ~928 read the constant, so the bump needs no edits there.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/migrations.ts src/db/migrations.test.ts
git commit -m "feat(db): schema v19 — colour per routine split"
```

---

### Task 4: Read and write the colour through `queries.ts`

**Files:**
- Modify: `src/types/routine.ts` (`RoutineSplit`, and move `DayScheduleEntry` here)
- Modify: `src/db/queries.ts:648-694` (`SplitRow`, `getSplits`, `createSplit`, `updateSplit`)
- Modify: `src/hooks/useRoutine.ts` (re-export `DayScheduleEntry`; pass `color` through `addSplit`)
- Test: `src/db/__tests__/queries.test.ts`

**Interfaces:**
- Consumes: `SplitColor`, `SPLIT_COLOR_ORDER`, `isSplitColor`, `DEFAULT_SPLIT_COLOR` from Task 1.
- Produces:
  - `RoutineSplit.color: SplitColor`
  - `createSplit(s: { name: string; mode: SplitMode; modality: Modality; color?: SplitColor }): number`
  - `updateSplit(id, patch: { name?; anchor_date?; rest_weekdays?; order?; color?: SplitColor })` — throws on an invalid colour
  - `DayScheduleEntry` exported from `src/types/routine.ts` (still re-exported from `src/hooks/useRoutine.ts`, so existing imports keep working)
  - `useRoutine().addSplit(name, mode, modality, color?)`

- [ ] **Step 1: Write the failing test**

Add to `src/db/__tests__/queries.test.ts`, following the file's existing setup convention:

```ts
  it("assigns the first unused palette colour to a new split", () => {
    const a = createSplit({ name: "A", mode: "cyclic", modality: "musculacao" });
    const b = createSplit({ name: "B", mode: "cyclic", modality: "corrida" });
    const splits = getSplits();
    expect(splits.find((s) => s.id === a)!.color).toBe("terra");
    expect(splits.find((s) => s.id === b)!.color).toBe("musgo");
  });

  it("honours an explicitly requested colour", () => {
    const id = createSplit({ name: "C", mode: "weekly", modality: "musculacao", color: "ameixa" });
    expect(getSplits().find((s) => s.id === id)!.color).toBe("ameixa");
  });

  // Six splits exhaust the palette; the seventh has to reuse rather than fail.
  it("cycles the palette once every colour is taken", () => {
    const ids = SPLIT_COLOR_ORDER.map((_, i) =>
      createSplit({ name: `S${i}`, mode: "cyclic", modality: "musculacao" })
    );
    const seventh = createSplit({ name: "S6", mode: "cyclic", modality: "musculacao" });
    const splits = getSplits();
    expect(ids.map((id) => splits.find((s) => s.id === id)!.color)).toEqual([...SPLIT_COLOR_ORDER]);
    expect(splits.find((s) => s.id === seventh)!.color).toBe("terra");
  });

  it("updates a colour", () => {
    const id = createSplit({ name: "D", mode: "cyclic", modality: "musculacao" });
    updateSplit(id, { color: "indigo" });
    expect(getSplits().find((s) => s.id === id)!.color).toBe("indigo");
  });

  // The upgraded-database path has no SQL CHECK, so TS is the only guard.
  it("refuses a colour outside the palette", () => {
    const id = createSplit({ name: "E", mode: "cyclic", modality: "musculacao" });
    expect(() => updateSplit(id, { color: "roxo" as never })).toThrow(/colour|cor/i);
    expect(getSplits().find((s) => s.id === id)!.color).toBe("terra");
  });
```

Add `SPLIT_COLOR_ORDER` to the file's imports:

```ts
import { SPLIT_COLOR_ORDER } from "../../data/splitColors";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/queries.test.ts -t "colour"`
Expected: FAIL — `color` is `undefined` on the returned splits.

- [ ] **Step 3: Widen the type**

In `src/types/routine.ts`, add the import and the field, and move `DayScheduleEntry` in from the hook:

```ts
import type { Modality } from "./exercise";
import type { SplitColor } from "../data/splitColors";

export interface RoutineSplit {
  id: number;
  name: string;
  mode: SplitMode;
  modality: Modality;
  anchor_date: string | null;
  rest_weekdays: number[]; // 0=Sun..6=Sat (cyclic only)
  order: number;
  uuid: string;
  /** Calendar identity — see src/data/splitColors.ts. */
  color: SplitColor;
}

/** What one split prescribes on one date. Lives here rather than in useRoutine
 *  so pure utils (routineLookahead) can consume it without importing a hook. */
export interface DayScheduleEntry {
  split: RoutineSplit;
  unit: RoutineUnit | null; // the unit to perform that day (null when resting)
  status: "workout" | "rest";
}
```

Add `DayScheduleEntry` to the re-export list in `src/types/index.ts:19`.

In `src/hooks/useRoutine.ts`, delete the local `DayScheduleEntry` interface (currently lines 65-69) and re-export the type instead, so every existing `import type { DayScheduleEntry } from "@/hooks/useRoutine"` keeps compiling:

```ts
import type { DayScheduleEntry } from "@/types";
export type { DayScheduleEntry };
```

- [ ] **Step 4: Read, create and update the colour**

In `src/db/queries.ts`, add to the imports:

```ts
import { SPLIT_COLOR_ORDER, isSplitColor, DEFAULT_SPLIT_COLOR, type SplitColor } from "../data/splitColors";
```

Add `color` to `SplitRow` (line ~648) — nullable, because an upgraded database's backfilled column is declared `TEXT`:

```ts
interface SplitRow {
  id: number;
  name: string;
  mode: string;
  modality: string;
  anchor_date: string | null;
  rest_weekdays: string;
  order: number;
  uuid: string;
  color: string | null;
}
```

In `getSplits`, add the mapped field:

```ts
    color: isSplitColor(r.color) ? r.color : DEFAULT_SPLIT_COLOR,
```

Replace `createSplit`:

```ts
export function createSplit(s: {
  name: string;
  mode: SplitMode;
  modality: Modality;
  color?: SplitColor;
}): number {
  const rows = db.getAllSync<{ color: string | null }>("SELECT color FROM routine_splits");
  // First unused colour keeps a small set of splits maximally distinguishable;
  // once all six are taken, cycling by count is the only option left.
  const used = new Set(rows.map((r) => r.color));
  const color =
    s.color ??
    SPLIT_COLOR_ORDER.find((c) => !used.has(c)) ??
    SPLIT_COLOR_ORDER[rows.length % SPLIT_COLOR_ORDER.length];

  const result = db.runSync(
    `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid, color) VALUES (?, ?, ?, NULL, '', ?, ?, ?)`,
    [s.name, s.mode, s.modality, rows.length, generateUuid(), color]
  );
  return result.lastInsertRowId;
}
```

Add the colour branch to `updateSplit`, and widen its patch type:

```ts
export function updateSplit(
  id: number,
  patch: {
    name?: string;
    anchor_date?: string | null;
    rest_weekdays?: number[];
    order?: number;
    color?: SplitColor;
  }
): void {
  if (patch.name !== undefined) db.runSync("UPDATE routine_splits SET name = ? WHERE id = ?", [patch.name, id]);
  if (patch.anchor_date !== undefined) db.runSync("UPDATE routine_splits SET anchor_date = ? WHERE id = ?", [patch.anchor_date, id]);
  if (patch.rest_weekdays !== undefined) db.runSync("UPDATE routine_splits SET rest_weekdays = ? WHERE id = ?", [patch.rest_weekdays.join(","), id]);
  if (patch.order !== undefined) db.runSync(`UPDATE routine_splits SET "order" = ? WHERE id = ?`, [patch.order, id]);
  if (patch.color !== undefined) {
    // Databases upgraded to v19 have no SQL CHECK on this column (SQLite cannot
    // add one via ALTER TABLE), so this guard is the only thing standing between
    // a typo and a colour the palette cannot render.
    if (!isSplitColor(patch.color)) throw new Error(`Invalid split colour: ${String(patch.color)}`);
    db.runSync("UPDATE routine_splits SET color = ? WHERE id = ?", [patch.color, id]);
  }
}
```

Note `createSplit` now derives `"order"` from `rows.length`, replacing the separate `SELECT id FROM routine_splits` count — same value, one query.

- [ ] **Step 5: Pass the colour through the hook**

In `src/hooks/useRoutine.ts`, widen `addSplit`:

```ts
  const addSplit = useCallback(
    (name: string, mode: SplitMode, modality: Modality, color?: SplitColor): number => {
      const id = createSplit({ name, mode, modality, color });
      refreshAll();
      return id;
    },
    [refreshAll]
  );
```

Import the type: `import type { SplitColor } from "@/data/splitColors";`

- [ ] **Step 6: Run tests and typecheck**

Run: `npx jest src/db/__tests__/queries.test.ts && npx tsc --noEmit`
Expected: queries tests PASS. `tsc` will now flag `src/db/importExport.ts` / `importExportApply.ts` for the missing `color` on split payloads — that is Task 5. If `tsc` reports errors **only** in those two files, proceed.

- [ ] **Step 7: Commit**

```bash
git add src/types/routine.ts src/types/index.ts src/db/queries.ts src/hooks/useRoutine.ts src/db/__tests__/queries.test.ts
git commit -m "feat(db): read and write split colour, move DayScheduleEntry to types"
```

---

### Task 5: Export format v7 carries the colour

**Files:**
- Modify: `src/db/importExport.ts:9` (version), `:89-98` (`ExportedSplit`), `:176-197` (the split query and mapping)
- Modify: `src/db/importExportApply.ts:394-400` (the split INSERT)
- Test: `src/db/importExport.test.ts`

**Interfaces:**
- Consumes: `isSplitColor`, `DEFAULT_SPLIT_COLOR`, `SplitColor` from Task 1.
- Produces: `CURRENT_EXPORT_FORMAT_VERSION = 7`; `ExportedSplit.color: SplitColor`.

**Note:** `src/db/importExport.ts:151` already rejects any payload whose `exportFormatVersion` differs from the current one, so v6 backups become unimportable. That is the repo's established behaviour for a format bump, not a regression introduced here.

- [ ] **Step 1: Write the failing test**

Add to `src/db/importExport.test.ts`:

```ts
  it("exports at format version 7", () => {
    expect(CURRENT_EXPORT_FORMAT_VERSION).toBe(7);
  });

  it("round-trips a split's colour", () => {
    const id = createSplit({ name: "Ciclo", mode: "cyclic", modality: "musculacao", color: "indigo" });
    const payload = buildExportPayload();
    const exported = payload.routineSplits.find((s) => s.name === "Ciclo");
    expect(exported!.color).toBe("indigo");

    deleteSplit(id);
    applyImportPayload(payload, "merge");
    expect(getSplits().find((s) => s.name === "Ciclo")!.color).toBe("indigo");
  });

  // A payload hand-edited, or written by a future build with a wider palette,
  // must import rather than abort — the colour is decoration, not data.
  it("falls back to terra when an imported colour is unknown", () => {
    const payload = buildExportPayload();
    payload.routineSplits.push({
      uuid: "uuid-import-unknown-colour",
      name: "Importado",
      mode: "cyclic",
      modality: "musculacao",
      anchor_date: null,
      rest_weekdays: [],
      order: 99,
      color: "roxo" as never,
      units: [],
    });

    applyImportPayload(payload, "merge");
    expect(getSplits().find((s) => s.name === "Importado")!.color).toBe("terra");
  });
```

Ensure the test file imports `createSplit`, `deleteSplit`, `getSplits`, `buildExportPayload`, `applyImportPayload` and `CURRENT_EXPORT_FORMAT_VERSION`, matching the names the file already uses for its other cases.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/importExport.test.ts -t "colour"`
Expected: FAIL — `CURRENT_EXPORT_FORMAT_VERSION` is 6, and `exported.color` is `undefined`.

- [ ] **Step 3: Bump and widen the export**

`src/db/importExport.ts` line 9:

```ts
export const CURRENT_EXPORT_FORMAT_VERSION = 7;
```

Add the import:

```ts
import { isSplitColor, DEFAULT_SPLIT_COLOR, type SplitColor } from "../data/splitColors";
```

Add the field to `ExportedSplit` (line ~89):

```ts
export interface ExportedSplit {
  uuid: string;
  name: string;
  mode: SplitMode;
  modality: Modality;
  anchor_date: string | null;
  rest_weekdays: number[];
  order: number;
  color: SplitColor;
  units: ExportedUnit[];
}
```

In the split query's row type (line ~176-181) add `color: string | null;`, and in the mapped object (line ~188-197) add:

```ts
      color: isSplitColor(sp.color) ? sp.color : DEFAULT_SPLIT_COLOR,
```

- [ ] **Step 4: Widen the import**

In `src/db/importExportApply.ts`, add to the imports:

```ts
import { isSplitColor, DEFAULT_SPLIT_COLOR } from "../data/splitColors";
```

Replace the split INSERT at line ~397-400:

```ts
      const result = db.runSync(
        `INSERT INTO routine_splits (name, mode, modality, anchor_date, rest_weekdays, "order", uuid, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          split.name,
          split.mode,
          split.modality,
          split.anchor_date,
          split.rest_weekdays.join(","),
          split.order,
          split.uuid,
          // Decoration, not data: an unrecognised slug must not abort an import
          // that is otherwise carrying real training history.
          isSplitColor(split.color) ? split.color : DEFAULT_SPLIT_COLOR,
        ]
      );
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx jest src/db/importExport.test.ts && npx tsc --noEmit`
Expected: import/export tests PASS; `tsc` clean.

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS. The data layer is now complete and self-consistent; everything after this point is UI.

- [ ] **Step 7: Commit**

```bash
git add src/db/importExport.ts src/db/importExportApply.ts src/db/importExport.test.ts
git commit -m "feat(db): export format v7 carries split colour"
```

---

### Task 6: Next-workout lookahead util

The rest-day card announces the next scheduled workout. Pure function, so the walk and its give-up bound are testable without a database.

**Files:**
- Create: `src/utils/routineLookahead.ts`
- Test: `src/utils/routineLookahead.test.ts`

**Interfaces:**
- Consumes: `DayScheduleEntry` from `src/types` (Task 4); `addDays` from `src/utils/cycle.ts`.
- Produces:
  - `interface NextWorkout { dateISO: string; unitLabel: string; splitName: string; splitId: number }`
  - `nextWorkoutAfter(fromISO: string, resolve: (iso: string) => DayScheduleEntry[], opts?: { splitId?: number | null; maxDays?: number }): NextWorkout | null` — walks forward starting the day **after** `fromISO`, up to `maxDays` (default 14), returning the first workout entry, filtered to `splitId` when given.

- [ ] **Step 1: Write the failing test**

Create `src/utils/routineLookahead.test.ts`:

```ts
import { nextWorkoutAfter } from "./routineLookahead";
import type { DayScheduleEntry, RoutineSplit, RoutineUnit } from "@/types";

function split(id: number, name: string): RoutineSplit {
  return {
    id, name, mode: "cyclic", modality: "musculacao",
    anchor_date: "2026-08-01", rest_weekdays: [], order: id,
    uuid: `uuid-${id}`, color: "terra",
  };
}

function unit(id: number, label: string): RoutineUnit {
  return { id, split_id: 1, ordinal: 0, label };
}

const ABC = split(1, "ABC");
const CORRIDA = split(2, "Corrida");

describe("nextWorkoutAfter", () => {
  it("finds the next workout and skips the day it starts from", () => {
    // 05 is a workout, but we ask what comes *after* it; 06 rests, 07 trains.
    const schedule: Record<string, DayScheduleEntry[]> = {
      "2026-08-05": [{ split: ABC, unit: unit(10, "Push A"), status: "workout" }],
      "2026-08-06": [{ split: ABC, unit: null, status: "rest" }],
      "2026-08-07": [{ split: ABC, unit: unit(11, "Pull B"), status: "workout" }],
    };
    expect(nextWorkoutAfter("2026-08-05", (iso) => schedule[iso] ?? [])).toEqual({
      dateISO: "2026-08-07",
      unitLabel: "Pull B",
      splitName: "ABC",
      splitId: 1,
    });
  });

  it("returns null when nothing is scheduled within the window", () => {
    expect(nextWorkoutAfter("2026-08-05", () => [])).toBeNull();
  });

  // The bound has to be real: an all-rest split would otherwise walk forever.
  it("gives up after maxDays and does not look past it", () => {
    const probed: string[] = [];
    const result = nextWorkoutAfter(
      "2026-08-05",
      (iso) => {
        probed.push(iso);
        return [{ split: ABC, unit: null, status: "rest" }];
      },
      { maxDays: 3 }
    );
    expect(result).toBeNull();
    expect(probed).toEqual(["2026-08-06", "2026-08-07", "2026-08-08"]);
  });

  it("honours a split filter, ignoring other splits' workouts", () => {
    const schedule: Record<string, DayScheduleEntry[]> = {
      "2026-08-06": [{ split: CORRIDA, unit: unit(20, "Longo 8km"), status: "workout" }],
      "2026-08-07": [{ split: ABC, unit: unit(11, "Pull B"), status: "workout" }],
    };
    const resolve = (iso: string) => schedule[iso] ?? [];
    expect(nextWorkoutAfter("2026-08-05", resolve, { splitId: 1 })!.dateISO).toBe("2026-08-07");
    expect(nextWorkoutAfter("2026-08-05", resolve, { splitId: 2 })!.dateISO).toBe("2026-08-06");
    expect(nextWorkoutAfter("2026-08-05", resolve, { splitId: null })!.dateISO).toBe("2026-08-06");
  });

  // status "workout" with a null unit is a shape the schedule should never
  // produce, but it must not crash into `unitLabel: undefined` if it ever does.
  it("ignores a workout entry with no unit", () => {
    const schedule: Record<string, DayScheduleEntry[]> = {
      "2026-08-06": [{ split: ABC, unit: null, status: "workout" }],
      "2026-08-07": [{ split: ABC, unit: unit(11, "Pull B"), status: "workout" }],
    };
    expect(nextWorkoutAfter("2026-08-05", (iso) => schedule[iso] ?? [])!.dateISO).toBe("2026-08-07");
  });

  it("crosses a month boundary", () => {
    const schedule: Record<string, DayScheduleEntry[]> = {
      "2026-09-01": [{ split: ABC, unit: unit(12, "Legs"), status: "workout" }],
    };
    expect(nextWorkoutAfter("2026-08-31", (iso) => schedule[iso] ?? [])!.dateISO).toBe("2026-09-01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/routineLookahead.test.ts`
Expected: FAIL — `Cannot find module './routineLookahead'`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/routineLookahead.ts`:

```ts
import { addDays } from "./cycle";
import type { DayScheduleEntry } from "@/types";

export interface NextWorkout {
  dateISO: string;
  unitLabel: string;
  splitName: string;
  splitId: number;
}

/**
 * The first scheduled workout strictly after `fromISO`, or null if none turns up
 * within `maxDays`. Bounded because a split with every weekday marked as rest
 * (or one with no anchor date) never produces a workout, and an unbounded walk
 * would hang the render that calls this.
 */
export function nextWorkoutAfter(
  fromISO: string,
  resolve: (iso: string) => DayScheduleEntry[],
  opts?: { splitId?: number | null; maxDays?: number }
): NextWorkout | null {
  const maxDays = opts?.maxDays ?? 14;
  const splitId = opts?.splitId ?? null;

  for (let offset = 1; offset <= maxDays; offset++) {
    const dateISO = addDays(fromISO, offset);
    for (const entry of resolve(dateISO)) {
      if (entry.status !== "workout" || entry.unit == null) continue;
      if (splitId != null && entry.split.id !== splitId) continue;
      return {
        dateISO,
        unitLabel: entry.unit.label,
        splitName: entry.split.name,
        splitId: entry.split.id,
      };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/routineLookahead.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/routineLookahead.ts src/utils/routineLookahead.test.ts
git commit -m "feat(routine): add bounded next-workout lookahead"
```

---

### Task 7: `WeekGrid` responsive primitive

**Files:**
- Create: `src/components/WeekGrid.tsx`

**Interfaces:**
- Consumes: `monthGridCells` / `weekDaysAround` are called by *consumers*, not by `WeekGrid` — it receives a flat cell array. `todayISO` from `src/utils/cycle.ts`.
- Produces:

```ts
export interface WeekGridCellState { isToday: boolean; isSelected: boolean; isCompact: boolean }
export interface WeekGridProps {
  /** ISO dates; null = filler. Length must be a multiple of 7. */
  days: (string | null)[];
  selectedISO?: string | null;
  onSelectDay?: (iso: string) => void;
  /** Rendered inside the cell, under the day number. */
  renderCellContent?: (iso: string, state: WeekGridCellState) => ReactNode;
  /** Top-right corner glyph — used for the trained/rest override mark. */
  renderCellCorner?: (iso: string, state: WeekGridCellState) => ReactNode;
  showWeekdayHeader?: boolean;
}
export const WEEK_GRID_WIDE_BREAKPOINT = 640;
export function WeekGrid(props: WeekGridProps): JSX.Element;
```

- [ ] **Step 1: Write the component**

Create `src/components/WeekGrid.tsx`:

```tsx
import type { ReactNode } from "react";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { todayISO } from "@/utils/cycle";

/** Below this width the calendar drops unit labels and defaults to the week
 *  strip. Measured on the window, not the platform: a narrow browser window is
 *  as cramped as a phone, and this app has to work in both. */
export const WEEK_GRID_WIDE_BREAKPOINT = 640;

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export interface WeekGridCellState {
  isToday: boolean;
  isSelected: boolean;
  isCompact: boolean;
}

export interface WeekGridProps {
  days: (string | null)[];
  selectedISO?: string | null;
  onSelectDay?: (iso: string) => void;
  renderCellContent?: (iso: string, state: WeekGridCellState) => ReactNode;
  renderCellCorner?: (iso: string, state: WeekGridCellState) => ReactNode;
  showWeekdayHeader?: boolean;
}

export function WeekGrid({
  days,
  selectedISO = null,
  onSelectDay,
  renderCellContent,
  renderCellCorner,
  showWeekdayHeader = true,
}: WeekGridProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < WEEK_GRID_WIDE_BREAKPOINT;
  const today = todayISO();

  // 44px is the minimum comfortable tap target; the old grid's aspectRatio 0.78
  // produced ~53×68 cells stuffed with 8px text, which is the bug being fixed.
  const cellHeight = isCompact ? 60 : 68;

  return (
    <View>
      {showWeekdayHeader && (
        <View className="flex-row mb-1">
          {WEEKDAYS.map((w) => (
            <View key={w} className="flex-1 items-center">
              <Text style={{ color: "#bdb8aa", fontSize: 11, fontWeight: "600" }}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row flex-wrap">
        {days.map((iso, i) => {
          if (iso == null) {
            return <View key={`pad-${i}`} style={{ width: `${100 / 7}%`, height: cellHeight }} />;
          }

          const isToday = iso === today;
          const isSelected = iso === selectedISO;
          const state: WeekGridCellState = { isToday, isSelected, isCompact };
          const dayNumber = Number(iso.slice(8, 10));

          return (
            <TouchableOpacity
              key={iso}
              style={{ width: `${100 / 7}%`, height: cellHeight, padding: 2 }}
              onPress={onSelectDay ? () => onSelectDay(iso) : undefined}
              disabled={!onSelectDay}
              activeOpacity={0.7}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingTop: 5,
                  alignItems: "center",
                  backgroundColor: isSelected ? "#26241f" : "#ffffff",
                  borderWidth: isToday ? 1.5 : 1,
                  borderColor: isToday ? "#26241f" : "#ddd8ce",
                }}
              >
                {renderCellCorner && (
                  <View style={{ position: "absolute", top: 3, right: 3 }}>
                    {renderCellCorner(iso, state)}
                  </View>
                )}
                <Text
                  style={{
                    color: isSelected ? "#ffffff" : "#26241f",
                    fontSize: 15,
                    fontWeight: isToday || isSelected ? "700" : "500",
                  }}
                >
                  {dayNumber}
                </Text>
                {renderCellContent?.(iso, state)}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify it compiles and violates no style rule**

Run: `npx tsc --noEmit && npx jest src/components/styleProps.test.ts`
Expected: both clean. The `styleProps` scan matters here — every `style` prop above is an object literal, never a function.

- [ ] **Step 3: Commit**

```bash
git add src/components/WeekGrid.tsx
git commit -m "feat(routine): add responsive WeekGrid primitive"
```

---

### Task 8: `SplitColorPicker`, wired into split creation and editing

Ships the colour end-to-end through the UI before anything depends on it visually.

**Files:**
- Create: `src/components/SplitColorPicker.tsx`
- Modify: `app/routine/new-split.tsx`

**Interfaces:**
- Consumes: `SPLIT_COLOR_ORDER`, `SPLIT_COLORS`, `SplitColor` (Task 1); `useRoutine().addSplit(name, mode, modality, color?)` (Task 4).
- Produces: `SplitColorPicker({ value, onChange }: { value: SplitColor; onChange: (c: SplitColor) => void })`.

- [ ] **Step 1: Write the component**

Create `src/components/SplitColorPicker.tsx`:

```tsx
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SPLIT_COLORS, SPLIT_COLOR_ORDER, type SplitColor } from "@/data/splitColors";

interface Props {
  value: SplitColor;
  onChange: (color: SplitColor) => void;
  label?: string;
}

export function SplitColorPicker({ value, onChange, label = "Cor no calendário" }: Props) {
  return (
    <View>
      <Text className="text-ink-soft text-xs font-semibold mb-2">{label}</Text>
      {/* Left-aligned and content-sized: these are controls, not a layout to fill. */}
      <View className="flex-row" style={{ gap: 10 }}>
        {SPLIT_COLOR_ORDER.map((color) => {
          const selected = color === value;
          return (
            <TouchableOpacity
              key={color}
              onPress={() => onChange(color)}
              accessibilityLabel={SPLIT_COLORS[color].label}
              hitSlop={6}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: SPLIT_COLORS[color].hex,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: selected ? 2 : 0,
                borderColor: "#26241f",
              }}
            >
              {selected && <MaterialCommunityIcons name="check" size={17} color="#ffffff" />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Add the picker to split creation**

In `app/routine/new-split.tsx`: add state, render the picker in the step that already collects name/mode/modality, and pass the colour to `addSplit`.

```tsx
import { SplitColorPicker } from "@/components/SplitColorPicker";
import { SPLIT_COLOR_ORDER, type SplitColor } from "@/data/splitColors";
```

```tsx
  // Seeded from the palette position the next split would get anyway, so the
  // picker opens on the colour the user would receive by doing nothing.
  const [color, setColor] = useState<SplitColor>(
    () => SPLIT_COLOR_ORDER[r.splits.length % SPLIT_COLOR_ORDER.length]
  );
```

Render `<SplitColorPicker value={color} onChange={setColor} />` in that step's form, and change the creation call to pass it:

```tsx
  const splitId = r.addSplit(name.trim(), mode, modality, color);
```

Read the file first to place these against its actual step structure and variable names — do not guess at them.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint app/routine/new-split.tsx src/components/SplitColorPicker.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/SplitColorPicker.tsx app/routine/new-split.tsx
git commit -m "feat(routine): pick a split's calendar colour at creation"
```

---

### Task 9: `SplitFilterChips`

**Files:**
- Create: `src/components/SplitFilterChips.tsx`

**Interfaces:**
- Consumes: `splitColorHex` (Task 1); `RoutineSplit` from `src/types`.
- Produces: `SplitFilterChips({ splits, activeSplitId, onChange }: { splits: RoutineSplit[]; activeSplitId: number | null; onChange: (id: number | null) => void })`.

- [ ] **Step 1: Write the component**

Create `src/components/SplitFilterChips.tsx`:

```tsx
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { splitColorHex } from "@/data/splitColors";
import type { RoutineSplit } from "@/types";

interface Props {
  splits: RoutineSplit[];
  activeSplitId: number | null;
  onChange: (splitId: number | null) => void;
}

function Chip({
  label,
  dotColor,
  active,
  onPress,
}: {
  label: string;
  dotColor: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center px-3 py-1.5 rounded-full"
      style={{
        gap: 6,
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : "transparent",
      }}
    >
      {dotColor && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            // Filled when active, hollow when not — so the chip carries the
            // split's colour in both states without shouting in either.
            backgroundColor: active ? dotColor : "transparent",
            borderWidth: active ? 0 : 1.5,
            borderColor: dotColor,
          }}
        />
      )}
      <Text style={{ color: active ? "#ffffff" : "#5c594f", fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SplitFilterChips({ splits, activeSplitId, onChange }: Props) {
  // One split needs no filter — a lone chip that only ever selects itself is noise.
  if (splits.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
    >
      <Chip
        label="Todos"
        dotColor={null}
        active={activeSplitId == null}
        onPress={() => onChange(null)}
      />
      {splits.map((split) => (
        <Chip
          key={split.id}
          label={split.name}
          dotColor={splitColorHex(split.color)}
          active={activeSplitId === split.id}
          // Tapping the active chip clears the filter — the same gesture in and out.
          onPress={() => onChange(activeSplitId === split.id ? null : split.id)}
        />
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src/components/SplitFilterChips.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/SplitFilterChips.tsx
git commit -m "feat(routine): add the split filter chips"
```

---

### Task 10: `DayPlanCard`

**Files:**
- Create: `src/components/DayPlanCard.tsx`

**Interfaces:**
- Consumes: `splitColorHex` (Task 1); `DayScheduleEntry` from `src/types` (Task 4); `formatDistanceValue`, `formatEffort`, `isDistanceModality` from `src/data/modalities`.
- Produces:
  - `describeDayTarget(t: RoutineUnitExercise, modality: Modality): string` — exported so the split editor can reuse the exact same string
  - `DayPlanCard({ entry, exercises, programLabel, onStart, onEdit })`
  - `DayRestRow({ entry })` — the one-line rest form

- [ ] **Step 1: Write the component**

Create `src/components/DayPlanCard.tsx`:

```tsx
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { splitColorHex } from "@/data/splitColors";
import { formatDistanceValue, formatEffort } from "@/data/modalities";
import type { DayScheduleEntry, Modality, RoutineUnitExercise } from "@/types";

/** The one-line target summary. Mirrors describeTarget in app/session/new.tsx so
 *  the plan and the wizard read identically for the same exercise. */
export function describeDayTarget(t: RoutineUnitExercise, modality: Modality): string {
  if (t.target_distance_km) {
    const effort = formatEffort(t.target_pace_sec, modality);
    return `${formatDistanceValue(t.target_distance_km, modality)}${effort ? ` · ${effort}` : ""}`;
  }
  if (!t.target_sets) return "—";
  const reps = t.target_reps_max ? `${t.target_reps}–${t.target_reps_max}` : `${t.target_reps}`;
  const weight = t.target_weight_kg ? ` @ ${t.target_weight_kg}kg` : "";
  return `${t.target_sets} × ${reps}${weight}`;
}

export function DayRestRow({ entry }: { entry: DayScheduleEntry }) {
  return (
    <View
      className="flex-row items-center px-3 py-2.5 rounded-xl mb-2"
      style={{ gap: 8, borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          borderWidth: 1.5,
          borderColor: splitColorHex(entry.split.color),
        }}
      />
      <Text className="text-ink-mute text-xs flex-1" numberOfLines={1}>
        {entry.split.name}
      </Text>
      <Text className="text-ink-faint text-xs">Descanso</Text>
    </View>
  );
}

interface Props {
  entry: DayScheduleEntry;
  /** Already resolved through the active program's current week. */
  exercises: RoutineUnitExercise[];
  /** e.g. "Semana 3 de 8", or null when no program covers this date. */
  programLabel: string | null;
  onStart: () => void;
  onEdit: () => void;
}

export function DayPlanCard({ entry, exercises, programLabel, onStart, onEdit }: Props) {
  const hex = splitColorHex(entry.split.color);

  return (
    <View
      className="bg-surface-card rounded-2xl mb-3 overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      {/* The split's colour as a left edge: identity without a coloured field
          that would fight the numbers for attention. */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 4, backgroundColor: hex }} />
        <View className="flex-1 px-4 py-3">
          <View className="flex-row items-start" style={{ gap: 8 }}>
            <View className="flex-1">
              <Text
                className="text-ink font-display font-semibold text-xl"
                style={{ letterSpacing: -0.3 }}
                numberOfLines={1}
              >
                {entry.unit?.label ?? entry.split.name}
              </Text>
              {programLabel && <Text className="text-ink-mute text-xs mt-0.5">{programLabel}</Text>}
            </View>
            <View className="flex-row items-center" style={{ gap: 4, flexShrink: 0 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: hex }} />
              <Text className="text-ink-mute text-xs" numberOfLines={1}>
                {entry.split.name}
              </Text>
            </View>
          </View>

          {exercises.length > 0 && (
            <View className="mt-3" style={{ gap: 6 }}>
              {exercises.map((ex) => (
                <View key={ex.id} className="flex-row items-baseline" style={{ gap: 8 }}>
                  <Text className="text-ink-soft text-sm flex-1" numberOfLines={1}>
                    {ex.exercise_name}
                  </Text>
                  {/* font-data (JetBrains Mono) so targets align down the column. */}
                  <Text className="text-ink font-data text-xs" style={{ flexShrink: 0 }}>
                    {describeDayTarget(ex, entry.split.modality)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {exercises.length === 0 && (
            <Text className="text-ink-faint text-xs mt-2">Nenhum exercício definido para este dia.</Text>
          )}

          <View className="flex-row items-center mt-4" style={{ gap: 12 }}>
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl items-center bg-brand-500"
              onPress={onStart}
              activeOpacity={0.85}
            >
              <Text className="text-white text-sm font-semibold">Iniciar treino</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center py-3"
              style={{ gap: 2 }}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <Text className="text-ink-mute text-xs font-medium">editar</Text>
              <MaterialCommunityIcons name="chevron-right" size={15} color="#928d80" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx jest src/components/styleProps.test.ts && npx eslint src/components/DayPlanCard.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayPlanCard.tsx
git commit -m "feat(routine): add the day plan card"
```

---

### Task 11: Rewrite `RoutineCalendar` over `WeekGrid`

**Files:**
- Modify: `src/components/RoutineCalendar.tsx` (full rewrite)

**Interfaces:**
- Consumes: `WeekGrid`, `WEEK_GRID_WIDE_BREAKPOINT` (Task 7); `weekDaysAround`, `monthGridCells` (Task 2); `splitColorHex` (Task 1); `DayScheduleEntry`, `OverrideStatus`.
- Produces:

```ts
interface RoutineCalendarProps {
  monthDate: Date;
  selectedISO: string;
  activeSplitId: number | null;
  scheduleForDate: (iso: string) => { planned: DayScheduleEntry[]; override: OverrideStatus | null };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (iso: string) => void;
}
export function RoutineCalendar(props: RoutineCalendarProps): JSX.Element;
```

This is a **breaking prop change** — the old component took no `selectedISO` and no `activeSplitId`. `app/(tabs)/routine.tsx` is its only consumer and is rewritten in Task 12; expect `tsc` to complain about that file until then.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/components/RoutineCalendar.tsx`:

```tsx
import { useState } from "react";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { WeekGrid, WEEK_GRID_WIDE_BREAKPOINT, type WeekGridCellState } from "@/components/WeekGrid";
import { splitColorHex } from "@/data/splitColors";
import { monthGridCells, weekDaysAround } from "@/utils/cycle";
import type { DayScheduleEntry, OverrideStatus } from "@/types";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Beyond this, a cell shows "+N" instead of more dots. Three 6px pips plus gaps
 *  is what fits a phone cell without shrinking the dots below visibility. */
const MAX_PIPS = 3;

interface Props {
  monthDate: Date;
  selectedISO: string;
  activeSplitId: number | null;
  scheduleForDate: (iso: string) => { planned: DayScheduleEntry[]; override: OverrideStatus | null };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (iso: string) => void;
}

export function RoutineCalendar({
  monthDate,
  selectedISO,
  activeSplitId,
  scheduleForDate,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < WEEK_GRID_WIDE_BREAKPOINT;
  // Wide viewports have room for the month, so it opens; phones start on the
  // strip and expand on demand.
  const [monthExpanded, setMonthExpanded] = useState(!isCompact);
  const showMonth = !isCompact || monthExpanded;

  const workoutsFor = (iso: string) =>
    scheduleForDate(iso)
      .planned.filter((p) => p.status === "workout")
      .filter((p) => activeSplitId == null || p.split.id === activeSplitId);

  const renderPips = (iso: string, state: WeekGridCellState) => {
    const workouts = workoutsFor(iso);
    if (workouts.length === 0) {
      return (
        <Text style={{ color: state.isSelected ? "#5c594f" : "#ddd8ce", fontSize: 12, marginTop: 3 }}>
          ·
        </Text>
      );
    }
    const shown = workouts.slice(0, MAX_PIPS);
    return (
      <View style={{ alignItems: "center", marginTop: 4 }}>
        <View className="flex-row" style={{ gap: 3 }}>
          {shown.map((p) => (
            <View
              key={p.split.id}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: splitColorHex(p.split.color),
              }}
            />
          ))}
        </View>
        {workouts.length > MAX_PIPS && (
          <Text
            style={{
              color: state.isSelected ? "#bdb8aa" : "#928d80",
              fontSize: 10,
              fontWeight: "600",
              marginTop: 1,
            }}
          >
            +{workouts.length - MAX_PIPS}
          </Text>
        )}
        {/* Unit labels only where there is room for them to be readable. The old
            grid rendered these at 8px on every viewport — the bug this fixes. */}
        {!state.isCompact && shown.length === 1 && shown[0].unit && (
          <Text
            numberOfLines={1}
            style={{
              color: state.isSelected ? "#ddd8ce" : "#928d80",
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
              maxWidth: "100%",
            }}
          >
            {shown[0].unit.label}
          </Text>
        )}
      </View>
    );
  };

  const renderOverride = (iso: string) => {
    const { override } = scheduleForDate(iso);
    if (!override) return null;
    return (
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: override === "trained" ? "#2f9e6e" : "#bf3b30",
        }}
      />
    );
  };

  return (
    <View className="mx-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center" style={{ gap: 2 }}>
          {showMonth && (
            <TouchableOpacity onPress={onPrevMonth} hitSlop={10} className="p-1">
              <MaterialCommunityIcons name="chevron-left" size={22} color="#928d80" />
            </TouchableOpacity>
          )}
          <Text
            className="text-ink font-display font-semibold text-lg"
            style={{ letterSpacing: -0.3 }}
          >
            {MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
          </Text>
          {showMonth && (
            <TouchableOpacity onPress={onNextMonth} hitSlop={10} className="p-1">
              <MaterialCommunityIcons name="chevron-right" size={22} color="#928d80" />
            </TouchableOpacity>
          )}
        </View>

        {isCompact && (
          <TouchableOpacity
            onPress={() => setMonthExpanded((v) => !v)}
            className="flex-row items-center px-2 py-1"
            style={{ gap: 2 }}
            hitSlop={8}
          >
            <Text className="text-ink-mute text-xs font-medium">mês</Text>
            <MaterialCommunityIcons
              name={monthExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#928d80"
            />
          </TouchableOpacity>
        )}
      </View>

      <WeekGrid
        days={
          showMonth
            ? monthGridCells(monthDate.getFullYear(), monthDate.getMonth())
            : weekDaysAround(selectedISO)
        }
        selectedISO={selectedISO}
        onSelectDay={onSelectDate}
        renderCellContent={renderPips}
        renderCellCorner={renderOverride}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verify the component itself compiles**

Run: `npx eslint src/components/RoutineCalendar.tsx && npx jest src/components/styleProps.test.ts`
Expected: clean. `npx tsc --noEmit` will still report errors in `app/(tabs)/routine.tsx` (old props) — that is expected and fixed in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/components/RoutineCalendar.tsx
git commit -m "feat(routine): rebuild the calendar on WeekGrid with colour pips"
```

---

### Task 12: Rewrite the Rotina tab and delete `DayDetailModal`

**Files:**
- Modify: `app/(tabs)/routine.tsx` (full rewrite)
- Delete: `src/components/DayDetailModal.tsx`

**Interfaces:**
- Consumes: `RoutineCalendar` (Task 11), `SplitFilterChips` (Task 9), `DayPlanCard` / `DayRestRow` (Task 10), `nextWorkoutAfter` (Task 6), `useRoutine()` including `resolvedTargetsForUnit` and `programsBySplit`, `todayISO` / `weekIndexSince` from `src/utils/cycle`.
- Produces: nothing consumed elsewhere. `Iniciar treino` navigates to `/session/new` with `splitId`, `modality` and `date` params — the contract Task 13 implements. **Task 13 must land before `Iniciar treino` actually skips steps**; until then the wizard ignores the params and opens at `modality`, which is a graceful degradation, not a crash.

- [ ] **Step 1: Rewrite the screen**

Replace the entire contents of `app/(tabs)/routine.tsx`:

```tsx
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { RoutineCalendar } from "@/components/RoutineCalendar";
import { SplitFilterChips } from "@/components/SplitFilterChips";
import { DayPlanCard, DayRestRow } from "@/components/DayPlanCard";
import { useRoutine } from "@/hooks/useRoutine";
import { nextWorkoutAfter } from "@/utils/routineLookahead";
import { todayISO, weekIndexSince } from "@/utils/cycle";

const WD_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDayHeading(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export default function RoutineScreen() {
  const r = useRoutine();
  const today = todayISO();
  const [selectedISO, setSelectedISO] = useState(today);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [activeSplitId, setActiveSplitId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      r.refreshAll();
    }, [r.refreshAll])
  );

  const activeSplit = activeSplitId == null ? null : r.splits.find((s) => s.id === activeSplitId) ?? null;

  const planned = r
    .scheduleForDate(selectedISO)
    .planned.filter((p) => activeSplitId == null || p.split.id === activeSplitId);
  const override = r.scheduleForDate(selectedISO).override;
  const workouts = planned.filter((p) => p.status === "workout" && p.unit != null);
  const rests = planned.filter((p) => p.status === "rest");

  // "Semana 3 de 8" for the split's active program, when one covers this date.
  const programLabelFor = (splitId: number): string | null => {
    const split = r.splits.find((s) => s.id === splitId);
    const active = (r.programsBySplit[splitId] ?? []).find((p) => p.is_active);
    if (!split?.anchor_date || !active) return null;
    const weekIndex = weekIndexSince(split.anchor_date, selectedISO);
    if (weekIndex < 0 || weekIndex >= active.total_weeks) return null;
    return `Semana ${weekIndex + 1} de ${active.total_weeks}`;
  };

  const upcoming =
    workouts.length === 0
      ? nextWorkoutAfter(selectedISO, (iso) => r.scheduleForDate(iso).planned, {
          splitId: activeSplitId,
        })
      : null;

  const selectDate = (iso: string) => {
    setSelectedISO(iso);
    // Keep the month header in step when a tap lands on a padded neighbour month.
    const d = new Date(iso + "T00:00:00");
    if (d.getMonth() !== monthDate.getMonth() || d.getFullYear() !== monthDate.getFullYear()) {
      setMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-3 pb-3 flex-row items-start">
          <View className="flex-1">
            <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 2 }}>
              TRAINING SPLIT
            </Text>
            <Text className="text-ink font-display font-semibold text-3xl" style={{ letterSpacing: -0.6 }}>
              Minha Rotina
            </Text>
          </View>
          <TouchableOpacity
            className="px-3 py-2 rounded-xl bg-brand-500"
            onPress={() => router.push("/routine/new-split")}
          >
            <Text className="text-white text-sm font-medium">+ Novo split</Text>
          </TouchableOpacity>
        </View>

        {r.splits.length === 0 ? (
          <View className="items-center justify-center px-8" style={{ paddingTop: 60 }}>
            <Text className="text-ink-soft text-base font-medium text-center">Monte seus splits</Text>
            <Text className="text-ink-mute text-sm mt-1 text-center">
              Crie splits cíclicos (rodízio) ou semanais (dias fixos) e veja tudo no calendário.
            </Text>
            <TouchableOpacity
              className="mt-4 px-4 py-2.5 rounded-xl bg-brand-500"
              onPress={() => router.push("/routine/new-split")}
            >
              <Text className="text-white text-sm font-medium">+ Criar split</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="pl-4 mb-1">
              <SplitFilterChips
                splits={r.splits}
                activeSplitId={activeSplitId}
                onChange={setActiveSplitId}
              />
            </View>

            {/* With a filter on, this is the only route to a split that happens
                to schedule nothing in view. Without it that split is unreachable
                from this tab, since the chips replaced the old split list. */}
            {activeSplit && (
              <TouchableOpacity
                className="flex-row items-center px-4 py-2"
                style={{ gap: 2 }}
                onPress={() => router.push(`/routine/${activeSplit.id}`)}
              >
                <Text className="text-ink-soft text-xs font-semibold">abrir {activeSplit.name}</Text>
                <MaterialCommunityIcons name="chevron-right" size={15} color="#5c594f" />
              </TouchableOpacity>
            )}

            <View style={{ height: 1, backgroundColor: "#ddd8ce", marginHorizontal: 16, marginVertical: 12 }} />

            <RoutineCalendar
              monthDate={monthDate}
              selectedISO={selectedISO}
              activeSplitId={activeSplitId}
              scheduleForDate={r.scheduleForDate}
              onPrevMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              onNextMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              onSelectDate={selectDate}
            />

            <View style={{ height: 1, backgroundColor: "#ddd8ce", marginHorizontal: 16, marginVertical: 16 }} />

            <View className="px-4">
              <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 2 }}>
                  {selectedISO === today
                    ? `HOJE · ${formatDayHeading(selectedISO).toUpperCase()}`
                    : formatDayHeading(selectedISO).toUpperCase()}
                </Text>
                <View className="flex-1" />
                {selectedISO !== today && (
                  <TouchableOpacity onPress={() => selectDate(today)} hitSlop={8}>
                    <Text className="text-ink-soft text-xs font-semibold">voltar para hoje</Text>
                  </TouchableOpacity>
                )}
              </View>

              {workouts.map((entry) => {
                const unit = entry.unit!;
                const { exercises } = r.resolvedTargetsForUnit(unit, entry.split, selectedISO);
                return (
                  <DayPlanCard
                    key={entry.split.id}
                    entry={entry}
                    exercises={exercises}
                    programLabel={programLabelFor(entry.split.id)}
                    onStart={() =>
                      router.push({
                        pathname: "/session/new",
                        params: {
                          splitId: String(entry.split.id),
                          modality: entry.split.modality,
                          date: selectedISO,
                        },
                      })
                    }
                    onEdit={() =>
                      router.push({
                        pathname: "/routine/[id]",
                        params: { id: String(entry.split.id), unitId: String(unit.id) },
                      })
                    }
                  />
                );
              })}

              {workouts.length === 0 && (
                <View
                  className="bg-surface-card rounded-2xl px-4 py-5 mb-3"
                  style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
                >
                  <Text className="text-ink font-display font-semibold text-xl" style={{ letterSpacing: -0.3 }}>
                    Descanso
                  </Text>
                  <Text className="text-ink-mute text-xs mt-1">
                    {upcoming
                      ? `próximo: ${upcoming.unitLabel}, ${formatDayHeading(upcoming.dateISO)}`
                      : "nenhum treino agendado nos próximos 14 dias"}
                  </Text>
                </View>
              )}

              {workouts.length > 0 && rests.map((entry) => <DayRestRow key={entry.split.id} entry={entry} />)}

              <View className="flex-row items-center mt-4" style={{ gap: 8 }}>
                <Text className="text-ink-mute text-xs">o que aconteceu:</Text>
                <OverrideButton
                  label="Treinei"
                  active={override === "trained"}
                  onPress={() =>
                    override === "trained"
                      ? r.clearOverrideMark(selectedISO)
                      : r.markOverride(selectedISO, "trained")
                  }
                />
                <OverrideButton
                  label="Descansei"
                  active={override === "rest"}
                  onPress={() =>
                    override === "rest"
                      ? r.clearOverrideMark(selectedISO)
                      : r.markOverride(selectedISO, "rest")
                  }
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Tapping the active state clears it, so "Limpar" needs no third button. */
function OverrideButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-3 py-1.5 rounded-full"
      style={{
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : "transparent",
      }}
    >
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Delete the modal**

```bash
git rm src/components/DayDetailModal.tsx
```

- [ ] **Step 3: Confirm nothing else imported it**

Run: `grep -rn "DayDetailModal" app src`
Expected: no output. If anything turns up, it must be removed before continuing — the file is gone.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx jest && npx eslint .`
Expected: all clean. The whole suite must pass here — this is the point where the tab is coherent again.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/routine.tsx src/components/DayDetailModal.tsx
git commit -m "feat(routine): today-first tab with an inline selected day"
```

---

### Task 13: `/session/new` accepts a prefilled split

**Files:**
- Modify: `app/session/new.tsx` (params, initial step, one-shot resolve effect)

**Interfaces:**
- Consumes: the params Task 12 sends — `splitId` (string), `modality` (string), `date` (ISO string).
- Produces: no new exports. Behaviour: with `splitId` present and no live session, the wizard opens at `resolvedDay` with the split, date and resolved unit already applied.

- [ ] **Step 1: Read the params**

In `app/session/new.tsx`, add `useLocalSearchParams` to the `expo-router` import and `useEffect`/`useRef` to the React import:

```tsx
import { useEffect, useReducer, useRef, useState, type ComponentProps } from "react";
import { router, useLocalSearchParams } from "expo-router";
```

Inside `NewSessionScreen`, immediately after `const recorder = useSessionRecorder();`:

```tsx
  // Prefill from the Rotina tab's "Iniciar treino": the split and date are
  // already known there, so the modality and split-choice steps are noise.
  const prefill = useLocalSearchParams<{ splitId?: string; modality?: string; date?: string }>();
  const prefillSplitId = prefill.splitId ? Number(prefill.splitId) : null;
  const hasPrefill =
    recorder.sessionId == null && prefillSplitId != null && !Number.isNaN(prefillSplitId);
```

- [ ] **Step 2: Seed the initial state from the params**

Change the four relevant `useState` initialisers (currently lines 91-97):

```tsx
  const [step, setStep] = useState<Step>(() => {
    // A live session always wins: a leftover recording must resume into details
    // rather than restart from a prefilled wizard step.
    if (recorder.sessionId != null) return "details";
    return hasPrefill ? "resolvedDay" : "modality";
  });
  const [date, setDate] = useState(() => resumedSession?.date ?? prefill.date ?? todayISO());
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [dateModalMonth, setDateModalMonth] = useState(() => new Date());

  const [modality, setModality] = useState<Modality>(
    () => recorder.modality ?? (hasPrefill ? (prefill.modality as Modality) : null) ?? "musculacao"
  );
  const [splitId, setSplitId] = useState<number | null>(
    () => recorder.splitId ?? (hasPrefill ? prefillSplitId : null)
  );
```

- [ ] **Step 3: Resolve the prefilled day once**

`resolvedUnit` / `resolvedExercises` start empty and are normally filled by `chooseSplit`, which the prefill path skips. Add this effect right after `applyEntryForSplit` is defined (after line ~197), so it can call it:

```tsx
  // One-shot: applyEntryForSplit needs the split row from useRoutine, which is
  // read synchronously on mount, so a single post-mount pass is enough. The ref
  // guard keeps a re-render (or the user changing the date) from re-resolving
  // over a manual choice made in changeUnit.
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (!hasPrefill || prefillApplied.current) return;
    const prefillSplit = r.splits.find((s) => s.id === prefillSplitId);
    if (!prefillSplit) return;
    prefillApplied.current = true;
    applyEntryForSplit(prefillSplit, date);
  });
```

- [ ] **Step 4: Verify the back-navigation edge**

Read the back handler around line ~293 (`else if (step === "changeUnit") setStep("resolvedDay")`) and confirm that stepping back from a prefilled `resolvedDay` behaves sanely: it should leave the screen (there is no `splitChoice` to return to in this flow), not strand the user on an empty step. If it currently falls through to `splitChoice`, guard it:

```tsx
    else if (step === "resolvedDay" && hasPrefill) router.back();
```

Place this branch against the handler's actual structure — read it before editing.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx jest && npx eslint app/session/new.tsx`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add app/session/new.tsx
git commit -m "feat(session): open the wizard on a prefilled split and date"
```

---

### Task 14: Split editor — identity panel and schedule card

**Files:**
- Create: `src/components/SplitIdentityPanel.tsx`
- Create: `src/components/CycleScheduleCard.tsx`
- Modify: `app/routine/[id].tsx`

**Interfaces:**
- Consumes: `WeekGrid` (Task 7), `SplitColorPicker` (Task 8), `splitColorHex` (Task 1), `weekDaysAround` (Task 2), `cyclicSlotIndex` / `weekday` / `todayISO` from `src/utils/cycle`, `modalityConfig` / `modalityLabel` from `src/data/modalities`, `WeekdayPicker` (existing, `size="compact"`).
- Produces:
  - `SplitIdentityPanel({ split, units, programSummary, onChangeColor })`
  - `CycleScheduleCard({ split, onToggleRestWeekday, onPressAnchor })`

- [ ] **Step 1: Write `SplitIdentityPanel`**

Create `src/components/SplitIdentityPanel.tsx`:

```tsx
import { useState, type ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { WeekGrid } from "@/components/WeekGrid";
import { SplitColorPicker } from "@/components/SplitColorPicker";
import { splitColorHex, type SplitColor } from "@/data/splitColors";
import { modalityConfig, modalityLabel } from "@/data/modalities";
import { cyclicSlotIndex, todayISO, weekDaysAround, weekday } from "@/utils/cycle";
import type { RoutineSplit, RoutineUnit } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const WD_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

interface Props {
  split: RoutineSplit;
  units: RoutineUnit[];
  /** e.g. "plano ativo" / "sem plano" — the caller knows about programs. */
  programSummary: string;
  onChangeColor: (color: SplitColor) => void;
}

/** Which unit this split prescribes on `dateISO`, or null when it rests.
 *  A local copy of the scheduling rule, narrowed to one split, so the panel
 *  stays a pure component instead of reaching for the whole useRoutine hook. */
function unitForDate(split: RoutineSplit, units: RoutineUnit[], dateISO: string): RoutineUnit | null {
  if (units.length === 0) return null;
  if (split.mode === "weekly") {
    return units.find((u) => u.ordinal === weekday(dateISO)) ?? null;
  }
  if (!split.anchor_date) return null;
  const idx = cyclicSlotIndex(split.anchor_date, dateISO, units.length, split.rest_weekdays);
  if (idx < 0) return null;
  return units.find((u) => u.ordinal === idx) ?? units[idx] ?? null;
}

export function SplitIdentityPanel({ split, units, programSummary, onChangeColor }: Props) {
  const [colorOpen, setColorOpen] = useState(false);
  const hex = splitColorHex(split.color);
  const today = todayISO();

  const restSummary =
    split.mode === "weekly"
      ? `${units.length} dia${units.length === 1 ? "" : "s"} na semana`
      : split.rest_weekdays.length > 0
        ? `descanso ${split.rest_weekdays.map((wd) => WD_SHORT[wd]).join(", ")}`
        : "sem descanso fixo";

  const summary = [
    `${units.length} dia${units.length === 1 ? "" : "s"}`,
    restSummary,
    programSummary,
  ].join(" · ");

  return (
    <View
      className="bg-surface-card rounded-2xl mb-5 overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 4, backgroundColor: hex }} />
        <View className="flex-1 px-4 py-3">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View
              className="flex-row items-center self-start px-2 py-1 rounded-full"
              style={{ backgroundColor: "#ebe7df", gap: 4 }}
            >
              <MaterialCommunityIcons
                name={modalityConfig(split.modality).icon as MciName}
                size={13}
                color="#5c594f"
              />
              <Text className="text-ink-mute text-xs">
                {modalityLabel(split.modality)} · {split.mode === "cyclic" ? "Cíclico" : "Semanal"}
              </Text>
            </View>
            <View className="flex-1" />
            <TouchableOpacity
              onPress={() => setColorOpen((v) => !v)}
              hitSlop={8}
              className="flex-row items-center"
              style={{ gap: 4 }}
            >
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: hex }} />
              <MaterialCommunityIcons
                name={colorOpen ? "chevron-up" : "chevron-down"}
                size={15}
                color="#928d80"
              />
            </TouchableOpacity>
          </View>

          {colorOpen && (
            <View className="mt-3">
              <SplitColorPicker value={split.color} onChange={onChangeColor} />
            </View>
          )}

          <Text className="text-ink-mute text-xs mt-3 mb-3">{summary}</Text>

          {/* The cycle's consequence, next to the controls that cause it: toggling
              a rest weekday or moving the anchor date re-lands these labels
              immediately, which the old text-only config could never show. */}
          <WeekGrid
            days={weekDaysAround(today)}
            selectedISO={null}
            renderCellContent={(iso, state) => {
              const unit = unitForDate(split, units, iso);
              if (!unit) {
                return <Text style={{ color: "#ddd8ce", fontSize: 12, marginTop: 3 }}>·</Text>;
              }
              const position = units.findIndex((u) => u.id === unit.id);
              return (
                <Text
                  numberOfLines={1}
                  style={{
                    color: state.isToday ? "#26241f" : "#928d80",
                    fontSize: 11,
                    fontWeight: "700",
                    marginTop: 3,
                  }}
                >
                  {split.mode === "cyclic" ? `D${position + 1}` : unit.label.slice(0, 4)}
                </Text>
              );
            }}
          />
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Write `CycleScheduleCard`**

Create `src/components/CycleScheduleCard.tsx`:

```tsx
import { Text, TouchableOpacity, View } from "react-native";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import type { RoutineSplit } from "@/types";

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatShortDate(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  split: RoutineSplit;
  onToggleRestWeekday: (weekday: number) => void;
  onPressAnchor: () => void;
}

export function CycleScheduleCard({ split, onToggleRestWeekday, onPressAnchor }: Props) {
  return (
    <View
      className="bg-surface-card rounded-2xl p-4 mb-6"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      <Text className="text-ink-mute text-xs mb-3" style={{ letterSpacing: 1, fontWeight: "700" }}>
        AGENDA
      </Text>

      <Text className="text-ink-soft text-xs font-semibold mb-2">Descanso fixo</Text>
      <View className="mb-4">
        <WeekdayPicker selected={split.rest_weekdays} onToggle={onToggleRestWeekday} />
      </View>

      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text className="text-ink-soft text-xs font-semibold">Dia 1 cai em</Text>
        <Text className="text-ink font-data text-xs flex-1">
          {split.anchor_date ? formatShortDate(split.anchor_date) : "não definido"}
        </Text>
        <TouchableOpacity onPress={onPressAnchor} hitSlop={8}>
          <Text className="text-ink-soft text-xs font-semibold" style={{ textDecorationLine: "underline" }}>
            {split.anchor_date ? "alterar" : "definir"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Recompose `app/routine/[id].tsx`**

Read the file first — this is a surgical edit to an existing 405-line screen, not a rewrite. Four changes:

1. **Accept the `unitId` deep link.** Widen the params and seed the expanded unit:

```tsx
  const { id, unitId } = useLocalSearchParams<{ id: string; unitId?: string }>();
  // Landing here from a day card's "editar ›" should open on that day.
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(() =>
    unitId ? Number(unitId) : null
  );
```

2. **Replace the loose modality chip** (currently lines 159-171) with the panel:

```tsx
        <SplitIdentityPanel
          split={split}
          units={units}
          programSummary={
            activeProgram ? "plano ativo" : programs.length > 0 ? `${programs.length} planos` : "sem plano"
          }
          onChangeColor={(color) => r.setSplitColor(split.id, color)}
        />
```

3. **Replace the loose "Agenda do ciclo" block** (currently lines 222-242 — the heading, helper text, `WeekdayPicker` and the anchor row) with:

```tsx
            <CycleScheduleCard
              split={split}
              onToggleRestWeekday={toggleRest}
              onPressAnchor={() => setAnchorPickerOpen(true)}
            />
```

4. **Add the imports:**

```tsx
import { SplitIdentityPanel } from "@/components/SplitIdentityPanel";
import { CycleScheduleCard } from "@/components/CycleScheduleCard";
```

Leave `ESTRUTURA`, `StrengthPlanTable` / `DistancePlanTable`, the weekly-mode branch and the whole `PLANOS` section exactly as they are.

- [ ] **Step 4: Add the `setSplitColor` mutator**

`useRoutine` has no colour mutator yet. Add it in `src/hooks/useRoutine.ts` beside `setSplitAnchorDate`, and to the returned object:

```ts
  const setSplitColor = useCallback((id: number, color: SplitColor) => {
    updateSplit(id, { color });
    // Optimistic, matching renameSplit: a colour change must repaint the panel
    // and its 7-day preview without a full DB re-read.
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
  }, []);
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx jest && npx eslint .`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/SplitIdentityPanel.tsx src/components/CycleScheduleCard.tsx app/routine/\[id\].tsx src/hooks/useRoutine.ts
git commit -m "feat(routine): recompose the split editor around a cycle preview"
```

---

### Task 15: Verify in a real browser at both widths

Layout is a visual property. This repo has learned the hard way that web behaviour does not match expectation without looking at it — see `feedback_verify_web_drag_libs_before_committing` and the `function-style-prop` scan. This task is not optional.

**Files:** none — verification only, plus any fixes it turns up.

- [ ] **Step 1: Start the web dev server**

Run: `npx expo start --web`

- [ ] **Step 2: Check the phone width**

Resize the browser window (or use device emulation) to **390px** wide and open the Rotina tab. Confirm every item:

- The week strip renders by default; the month grid is collapsed.
- No text anywhere in the calendar is smaller than 10px. Unit labels are absent at this width.
- Each cell is at least 44px tall and comfortably tappable.
- A day with two splits shows two distinct colour pips.
- Tapping a day changes the heading and the cards below; it does **not** open a modal.
- Tapping `mês ⌄` expands a square-celled month grid that does not overflow horizontally.
- The filter chips scroll horizontally, stay left-aligned, and are content-sized — not stretched, not centred.
- Selecting a chip simultaneously dims the other splits' pips and removes their cards.
- `Iniciar treino` opens the wizard already on the resolved-day step, with the right split and date.
- `editar ›` opens the split editor with the right day expanded.

- [ ] **Step 3: Check the desktop width**

Resize to **≥ 1024px** and confirm:

- The month grid is expanded by default and the `mês` toggle is absent.
- Unit labels appear in cells that have a single workout.
- The 7-day preview in the split editor tracks changes: toggle a rest weekday and watch `D1/D2/D3` re-land immediately.

- [ ] **Step 4: Check the boundary**

Resize slowly across **640px** and confirm the strip/month switch happens without a layout jump or a crash, in both directions.

- [ ] **Step 5: Check the empty and degenerate states**

- A split with no units: the editor's preview shows all `·` and does not crash.
- A cyclic split with no anchor date: same.
- A day where every split rests: one `Descanso` card with a `próximo:` line.
- A split whose every weekday is marked as rest: the rest card reads `nenhum treino agendado nos próximos 14 dias` rather than hanging.

- [ ] **Step 6: Fix anything broken, then commit**

```bash
git add -A
git commit -m "fix(routine): browser verification fixes at 390px and desktop"
```

If nothing needed fixing, skip the commit and say so — do not fabricate a commit.

- [ ] **Step 7: Final full verification**

Run: `npx tsc --noEmit && npx jest && npx eslint .`
Expected: all three clean. Report the actual output; do not claim success without it.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `splitColors.ts` registry, six exact hexes | 1 |
| `weekDaysAround` util | 2 |
| Schema v19, `color` column, `CHECK`, backfill by `"order"` | 3 |
| `RoutineSplit.color`, `createSplit` / `updateSplit` colour | 4 |
| Export v7 with colour + unknown-slug fallback | 5 |
| Next-workout lookahead with 14-day bound | 6 |
| `WeekGrid` primitive, 640px breakpoint, `useWindowDimensions` | 7 |
| Colour picker at creation and in the editor | 8, 14 |
| Filter chips as single state | 9, 12 |
| `DayPlanCard` with resolved targets, `font-data` numbers, `Semana N de M` | 10, 12 |
| Calendar strip/month, pips, `+N` at 10px, square cells, override glyph | 11 |
| Selected day replaces `DayDetailModal`; modal deleted | 12 |
| `abrir <split> ›` reachability link | 12 |
| Rest card with `próximo:` | 12 |
| `/session/new` prefill params | 13 |
| `SplitIdentityPanel` with 7-day preview; `CycleScheduleCard`; `unitId` deep link | 14 |
| Browser verification at 390px and desktop | 15 |

No spec requirement is unassigned.

**Deviations recorded in the plan itself:** the v19 `ALTER TABLE` adds `color` nullable rather than `NOT NULL DEFAULT 'terra'`, so the backfill can be idempotent (Task 3, Design note).

**Type consistency check:** `SplitColor` / `SPLIT_COLOR_ORDER` / `isSplitColor` / `splitColorHex` / `DEFAULT_SPLIT_COLOR` are defined in Task 1 and used with those exact names in Tasks 3, 4, 5, 8, 9, 10, 11, 14. `DayScheduleEntry` moves to `src/types/routine.ts` in Task 4 and is consumed under that import in Tasks 6, 10, 11, 12. `WeekGridCellState` is defined in Task 7 and destructured as `state.isToday` / `state.isSelected` / `state.isCompact` in Tasks 11 and 14. `WEEK_GRID_WIDE_BREAKPOINT` is defined in Task 7 and imported in Task 11. `nextWorkoutAfter` returns `{ dateISO, unitLabel, splitName, splitId }` in Task 6 and is read as `upcoming.unitLabel` / `upcoming.dateISO` in Task 12. `setSplitColor` is added to `useRoutine` in Task 14 and called only there. `describeDayTarget` is exported from `DayPlanCard` in Task 10.

**Ordering note:** Task 12 sends wizard params that Task 13 implements. Between them the params are ignored and the wizard opens at `modality` — degraded, not broken. Keeping this order lets Task 12 stand alone as a complete, testable tab.
