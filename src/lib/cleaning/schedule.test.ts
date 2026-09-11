import { describe, expect, it } from "vitest";
import { addDays, assigneeFor, dueDateFor, isOpenOn, nextDueOnOrAfter, occurrenceIndex, occurrenceOn, periodKeyFor, rhythmLabel, upcoming, validateAssign, validateRhythm, weekStart, type Scheduled } from "./schedule";

// 2026-09-10 is a Thursday; the week is Sun 2026-09-06 … Sat 2026-09-12.
const task = (id: string, rhythm: Scheduled["rhythm"], assign: Scheduled["assign"] = { mode: "anyone" }, createdOn = "2026-09-01"): Scheduled => ({ id, rhythm, assign, active: true, createdOn });

describe("periods", () => {
  it("weeks start on Sunday", () => {
    expect(weekStart("2026-09-10")).toBe("2026-09-06");
    expect(weekStart("2026-09-06")).toBe("2026-09-06");
    expect(weekStart("2026-09-12")).toBe("2026-09-06");
  });
  it("daily and weekday tasks live in a day, every-n-weeks in a week, monthly in a month", () => {
    expect(periodKeyFor({ type: "daily" }, "2026-09-10")).toBe("2026-09-10");
    expect(periodKeyFor({ type: "weekly", weekdays: [6] }, "2026-09-12")).toBe("2026-09-12");
    expect(periodKeyFor({ type: "every_weeks", n: 2, weekday: 6, anchor: "2026-09-08" }, "2026-09-10")).toBe("2026-09-06");
    expect(periodKeyFor({ type: "monthly", day: 15 }, "2026-09-10")).toBe("2026-09");
  });
});

describe("isOpenOn", () => {
  it("Saturday-only tasks are open on Saturdays only", () => {
    const r = { type: "weekly" as const, weekdays: [6] };
    expect(isOpenOn(r, "2026-09-12")).toBe(true);
    expect(isOpenOn(r, "2026-09-10")).toBe(false);
  });
  it("every other week: open through the due week, closed the week between", () => {
    const r = { type: "every_weeks" as const, n: 2, weekday: 6, anchor: "2026-09-08" };
    expect(isOpenOn(r, "2026-09-06")).toBe(true);   // Sunday of the anchor week
    expect(isOpenOn(r, "2026-09-12")).toBe(true);   // its Saturday
    expect(isOpenOn(r, "2026-09-15")).toBe(false);  // the week between
    expect(isOpenOn(r, "2026-09-22")).toBe(true);   // two weeks on
    expect(isOpenOn(r, "2026-08-30")).toBe(false);  // before the anchor
    expect(dueDateFor(r, "2026-09-20")).toBe("2026-09-26");
  });
  it("monthly is open all month and due by its day, clamped to short months", () => {
    expect(isOpenOn({ type: "monthly", day: 15 }, "2026-09-01")).toBe(true);
    expect(dueDateFor({ type: "monthly", day: 15 }, "2026-09")).toBe("2026-09-15");
    expect(dueDateFor({ type: "monthly", day: "last" }, "2026-02")).toBe("2026-02-28");
    expect(dueDateFor({ type: "monthly", day: "last" }, "2028-02")).toBe("2028-02-29");
  });
  it("once is a single day", () => {
    expect(isOpenOn({ type: "once", date: "2026-09-20" }, "2026-09-20")).toBe(true);
    expect(isOpenOn({ type: "once", date: "2026-09-20" }, "2026-09-21")).toBe(false);
  });
});

