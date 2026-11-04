import { maxOf, samplesOf, validateHealthImport } from "./model";
import type { HealthSeries } from "./types";
const record = (id: string, values: number[]): HealthSeries => ({ externalId: id, device: null, modifiedAt: null,
  samples: values.map((value, i) => ({ time: 1000 + i * 2000, value })) });

it("preserves real zeros and decimals and distinguishes no samples", () => {
  expect(maxOf(null)).toBeNull();
  expect(maxOf([record("one", [0])])).toBe(0);
  expect(maxOf([record("one", [0, 170.5])])).toBe(170.5);
});
it("deduplicates identical overlapping samples but rejects conflicting sensors", () => {
  expect(samplesOf([record("one", [120, 140]), record("two", [120])])).toHaveLength(2);
  expect(() => samplesOf([record("one", [120]), record("two", [130])])).toThrow("conflitantes");
});
it("rejects malformed backup payloads", () => {
  expect(() => validateHealthImport(null)).toThrow();
  expect(() => validateHealthImport({ uuid: "id", sourceScope: "phone", workout: {} })).toThrow();
});
