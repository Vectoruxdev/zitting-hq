import { describe, it, expect } from "vitest";
import { expandIcs } from "./ics";

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;

describe("expandIcs", () => {
  it("parses a simple timed event with folded summary", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:a@x\r\nSUMMARY:Soccer\r\n practice\r\nDTSTART;TZID=America/Denver:20260612T173000\r\nDTEND;TZID=America/Denver:20260612T183000\r\nEND:VEVENT"
    );
    const out = expandIcs(ics, "2026-06-08", "2026-06-14");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: "Soccerpractice", dateISO: "2026-06-12", time: "17:30" });
  });

  it("all-day events have null time; multi-day DTEND is exclusive", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:b@x\r\nSUMMARY:Camping\r\nDTSTART;VALUE=DATE:20260612\r\nDTEND;VALUE=DATE:20260615\r\nEND:VEVENT"
    );
    const out = expandIcs(ics, "2026-06-08", "2026-06-30");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ dateISO: "2026-06-12", time: null, endDateISO: "2026-06-14" });
  });

  it("expands weekly RRULE with BYDAY inside the window only", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:c@x\r\nSUMMARY:Piano\r\nDTSTART:20260601T160000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\nEND:VEVENT"
    );
    const out = expandIcs(ics, "2026-06-08", "2026-06-14");
    expect(out.map((e) => e.dateISO)).toEqual(["2026-06-08", "2026-06-10"]);
    expect(out[0].time).toBe("16:00");
  });

  it("respects UNTIL, COUNT, and EXDATE", () => {
    const until = wrap(
      "BEGIN:VEVENT\r\nUID:d@x\r\nSUMMARY:Standup\r\nDTSTART:20260601T090000\r\nRRULE:FREQ=DAILY;UNTIL=20260603T235959Z\r\nEND:VEVENT"
    );
    expect(expandIcs(until, "2026-06-01", "2026-06-30").length).toBeLessThanOrEqual(3);

    const count = wrap(
      "BEGIN:VEVENT\r\nUID:e@x\r\nSUMMARY:Series\r\nDTSTART:20260601T090000\r\nRRULE:FREQ=DAILY;COUNT=2\r\nEND:VEVENT"
    );
    expect(expandIcs(count, "2026-06-01", "2026-06-30")).toHaveLength(2);

    const ex = wrap(
      "BEGIN:VEVENT\r\nUID:f@x\r\nSUMMARY:Class\r\nDTSTART:20260601T100000\r\nRRULE:FREQ=WEEKLY\r\nEXDATE:20260608T100000\r\nEND:VEVENT"
    );
    const dates = expandIcs(ex, "2026-06-01", "2026-06-21").map((e) => e.dateISO);
    expect(dates).toEqual(["2026-06-01", "2026-06-15"]);
  });

  it("drops cancelled events and replaced (RECURRENCE-ID) instances", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT\r\nUID:g@x\r\nSUMMARY:Lesson\r\nDTSTART:20260601T140000\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEND:VEVENT",
        // June 8 instance moved to June 9
        "BEGIN:VEVENT\r\nUID:g@x\r\nSUMMARY:Lesson (moved)\r\nDTSTART:20260609T150000\r\nRECURRENCE-ID:20260608T140000\r\nEND:VEVENT",
        "BEGIN:VEVENT\r\nUID:h@x\r\nSUMMARY:Nope\r\nSTATUS:CANCELLED\r\nDTSTART:20260610T090000\r\nEND:VEVENT",
      ].join("\r\n")
    );
    const out = expandIcs(ics, "2026-06-01", "2026-06-21");
    const titles = out.map((e) => `${e.dateISO} ${e.title}`);
    expect(titles).toContain("2026-06-01 Lesson");
    expect(titles).toContain("2026-06-09 Lesson (moved)");
    expect(titles).toContain("2026-06-15 Lesson");
    expect(titles).not.toContain("2026-06-08 Lesson");
    expect(titles.some((t) => t.includes("Nope"))).toBe(false);
  });

  it("unescapes text and handles monthly recurrence", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:i@x\r\nSUMMARY:Dinner\\, fancy\r\nLOCATION:Mom\\'s\r\nDTSTART:20260105T180000\r\nRRULE:FREQ=MONTHLY;INTERVAL=1\r\nEND:VEVENT"
    );
    const out = expandIcs(ics, "2026-06-01", "2026-06-30");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Dinner, fancy");
    expect(out[0].dateISO).toBe("2026-06-05");
  });
});
