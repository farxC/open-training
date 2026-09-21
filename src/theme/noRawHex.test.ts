import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * Colors belong in src/theme/palette.js and nowhere else.
 *
 * A source scan rather than a lint rule for the same reason styleProps.test.ts
 * is one: the offending shapes are strings in JSX props and inline style
 * objects, and the list of files still to convert is more useful kept in one
 * sorted place than as 80 scattered eslint-disable comments.
 *
 * This doubles as the migration's burndown chart. Every phase's definition of
 * done is "delete these files from PENDING". The suite stays green at every
 * commit, and once PENDING is empty the guard switches itself on.
 *
 * Only ever remove entries. Adding one means a new raw color got in.
 */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

const ROOTS = ["src", "app"];

/** src/theme is where the colors live; the tests there assert on them. */
const ALLOWED_DIRS = [join("src", "theme")];

/**
 * Files still holding raw colors, to be emptied phase by phase.
 * Phase 4a: feed · 4b: profile/analytics · 4c: session · 4d: exercises · 4e: routine
 */
const PENDING = new Set<string>([
  "app/(tabs)/routine.tsx",
  "app/exercises/[id].tsx",
  "app/exercises/[id]/variations.tsx",
  "app/routine/[id].tsx",
  "app/routine/new-split.tsx",
  "app/routine/program/[id].tsx",
  "app/routine/program/new.tsx",
  "app/routine/program/week/[id].tsx",
  "app/session/[id].tsx",
  "app/session/new.tsx",
  "src/components/AnalyticsMuscleBreakdown.tsx",
  "src/components/DateField.web.tsx",
  "src/components/DatePickerModal.tsx",
  "src/components/DayBreakdownModal.tsx",
  "src/components/DistancePlanTable.tsx",
  "src/components/DistanceSessionForm.tsx",
  "src/components/DraggableList.tsx",
  "src/components/ExerciseConfigEditor.tsx",
  "src/components/ExerciseEditSheet.tsx",
  "src/components/ExercisePickerModal.tsx",
  "src/components/ExerciseProgressChart.tsx",
  "src/components/ExerciseSessionCard.tsx",
  "src/components/ExerciseSetHistory.tsx",
  "src/components/ExerciseSpecSheet.tsx",
  "src/components/ExerciseStatBand.tsx",
  "src/components/ModalityCardGrid.tsx",
  "src/components/ModalityChips.tsx",
  "src/components/ModalityToggle.tsx",
  "src/components/MuscleExerciseList.tsx",
  "src/components/MuscleGroupEditor.tsx",
  "src/components/MuscleSeriesSessionCard.tsx",
  "src/components/PhotoAttachment.tsx",
  "src/components/PhotoAttachment.web.tsx",
  "src/components/RecordStamp.tsx",
  "src/components/RecordsByMuscleGroup.tsx",
  "src/components/ResistanceCurveChartImpl.tsx",
  "src/components/ResistanceCurveGlyph.tsx",
  "src/components/RoutineCalendar.tsx",
  "src/components/SessionFinishModal.tsx",
  "src/components/SessionTimer.tsx",
  "src/components/SetLogger.tsx",
  "src/components/SetRow.tsx",
  "src/components/SortableExerciseList.tsx",
  "src/components/StrengthPlanTable.tsx",
  "src/components/TargetFields.tsx",
  "src/components/TickBar.tsx",
  "src/components/VariationSwapModal.tsx",
  "src/components/VolumeChartImpl.tsx",
  "src/components/WeekdayPicker.tsx",
  "src/utils/recordsGamification.test.ts",
  "src/utils/recordsGamification.ts",
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

  const offenders = scanned.filter((file) =>
    RAW_COLOR.test(stripComments(readFileSync(join(repoRoot, file), "utf8")))
  );

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
