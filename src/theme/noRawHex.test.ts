import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * Colors belong in src/theme/palette.js and nowhere else — neither as a hex
 * literal nor as one of Tailwind's own palette classes.
 *
 * A source scan rather than a lint rule for the same reason styleProps.test.ts
 * is one: the offending shapes are strings in JSX props and inline style
 * objects, and the list of files still to convert is more useful kept in one
 * sorted place than as 80 scattered eslint-disable comments.
 *
 * PENDING was the migration's burndown chart — 80 files at the start, emptied
 * phase by phase. It is empty now, which means the guard is armed: a raw colour
 * anywhere in app/ or src/ outside src/theme fails this test.
 *
 * Never add an entry back. If this fails, the colour belongs in palette.js.
 */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

/**
 * Tailwind's own palette classes bypass the token layer just as effectively as
 * a hex does — and more quietly, since they look like any other utility. This
 * was a real miss: 23 `text-white` survived the whole migration and only turned
 * up as light-on-light text on a filled button, because `bg-brand-500` inverts
 * in dark and a literal white does not. Use text-brand-ink for a label on a
 * fill, or bg-surface-card for a card.
 */
const RAW_CLASS = /\b(?:text|bg|border|shadow|fill|stroke)-(?:white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;

const ROOTS = ["src", "app"];

/** src/theme is where the colors live; the tests there assert on them. */
const ALLOWED_DIRS = [join("src", "theme")];

/**
 * Empty. The migration is done, so this guard is now live: any raw colour added
 * to app/ or src/ outside src/theme fails the suite.
 */
const PENDING = new Set<string>([
]);

/**
 * Comments are prose, and prose gets to name a color — "values/styles.xml pins
 * it to #ffffff" is documentation, not a style. Strings are what ship.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("raw colors", () => {
  const repoRoot = join(__dirname, "..", "..");

  const scanned = ROOTS.flatMap((root) => sourceFiles(join(repoRoot, root)))
    .map((file) => relative(repoRoot, file))
    .filter((file) => !ALLOWED_DIRS.some((dir) => file.startsWith(dir + sep)))
    .sort();

  const offenders = scanned.filter((file) => {
    const source = stripComments(readFileSync(join(repoRoot, file), "utf8"));
    return RAW_COLOR.test(source) || RAW_CLASS.test(source);
  });

  it("appear only in files still pending migration", () => {
    const toPosix = (file: string) => file.split(sep).join("/");
    expect(offenders.map(toPosix).filter((file) => !PENDING.has(file))).toEqual([]);
  });

  /**
   * Keeps the burndown honest: a file that has been converted must be struck
   * from PENDING, so the set always reflects the real remaining work.
   */
  it("has no stale entries in PENDING", () => {
    const offending = new Set(offenders.map((file) => file.split(sep).join("/")));
    expect([...PENDING].filter((file) => !offending.has(file)).sort()).toEqual([]);
  });
});
