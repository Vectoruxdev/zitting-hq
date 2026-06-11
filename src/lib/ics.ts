/**
 * Minimal ICS (iCalendar) parser + recurrence expander for read-only Google
 * Calendar "secret address" feeds. Pure (no fetch, no Date.now) — the caller
 * supplies the expansion window.
 *
 * Deliberate simplifications (family-calendar scope, not a full RFC 5545):
 * - TZID-stamped times are treated as WALL-CLOCK local times (the family
 *   lives in one timezone; their events carry their own TZID). UTC ('Z')
 *   times are converted to the server's local time.
 * - RRULE: FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL,
 *   and BYDAY (weekly). Other BY* parts fall back to the base cadence.
 * - EXDATE and cancelled/overridden instances (RECURRENCE-ID) are excluded;
 *   the override row itself shows as its own event.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  dateISO: string; // local YYYY-MM-DD of the instance start
  time: string | null; // "18:30" local, null = all-day
  endDateISO: string | null; // inclusive last day for multi-day all-day events
  location: string | null;
}

interface RawEvent {
  uid: string;
  summary: string;
  status: string | null;
  location: string | null;
  recurrenceId: string | null;
  dtstart: { date: Date; allDay: boolean } | null;
  dtend: { date: Date; allDay: boolean } | null;
  rrule: string | null;
  exdates: string[]; // local YYYY-MM-DD of excluded instance starts
}

const pad = (n: number) => String(n).padStart(2, "0");
export const localDateISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Unfold RFC 5545 folded lines (continuation = CRLF + space/tab). */
function unfold(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out.filter((l) => l.length > 0);
}

/** Parse a DT value: 20260610 (all-day) | 20260610T183000 | 20260610T183000Z. */
function parseDt(value: string): { date: Date; allDay: boolean } | null {
  const allDay = /^\d{8}$/.test(value);
  if (allDay) {
    const y = +value.slice(0, 4), m = +value.slice(4, 6), d = +value.slice(6, 8);
    return { date: new Date(y, m - 1, d), allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S, z] = m;
  if (z === "Z") {
    return { date: new Date(Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S)), allDay: false };
  }
  // TZID/floating → wall-clock local (see header note).
  return { date: new Date(+Y, +Mo - 1, +D, +H, +Mi, +S), allDay: false };
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " · ").replace(/\\([,;\\])/g, "$1").trim();
}

function parseEvents(text: string): RawEvent[] {
  const lines = unfold(text);
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { uid: "", summary: "(untitled)", status: null, location: null, recurrenceId: null, dtstart: null, dtend: null, rrule: null, exdates: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.dtstart) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [prop] = left.split(";");
    switch (prop) {
      case "UID": cur.uid = value.trim(); break;
      case "SUMMARY": cur.summary = unescapeText(value) || "(untitled)"; break;
      case "STATUS": cur.status = value.trim().toUpperCase(); break;
      case "LOCATION": cur.location = unescapeText(value) || null; break;
      case "RECURRENCE-ID": cur.recurrenceId = value.trim(); break;
      case "DTSTART": cur.dtstart = parseDt(value.trim()); break;
      case "DTEND": cur.dtend = parseDt(value.trim()); break;
      case "RRULE": cur.rrule = value.trim(); break;
      case "EXDATE": {
        for (const v of value.split(",")) {
          const dt = parseDt(v.trim());
          if (dt) cur.exdates.push(localDateISO(dt.date));
        }
        break;
      }
    }
  }
  return events;
}

interface Rrule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  until: Date | null;
  byday: number[] | null; // JS weekday numbers (0=Sun) — weekly only
}

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRrule(s: string): Rrule | null {
  const parts = Object.fromEntries(
    s.split(";").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).toUpperCase(), kv.slice(i + 1)];
    })
  ) as Record<string, string>;
  const freq = parts.FREQ as Rrule["freq"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const until = parts.UNTIL ? parseDt(parts.UNTIL)?.date ?? null : null;
  const byday = freq === "WEEKLY" && parts.BYDAY
    ? parts.BYDAY.split(",").map((d) => BYDAY[d.slice(-2)]).filter((n) => n != null)
    : null;
  return {
    freq,
    interval: Math.max(1, parseInt(parts.INTERVAL || "1", 10) || 1),
    count: parts.COUNT ? parseInt(parts.COUNT, 10) : null,
    until,
    byday: byday && byday.length ? byday : null,
  };
}

