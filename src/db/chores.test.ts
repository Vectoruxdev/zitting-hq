import { describe, expect, it } from "vitest";
import { choreStreak, dayFor, isDue, weekOf, weekPoints, type Chore, type Completion } from "./chores";

const chore = (o: Partial<Chore> & { id: string }): Chore => ({ title: o.id, icon: null, assigneeMemberId: "kid", days: "0123456", timeOfDay: "any", points: 1, needsCheck: false, active: true, sort: 0, ...o });
const done = (choreId: string, day: string, checkedAt: string | null = null): Completion => ({ id: Math.random(), choreId, memberId: "kid", day, doneAt: day, checkedBy: checkedAt ? "mom" : null, checkedAt });

describe("weekOf / isDue", () => {
  it("returns Sunday..Saturday around the date", () => {
    // 2026-09-08 is a Tuesday
    expect(weekOf("2026-09-08")).toEqual(["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"]);
  });
  it("uses weekday digits, Sunday = 0", () => {
    const weekdays = chore({ id: "a", days: "12345" });
    expect(isDue(weekdays, "2026-09-08")).toBe(true);   // Tue
    expect(isDue(weekdays, "2026-09-06")).toBe(false);  // Sun
    expect(isDue({ ...weekdays, active: false }, "2026-09-08")).toBe(false);
  });
});

describe("dayFor", () => {
  const chores = [chore({ id: "bed", timeOfDay: "morning", points: 1 }), chore({ id: "dishes", timeOfDay: "evening", points: 2, needsCheck: true }), chore({ id: "trash", assigneeMemberId: null, days: "2" })];
  it("splits due chores per person and the shared pool, in time order", () => {
    const [kid, anyone] = dayFor(chores, [], ["kid", null], "2026-09-08");
    expect(kid.due.map((c) => c.id)).toEqual(["bed", "dishes"]);
    expect(kid).toMatchObject({ allDone: false, points: 0, possible: 3, waitingCheck: 0 });
    expect(anyone.due.map((c) => c.id)).toEqual(["trash"]);
  });
  it("counts points only once a needs-check chore is checked", () => {
    const [kid] = dayFor(chores, [done("bed", "2026-09-08"), done("dishes", "2026-09-08")], ["kid"], "2026-09-08");
    expect(kid).toMatchObject({ allDone: true, points: 1, waitingCheck: 1 });
    const [checked] = dayFor(chores, [done("bed", "2026-09-08"), done("dishes", "2026-09-08", "2026-09-08T20:00:00Z")], ["kid"], "2026-09-08");
    expect(checked).toMatchObject({ points: 3, waitingCheck: 0 });
  });
});

describe("choreStreak", () => {
  const chores = [chore({ id: "bed" }), chore({ id: "read", days: "135" })];
  it("counts full days back from today, skipping days with nothing due", () => {
    const comps = [done("bed", "2026-09-06"), done("bed", "2026-09-07"), done("read", "2026-09-07"), done("bed", "2026-09-08")];
    expect(choreStreak(chores, comps, "kid", "2026-09-08")).toBe(3);
  });
  it("doesn't break on an unfinished today", () => {
    const comps = [done("bed", "2026-09-06"), done("bed", "2026-09-07"), done("read", "2026-09-07")];
    expect(choreStreak(chores, comps, "kid", "2026-09-08")).toBe(2);
  });
  it("breaks on a missed day", () => {
    const comps = [done("bed", "2026-09-05"), done("bed", "2026-09-07"), done("read", "2026-09-07"), done("bed", "2026-09-08")];
    expect(choreStreak(chores, comps, "kid", "2026-09-08")).toBe(2);
    expect(choreStreak(chores, [], "kid", "2026-09-08")).toBe(0);
    expect(choreStreak(chores, comps, "nobody", "2026-09-08")).toBe(0);
  });
});

describe("weekPoints", () => {
  it("sums the week", () => {
    const chores = [chore({ id: "bed", points: 2 })];
    const week = weekOf("2026-09-08");
    expect(weekPoints(chores, [done("bed", "2026-09-06"), done("bed", "2026-09-08")], "kid", week)).toEqual({ points: 4, possible: 14 });
  });
});
