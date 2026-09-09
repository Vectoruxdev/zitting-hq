import { describe, expect, it } from "vitest";
import { daysBetween, reminderDueAt, zonedDateISO, zonedToUtc } from "./zoned-time";

describe("zonedToUtc", () => {
  it("converts Denver local time during daylight saving (UTC-6)", () => {
    expect(zonedToUtc("2026-09-08", "15:30").toISOString()).toBe("2026-09-08T21:30:00.000Z");
  });
  it("converts Denver local time in winter (UTC-7)", () => {
    expect(zonedToUtc("2026-01-15", "08:00").toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });
  it("treats all-day events as 9am local", () => {
    expect(zonedToUtc("2026-09-08", null).toISOString()).toBe("2026-09-08T15:00:00.000Z");
  });
  it("round-trips the local date", () => {
    expect(zonedDateISO(zonedToUtc("2026-09-08", "23:45"))).toBe("2026-09-08");
    expect(zonedDateISO(zonedToUtc("2026-09-08", "00:15"))).toBe("2026-09-08");
  });
});

describe("reminderDueAt / daysBetween", () => {
  it("subtracts the lead time", () => {
    expect(reminderDueAt("2026-09-08", "15:30", 60).toISOString()).toBe("2026-09-08T20:30:00.000Z");
  });
  it("counts whole days", () => {
    expect(daysBetween("2026-09-08", "2026-09-20")).toBe(12);
    expect(daysBetween("2026-09-08", "2026-09-08")).toBe(0);
    expect(daysBetween("2026-09-08", "2026-09-01")).toBe(-7);
  });
});