const DAY_MS = 86400000;

/** Inclusive end day for a multi-day all-day event (DTEND is exclusive). */
function inclusiveEnd(ev: RawEvent): string | null {
  if (!ev.dtstart?.allDay || !ev.dtend?.allDay) return null;
  const end = new Date(ev.dtend.date.getTime() - DAY_MS);
  return end > ev.dtstart.date ? localDateISO(end) : null;
}

/**
 * Expand a feed's events into concrete instances within [windowStartISO,
 * windowEndISO] (inclusive local dates). Cancelled events and EXDATE'd /
 * overridden instances are dropped.
 */
export function expandIcs(text: string, windowStartISO: string, windowEndISO: string): IcsEvent[] {
  const events = parseEvents(text);
  const winStart = new Date(windowStartISO + "T00:00:00");
  const winEnd = new Date(windowEndISO + "T23:59:59");
  const out: IcsEvent[] = [];

  // Instances overridden by a RECURRENCE-ID row (keyed by uid + local date).
  const overridden = new Set(
    events
      .filter((e) => e.recurrenceId)
      .map((e) => {
        const dt = parseDt(e.recurrenceId!);
        return dt ? `${e.uid}:${localDateISO(dt.date)}` : "";
      })
      .filter(Boolean)
  );

  const push = (ev: RawEvent, start: Date) => {
    const dateISO = localDateISO(start);
    out.push({
      uid: ev.uid,
      title: ev.summary,
      dateISO,
      time: ev.dtstart!.allDay ? null : localTime(start),
      endDateISO: inclusiveEnd(ev),
      location: ev.location,
    });
  };

  for (const ev of events) {
    if (!ev.dtstart) continue;
    if (ev.status === "CANCELLED") continue;
    const start = ev.dtstart.date;

    if (!ev.rrule) {
      // Single event (a RECURRENCE-ID override lands here too — its parent
      // instance is excluded below).
      const endISO = inclusiveEnd(ev);
      const lastDay = endISO ? new Date(endISO + "T23:59:59") : start;
      if (lastDay >= winStart && start <= winEnd) push(ev, start);
      continue;
    }

    const rule = parseRrule(ev.rrule);
    if (!rule) continue;

    let produced = 0;
    let cursor = new Date(start);
    let guard = 0;
    while (guard++ < 2000) {
      if (rule.count != null && produced >= rule.count) break;
      if (rule.until && cursor > rule.until) break;
      if (cursor > winEnd) break;

      const occurs =
        rule.freq !== "WEEKLY" || !rule.byday
          ? true
          : rule.byday.includes(cursor.getDay());

      if (occurs) {
        produced++;
        const key = `${ev.uid}:${localDateISO(cursor)}`;
        if (cursor >= winStart && !ev.exdates.includes(localDateISO(cursor)) && !overridden.has(key)) {
          push(ev, new Date(cursor));
        }
      }

      // advance
      if (rule.freq === "DAILY") cursor = new Date(cursor.getTime() + rule.interval * DAY_MS);
      else if (rule.freq === "WEEKLY") {
        if (rule.byday) {
          // step a day at a time; skip (interval-1) weeks when wrapping past Saturday
          const next = new Date(cursor.getTime() + DAY_MS);
          if (next.getDay() === 0 && rule.interval > 1) {
            cursor = new Date(next.getTime() + (rule.interval - 1) * 7 * DAY_MS);
          } else {
            cursor = next;
          }
        } else {
          cursor = new Date(cursor.getTime() + rule.interval * 7 * DAY_MS);
        }
      } else if (rule.freq === "MONTHLY") {
        const d = new Date(cursor);
        d.setMonth(d.getMonth() + rule.interval);
        cursor = d;
      } else {
        const d = new Date(cursor);
        d.setFullYear(d.getFullYear() + rule.interval);
        cursor = d;
      }
    }
  }

  return out.sort((a, b) => (a.dateISO + (a.time || "")) < (b.dateISO + (b.time || "")) ? -1 : 1);
}
