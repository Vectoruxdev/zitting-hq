/**
 * Recurring-transfer scheduling (pure). Computes WHEN a scheduled allocation
 * rule should next generate a planned transfer, given a cadence and an anchor
 * (reference) date. No `Date.now()` — the caller injects `today` — so it's
 * deterministic and unit-testable, like allocate.ts / savings.ts.
 *
 * All dates are ISO `YYYY-MM-DD` strings handled in UTC (no timezone drift).
 * Anchor semantics:
 *   weekly/biweekly → the anchor's weekday, every 7/14 days
 *   monthly/quarterly/yearly → the anchor's day-of-month (clamped to short
 *     months, e.g. the 31st becomes Feb 28), stepping 1/3/12 months
 *   semimonthly → the 1st and 15th of every month (anchor ignored)
 */

export type Cadence = "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "yearly";

const MS_DAY = 86400000;
const isISO = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
const toUTC = (iso: string): Date => new Date(iso.slice(0, 10) + "T00:00:00Z");
const fmt = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * MS_DAY);
const addDaysISO = (iso: string, days: number): string => fmt(addDays(toUTC(iso), days));

/** Last day of a UTC month (monthIdx 0–11, may be out of range — normalized). */
const clampDay = (year: number, monthIdx: number, day: number): number => {
  const last = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  return Math.min(day, last);
};

/** Add `months` to a date, keeping the anchor's day-of-month (clamped). */
function addMonthsClamped(d: Date, months: number, anchorDay: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return new Date(Date.UTC(y, m, clampDay(y, m, anchorDay)));
}

function periodNext(cadence: Cadence, prev: Date, anchorDay: number): Date {
  switch (cadence) {
    case "weekly": return addDays(prev, 7);
    case "biweekly": return addDays(prev, 14);
    case "monthly": return addMonthsClamped(prev, 1, anchorDay);
    case "quarterly": return addMonthsClamped(prev, 3, anchorDay);
    case "yearly": return addMonthsClamped(prev, 12, anchorDay);
    default: return addDays(prev, 7);
  }
}

/** First {1st,15th} occurrence on or after `fromISO`. */
function semimonthlyOnOrAfter(fromISO: string): string {
  const a = toUTC(fromISO);
  const y = a.getUTCFullYear();
  const m = a.getUTCMonth();
  const candidates = [Date.UTC(y, m, 1), Date.UTC(y, m, 15), Date.UTC(y, m + 1, 1)].map((t) => fmt(new Date(t)));
  for (const c of candidates) if (c >= fromISO) return c;
  return candidates[candidates.length - 1];
}

/** First cadence-aligned occurrence on or after `fromISO`. */
export function nextOnOrAfter(cadence: Cadence, anchorISO: string | null | undefined, fromISO: string): string {
  if (cadence === "semimonthly") return semimonthlyOnOrAfter(fromISO);
  const anchor = isISO(anchorISO) ? anchorISO : fromISO;
  const anchorDay = toUTC(anchor).getUTCDate();
  let cur = toUTC(anchor);
  let guard = 0;
  while (fmt(cur) < fromISO && guard++ < 6000) cur = periodNext(cadence, cur, anchorDay);
  return fmt(cur);
}

/** First cadence-aligned occurrence strictly after `afterISO` (used to advance). */
export function nextOccurrence(cadence: Cadence, anchorISO: string | null | undefined, afterISO: string): string {
  return nextOnOrAfter(cadence, anchorISO, addDaysISO(afterISO, 1));
}

/** The initial `nextRunDate` when a scheduled rule is created. */
export function firstRunOnOrAfter(cadence: Cadence, anchorISO: string | null | undefined, todayISO: string): string {
  const from = isISO(anchorISO) && anchorISO > todayISO ? anchorISO : todayISO;
  return nextOnOrAfter(cadence, anchorISO, from);
}

/**
 * Every run-date from `nextRunISO` through `todayISO` inclusive — so a cron that
 * missed cycles catches up. Capped (default 24) as a runaway guard.
 */
export function dueRuns(
  cadence: Cadence,
  anchorISO: string | null | undefined,
  nextRunISO: string | null | undefined,
  todayISO: string,
  cap = 24
): string[] {
  if (!isISO(nextRunISO)) return [];
  const out: string[] = [];
  let r: string = nextRunISO;
  let guard = 0;
  while (r <= todayISO && guard++ < cap) {
    out.push(r);
    r = nextOccurrence(cadence, anchorISO, r);
  }
  return out;
}

export const CADENCES: Cadence[] = ["weekly", "biweekly", "semimonthly", "monthly", "quarterly", "yearly"];
export const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month (1st & 15th)",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
};