describe("rotation", () => {
  const K = "katelynn", J = "jaelynn";
  it("alternates week by week for an every-week task", () => {
    const t = task("mop", { type: "every_weeks", n: 1, weekday: 6, anchor: "2026-09-06" }, { mode: "rotation", memberIds: [J, K], anchor: "2026-09-06" });
    expect(assigneeFor(t, "2026-09-06")).toBe(J);
    expect(assigneeFor(t, "2026-09-13")).toBe(K);
    expect(assigneeFor(t, "2026-09-20")).toBe(J);
  });
  it("counts only the days a weekday task actually comes round", () => {
    const r = { type: "weekly" as const, weekdays: [1, 4] }; // Mon + Thu
    expect(occurrenceIndex(r, "2026-09-07", "2026-09-07")).toBe(0); // Mon
    expect(occurrenceIndex(r, "2026-09-10", "2026-09-07")).toBe(1); // Thu
    expect(occurrenceIndex(r, "2026-09-14", "2026-09-07")).toBe(2); // next Mon
  });
  it("a hand-off wins for that period only", () => {
    const t = task("mop", { type: "every_weeks", n: 1, weekday: 6, anchor: "2026-09-06" }, { mode: "rotation", memberIds: [J, K], anchor: "2026-09-06" });
    expect(assigneeFor(t, "2026-09-06", K)).toBe(K);
    expect(assigneeFor(t, "2026-09-13")).toBe(K);
  });
  it("person and anyone", () => {
    expect(assigneeFor(task("a", { type: "daily" }, { mode: "person", memberId: K }), "2026-09-10")).toBe(K);
    expect(assigneeFor(task("b", { type: "daily" }), "2026-09-10")).toBeNull();
  });
});

describe("occurrences and what is coming up", () => {
  it("skips paused tasks", () => {
    expect(occurrenceOn({ ...task("a", { type: "daily" }), active: false }, "2026-09-10")).toBeNull();
  });
  it("lists the next non-daily due dates once each, soonest first", () => {
    const ts = [
      task("daily", { type: "daily" }),
      task("sat", { type: "weekly", weekdays: [6] }),
      task("ac", { type: "every_weeks", n: 2, weekday: 6, anchor: "2026-09-08" }),
      task("bills", { type: "monthly", day: 15 }),
      task("party", { type: "once", date: "2026-09-11" }),
    ];
    const up = upcoming(ts, "2026-09-10", 14);
    expect(up.map((o) => `${o.taskId}@${o.dueISO}`)).toEqual(["party@2026-09-11", "sat@2026-09-12", "ac@2026-09-12", "bills@2026-09-15", "sat@2026-09-19"]);
  });
  it("finds the next due day", () => {
    expect(nextDueOnOrAfter({ type: "every_weeks", n: 2, weekday: 6, anchor: "2026-09-08" }, "2026-09-13")).toBe("2026-09-26");
    expect(nextDueOnOrAfter({ type: "monthly", day: 1 }, "2026-09-10")).toBe("2026-10-01");
    expect(nextDueOnOrAfter({ type: "once", date: "2026-09-01" }, "2026-09-10")).toBeNull();
  });
});

describe("labels and validation", () => {
  it("reads naturally", () => {
    expect(rhythmLabel({ type: "weekly", weekdays: [1, 2, 3, 4, 5] })).toBe("Weekdays");
    expect(rhythmLabel({ type: "every_weeks", n: 2, weekday: 6, anchor: "2026-09-08" })).toBe("Every other week · by Saturday");
    expect(rhythmLabel({ type: "monthly", day: 3 })).toBe("Monthly · by the 3rd");
    expect(rhythmLabel({ type: "monthly", day: "last" })).toBe("Monthly · last day");
  });
  it("rejects nonsense and normalises the rest", () => {
    expect(validateRhythm({ type: "weekly", weekdays: [] })).toEqual({ ok: false, error: "Pick at least one day" });
    expect(validateRhythm({ type: "weekly", weekdays: ["6", 6, 1] })).toEqual({ ok: true, rhythm: { type: "weekly", weekdays: [1, 6] } });
    expect(validateRhythm({ type: "every_weeks", n: 2, weekday: 6, anchor: "nope" }).ok).toBe(false);
    expect(validateRhythm({ type: "monthly", day: 31 }).ok).toBe(false);
    expect(validateAssign({ mode: "rotation", memberIds: ["a"] }, ["a", "b"]).ok).toBe(false);
    expect(validateAssign({ mode: "rotation", memberIds: ["a", "b", "zzz"] }, ["a", "b"])).toEqual({ ok: true, assign: { mode: "rotation", memberIds: ["a", "b"], anchor: undefined } });
    expect(validateAssign({ mode: "person", memberId: "zzz" }, ["a"]).ok).toBe(false);
    expect(validateAssign(undefined, ["a"])).toEqual({ ok: true, assign: { mode: "anyone" } });
  });
  it("date helpers", () => { expect(addDays("2026-09-30", 1)).toBe("2026-10-01"); });
});
