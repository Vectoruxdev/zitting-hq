import { describe, expect, it } from "vitest";
import { expandSpan, sortItems, type CalItem } from "./calendar";

const base = (o: Partial<CalItem>): CalItem => ({ key: "k", kind: "event", title: "t", dateISO: "2026-09-08", endDateISO: null, time: null, endTime: null, location: null, note: null, prepNotes: null, forMemberId: null, driverMemberId: null, cookMemberId: null, source: "Family", color: null, familyEventId: null, tripId: null, visibility: "family", createdBy: null, reminders: [], ...o });

describe("expandSpan", () => {
  it("emits one item per day inside the window with day-of-trip", () => {
    const out = expandSpan({ dateISO: "2026-09-06", endDateISO: "2026-09-10" }, "2026-09-08", "2026-09-30");
    expect(out.map((x) => x.dateISO)).toEqual(["2026-09-08", "2026-09-09", "2026-09-10"]);
    expect(out[0].dayOfTrip).toEqual({ n: 3, of: 5 });
  });
  it("returns nothing outside the window and no day-of-trip for single days", () => {
    expect(expandSpan({ dateISO: "2026-10-01", endDateISO: null }, "2026-09-01", "2026-09-30")).toEqual([]);
    expect(expandSpan({ dateISO: "2026-09-08", endDateISO: null }, "2026-09-01", "2026-09-30")[0].dayOfTrip).toBeUndefined();
  });
});

describe("sortItems", () => {
  it("orders by date, then trips → all-day → timed → dinner", () => {
    const items = [
      base({ key: "dinner", kind: "dinner" }),
      base({ key: "timed", time: "15:30" }),
      base({ key: "early", time: "08:15" }),
      base({ key: "allday" }),
      base({ key: "trip", kind: "trip" }),
      base({ key: "tomorrow", dateISO: "2026-09-09" }),
    ].sort(sortItems);
    expect(items.map((i) => i.key)).toEqual(["trip", "allday", "early", "timed", "dinner", "tomorrow"]);
  });
});
