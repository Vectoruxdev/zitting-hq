import { describe, expect, it } from "vitest";
import { groupByDay, localDay, pickForDay } from "./photos";

describe("groupByDay", () => {
  const today = localDay(new Date().toISOString());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const items = [
    { id: 1, takenAt: new Date().toISOString() },
    { id: 2, takenAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: 3, takenAt: y.toISOString() },
    { id: 4, takenAt: null },
  ];
  it("labels today, yesterday, dates and undated", () => {
    const g = groupByDay(items, today);
    expect(g.map((x) => x.label)).toEqual(["Today", "Yesterday", "Undated"]);
    expect(g[0].items.map((i) => i.id)).toEqual([1, 2]);
  });
  it("is stable for a day", () => {
    expect(pickForDay([1, 2, 3], "2026-09-08")).toBe(pickForDay([1, 2, 3], "2026-09-08"));
    expect(pickForDay([], "2026-09-08")).toBeNull();
  });
});
