import { CLASS_TOKENS } from "./palette";
import type { ColorToken } from "./palette";

/* eslint-disable @typescript-eslint/no-var-requires */
const tailwindConfig = require("../../tailwind.config.js");

type ColorTree = { [key: string]: string | ColorTree };

/** Flattens Tailwind's nested color object into the leaf values. */
function leaves(tree: ColorTree, path: string[] = []): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[[...path, key].join("."), value] as [string, string]]
      : leaves(value, [...path, key])
  );
}

/**
 * The palette and the Tailwind config are written in two places by necessity —
 * one is a value map, the other a class-name tree. These assertions are what
 * keeps them from drifting: a token added to one and forgotten in the other
 * would otherwise show up as a class that silently renders transparent.
 */
describe("tailwind color tokens", () => {
  const colorLeaves = leaves(tailwindConfig.theme.extend.colors as ColorTree);

  it("routes every color through a CSS variable, never a literal", () => {
    for (const [name, value] of colorLeaves) {
      expect([name, value]).toEqual([name, expect.stringMatching(/^rgb\(var\(--color-[a-z0-9-]+\) \/ <alpha-value>\)$/)]);
    }
  });

  it("references only tokens that exist in the palette", () => {
    const referenced = colorLeaves.map(([, value]) => /--color-([a-z0-9-]+)/.exec(value)![1]);
    expect(referenced.filter((token) => !CLASS_TOKENS.includes(token as ColorToken))).toEqual([]);
  });

  it("exposes every palette token as a class", () => {
    const referenced = new Set(
      colorLeaves.map(([, value]) => /--color-([a-z0-9-]+)/.exec(value)![1])
    );
    expect(CLASS_TOKENS.filter((token) => !referenced.has(token))).toEqual([]);
  });

  /**
   * "media" makes colorScheme.set() throw on web, so the user could never pick a
   * theme in the browser. Worth a test because the symptom appears far from the
   * cause.
   */
  it("uses class-based dark mode", () => {
    expect(tailwindConfig.darkMode).toBe("class");
  });
});
