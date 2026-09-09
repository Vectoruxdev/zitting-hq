/**
 * Family time is America/Denver; the server runs in UTC. These helpers turn a
 * local date + "HH:mm" into a real instant and back without a tz library.
 */
export const FAMILY_TZ = "America/Denver";

/** Offset (ms) of `tz` from UTC at a given instant. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-09-08" + "15:30" in `tz` → the UTC instant. All-day (no time) = 09:00 local, the hour a reminder should land. */
export function zonedToUtc(dateISO: string, time: string | null | undefined, tz = FAMILY_TZ): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = (time && /^\d{1,2}:\d{2}/.test(time) ? time : "09:00").split(":").map(Number);
  // two-pass: guess in UTC, correct by the zone's offset at that guess, correct once more for DST edges
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMs(new Date(guess), tz);
  return new Date(guess - tzOffsetMs(new Date(first), tz));
}

/** Local YYYY-MM-DD in `tz` for an instant. */
export function zonedDateISO(at: Date, tz = FAMILY_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);
}

/** When a reminder fires: the event's instant minus `minutesBefore`. */
export function reminderDueAt(dateISO: string, time: string | null | undefined, minutesBefore: number, tz = FAMILY_TZ): Date {
  return new Date(zonedToUtc(dateISO, time, tz).getTime() - minutesBefore * 60_000);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.UTC(...isoParts(toISO)) - Date.UTC(...isoParts(fromISO))) / 86400000);
}
const isoParts = (iso: string): [number, number, number] => { const [y, m, d] = iso.split("-").map(Number); return [y, m - 1, d]; };
