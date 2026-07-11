import { periodRange, previousPeriodRange, trendBuckets } from "./periods";

describe("periodRange", () => {
  describe("week", () => {
    it("returns Mon-Sun for a mid-week ref (Wednesday)", () => {
      // 2026-07-08 is a Wednesday
      expect(periodRange("week", "2026-07-08")).toEqual({
        start: "2026-07-06", // Monday
        end: "2026-07-12", // Sunday
      });
    });
    it("handles refISO being itself a Monday", () => {
      expect(periodRange("week", "2026-07-06")).toEqual({
        start: "2026-07-06",
        end: "2026-07-12",
      });
    });
    it("handles refISO being itself a Sunday", () => {
      expect(periodRange("week", "2026-07-12")).toEqual({
        start: "2026-07-06",
        end: "2026-07-12",
      });
    });
  });

  describe("month", () => {
    it("returns first/last day of a 31-day month", () => {
      expect(periodRange("month", "2026-07-15")).toEqual({
        start: "2026-07-01",
        end: "2026-07-31",
      });
    });
    it("returns first/last day of a 30-day month", () => {
      expect(periodRange("month", "2026-04-15")).toEqual({
        start: "2026-04-01",
        end: "2026-04-30",
      });
    });
    it("handles February in a non-leap year", () => {
      expect(periodRange("month", "2025-02-10")).toEqual({
        start: "2025-02-01",
        end: "2025-02-28",
      });
    });
    it("handles February in a leap year", () => {
      expect(periodRange("month", "2024-02-10")).toEqual({
        start: "2024-02-01",
        end: "2024-02-29",
      });
    });
  });

  describe("semester", () => {
    it("classifies a June date as S1", () => {
      expect(periodRange("semester", "2026-06-30")).toEqual({
        start: "2026-01-01",
        end: "2026-06-30",
      });
    });
    it("classifies a July date as S2", () => {
      expect(periodRange("semester", "2026-07-01")).toEqual({
        start: "2026-07-01",
        end: "2026-12-31",
      });
    });
    it("classifies a January date as S1", () => {
      expect(periodRange("semester", "2026-01-15")).toEqual({
        start: "2026-01-01",
        end: "2026-06-30",
      });
    });
    it("classifies a December date as S2", () => {
      expect(periodRange("semester", "2026-12-15")).toEqual({
        start: "2026-07-01",
        end: "2026-12-31",
      });
    });
  });

  describe("year", () => {
    it("returns Jan 1 - Dec 31 of the ref year", () => {
      expect(periodRange("year", "2026-07-08")).toEqual({
        start: "2026-01-01",
        end: "2026-12-31",
      });
    });
  });
});

describe("previousPeriodRange", () => {
  it("week: previous Mon-Sun", () => {
    expect(previousPeriodRange("week", "2026-07-08")).toEqual({
      start: "2026-06-29",
      end: "2026-07-05",
    });
  });

  it("month: previous month within the same year", () => {
    expect(previousPeriodRange("month", "2026-07-15")).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    });
  });

  it("month: January rolls back to December of the prior year", () => {
    expect(previousPeriodRange("month", "2026-01-10")).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("semester: S2 rolls back to S1 of the same year", () => {
    expect(previousPeriodRange("semester", "2026-09-01")).toEqual({
      start: "2026-01-01",
      end: "2026-06-30",
    });
  });

  it("semester: S1 rolls back to S2 of the prior year", () => {
    expect(previousPeriodRange("semester", "2026-03-01")).toEqual({
      start: "2025-07-01",
      end: "2025-12-31",
    });
  });

  it("year: previous calendar year", () => {
    expect(previousPeriodRange("year", "2026-07-08")).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
    });
  });
});

describe("trendBuckets", () => {
  it("week: defaults to 8 buckets, chronological, ending with current week", () => {
    const buckets = trendBuckets("week", "2026-07-08");
    expect(buckets).toHaveLength(8);
    expect(buckets[buckets.length - 1]).toEqual({
      ...periodRange("week", "2026-07-08"),
      label: buckets[buckets.length - 1].label,
    });
    // chronological: each bucket's start is 7 days after the previous one's start
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].start > buckets[i - 1].start).toBe(true);
    }
  });

  it("week: label is compact day/month of the Monday", () => {
    const buckets = trendBuckets("week", "2026-07-08", 1);
    expect(buckets[0].label).toBe("6/7");
  });

  it("month: defaults to 6 buckets", () => {
    const buckets = trendBuckets("month", "2026-07-15");
    expect(buckets).toHaveLength(6);
    expect(buckets[buckets.length - 1]).toEqual({
      ...periodRange("month", "2026-07-15"),
      label: buckets[buckets.length - 1].label,
    });
  });

  it("month: labels are 3-letter Portuguese abbreviations", () => {
    const buckets = trendBuckets("month", "2026-07-15", 3);
    expect(buckets.map((b) => b.label)).toEqual(["Mai", "Jun", "Jul"]);
  });

  it("month: chronological order across a year boundary", () => {
    const buckets = trendBuckets("month", "2026-01-15", 3);
    expect(buckets.map((b) => b.label)).toEqual(["Nov", "Dez", "Jan"]);
    expect(buckets[0].start).toBe("2025-11-01");
    expect(buckets[2].start).toBe("2026-01-01");
  });

  it("semester: defaults to 4 buckets", () => {
    const buckets = trendBuckets("semester", "2026-07-08");
    expect(buckets).toHaveLength(4);
    expect(buckets[buckets.length - 1]).toEqual({
      ...periodRange("semester", "2026-07-08"),
      label: buckets[buckets.length - 1].label,
    });
  });

  it("semester: labels formatted as S#/YY", () => {
    const buckets = trendBuckets("semester", "2026-07-08", 2);
    expect(buckets.map((b) => b.label)).toEqual(["S1/26", "S2/26"]);
  });

  it("year: defaults to 4 buckets", () => {
    const buckets = trendBuckets("year", "2026-07-08");
    expect(buckets).toHaveLength(4);
    expect(buckets.map((b) => b.label)).toEqual(["2023", "2024", "2025", "2026"]);
  });

  it("year: last bucket equals periodRange(g, refISO)", () => {
    const buckets = trendBuckets("year", "2026-07-08", 2);
    expect(buckets[buckets.length - 1]).toEqual({
      ...periodRange("year", "2026-07-08"),
      label: "2026",
    });
  });

  it("honors an explicit count override", () => {
    expect(trendBuckets("week", "2026-07-08", 3)).toHaveLength(3);
    expect(trendBuckets("month", "2026-07-08", 12)).toHaveLength(12);
  });
});
