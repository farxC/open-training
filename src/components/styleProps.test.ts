import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Function-valued style props are broken on native by NativeWind.
 *
 * Its JSX transform swaps every Pressable/View/Text for the react-native-css-
 * interop wrapper. On native the wrapper collects the inline `style` prop as a
 * style rule and spreads it — `{ ...fn }` is `{}` — then overwrites the prop
 * with that empty object, so `style={({ pressed }) => …}` silently renders
 * unstyled on device while still working in the browser (the web interop path
 * never touches `style`). Use local state for pressed/hovered instead:
 * src/hooks/useInteractionState.ts.
 *
 * This is a source scan rather than a render test because wrap-jsx skips
 * registering the interop components when NODE_ENV === "test", so the bug
 * cannot reproduce under jest.
 */
const FUNCTION_STYLE = /[A-Za-z]*[Ss]tyle=\{\s*\(/;

const ROOTS = ["src", "app"];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsxFiles(full));
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("style props", () => {
  it("are never functions (NativeWind discards them on native)", () => {
    const repoRoot = join(__dirname, "..", "..");
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of tsxFiles(join(repoRoot, root))) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, index) => {
          if (FUNCTION_STYLE.test(line)) {
            offenders.push(`${file.slice(repoRoot.length + 1)}:${index + 1}`);
          }
        });
      }
    }

    expect(offenders).toEqual([]);
  });
});
