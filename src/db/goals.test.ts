import { describe, expect, it } from "vitest";
import { computeProgress, currentStreak, daysUntil } from "./goals";

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-09-06", "2026-09-07", "2026-09-08"], "2026-09-08")).toBe(3);
  });
  it("survives until the day is over when today isn't checked yet", () => {
    expect(currentStreak(["2026-09-06", "2026-09-07"], "2026-09-08")).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(currentStreak(["2026-09-04", "2026-09-05", "2026-09-07"], "2026-09-08")).toBe(1);
    expect(currentStreak(["2026-09-01"], "2026-09-08")).toBe(0);
    expect(currentStreak([], "2026-09-08")).toBe(0);
  });
});

describe("computeProgress", () => {
  const today = "2026-09-08";
  it("checkoff is binary on completion", () => {
    expect(computeProgress({ progressKind: "checkoff", target: null }, [], today).value).toBe(0);
    expect(computeProgress({ progressKind: "checkoff", target: null, completedAt: "2026-09-01T00:00:00Z" }, [], today)).toMatchObject({ value: 1, done: true });
  });
  it("count sums amounts against the target and flags when met", () => {
    const p = computeProgress({ progressKind: "count", target: 20, unit: "books" }, [{ day: "2026-09-01", amount: 6 }, { day: today, amount: 2 }], today);
    expect(p).toMatchObject({ current: 8, target: 20, value: 0.4, unit: "books", doneToday: true, done: false });
    expect(computeProgress({ progressKind: "count", target: 5 }, [{ day: today, amount: 7 }], today)).toMatchObject({ value: 1, done: true });
  });
  it("streak counts distinct days and reports the live streak", () => {
    const p = computeProgress({ progressKind: "streak", target: 30 }, [{ day: "2026-09-07", amount: 1 }, { day: "2026-09-07", amount: 1 }, { day: today, amount: 1 }], today);
    expect(p).toMatchObject({ current: 2, streak: 2, doneToday: true, unit: "days" });
    expect(p.value).toBeCloseTo(2 / 30);
  });
  it("savings reads the linked finance goal", () => {
    const p = computeProgress({ progressKind: "savings", target: null }, [], today, { saved: 3200, target: 8000 });
    expect(p).toMatchObject({ current: 3200, target: 8000, value: 0.4, money: true, done: false });
    expect(computeProgress({ progressKind: "savings", target: null }, [], today, null).value).toBe(0);
  });
  it("never exceeds 1", () => {
    expect(computeProgress({ progressKind: "count", target: 2 }, [{ day: today, amount: 9 }], today).value).toBe(1);
  });
});

describe("daysUntil", () => {
  it("counts calendar days", () => {
    expect(daysUntil("2026-09-10", "2026-09-08")).toBe(2);
    expect(daysUntil("2026-09-08", "2026-09-08")).toBe(0);
    expect(daysUntil("2026-09-01", "2026-09-08")).toBe(-7);
    expect(daysUntil(null, "2026-09-08")).toBeNull();
  });
});
