# Workout History Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-stage standalone script that turns Rafael's WhatsApp workout log (`treinos.txt`) into an app backup JSON he can import through open-training's existing Import screen, without ever touching the live app or its SQLite storage directly.

**Architecture:** Three independent Node/TypeScript CLI scripts under `scripts/import-history/`, each consuming the previous stage's output file and producing the next: `parse.ts` (WhatsApp text → raw sessions JSON), `aliases.ts` (raw exercise names → a draft name-dedup mapping Rafael hand-edits), `build.ts` (raw sessions + approved mapping → `ExportPayload`-shaped JSON, validated with the app's own `validateExportPayload`). All parsing/matching logic lives in pure, unit-tested functions under `scripts/import-history/lib/`; the CLI files are thin file-I/O wrappers around them.

**Tech Stack:** TypeScript, run via `tsx` (new devDependency, no compilation step), tested with the existing Jest setup (new `import-history` project in `jest.config.js`), reusing types and constants directly from `src/db/importExport.ts`, `src/db/schema.ts`, `src/types/exercise.ts`, `src/utils/uuid.ts`, and `src/data/exercises.ts`.

## Global Constraints

- No network calls, no upload of `treinos.txt` or any derived file anywhere — everything stays local to the repo/filesystem.
- No direct SQLite writes. The only output that touches the app is `import-payload.json`, applied through the app's existing Import screen (`src/db/importFile.ts` → `applyImport`), which already does merge-by-uuid.
- `planExerciseMerge` (`src/db/importExport.ts`) matches existing exercises by **literal, case-sensitive string equality** on `name` — a canonical name meant to match an existing seed exercise must be copied verbatim from `src/data/exercises.ts`, not re-typed or re-cased.
- Genuinely ambiguous or malformed lines are **never guessed** — they're dropped from the parsed output and listed in a report for Rafael to fix or ignore by hand. This applies even when a plausible-looking guess is possible.
- Rep counts may be fractional (the source log uses half-reps like "7.5 reps" constantly) — stored as `number`, never rounded to an integer.
- Generated data files (`raw-workouts.json`, `unparsed-lines.txt`, `exercise-aliases.json`, `import-payload.json`) contain Rafael's real personal training history and must never be committed — they're gitignored.
- Scripts live outside the Expo/React Native app bundle (`scripts/import-history/`), written in plain TypeScript executed via `tsx`, not part of the app's runtime code.

---

### Task 1: Scaffold the script project + `normalizeExerciseName`

**Files:**
- Modify: `package.json` (add `tsx` devDependency)
- Modify: `jest.config.js` (add `import-history` project)
- Modify: `.gitignore` (exclude generated import-history data files)
- Create: `scripts/import-history/lib/normalizeName.ts`
- Test: `scripts/import-history/lib/normalizeName.test.ts`

**Interfaces:**
- Produces: `normalizeExerciseName(name: string): string` — used by Task 9 (`buildAliasDraft`).

- [ ] **Step 1: Install `tsx` as a dev dependency**

Run: `npm install --save-dev tsx`

- [ ] **Step 2: Add the `import-history` Jest project**

In `jest.config.js`, add a third entry to the `projects` array (after the existing `"db"` entry):

```js
    {
      displayName: "import-history",
      testEnvironment: "node",
      testMatch: ["<rootDir>/scripts/import-history/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": ["babel-jest", { configFile: "./babel.config.js" }],
      },
    },
```

- [ ] **Step 3: Gitignore generated data files**

Append to `.gitignore`:

```
# scripts/import-history: generated personal training data, never commit
scripts/import-history/raw-workouts.json
scripts/import-history/unparsed-lines.txt
scripts/import-history/exercise-aliases.json
scripts/import-history/import-payload.json
```

- [ ] **Step 4: Write the failing test**

Create `scripts/import-history/lib/normalizeName.test.ts`:

```ts
import { normalizeExerciseName } from "./normalizeName";

describe("normalizeExerciseName", () => {
  test("lowercases and strips accents", () => {
    expect(normalizeExerciseName("Elevação Lateral")).toBe("elevacao lateral");
  });

  test("strips punctuation and collapses whitespace", () => {
    expect(normalizeExerciseName("Sup. Inclinado")).toBe("sup inclinado");
  });

  test("is case-insensitive", () => {
    expect(normalizeExerciseName("Rosca Direta")).toBe(normalizeExerciseName("Rosca direta"));
  });

  test("treats a typo as a different name", () => {
    expect(normalizeExerciseName("Rosca direta")).not.toBe(
      normalizeExerciseName("Rpsca direta")
    );
  });

  test("strips parentheses but keeps their words", () => {
    expect(normalizeExerciseName("Ext. (Normal)")).toBe("ext normal");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/normalizeName.test.ts`
Expected: FAIL with "Cannot find module './normalizeName'"

- [ ] **Step 6: Write the implementation**

Create `scripts/import-history/lib/normalizeName.ts`:

```ts
export function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/normalizeName.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json jest.config.js .gitignore scripts/import-history/lib/normalizeName.ts scripts/import-history/lib/normalizeName.test.ts
git commit -m "feat(import-history): scaffold script project and exercise name normalizer"
```

---

### Task 2: `levenshteinDistance` and `similarity`

**Files:**
- Create: `scripts/import-history/lib/similarity.ts`
- Test: `scripts/import-history/lib/similarity.test.ts`

