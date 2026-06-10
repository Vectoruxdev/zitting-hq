import { describe, it, expect } from "vitest";
import { nextOccurrence, nextOnOrAfter, firstRunOnOrAfter, dueRuns } from "./schedule";

describe("nextOccurrence (strictly after)", () => {
  it("monthly keeps the anchor day-of-month", () => {
    expect(nextOccurrence("monthly", "2026-01-15", "2026-01-15")).toBe("2026-02-15");
    expect(nextOccurrence("monthly", "2026-01-15", "2026-01-10")).toBe("2026-01-15");
  });
  it("monthly clamps to short months", () => {
    expect(nextOccurrence("monthly", "2026-01-31", "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence("monthly", "2026-01-31", "2026-02-28")).toBe("2026-03-31");
  });
  it("weekly steps 7 days from the anchor weekday", () => {
    expect(nextOccurrence("weekly", "2026-06-01", "2026-06-01")).toBe("2026-06-08");
    expect(nextOccurrence("weekly", "2026-06-01", "2026-06-05")).toBe("2026-06-08");
  });
  it("biweekly steps 14 days", () => {
    expect(nextOccurrence("biweekly", "2026-06-01", "2026-06-02")).toBe("2026-06-15");
    expect(nextOccurrence("biweekly", "2026-06-01", "2026-06-15")).toBe("2026-06-29");
  });
  it("semimonthly alternates 1st and 15th", () => {
    expect(nextOccurrence("semimonthly", null, "2026-06-03")).toBe("2026-06-15");
    expect(nextOccurrence("semimonthly", null, "2026-06-15")).toBe("2026-07-01");
    expect(nextOccurrence("semimonthly", null, "2026-06-20")).toBe("2026-07-01");
  });
  it("quarterly steps 3 months", () => {
    expect(nextOccurrence("quarterly", "2026-01-10", "2026-01-10")).toBe("2026-04-10");
  });
  it("yearly steps a year and clamps Feb 29", () => {
    expect(nextOccurrence("yearly", "2024-02-29", "2024-03-01")).toBe("2025-02-28");
  });
});

describe("firstRunOnOrAfter", () => {
  it("uses a future anchor as-is", () => {
    expect(firstRunOnOrAfter("monthly", "2026-07-01", "2026-06-09")).toBe("2026-07-01");
  });
  it("rolls a past anchor forward to the next occurrence >= today", () => {
    expect(firstRunOnOrAfter("monthly", "2026-01-01", "2026-06-09")).toBe("2026-07-01");
    expect(firstRunOnOrAfter("monthly", "2026-01-15", "2026-06-09")).toBe("2026-06-15");
  });
  it("includes today when today is itself an occurrence", () => {
    expect(firstRunOnOrAfter("semimonthly", null, "2026-06-15")).toBe("2026-06-15");
  });
});

describe("dueRuns (catch-up)", () => {
  it("returns every run-date through today", () => {
    expect(dueRuns("monthly", "2026-01-01", "2026-06-01", "2026-08-09")).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
  });
  it("returns just the one when next run is today", () => {
    expect(dueRuns("monthly", "2026-06-01", "2026-06-01", "2026-06-09")).toEqual(["2026-06-01"]);
  });
  it("returns nothing when the next run is in the future", () => {
    expect(dueRuns("monthly", "2026-06-01", "2026-07-01", "2026-06-09")).toEqual([]);
  });
  it("honors the catch-up cap", () => {
    expect(dueRuns("weekly", "2020-01-01", "2020-01-01", "2030-01-01", 5)).toHaveLength(5);
  });
  it("is empty when there is no next run date", () => {
    expect(dueRuns("monthly", "2026-01-01", null, "2026-08-09")).toEqual([]);
  });
});

describe("nextOnOrAfter", () => {
  it("returns the from-date when it is an occurrence", () => {
    expect(nextOnOrAfter("monthly", "2026-01-15", "2026-03-15")).toBe("2026-03-15");
  });
});
