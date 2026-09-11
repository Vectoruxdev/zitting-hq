/**
 * The cleaning schedule engine — pure, no database. A task has a *rhythm*;
 * the rhythm decides which *period* it lives in (a day, a week, a month, or a
 * single date), and "done" is recorded per period. So a daily task resets
 * every day, "every 2 weeks · by Saturday" is open for its whole fortnight
 * week and due on the Saturday, and a monthly job is open all month.
 * Weeks run Sunday to Saturday, like the calendar and the meals rotation.
 */

export type Rhythm =
  | { type: "daily" }
  /** Certain weekdays, due that day (0 = Sunday). */
  | { type: "weekly"; weekdays: number[] }
  /** Every n weeks, open all that week, due by `weekday`; `anchor` is any date in a due week. */
  | { type: "every_weeks"; n: number; weekday: number; anchor: string }
  /** Every month, open all month, due by day `day` (1–28) or the last day. */
  | { type: "monthly"; day: number | "last" }
  | { type: "once"; date: string };

export type Assign =
  | { mode: "anyone" }
  | { mode: "person"; memberId: string }
  /** Takes turns: the k-th time the task comes round goes to memberIds[k % n]. */
  | { mode: "rotation"; memberIds: string[]; anchor?: string };

export type Period = "day" | "week" | "month" | "once";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

export interface Scheduled { id: string; rhythm: Rhythm; assign: Assign; active: boolean; createdOn: string }

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── dates (UTC arithmetic on YYYY-MM-DD strings; no time zones involved) ──
export const addDays = (iso: string, n: number): string => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekdayOf = (iso: string): number => new Date(iso + "T00:00:00Z").getUTCDay();
export const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
/** The Sunday that starts the week holding `iso`. */
export const weekStart = (iso: string): string => addDays(iso, -weekdayOf(iso));
export const monthOf = (iso: string): string => iso.slice(0, 7);
export const lastDayOfMonth = (ym: string): string => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const monthsBetween = (a: string, b: string): number => { const [ay, am] = a.split("-").map(Number); const [by, bm] = b.split("-").map(Number); return (by - ay) * 12 + (bm - am); };
const monthDay = (ym: string, day: number | "last"): string => (day === "last" ? lastDayOfMonth(ym) : `${ym}-${String(Math.min(day, Number(lastDayOfMonth(ym).slice(8)))).padStart(2, "0")}`);

export function periodOf(r: Rhythm): Period {
  return r.type === "daily" || r.type === "weekly" ? "day" : r.type === "every_weeks" ? "week" : r.type === "monthly" ? "month" : "once";
}

/** The period key a day belongs to for this rhythm (whether or not the task is open then). */
export function periodKeyFor(r: Rhythm, dayISO: string): string {
  switch (r.type) {
    case "daily": case "weekly": return dayISO;
    case "every_weeks": return weekStart(dayISO);
    case "monthly": return monthOf(dayISO);
    case "once": return r.date;
  }
}

/** Is the task open (something to do) on this day? Week and month tasks are open for their whole period. */
export function isOpenOn(r: Rhythm, dayISO: string): boolean {
  switch (r.type) {
    case "daily": return true;
    case "weekly": return r.weekdays.includes(weekdayOf(dayISO));
    case "every_weeks": {
      const w = weekStart(dayISO), a = weekStart(r.anchor);
      const weeks = daysBetween(a, w) / 7;
      return weeks >= 0 && weeks % Math.max(1, r.n) === 0;
    }
    case "monthly": return true;
    case "once": return dayISO === r.date;
  }
}

/** The day a period's occurrence is due by. */
export function dueDateFor(r: Rhythm, periodKey: string): string {
  switch (r.type) {
    case "daily": case "weekly": return periodKey;
    case "every_weeks": return addDays(periodKey, r.weekday);
    case "monthly": return monthDay(periodKey, r.day);
    case "once": return r.date;
  }
}

/** How many times the task has come round before this period (for rotations). */
export function occurrenceIndex(r: Rhythm, periodKey: string, anchorISO: string): number {
  switch (r.type) {
    case "daily": return Math.max(0, daysBetween(anchorISO, periodKey));
    case "weekly": {
      let n = 0;
      for (let d = anchorISO; d < periodKey; d = addDays(d, 1)) if (r.weekdays.includes(weekdayOf(d))) n++;
      return n;
    }
    case "every_weeks": return Math.max(0, Math.floor(daysBetween(weekStart(r.anchor), periodKey) / 7 / Math.max(1, r.n)));
    case "monthly": return Math.max(0, monthsBetween(monthOf(anchorISO), periodKey));
    case "once": return 0;
  }
}

/** Who this period's occurrence falls to: a hand-off wins, then the task's own rule; null = anyone. */
export function assigneeFor(task: Scheduled, periodKey: string, handoff?: string | null): string | null {
  if (handoff) return handoff;
  const a = task.assign;
  if (a.mode === "person") return a.memberId;
  if (a.mode === "rotation") {
    if (!a.memberIds.length) return null;
    const k = occurrenceIndex(task.rhythm, periodKey, a.anchor ?? task.createdOn);
    return a.memberIds[k % a.memberIds.length];
  }
  return null;
}

