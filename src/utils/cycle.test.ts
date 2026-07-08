import { addDays, cyclicSlotIndex, daysBetween, weekday } from "./cycle";

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-06-09", "2026-06-12")).toBe(3);
  });
  it("is negative before the anchor", () => {
    expect(daysBetween("2026-06-09", "2026-06-07")).toBe(-2);
  });
});

describe("weekday", () => {
  it("returns JS getDay (0=Sun..6=Sat)", () => {
    expect(weekday("2026-06-01")).toBe(1); // Monday
    expect(weekday("2026-06-07")).toBe(0); // Sunday
    expect(weekday("2026-06-09")).toBe(2); // Tuesday
  });
});

describe("addDays", () => {
  it("adds days and rolls over months", () => {
    expect(addDays("2026-06-01", 1)).toBe("2026-06-02");
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
  });
});

describe("cyclicSlotIndex", () => {
  const anchor = "2026-06-01"; // Monday
  const rest = [2, 5]; // Tue, Fri
  const N = 5;

  it("maps the anchor (eligible) to slot 0", () => {
    expect(cyclicSlotIndex(anchor, "2026-06-01", N, rest)).toBe(0);
  });
  it("returns -1 on rest weekdays", () => {
    expect(cyclicSlotIndex(anchor, "2026-06-02", N, rest)).toBe(-1); // Tue
    expect(cyclicSlotIndex(anchor, "2026-06-05", N, rest)).toBe(-1); // Fri
  });
  it("skips rest weekdays without advancing (order preserved)", () => {
    expect(cyclicSlotIndex(anchor, "2026-06-03", N, rest)).toBe(1); // Wed
    expect(cyclicSlotIndex(anchor, "2026-06-04", N, rest)).toBe(2); // Thu
    expect(cyclicSlotIndex(anchor, "2026-06-06", N, rest)).toBe(3); // Sat
    expect(cyclicSlotIndex(anchor, "2026-06-07", N, rest)).toBe(4); // Sun
  });
  it("wraps around after counting eligible days", () => {
    expect(cyclicSlotIndex(anchor, "2026-06-08", N, rest)).toBe(0); // 6th eligible
    expect(cyclicSlotIndex(anchor, "2026-06-10", N, rest)).toBe(1);
  });
  it("handles an anchor that lands on a rest weekday", () => {
    expect(cyclicSlotIndex("2026-06-02", "2026-06-02", N, rest)).toBe(-1);
    expect(cyclicSlotIndex("2026-06-02", "2026-06-03", N, rest)).toBe(0);
    expect(cyclicSlotIndex("2026-06-02", "2026-06-04", N, rest)).toBe(1);
  });
  it("handles dates before the anchor", () => {
    expect(cyclicSlotIndex("2026-06-08", "2026-06-07", N, rest)).toBe(4);
    expect(cyclicSlotIndex("2026-06-08", "2026-06-06", N, rest)).toBe(3);
  });
  it("returns -1 for non-positive unit count", () => {
    expect(cyclicSlotIndex(anchor, "2026-06-03", 0, rest)).toBe(-1);
  });
  it("works with no rest weekdays (advances every day)", () => {
    expect(cyclicSlotIndex("2026-06-01", "2026-06-04", 3, [])).toBe(0);
    expect(cyclicSlotIndex("2026-06-01", "2026-06-02", 3, [])).toBe(1);
  });
});