**Interfaces:**
- Produces: `levenshteinDistance(a: string, b: string): number`, `similarity(a: string, b: string): number` (range 0–1) — used by Task 9 (`buildAliasDraft`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/similarity.test.ts`:

```ts
import { levenshteinDistance, similarity } from "./similarity";

describe("levenshteinDistance", () => {
  test("is zero for identical strings", () => {
    expect(levenshteinDistance("rosca direta", "rosca direta")).toBe(0);
  });

  test("counts a single substitution", () => {
    expect(levenshteinDistance("rosca direta", "rpsca direta")).toBe(1);
  });
});

describe("similarity", () => {
  test("is 1 for identical strings", () => {
    expect(similarity("hack squat", "hack squat")).toBe(1);
  });

  test("is high for a near-typo", () => {
    expect(similarity("rosca direta", "rpsca direta")).toBeCloseTo(0.9167, 3);
  });

  test("is low for unrelated strings", () => {
    expect(similarity("hack squat", "rosca direta")).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/similarity.test.ts`
Expected: FAIL with "Cannot find module './similarity'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/similarity.ts`:

```ts
export function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/similarity.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/similarity.ts scripts/import-history/lib/similarity.test.ts
git commit -m "feat(import-history): add levenshtein-based name similarity"
```

---

### Task 3: `parseMessages` — split the WhatsApp export into messages

**Files:**
- Create: `scripts/import-history/lib/parseMessages.ts`
- Test: `scripts/import-history/lib/parseMessages.test.ts`

**Interfaces:**
- Produces: `interface WhatsAppMessage { date: string; time: string; lines: string[] }`, `parseMessages(fileContent: string): WhatsAppMessage[]` — used by Task 7 (`extractWorkoutSessions`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/parseMessages.test.ts`:

```ts
import { parseMessages } from "./parseMessages";

describe("parseMessages", () => {
  test("splits a workout message with continuation lines from the next message", () => {
    const input = [
      "[10/03/26, 18:01:09] Rafael Ortiz Nunes: Pantu joelho flexionado- 120kg < 9 reps / 130kg <- 7 reps",
      "Hack squat - 130kg <- 8 reps (0 RiR) / 135kg <- 6 reps (0 RiR) / 5 reps (falha)",
      "[11/03/26, 18:43:01] Rafael Ortiz Nunes: Remada sentado pegada pronada -77kg <- 9 reps  / 8 reps / 7 reps",
    ].join("\n");

    const messages = parseMessages(input);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      date: "10/03/26",
      time: "18:01:09",
      lines: [
        "Pantu joelho flexionado- 120kg < 9 reps / 130kg <- 7 reps",
        "Hack squat - 130kg <- 8 reps (0 RiR) / 135kg <- 6 reps (0 RiR) / 5 reps (falha)",
      ],
    });
    expect(messages[1].date).toBe("11/03/26");
    expect(messages[1].time).toBe("18:43:01");
  });

  test("handles the leading U+200E mark on media messages", () => {
    const input =
      "‎[14/03/26, 12:26:39] Rafael Ortiz Nunes: CIC cor assinatura-1.png ‎document omitted";
    const messages = parseMessages(input);
    expect(messages).toHaveLength(1);
    expect(messages[0].date).toBe("14/03/26");
    expect(messages[0].lines).toEqual(["CIC cor assinatura-1.png ‎document omitted"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/parseMessages.test.ts`
Expected: FAIL with "Cannot find module './parseMessages'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/parseMessages.ts`:

```ts
export interface WhatsAppMessage {
  date: string;
  time: string;
  lines: string[];
}

const HEADER_RE = /^‎?\[(\d{2}\/\d{2}\/\d{2}),\s(\d{2}:\d{2}:\d{2})\]\s[^:]+:\s?(.*)$/;

export function parseMessages(fileContent: string): WhatsAppMessage[] {
  const lines = fileContent.split(/\r?\n/);
  const messages: WhatsAppMessage[] = [];
  let current: WhatsAppMessage | null = null;

  for (const rawLine of lines) {
    const match = rawLine.match(HEADER_RE);
    if (match) {
      current = { date: match[1], time: match[2], lines: match[3] ? [match[3]] : [] };
      messages.push(current);
    } else if (current) {
      current.lines.push(rawLine);
    }
  }

  return messages;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/parseMessages.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/parseMessages.ts scripts/import-history/lib/parseMessages.test.ts
git commit -m "feat(import-history): split WhatsApp export into messages"
```

---

### Task 4: `stitchWrappedLines` — merge a dangling weight/arrow onto the next line

**Files:**
- Create: `scripts/import-history/lib/stitchWrappedLines.ts`
- Test: `scripts/import-history/lib/stitchWrappedLines.test.ts`

**Interfaces:**
- Produces: `stitchWrappedLines(lines: string[]): string[]` — used by Task 7 (`extractWorkoutSessions`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/stitchWrappedLines.test.ts`:

```ts
import { stitchWrappedLines } from "./stitchWrappedLines";

describe("stitchWrappedLines", () => {
  test("merges a line ending in a dangling arrow with the next line", () => {
    const input = ["Extensora - 60kg <- ", "9 reps (falha) / 7 reps (falha) / 7 reps (falha)"];
    expect(stitchWrappedLines(input)).toEqual([
      "Extensora - 60kg <- 9 reps (falha) / 7 reps (falha) / 7 reps (falha)",
    ]);
  });

  test("leaves complete lines untouched", () => {
    const input = ["Hack squat - 130kg <- 8 reps / 6 reps"];
    expect(stitchWrappedLines(input)).toEqual(input);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/stitchWrappedLines.test.ts`
Expected: FAIL with "Cannot find module './stitchWrappedLines'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/stitchWrappedLines.ts`:

```ts
export function stitchWrappedLines(lines: string[]): string[] {
  const stitched: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (/[<-]\s*$/.test(line.trim()) && i + 1 < lines.length) {
      i++;
      line = `${line.trim()} ${lines[i].trim()}`;
    }
    stitched.push(line);
  }
  return stitched;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/stitchWrappedLines.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/stitchWrappedLines.ts scripts/import-history/lib/stitchWrappedLines.test.ts
git commit -m "feat(import-history): stitch line-wrapped exercise entries"
```

---

### Task 5: `parseSetGroup` — parse one `/`-separated set

**Files:**
- Create: `scripts/import-history/lib/parseSetGroup.ts`
- Test: `scripts/import-history/lib/parseSetGroup.test.ts`

**Interfaces:**
- Produces: `interface ParsedSet { weight_kg: number; reps: number; rir: number | null; failure: 0 | 1; notes: string | null }`, `parseSetGroup(rawGroup: string, carryWeight: number | null): ParsedSet | null` — used by Task 6 (`parseExerciseLine`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/parseSetGroup.test.ts`:

```ts
import { parseSetGroup } from "./parseSetGroup";

describe("parseSetGroup", () => {
  test("parses a weight, reps and RiR", () => {
    expect(parseSetGroup("130kg <- 8 reps (0 RiR)", null)).toEqual({
      weight_kg: 130,
      reps: 8,
      rir: 0,
      failure: 0,
      notes: null,
    });
  });

  test("carries the previous weight forward when none is given", () => {
    expect(parseSetGroup("5 reps (falha)", 135)).toEqual({
      weight_kg: 135,
      reps: 5,
      rir: null,
      failure: 1,
      notes: null,
    });
  });

  test("returns null when no weight has ever been established", () => {
    expect(parseSetGroup("8 reps", null)).toBeNull();
  });

  test("takes the lower value of a rep range and keeps the original text as a note", () => {
    expect(parseSetGroup("18kg <- (8-9 reps)", null)).toEqual({
      weight_kg: 18,
      reps: 8,
      rir: null,
      failure: 0,
      notes: "(8-9 reps)",
    });
  });

  test("takes the first value of bonus reps and keeps the original text as a note", () => {
    expect(parseSetGroup("16kg <- 10 + 1 reps", null)).toEqual({
      weight_kg: 16,
      reps: 10,
      rir: null,
      failure: 0,
      notes: "10 + 1 reps",
    });
  });

  test("reads a negative RiR", () => {
    expect(parseSetGroup("8 reps (- 1 RiR)", 30)).toEqual({
      weight_kg: 30,
      reps: 8,
      rir: -1,
      failure: 0,
      notes: null,
    });
  });

  test("keeps a bracketed tag as a note", () => {
    expect(parseSetGroup("13kg <- 10 reps [BACKOFF]", null)).toEqual({
      weight_kg: 13,
      reps: 10,
      rir: null,
      failure: 0,
      notes: "[BACKOFF]",
    });
  });

  test("accepts misspelled rep units", () => {
    expect(parseSetGroup("104kg <- 9 rsps", null)).toEqual({
      weight_kg: 104,
      reps: 9,
      rir: null,
      failure: 0,
      notes: null,
    });
  });

  test("flags a group with a leftover second weight token as unparseable", () => {
    expect(parseSetGroup("84kg <- 104kg <- 12 reps (0 RiR)", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/parseSetGroup.test.ts`
Expected: FAIL with "Cannot find module './parseSetGroup'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/parseSetGroup.ts`:

```ts
export interface ParsedSet {
  weight_kg: number;
  reps: number;
  rir: number | null;
  failure: 0 | 1;
  notes: string | null;
}

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*kg/i;
const BRACKET_RE = /\[[^\]]*\]/g;
const FAILURE_RE = /falha/i;
const RIR_RE = /(-\s*)?(\d+(?:[.,]\d+)?)\s*ri?r/i;
const RANGE_RE = /(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/;
const BONUS_RE = /(\d+(?:[.,]\d+)?)\s*\+\s*\d+(?:[.,]\d+)?/;
const NUMBER_RE = /(\d+(?:[.,]\d+)?)/;

function toFloat(raw: string): number {
  return parseFloat(raw.replace(",", "."));
}

export function parseSetGroup(rawGroup: string, carryWeight: number | null): ParsedSet | null {
  let group = rawGroup.trim();
  let weight = carryWeight;

  const weightMatch = group.match(WEIGHT_RE);
  if (weightMatch && weightMatch.index !== undefined) {
    weight = toFloat(weightMatch[1]);
    group = (group.slice(0, weightMatch.index) + group.slice(weightMatch.index + weightMatch[0].length))
      .replace(/^[\s<-]+/, "")
      .trim();
  }

  if (weight === null) return null;

  const notesParts: string[] = [];

  const brackets = group.match(BRACKET_RE);
  if (brackets) notesParts.push(...brackets);
  const repsRegion = group.replace(BRACKET_RE, "").trim();

  // A leftover weight token here means this group has two weights mashed
  // together (an in-log correction/typo) — too ambiguous to guess at.
  if (WEIGHT_RE.test(repsRegion)) return null;

  const failure: 0 | 1 = FAILURE_RE.test(repsRegion) ? 1 : 0;

  let rir: number | null = null;
  const rirMatch = repsRegion.match(RIR_RE);
  if (rirMatch) {
    const value = toFloat(rirMatch[2]);
    rir = rirMatch[1] ? -value : value;
  }

  const rangeMatch = repsRegion.match(RANGE_RE);
  const bonusMatch = repsRegion.match(BONUS_RE);

  let reps: number | null = null;
  if (rangeMatch && (!bonusMatch || (rangeMatch.index ?? 0) <= (bonusMatch.index ?? 0))) {
    reps = toFloat(rangeMatch[1]);
    notesParts.push(repsRegion);
  } else if (bonusMatch) {
    reps = toFloat(bonusMatch[1]);
    notesParts.push(repsRegion);
  } else {
    const simpleMatch = repsRegion.match(NUMBER_RE);
    if (simpleMatch) reps = toFloat(simpleMatch[1]);
  }

  if (reps === null) return null;

  return {
    weight_kg: weight,
    reps,
    rir,
    failure,
    notes: notesParts.length > 0 ? notesParts.join("; ") : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/parseSetGroup.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/parseSetGroup.ts scripts/import-history/lib/parseSetGroup.test.ts
git commit -m "feat(import-history): parse a single set (weight, reps, RiR, failure, notes)"
```

---

### Task 6: `parseExerciseLine` — parse one exercise line into a name + sets

**Files:**
- Create: `scripts/import-history/lib/parseExerciseLine.ts`
- Test: `scripts/import-history/lib/parseExerciseLine.test.ts`

**Interfaces:**
- Consumes: `parseSetGroup(rawGroup: string, carryWeight: number | null): ParsedSet | null` (Task 5).
- Produces: `interface ParsedExerciseLine { rawName: string; sets: ParsedSet[] }`, `parseExerciseLine(line: string): ParsedExerciseLine | null` — used by Task 7 (`extractWorkoutSessions`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/parseExerciseLine.test.ts`:

```ts
import { parseExerciseLine } from "./parseExerciseLine";

describe("parseExerciseLine", () => {
  test("parses a name and two sets with the arrowless '<' separator", () => {
    expect(
      parseExerciseLine("Pantu joelho flexionado- 120kg < 9 reps / 130kg <- 7 reps")
    ).toEqual({
      rawName: "Pantu joelho flexionado",
      sets: [
        { weight_kg: 120, reps: 9, rir: null, failure: 0, notes: null },
        { weight_kg: 130, reps: 7, rir: null, failure: 0, notes: null },
      ],
    });
  });

  test("parses three sets with weight carried forward and a failure flag", () => {
    expect(
      parseExerciseLine(
        "Hack squat - 130kg <- 8 reps (0 RiR) / 135kg <- 6 reps (0 RiR) / 5 reps (falha)"
      )
    ).toEqual({
      rawName: "Hack squat",
      sets: [
        { weight_kg: 130, reps: 8, rir: 0, failure: 0, notes: null },
        { weight_kg: 135, reps: 6, rir: 0, failure: 0, notes: null },
        { weight_kg: 135, reps: 5, rir: null, failure: 1, notes: null },
      ],
    });
  });

  test("returns null for a line with no weight token at all", () => {
    expect(
      parseExerciseLine("Pull down unilateral - -10 9.5 reps / 9 reps")
    ).toBeNull();
  });

  test("returns null when any one of the line's sets is unparseable", () => {
    expect(
      parseExerciseLine(
        "Abdutora - 84kg <- 104kg <- 12 reps (0 RiR) / 8 reps (0 RiR) /7 rpes"
      )
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/parseExerciseLine.test.ts`
Expected: FAIL with "Cannot find module './parseExerciseLine'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/parseExerciseLine.ts`:

```ts
import { parseSetGroup, ParsedSet } from "./parseSetGroup";

export interface ParsedExerciseLine {
  rawName: string;
  sets: ParsedSet[];
}

const FIRST_WEIGHT_RE = /\d+(?:[.,]\d+)?\s*kg/i;

export function parseExerciseLine(line: string): ParsedExerciseLine | null {
  const trimmed = line.trim();
  const firstWeight = trimmed.match(FIRST_WEIGHT_RE);
  if (!firstWeight || firstWeight.index === undefined) return null;

  const rawName = trimmed
    .slice(0, firstWeight.index)
    .replace(/[\s<-]+$/, "")
    .trim();
  if (!rawName) return null;

  const setsRegion = trimmed.slice(firstWeight.index);
  const groups = setsRegion
    .split("/")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);

  const sets: ParsedSet[] = [];
  let carryWeight: number | null = null;
  for (const group of groups) {
    const parsed = parseSetGroup(group, carryWeight);
    if (!parsed) return null;
    carryWeight = parsed.weight_kg;
    sets.push(parsed);
  }

  if (sets.length === 0) return null;
  return { rawName, sets };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/parseExerciseLine.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/parseExerciseLine.ts scripts/import-history/lib/parseExerciseLine.test.ts
git commit -m "feat(import-history): parse an exercise line into a name and its sets"
```

---

### Task 7: `extractWorkoutSessions` — messages → sessions + unparsed-line report

**Files:**
- Create: `scripts/import-history/lib/extractWorkoutSessions.ts`
- Test: `scripts/import-history/lib/extractWorkoutSessions.test.ts`

**Interfaces:**
- Consumes: `parseMessages` (Task 3), `stitchWrappedLines` (Task 4), `parseExerciseLine` (Task 6).
- Produces: `interface RawWorkoutExercise { rawName: string; sets: ParsedSet[] }`, `interface RawWorkoutSession { date: string; time: string; exercises: RawWorkoutExercise[] }`, `interface UnparsedLine { date: string; time: string; line: string }`, `extractWorkoutSessions(fileContent: string): { sessions: RawWorkoutSession[]; unparsedLines: UnparsedLine[] }` — used by Task 8 (`parse.ts`), Task 10 (`aliases.ts`), Task 12 (`build.ts`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/extractWorkoutSessions.test.ts`:

```ts
import { extractWorkoutSessions } from "./extractWorkoutSessions";

describe("extractWorkoutSessions", () => {
  const input = [
    "[10/03/26, 18:01:09] Rafael Ortiz Nunes: Hack squat - 130kg <- 8 reps (0 RiR) / 6 reps (falha)",
    "Cadeira flexora - 104kg <- 9 reps / 8 reps",
    "[16/03/26, 20:34:52] Rafael Ortiz Nunes: 67935002837",
    "[17/03/26, 18:33:35] Rafael Ortiz Nunes: Remada sentado - 84kg <- 9 reps",
    "Pull down unilateral - -10 9.5 reps / 9 reps",
  ].join("\n");

  test("keeps only messages with at least one parseable exercise line", () => {
    const { sessions } = extractWorkoutSessions(input);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].date).toBe("10/03/26");
    expect(sessions[0].exercises.map((e) => e.rawName)).toEqual(["Hack squat", "Cadeira flexora"]);
    expect(sessions[1].date).toBe("17/03/26");
    expect(sessions[1].exercises.map((e) => e.rawName)).toEqual(["Remada sentado"]);
  });

  test("reports the unparseable line only from the message it belongs to", () => {
    const { unparsedLines } = extractWorkoutSessions(input);
    expect(unparsedLines).toEqual([
      {
        date: "17/03/26",
        time: "18:33:35",
        line: "Pull down unilateral - -10 9.5 reps / 9 reps",
      },
    ]);
  });

  test("drops non-workout messages entirely, without reporting them", () => {
    const { unparsedLines } = extractWorkoutSessions(input);
    expect(unparsedLines.some((u) => u.line.includes("67935002837"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/extractWorkoutSessions.test.ts`
Expected: FAIL with "Cannot find module './extractWorkoutSessions'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/extractWorkoutSessions.ts`:

```ts
import { parseMessages } from "./parseMessages";
import { stitchWrappedLines } from "./stitchWrappedLines";
import { parseExerciseLine } from "./parseExerciseLine";
import type { ParsedSet } from "./parseSetGroup";

export interface RawWorkoutExercise {
  rawName: string;
  sets: ParsedSet[];
}

export interface RawWorkoutSession {
  date: string;
  time: string;
  exercises: RawWorkoutExercise[];
}

export interface UnparsedLine {
  date: string;
  time: string;
  line: string;
}

export function extractWorkoutSessions(fileContent: string): {
  sessions: RawWorkoutSession[];
  unparsedLines: UnparsedLine[];
} {
  const messages = parseMessages(fileContent);
  const sessions: RawWorkoutSession[] = [];
  const unparsedLines: UnparsedLine[] = [];

  for (const message of messages) {
    const stitchedLines = stitchWrappedLines(message.lines);
    const exercises: RawWorkoutExercise[] = [];
    const failedLines: string[] = [];

    for (const line of stitchedLines) {
      if (!line.trim()) continue;
      const parsed = parseExerciseLine(line);
      if (parsed) {
        exercises.push({ rawName: parsed.rawName, sets: parsed.sets });
      } else {
        failedLines.push(line);
      }
    }

    if (exercises.length === 0) continue;

    sessions.push({ date: message.date, time: message.time, exercises });
    for (const line of failedLines) {
      unparsedLines.push({ date: message.date, time: message.time, line });
    }
  }

  return { sessions, unparsedLines };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/extractWorkoutSessions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/extractWorkoutSessions.ts scripts/import-history/lib/extractWorkoutSessions.test.ts
git commit -m "feat(import-history): extract workout sessions from parsed messages"
```

---

### Task 8: `parse.ts` — stage 1 CLI, run against the real 5-month log

**Files:**
- Create: `scripts/import-history/parse.ts`

**Interfaces:**
- Consumes: `extractWorkoutSessions(fileContent: string)` (Task 7).
- Produces: `scripts/import-history/raw-workouts.json`, `scripts/import-history/unparsed-lines.txt` (consumed by Task 10 and Task 12).

- [ ] **Step 1: Write the CLI script**

Create `scripts/import-history/parse.ts`:

```ts
import { readFileSync, writeFileSync } from "fs";
import { extractWorkoutSessions } from "./lib/extractWorkoutSessions";

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npx tsx scripts/import-history/parse.ts <path-to-treinos.txt>");
    process.exit(1);
  }

  const fileContent = readFileSync(inputPath, "utf-8");
  const { sessions, unparsedLines } = extractWorkoutSessions(fileContent);

  writeFileSync("scripts/import-history/raw-workouts.json", JSON.stringify(sessions, null, 2));

  const report = unparsedLines.map((u) => `${u.date} ${u.time}: ${u.line}`).join("\n");
  writeFileSync("scripts/import-history/unparsed-lines.txt", report);

  console.log(`Parsed ${sessions.length} sessions.`);
  console.log(`${unparsedLines.length} lines need manual review (unparsed-lines.txt).`);
}

main();
```

- [ ] **Step 2: Run it against the real 5-month sample**

Run: `npx tsx scripts/import-history/parse.ts /Users/farxc/Downloads/treinos.txt`

Expected: prints a session count in the tens (roughly one per gym visit across ~5 months) and a small unparsed-line count. Then:

- Open `scripts/import-history/unparsed-lines.txt` and confirm it contains (at minimum) these two known-ambiguous lines from the source file: the line with `Pull down unilateral - -10 9.5 reps / 9 reps` and the line with `Abdutora - 84kg <- 104kg <- 12 reps`.
- Open `scripts/import-history/raw-workouts.json` and spot-check the first session: it should have `date: "10/03/26"`, `time: "18:01:09"`, and its first exercise should be `{ rawName: "Pantu joelho flexionado", sets: [...] }` with 2 sets.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-history/parse.ts
git commit -m "feat(import-history): add stage 1 parse CLI"
```

---

### Task 9: `buildAliasDraft` — cluster raw exercise names into a draft mapping

**Files:**
- Create: `scripts/import-history/lib/buildAliasDraft.ts`
- Test: `scripts/import-history/lib/buildAliasDraft.test.ts`

**Interfaces:**
- Consumes: `normalizeExerciseName` (Task 1), `similarity` (Task 2).
- Produces: `interface AliasGroup { canonicalName: string | null; matchedSeedExercise: string | null; new: boolean; equipment: string; type: string; muscle_groups: { muscle_group: string; counting_factor: number }[]; rawNames: string[] }`, `interface FuzzyMergeSuggestion { a: string; b: string; similarity: number }`, `interface AliasDraft { groups: AliasGroup[]; suggestedFuzzyMerges: FuzzyMergeSuggestion[] }`, `buildAliasDraft(rawNames: string[], seedExerciseNames: string[]): AliasDraft` — used by Task 10 (`aliases.ts`) and Task 11 (`buildImportPayload`).

- [ ] **Step 1: Write the failing test**

Create `scripts/import-history/lib/buildAliasDraft.test.ts`:

```ts
import { buildAliasDraft } from "./buildAliasDraft";

describe("buildAliasDraft", () => {
  test("groups case-variant raw names together and matches an existing seed exercise", () => {
    const draft = buildAliasDraft(["Hack squat", "Hack Squat"], ["Hack Squat"]);
    expect(draft.groups).toHaveLength(1);
    expect(draft.groups[0]).toMatchObject({
      canonicalName: "Hack Squat",
      matchedSeedExercise: "Hack Squat",
      new: false,
      rawNames: ["Hack squat", "Hack Squat"],
    });
  });

  test("marks an unmatched name as new", () => {
    const draft = buildAliasDraft(["Pantu joelho flexionado"], ["Hack Squat"]);
    expect(draft.groups[0]).toMatchObject({
      canonicalName: null,
      matchedSeedExercise: null,
      new: true,
      rawNames: ["Pantu joelho flexionado"],
    });
  });

  test("suggests a fuzzy merge for a near-typo without merging automatically", () => {
    const draft = buildAliasDraft(["Rosca Direta", "Rpsca direta"], []);
    expect(draft.groups).toHaveLength(2);
    expect(draft.suggestedFuzzyMerges).toEqual([
      { a: "Rosca Direta", b: "Rpsca direta", similarity: 0.92 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/buildAliasDraft.test.ts`
Expected: FAIL with "Cannot find module './buildAliasDraft'"

- [ ] **Step 3: Write the implementation**

Create `scripts/import-history/lib/buildAliasDraft.ts`:

```ts
import { normalizeExerciseName } from "./normalizeName";
import { similarity } from "./similarity";

export interface AliasGroup {
  canonicalName: string | null;
  matchedSeedExercise: string | null;
  new: boolean;
  equipment: string;
  type: string;
  muscle_groups: { muscle_group: string; counting_factor: number }[];
  rawNames: string[];
}

export interface FuzzyMergeSuggestion {
  a: string;
  b: string;
  similarity: number;
}

export interface AliasDraft {
  groups: AliasGroup[];
  suggestedFuzzyMerges: FuzzyMergeSuggestion[];
}

const FUZZY_THRESHOLD = 0.82;

export function buildAliasDraft(rawNames: string[], seedExerciseNames: string[]): AliasDraft {
  const byNormalized = new Map<string, string[]>();
  for (const rawName of rawNames) {
    const key = normalizeExerciseName(rawName);
    const bucket = byNormalized.get(key);
    if (bucket) {
      if (!bucket.includes(rawName)) bucket.push(rawName);
    } else {
      byNormalized.set(key, [rawName]);
    }
  }

  const seedByNormalized = new Map<string, string>();
  for (const seedName of seedExerciseNames) {
    seedByNormalized.set(normalizeExerciseName(seedName), seedName);
  }

  const normalizedKeys = Array.from(byNormalized.keys());

  const groups: AliasGroup[] = normalizedKeys.map((key) => {
    const rawNamesForKey = byNormalized.get(key) as string[];
    const matchedSeedExercise = seedByNormalized.get(key) ?? null;
    return {
      canonicalName: matchedSeedExercise,
      matchedSeedExercise,
      new: matchedSeedExercise === null,
      equipment: "",
      type: "",
      muscle_groups: [],
      rawNames: rawNamesForKey,
    };
  });

  const suggestedFuzzyMerges: FuzzyMergeSuggestion[] = [];
  for (let i = 0; i < normalizedKeys.length; i++) {
    for (let j = i + 1; j < normalizedKeys.length; j++) {
      const score = similarity(normalizedKeys[i], normalizedKeys[j]);
      if (score >= FUZZY_THRESHOLD) {
        suggestedFuzzyMerges.push({
          a: (byNormalized.get(normalizedKeys[i]) as string[])[0],
          b: (byNormalized.get(normalizedKeys[j]) as string[])[0],
          similarity: Math.round(score * 100) / 100,
        });
      }
    }
  }

  return { groups, suggestedFuzzyMerges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/buildAliasDraft.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/import-history/lib/buildAliasDraft.ts scripts/import-history/lib/buildAliasDraft.test.ts
git commit -m "feat(import-history): cluster raw exercise names into a draft alias mapping"
```

---

### Task 10: `aliases.ts` — stage 2 CLI, generate the draft for Rafael to review

**Files:**
- Create: `scripts/import-history/aliases.ts`

**Interfaces:**
- Consumes: `buildAliasDraft` (Task 9); `RawWorkoutSession` (Task 7, read from `raw-workouts.json`); `SEED_EXERCISES`, `SEED_RUNNING_EXERCISES` from `src/data/exercises.ts`.
- Produces: `scripts/import-history/exercise-aliases.json` (hand-edited by Rafael, then consumed by Task 12's `build.ts`).

- [ ] **Step 1: Write the CLI script**

Create `scripts/import-history/aliases.ts`:

```ts
import { readFileSync, writeFileSync } from "fs";
import { buildAliasDraft } from "./lib/buildAliasDraft";
import { SEED_EXERCISES, SEED_RUNNING_EXERCISES } from "../../src/data/exercises";
import type { RawWorkoutSession } from "./lib/extractWorkoutSessions";

function main() {
  const sessions: RawWorkoutSession[] = JSON.parse(
    readFileSync("scripts/import-history/raw-workouts.json", "utf-8")
  );

  const rawNames = Array.from(
    new Set(sessions.flatMap((session) => session.exercises.map((exercise) => exercise.rawName)))
  );

  const seedExerciseNames = [...SEED_EXERCISES, ...SEED_RUNNING_EXERCISES].map((ex) => ex.name);

  const draft = buildAliasDraft(rawNames, seedExerciseNames);

  writeFileSync("scripts/import-history/exercise-aliases.json", JSON.stringify(draft, null, 2));

  console.log(
    `${draft.groups.length} exercise groups (${draft.groups.filter((g) => g.new).length} new).`
  );
  console.log(`${draft.suggestedFuzzyMerges.length} fuzzy-merge suggestions to review.`);
}

main();
```

- [ ] **Step 2: Run it and hand it to Rafael for review**

Run: `npx tsx scripts/import-history/aliases.ts`

Then open `scripts/import-history/exercise-aliases.json` and, for every group:

- If `"new": false` (matched an existing seed exercise), leave it as-is.
- If `"new": true`, fill in `equipment` (one of `barbell`, `dumbbell`, `machine`, `cable`, `bodyweight`, `kettlebell`, `band`, `other`), `type` (`compound` or `isolation`), `muscle_groups` (array of `{ "muscle_group": "...", "counting_factor": 1 }`, where `muscle_group` is one of `chest`, `back`, `shoulders`, `biceps`, `triceps`, `legs`, `femoral`, `glutes`, `core`, `cardio`, `full_body`), and `canonicalName` (the name to display in the app).
- Check `suggestedFuzzyMerges` — for each pair that's genuinely the same exercise, merge the second group's `rawNames` array into the first group's and delete the now-empty second group.

This step has no automated pass/fail — it's the manual checkpoint described in the design spec. Do not proceed to Task 12 until every group has a non-null `canonicalName` (Task 11's `buildImportPayload` will throw a clear error listing any that are still missing).

- [ ] **Step 3: Commit**

```bash
git add scripts/import-history/aliases.ts
git commit -m "feat(import-history): add stage 2 alias-draft CLI"
```

---

### Task 11: `convertWhatsAppDateToIso` + `buildImportPayload`

**Files:**
- Create: `scripts/import-history/lib/convertWhatsAppDateToIso.ts`
- Test: `scripts/import-history/lib/convertWhatsAppDateToIso.test.ts`
- Create: `scripts/import-history/lib/buildImportPayload.ts`
- Test: `scripts/import-history/lib/buildImportPayload.test.ts`

**Interfaces:**
- Consumes: `RawWorkoutSession` (Task 7), `AliasDraft`/`AliasGroup` (Task 9), `ExportPayload`/`ExportedExercise`/`ExportedSession`/`ExportedSet`/`ExportedSessionExercise`/`CURRENT_EXPORT_FORMAT_VERSION` from `src/db/importExport.ts`, `generateUuid` from `src/utils/uuid.ts`.
- Produces: `convertWhatsAppDateToIso(date: string): string`, `buildImportPayload(sessions: RawWorkoutSession[], aliasDraft: AliasDraft, appSchemaVersion: number, exportedAt: string): ExportPayload` — used by Task 12 (`build.ts`).

- [ ] **Step 1: Write the failing test for the date converter**

Create `scripts/import-history/lib/convertWhatsAppDateToIso.test.ts`:

```ts
import { convertWhatsAppDateToIso } from "./convertWhatsAppDateToIso";

describe("convertWhatsAppDateToIso", () => {
  test("converts DD/MM/YY to YYYY-MM-DD", () => {
    expect(convertWhatsAppDateToIso("10/03/26")).toBe("2026-03-10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/convertWhatsAppDateToIso.test.ts`
Expected: FAIL with "Cannot find module './convertWhatsAppDateToIso'"

- [ ] **Step 3: Write the date converter**

Create `scripts/import-history/lib/convertWhatsAppDateToIso.ts`:

```ts
export function convertWhatsAppDateToIso(date: string): string {
  const [day, month, year] = date.split("/");
  return `20${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/convertWhatsAppDateToIso.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write the failing test for `buildImportPayload`**

Create `scripts/import-history/lib/buildImportPayload.test.ts`:

```ts
import { buildImportPayload } from "./buildImportPayload";
import type { AliasDraft } from "./buildAliasDraft";
import type { RawWorkoutSession } from "./extractWorkoutSessions";

describe("buildImportPayload", () => {
  const sessions: RawWorkoutSession[] = [
    {
      date: "10/03/26",
      time: "18:01:09",
      exercises: [
        {
          rawName: "Hack squat",
          sets: [
            { weight_kg: 130, reps: 8, rir: 0, failure: 0, notes: null },
            { weight_kg: 135, reps: 5, rir: null, failure: 1, notes: null },
          ],
        },
      ],
    },
  ];

  const aliasDraft: AliasDraft = {
    groups: [
      {
        canonicalName: "Hack Squat",
        matchedSeedExercise: "Hack Squat",
        new: false,
        equipment: "",
        type: "",
        muscle_groups: [],
        rawNames: ["Hack squat"],
      },
    ],
    suggestedFuzzyMerges: [],
  };

  test("builds a session with sets referencing the matched exercise by uuid", () => {
    const payload = buildImportPayload(sessions, aliasDraft, 14, "2026-07-23T00:00:00.000Z");

    expect(payload.exportFormatVersion).toBe(3);
    expect(payload.appSchemaVersion).toBe(14);
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({ name: "Hack Squat", is_custom: 0 });

    const [session] = payload.sessions;
    expect(session.date).toBe("2026-03-10");
    expect(session.start_time).toBe("2026-03-10T18:01:09.000Z");
    expect(session.sets).toHaveLength(2);
    expect(session.sets[0]).toMatchObject({
      exercise_uuid: payload.exercises[0].uuid,
      set_number: 1,
      reps: 8,
      weight_kg: 130,
      rir: 0,
      failure: 0,
    });
    expect(session.sets[1]).toMatchObject({ set_number: 2, reps: 5, failure: 1 });
    expect(session.exercises).toEqual([{ exercise_uuid: payload.exercises[0].uuid, order: 0 }]);
  });

  test("throws when a group is missing required fields for a new exercise", () => {
    const badDraft: AliasDraft = {
      groups: [
        {
          canonicalName: null,
          matchedSeedExercise: null,
          new: true,
          equipment: "",
          type: "",
          muscle_groups: [],
          rawNames: ["Pantu joelho flexionado"],
        },
      ],
      suggestedFuzzyMerges: [],
    };
    expect(() =>
      buildImportPayload(sessions, badDraft, 14, "2026-07-23T00:00:00.000Z")
    ).toThrow(/unresolved groups/);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest scripts/import-history/lib/buildImportPayload.test.ts`
Expected: FAIL with "Cannot find module './buildImportPayload'"

- [ ] **Step 7: Write the implementation**

Create `scripts/import-history/lib/buildImportPayload.ts`:

```ts
import type {
  ExportPayload,
  ExportedExercise,
  ExportedSession,
  ExportedSet,
  ExportedSessionExercise,
} from "../../src/db/importExport";
import { CURRENT_EXPORT_FORMAT_VERSION } from "../../src/db/importExport";
import { generateUuid } from "../../src/utils/uuid";
import type { AliasDraft, AliasGroup } from "./buildAliasDraft";
import type { RawWorkoutSession } from "./extractWorkoutSessions";
import { convertWhatsAppDateToIso } from "./convertWhatsAppDateToIso";

function validateAliasDraft(aliasDraft: AliasDraft): void {
  const unresolved = aliasDraft.groups.filter(
    (group) =>
      !group.canonicalName ||
      (group.new && (!group.equipment || !group.type || group.muscle_groups.length === 0))
  );
  if (unresolved.length > 0) {
    const names = unresolved.map((group) => group.rawNames.join(" / ")).join(" | ");
    throw new Error(`exercise-aliases.json has unresolved groups: ${names}`);
  }
}

export function buildImportPayload(
  sessions: RawWorkoutSession[],
  aliasDraft: AliasDraft,
  appSchemaVersion: number,
  exportedAt: string
): ExportPayload {
  validateAliasDraft(aliasDraft);

  const rawNameToGroup = new Map<string, AliasGroup>();
  for (const group of aliasDraft.groups) {
    for (const rawName of group.rawNames) rawNameToGroup.set(rawName, group);
  }

  const uuidByCanonicalName = new Map<string, string>();
  const exercises: ExportedExercise[] = [];
  for (const group of aliasDraft.groups) {
    const name = group.canonicalName as string;
    if (uuidByCanonicalName.has(name)) continue;
    const uuid = generateUuid();
    uuidByCanonicalName.set(name, uuid);
    exercises.push({
      uuid,
      name,
      // Equipment/type/muscle_groups only matter for genuinely new exercises:
      // planExerciseMerge (src/db/importExport.ts) matches existing ones by
      // exact name and ignores every other field on a match.
      muscle_groups: group.new ? group.muscle_groups : [],
      equipment: group.new ? group.equipment : "other",
      type: group.new ? group.type : "isolation",
      is_custom: group.new ? 1 : 0,
      modality: "musculacao",
    });
  }

  const exportedSessions: ExportedSession[] = sessions.map((session) => {
    const sets: ExportedSet[] = [];
    const exerciseOrder: string[] = [];
    const seenExerciseUuid = new Set<string>();

    for (const exercise of session.exercises) {
      const group = rawNameToGroup.get(exercise.rawName);
      if (!group) {
        throw new Error(`No alias mapping found for raw exercise name "${exercise.rawName}"`);
      }
      const exerciseUuid = uuidByCanonicalName.get(group.canonicalName as string) as string;

      if (!seenExerciseUuid.has(exerciseUuid)) {
        seenExerciseUuid.add(exerciseUuid);
        exerciseOrder.push(exerciseUuid);
      }

      exercise.sets.forEach((set, index) => {
        sets.push({
          exercise_uuid: exerciseUuid,
          set_number: index + 1,
          reps: set.reps,
          weight_kg: set.weight_kg,
          rpe: null,
          rir: set.rir,
          notes: set.notes,
          distance_km: null,
          duration_sec: null,
          pace_sec: null,
          failure: set.failure,
        });
      });
    }

    const exercisesJoin: ExportedSessionExercise[] = exerciseOrder.map((exercise_uuid, order) => ({
      exercise_uuid,
      order,
    }));

    const isoDate = convertWhatsAppDateToIso(session.date);

    return {
      uuid: generateUuid(),
      date: isoDate,
      name: null,
      notes: null,
      duration_seconds: null,
      // WhatsApp only records a wall-clock time, with no timezone/DST
      // history recoverable across 2.3 years — stored as if UTC, an
      // accepted approximation since only the date matters for analytics.
      start_time: `${isoDate}T${session.time}.000Z`,
      end_time: null,
      modality: "musculacao",
      sets,
      exercises: exercisesJoin,
    };
  });

  return {
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt,
    appSchemaVersion,
    exercises,
    sessions: exportedSessions,
    routineSplits: [],
    trainingPrograms: [],
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest scripts/import-history/lib/buildImportPayload.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add scripts/import-history/lib/convertWhatsAppDateToIso.ts scripts/import-history/lib/convertWhatsAppDateToIso.test.ts scripts/import-history/lib/buildImportPayload.ts scripts/import-history/lib/buildImportPayload.test.ts
git commit -m "feat(import-history): build the ExportPayload from parsed sessions and approved aliases"
```

---

### Task 12: `build.ts` — stage 3 CLI, run end-to-end, write the README

**Files:**
- Create: `scripts/import-history/build.ts`
- Create: `scripts/import-history/README.md`

**Interfaces:**
- Consumes: `buildImportPayload` (Task 11), `validateExportPayload` from `src/db/importExport.ts`, `SCHEMA_VERSION` from `src/db/schema.ts`.
- Produces: `scripts/import-history/import-payload.json` (imported by Rafael through the app's existing Import screen).

- [ ] **Step 1: Write the CLI script**

Create `scripts/import-history/build.ts`:

```ts
import { readFileSync, writeFileSync } from "fs";
import { buildImportPayload } from "./lib/buildImportPayload";
import { validateExportPayload } from "../../src/db/importExport";
import { SCHEMA_VERSION } from "../../src/db/schema";
import type { RawWorkoutSession } from "./lib/extractWorkoutSessions";
import type { AliasDraft } from "./lib/buildAliasDraft";

function main() {
  const sessions: RawWorkoutSession[] = JSON.parse(
    readFileSync("scripts/import-history/raw-workouts.json", "utf-8")
  );
  const aliasDraft: AliasDraft = JSON.parse(
    readFileSync("scripts/import-history/exercise-aliases.json", "utf-8")
  );

  const payload = buildImportPayload(
    sessions,
    aliasDraft,
    SCHEMA_VERSION,
    new Date().toISOString()
  );

  validateExportPayload(payload);

  writeFileSync("scripts/import-history/import-payload.json", JSON.stringify(payload, null, 2));

  console.log(
    `Wrote ${payload.sessions.length} sessions and ${payload.exercises.length} exercises.`
  );
}

main();
```

- [ ] **Step 2: Write the README**

Create `scripts/import-history/README.md`:

```markdown
# Workout history import

Turns a WhatsApp "chat with myself" workout log into an open-training backup
JSON, imported through the app's existing Import screen. See
`docs/superpowers/specs/2026-07-23-workout-history-import-design.md` for the
full design.

## Usage

    npx tsx scripts/import-history/parse.ts /path/to/treinos.txt
    # -> raw-workouts.json, unparsed-lines.txt (review the latter)

    npx tsx scripts/import-history/aliases.ts
    # -> exercise-aliases.json (DRAFT — hand-edit before continuing:
    #    fill in equipment/type/muscle_groups/canonicalName for every
    #    "new": true group, and merge any confirmed suggestedFuzzyMerges)

    npx tsx scripts/import-history/build.ts
    # -> import-payload.json

Then open the app, go to the Import screen, and pick `import-payload.json`.
Re-running `build.ts` after editing `exercise-aliases.json` is safe — the
app's import merges by uuid, so nothing is duplicated.
```

- [ ] **Step 3: Run the full pipeline end-to-end against the real 5-month file**

Run:

```bash
npx tsx scripts/import-history/parse.ts /Users/farxc/Downloads/treinos.txt
npx tsx scripts/import-history/aliases.ts
```

Then hand-review/edit `scripts/import-history/exercise-aliases.json` as described in Task 10, Step 2. Once every group has a `canonicalName` and every `"new": true` group has `equipment`/`type`/`muscle_groups` filled in, run:

```bash
npx tsx scripts/import-history/build.ts
```

Expected: prints a session/exercise count with no thrown error, and `scripts/import-history/import-payload.json` exists. Open it and spot-check that `exercises` contains entries for both matched seed exercises (e.g. `"Hack Squat"`, `is_custom: 0`) and new custom ones (`is_custom: 1`) with the muscle groups Rafael assigned.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-history/build.ts scripts/import-history/README.md
git commit -m "feat(import-history): add stage 3 build CLI and usage docs"
```

---

## Self-Review Notes

- **Spec coverage:** All three pipeline stages (parse, aliases, build), every parsing rule from the spec (weight carry-forward, interchangeable separators, unspell-checked rep units, rep ranges → lower value + note, bonus reps → first value + note, failure/RiR/bracket modifiers, multi-line wrap, ambiguous-line rejection), the alias-review workflow (draft + fuzzy suggestions, never auto-merged), literal-name matching for existing exercises, and the gitignore/privacy requirement are each covered by a task.
- **Placeholder scan:** no TBDs; every step has runnable code and concrete expected output.
- **Type consistency:** `ParsedSet` (Task 5) flows unchanged through `parseExerciseLine` (Task 6) and `RawWorkoutExercise`/`RawWorkoutSession` (Task 7) into `buildImportPayload` (Task 11). `AliasGroup`/`AliasDraft` (Task 9) are the same shape read from `exercise-aliases.json` in Task 12 and consumed by Task 11. Field names (`rawName`, `rawNames`, `canonicalName`, `weight_kg`, `reps`, `rir`, `failure`, `notes`) are consistent across every task that touches them.
- **Known limitation carried forward from the spec:** the fuzzy-merge threshold (`0.82`) is a starting point, not tuned against the full 2.3-year log — if the 5-month trial run in Task 12 shows too many or too few suggestions, adjust `FUZZY_THRESHOLD` in `scripts/import-history/lib/buildAliasDraft.ts` before running the full import.