export interface Occurrence { taskId: string; periodKey: string; dueISO: string; period: Period }

/** The occurrence open on `dayISO`, if any. */
export function occurrenceOn(task: Scheduled, dayISO: string): Occurrence | null {
  if (!task.active || !isOpenOn(task.rhythm, dayISO)) return null;
  const periodKey = periodKeyFor(task.rhythm, dayISO);
  return { taskId: task.id, periodKey, dueISO: dueDateFor(task.rhythm, periodKey), period: periodOf(task.rhythm) };
}

/** Non-daily occurrences due within the next `days` days from `fromISO` (inclusive), soonest first. */
export function upcoming(tasks: Scheduled[], fromISO: string, days: number): Occurrence[] {
  const out: Occurrence[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < days; i++) {
    const day = addDays(fromISO, i);
    for (const t of tasks) {
      if (t.rhythm.type === "daily") continue;
      const occ = occurrenceOn(t, day);
      if (!occ || occ.dueISO !== day) continue;
      const k = `${t.id}:${occ.periodKey}`;
      if (seen.has(k)) continue;
      seen.add(k); out.push(occ);
    }
  }
  return out;
}

/** The next due date on or after `fromISO` (bounded search; null if none within ~2 years). */
export function nextDueOnOrAfter(r: Rhythm, fromISO: string): string | null {
  for (let i = 0; i < 740; i++) {
    const day = addDays(fromISO, i);
    if (isOpenOn(r, day) && dueDateFor(r, periodKeyFor(r, day)) === day) return day;
  }
  return null;
}

export function rhythmLabel(r: Rhythm): string {
  switch (r.type) {
    case "daily": return "Every day";
    case "weekly": {
      const d = [...r.weekdays].sort();
      if (d.length === 7) return "Every day";
      if (d.join("") === "12345") return "Weekdays";
      if (d.join("") === "06") return "Weekends";
      return d.map((x) => SHORT[x]).join(" ");
    }
    case "every_weeks": return `${r.n <= 1 ? "Every week" : r.n === 2 ? "Every other week" : `Every ${r.n} weeks`} · by ${WEEKDAY_NAMES[r.weekday]}`;
    case "monthly": return r.day === "last" ? "Monthly · last day" : `Monthly · by the ${ordinal(r.day)}`;
    case "once": return `Once · ${r.date}`;
  }
}

export function periodLabel(p: Period): string { return p === "day" ? "today" : p === "week" ? "this week" : p === "month" ? "this month" : "once"; }

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** Normalise user input into a valid rhythm, or explain why not. */
export function validateRhythm(r: unknown): { ok: true; rhythm: Rhythm } | { ok: false; error: string } {
  const x = r as Partial<Record<string, unknown>> | null;
  const iso = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!x || typeof x !== "object") return { ok: false, error: "Pick how often" };
  switch (x.type) {
    case "daily": return { ok: true, rhythm: { type: "daily" } };
    case "weekly": {
      const days = Array.from(new Set((Array.isArray(x.weekdays) ? x.weekdays : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
      if (!days.length) return { ok: false, error: "Pick at least one day" };
      return { ok: true, rhythm: { type: "weekly", weekdays: days } };
    }
    case "every_weeks": {
      const n = Number(x.n), weekday = Number(x.weekday);
      if (!Number.isInteger(n) || n < 1 || n > 12) return { ok: false, error: "Every how many weeks?" };
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Pick the day it's due by" };
      if (!iso(x.anchor)) return { ok: false, error: "Pick the first week" };
      return { ok: true, rhythm: { type: "every_weeks", n, weekday, anchor: x.anchor as string } };
    }
    case "monthly": {
      if (x.day === "last") return { ok: true, rhythm: { type: "monthly", day: "last" } };
      const day = Number(x.day);
      if (!Number.isInteger(day) || day < 1 || day > 28) return { ok: false, error: "Pick a day of the month (1–28) or the last day" };
      return { ok: true, rhythm: { type: "monthly", day } };
    }
    case "once": {
      if (!iso(x.date)) return { ok: false, error: "Pick the date" };
      return { ok: true, rhythm: { type: "once", date: x.date as string } };
    }
    default: return { ok: false, error: "Pick how often" };
  }
}

export function validateAssign(a: unknown, knownIds: string[]): { ok: true; assign: Assign } | { ok: false; error: string } {
  const x = a as Partial<Record<string, unknown>> | null;
  if (!x || typeof x !== "object" || x.mode === "anyone" || !x.mode) return { ok: true, assign: { mode: "anyone" } };
  if (x.mode === "person") {
    if (typeof x.memberId !== "string" || !knownIds.includes(x.memberId)) return { ok: false, error: "Pick who" };
    return { ok: true, assign: { mode: "person", memberId: x.memberId } };
  }
  if (x.mode === "rotation") {
    const ids = (Array.isArray(x.memberIds) ? x.memberIds : []).filter((id): id is string => typeof id === "string" && knownIds.includes(id));
    if (ids.length < 2) return { ok: false, error: "A rotation needs at least two people" };
    const anchor = typeof x.anchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.anchor) ? x.anchor : undefined;
    return { ok: true, assign: { mode: "rotation", memberIds: Array.from(new Set(ids)), anchor } };
  }
  return { ok: false, error: "Pick who" };
}
