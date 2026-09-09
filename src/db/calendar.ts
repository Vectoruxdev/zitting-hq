/**
 * Calendar v2 — one list of what's happening: Google feeds (ICS), family
 * events and appointments (visibility-filtered), trips as spans, and dinner
 * nights as a quiet daily row. Sequential, defensive reads.
 */
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { canView, type Viewer } from "@/lib/access";
import { expandIcs } from "@/lib/ics";
import { addDaysISO } from "./household";
import { getNights } from "./kitchen";
import { reminderDueAt } from "@/lib/zoned-time";
import { personIndex } from "@/lib/frame-user";
import { cached } from "@/lib/cache";

export type CalKind = "event" | "appointment" | "trip" | "feed" | "dinner";
export interface CalItem {
  key: string;
  kind: CalKind;
  title: string;
  dateISO: string;
  endDateISO: string | null;
  time: string | null;
  endTime: string | null;
  location: string | null;
  note: string | null;
  prepNotes: string | null;
  forMemberId: string | null;
  driverMemberId: string | null;
  cookMemberId: string | null;
  source: string;             // feed name | "Family" | trip name | "Dinner"
  color: string | null;
  familyEventId: number | null;
  tripId: string | null;
  visibility: string;
  createdBy: string | null;
  reminders: number[];
  /** trip span: day index 1-based and total */
  dayOfTrip?: { n: number; of: number };
}

/** A calendar feed as the client sees it — never the secret URL. */
export interface FeedInfo { id: number; name: string; enabled: boolean; error?: string; memberId: string | null; visibility: string; sharedWith: string[]; color: string | null }

const FEED_COLORS = ["var(--hue-sky)", "var(--hue-lilac)", "var(--hue-mint)", "var(--hue-butter)", "var(--hue-rose)"];

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db;
}

/* ---------- pure ---------- */

/** Stable day ordering: all-day first, then by time, then title. */
export function sortItems(a: CalItem, b: CalItem): number {
  if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
  const ka = a.kind === "trip" ? 0 : a.kind === "dinner" ? 3 : a.time ? 2 : 1;
  const kb = b.kind === "trip" ? 0 : b.kind === "dinner" ? 3 : b.time ? 2 : 1;
  if (ka !== kb) return ka - kb;
  if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
  return a.title.localeCompare(b.title);
}

/** Expand a span (trip, multi-day event) into one item per day inside the window. */
export function expandSpan<T extends { dateISO: string; endDateISO: string | null }>(item: T, fromISO: string, toISO: string): (T & { dayOfTrip?: { n: number; of: number } })[] {
  const end = item.endDateISO || item.dateISO;
  if (end < fromISO || item.dateISO > toISO) return [];
  const out: (T & { dayOfTrip?: { n: number; of: number } })[] = [];
  let d = item.dateISO, n = 1;
  const total = Math.max(1, Math.round((Date.parse(end) - Date.parse(item.dateISO)) / 86400000) + 1);
  while (d <= end) { if (d >= fromISO && d <= toISO) out.push({ ...item, dateISO: d, dayOfTrip: total > 1 ? { n, of: total } : undefined }); d = addDaysISO(d, 1); n++; }
  return out;
}

/* ---------- reads ---------- */

type FeedRow = typeof s.calendarFeeds.$inferSelect;

/** Feeds the viewer may see: household feeds (no person) always; a person's feed by its visibility — family, private (them and the owner), custom (shares). */
async function getFeeds__live(viewer: Viewer): Promise<(FeedInfo & { url: string })[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.calendarFeeds).orderBy(asc(s.calendarFeeds.id)).catch(() => [] as FeedRow[]);
  if (!rows.length) return [];
  const shares = await db.select().from(s.shares).where(and(eq(s.shares.entityType, "calendar_feed"), inArray(s.shares.entityId, rows.map((r) => String(r.id))))).catch(() => [] as (typeof s.shares.$inferSelect)[]);
  const memberIds = rows.map((r) => r.memberId).filter((x): x is string => !!x);
  const hues = memberIds.length ? await db.select({ memberId: s.memberProfiles.memberId, hue: s.memberProfiles.hue }).from(s.memberProfiles).where(inArray(s.memberProfiles.memberId, memberIds)).catch(() => [] as { memberId: string; hue: number | null }[]) : [];
  return rows
    .map((r) => {
      const sharedWith = shares.filter((x) => x.entityId === String(r.id)).map((x) => x.memberId);
      const hue = r.memberId ? hues.find((h) => h.memberId === r.memberId)?.hue ?? personIndex(r.memberId) : null;
      return { id: r.id, name: r.name, enabled: r.enabled, memberId: r.memberId, visibility: r.visibility, sharedWith, url: r.url, color: r.color || (hue ? `var(--person-${hue})` : null) };
    })
    .filter((f) => !f.memberId || canView({ visibility: f.visibility, ownerId: f.memberId, sharedWith: f.sharedWith }, viewer));
}

export async function feedById(id: number): Promise<FeedRow | null> {
  if (!isDbConfigured || !db) return null;
  const [row] = await db.select().from(s.calendarFeeds).where(eq(s.calendarFeeds.id, id)).limit(1).catch(() => [] as FeedRow[]);
  return row ?? null;
}

export async function addFeed(args: { name: string; url: string; memberId: string | null; visibility: string; sharedWith?: string[]; color?: string | null }): Promise<number> {
  if (!db) throw new Error("Database not configured");
  const [row] = await db.insert(s.calendarFeeds).values({ name: args.name, url: args.url, memberId: args.memberId, visibility: args.visibility, color: args.color ?? null }).returning({ id: s.calendarFeeds.id });
  if (args.visibility === "custom" && args.sharedWith?.length) await db.insert(s.shares).values(args.sharedWith.map((memberId) => ({ entityType: "calendar_feed", entityId: String(row.id), memberId }))).onConflictDoNothing();
  return row.id;
}

export async function setFeedEnabled(id: number, enabled: boolean) {
  if (!db) throw new Error("Database not configured");
  await db.update(s.calendarFeeds).set({ enabled, updatedAt: new Date() }).where(eq(s.calendarFeeds.id, id));
}

export async function setFeedVisibility(id: number, visibility: string, sharedWith: string[]) {
  if (!db) throw new Error("Database not configured");
  await db.update(s.calendarFeeds).set({ visibility, updatedAt: new Date() }).where(eq(s.calendarFeeds.id, id));
  await db.delete(s.shares).where(and(eq(s.shares.entityType, "calendar_feed"), eq(s.shares.entityId, String(id))));
  if (visibility === "custom" && sharedWith.length) await db.insert(s.shares).values(sharedWith.map((memberId) => ({ entityType: "calendar_feed", entityId: String(id), memberId }))).onConflictDoNothing();
}

export async function deleteFeed(id: number) {
  if (!db) throw new Error("Database not configured");
  await db.delete(s.shares).where(and(eq(s.shares.entityType, "calendar_feed"), eq(s.shares.entityId, String(id))));
  await db.delete(s.calendarFeeds).where(eq(s.calendarFeeds.id, id));
}

async function feedItems(viewer: Viewer, fromISO: string, toISO: string): Promise<{ items: CalItem[]; feeds: FeedInfo[] }> {
  const feeds = await getFeeds(viewer);
  const info: FeedInfo[] = [];
  const pub = (feed: (typeof feeds)[number], extra: Partial<FeedInfo>): FeedInfo => ({ id: feed.id, name: feed.name, enabled: feed.enabled, memberId: feed.memberId, visibility: feed.visibility, sharedWith: feed.sharedWith, color: feed.color, ...extra });
  const perFeed = await Promise.all(feeds.map(async (feed, i) => {
    if (!feed.enabled) { info.push(pub(feed, {})); return [] as CalItem[]; }
    try {
      const res = await fetch(feed.url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const color = feed.color || FEED_COLORS[i % FEED_COLORS.length];
      info.push(pub(feed, {}));
      return expandIcs(await res.text(), fromISO, toISO).map((ev) => ({
        key: `feed-${feed.id}-${ev.uid}-${ev.dateISO}-${ev.time ?? "allday"}`, kind: "feed" as const, title: ev.title, dateISO: ev.dateISO, endDateISO: ev.endDateISO ?? null, time: ev.time ?? null, endTime: null,
        location: ev.location ?? null, note: null, prepNotes: null, forMemberId: feed.memberId, driverMemberId: null, cookMemberId: null, source: feed.name, color, familyEventId: null, tripId: null, visibility: feed.visibility, createdBy: feed.memberId, reminders: [],
      }));
    } catch (err) { info.push(pub(feed, { error: err instanceof Error ? err.message : "fetch failed" })); return []; }
  }));
  return { items: perFeed.flat(), feeds: info.sort((a, b) => a.id - b.id) };
}

async function familyItems__live(viewer: Viewer, fromISO: string, toISO: string): Promise<CalItem[]> {
  if (!db) return [];
  const rows = await db.select().from(s.familyEvents).where(and(lte(s.familyEvents.date, toISO), gte(s.familyEvents.date, addDaysISO(fromISO, -60)))).orderBy(asc(s.familyEvents.date)).catch(() => [] as (typeof s.familyEvents.$inferSelect)[]);
  const ids = rows.map((r) => r.id);
  const reminders = ids.length ? await db.select().from(s.eventReminders).where(inArray(s.eventReminders.eventId, ids)).catch(() => [] as (typeof s.eventReminders.$inferSelect)[]) : [];
  const shares = ids.length ? await db.select().from(s.shares).where(and(eq(s.shares.entityType, "event"), inArray(s.shares.entityId, ids.map(String)))).catch(() => [] as (typeof s.shares.$inferSelect)[]) : [];
  const out: CalItem[] = [];
  for (const r of rows) {
    const sharedWith = shares.filter((x) => x.entityId === String(r.id)).map((x) => x.memberId);
    const involved = viewer.memberId && (r.forMemberId === viewer.memberId || r.driverMemberId === viewer.memberId);
    if (!involved && !canView({ visibility: r.visibility, ownerId: r.createdBy, sharedWith }, viewer)) continue;
    const base: CalItem = {
      key: `fam-${r.id}`, kind: (r.kind as CalKind) === "appointment" ? "appointment" : "event", title: r.title, dateISO: String(r.date), endDateISO: r.endDate ? String(r.endDate) : null, time: r.time, endTime: r.endTime,
      location: r.location, note: r.note, prepNotes: r.prepNotes, forMemberId: r.forMemberId, driverMemberId: r.driverMemberId, cookMemberId: null, source: "Family", color: r.color || (r.kind === "appointment" ? "var(--hue-lilac)" : "var(--accent)"),
      familyEventId: r.id, tripId: r.tripId, visibility: r.visibility, createdBy: r.createdBy, reminders: reminders.filter((x) => x.eventId === r.id).map((x) => x.minutesBefore),
    };
    out.push(...expandSpan(base, fromISO, toISO).map((x, i) => ({ ...x, key: i ? `${base.key}-d${i}` : base.key })));
  }
  return out;
}

async function tripItems__live(viewer: Viewer, fromISO: string, toISO: string): Promise<CalItem[]> {
  if (!db) return [];
  const rows = await db.select().from(s.trips).where(and(lte(s.trips.startsOn, toISO), gte(s.trips.endsOn, fromISO))).catch(() => [] as (typeof s.trips.$inferSelect)[]);
  if (!rows.length) return [];
  const shares = await db.select().from(s.shares).where(and(eq(s.shares.entityType, "trip"), inArray(s.shares.entityId, rows.map((r) => r.id)))).catch(() => [] as (typeof s.shares.$inferSelect)[]);
  const out: CalItem[] = [];
  for (const t of rows) {
    if (!t.startsOn) continue;
    if (!canView({ visibility: t.visibility, ownerId: t.createdBy, sharedWith: shares.filter((x) => x.entityId === t.id).map((x) => x.memberId) }, viewer)) continue;
    const base: CalItem = { key: `trip-${t.id}`, kind: "trip", title: t.name, dateISO: String(t.startsOn), endDateISO: t.endsOn ? String(t.endsOn) : String(t.startsOn), time: null, endTime: null, location: t.destination, note: null, prepNotes: null, forMemberId: null, driverMemberId: null, cookMemberId: null, source: t.name, color: "var(--hue-sky)", familyEventId: null, tripId: t.id, visibility: t.visibility, createdBy: t.createdBy, reminders: [] };
    out.push(...expandSpan(base, fromISO, toISO).map((x, i) => ({ ...x, key: `${base.key}-d${i}` })));
  }
  return out;
}

export interface CalendarData { items: CalItem[]; feeds: FeedInfo[]; configured: boolean }

/** Everything between two dates (inclusive), sorted. */
export async function getCalendar(viewer: Viewer, fromISO: string, toISO: string, opts: { dinners?: boolean } = {}): Promise<CalendarData> {
  if (!isDbConfigured || !db) return { items: [], feeds: [], configured: false };
  // Sequential DB reads (pooler-safe); the ICS fetches inside feedItems stay concurrent (HTTP, not the pool).
  const { items: feed, feeds } = await feedItems(viewer, fromISO, toISO);
  const fam = await familyItems(viewer, fromISO, toISO);
  const trips = await tripItems(viewer, fromISO, toISO);
  const items = [...feed, ...fam, ...trips];
  if (opts.dinners !== false) {
    const days = Math.min(62, Math.max(1, Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400000) + 1));
    const nights = await getNights(fromISO, days).catch(() => []);
    for (const n of nights) if (n.cook) items.push({ key: `dinner-${n.date}`, kind: "dinner", title: n.note || "Dinner", dateISO: n.date, endDateISO: null, time: null, endTime: null, location: null, note: null, prepNotes: null, forMemberId: null, driverMemberId: null, cookMemberId: n.cook, source: "Dinner", color: "var(--hue-butter)", familyEventId: null, tripId: null, visibility: "family", createdBy: null, reminders: [] });
  }
  return { items: items.sort(sortItems), feeds, configured: true };
}

async function getEvent__live(id: number, viewer: Viewer): Promise<CalItem | null> {
  if (!isDbConfigured || !db) return null;
  const [r] = await db.select().from(s.familyEvents).where(eq(s.familyEvents.id, id)).limit(1).catch(() => []);
  if (!r) return null;
  const items = await familyItems(viewer, String(r.date), r.endDate ? String(r.endDate) : String(r.date));
  return items.find((x) => x.familyEventId === id) ?? null;
}

/** Upcoming appointments (from today), soonest first. */
async function listAppointments__live(viewer: Viewer, todayISO: string, days = 120): Promise<CalItem[]> {
  const cal = await getCalendar(viewer, todayISO, addDaysISO(todayISO, days), { dinners: false });
  return cal.items.filter((i) => i.kind === "appointment");
}

/* ---------- writes ---------- */

export interface EventInput { kind: "event" | "appointment"; title: string; date: string; endDate?: string | null; time?: string | null; endTime?: string | null; location?: string | null; note?: string | null; prepNotes?: string | null; forMemberId?: string | null; driverMemberId?: string | null; visibility?: string; sharedWith?: string[]; reminders?: number[]; createdBy?: string | null; color?: string | null; tripId?: string | null }

export async function createEvent(e: EventInput): Promise<number> {
  const database = requireDb();
  const [row] = await database.insert(s.familyEvents).values({ title: e.title.trim(), date: e.date, endDate: e.endDate || null, time: e.time?.trim() || null, endTime: e.endTime?.trim() || null, note: e.note?.trim() || null, color: e.color ?? null, createdBy: e.createdBy ?? null, kind: e.kind, location: e.location?.trim() || null, prepNotes: e.prepNotes?.trim() || null, forMemberId: e.forMemberId || null, driverMemberId: e.driverMemberId || null, visibility: e.visibility ?? "family", tripId: e.tripId ?? null }).returning({ id: s.familyEvents.id });
  if (e.visibility === "custom" && e.sharedWith?.length) await database.insert(s.shares).values(e.sharedWith.map((memberId) => ({ entityType: "event", entityId: String(row.id), memberId }))).onConflictDoNothing();
  if (e.reminders?.length) await database.insert(s.eventReminders).values(e.reminders.map((minutesBefore) => ({ eventId: row.id, minutesBefore })));
  return row.id;
}

export async function updateEvent(id: number, e: Partial<EventInput>): Promise<void> {
  const database = requireDb();
  const patch: Partial<typeof s.familyEvents.$inferInsert> = { updatedAt: new Date() };
  if (e.title !== undefined) patch.title = e.title.trim();
  if (e.kind !== undefined) patch.kind = e.kind;
  if (e.date !== undefined) patch.date = e.date;
  if (e.endDate !== undefined) patch.endDate = e.endDate || null;
  if (e.time !== undefined) patch.time = e.time?.trim() || null;
  if (e.endTime !== undefined) patch.endTime = e.endTime?.trim() || null;
  if (e.location !== undefined) patch.location = e.location?.trim() || null;
  if (e.note !== undefined) patch.note = e.note?.trim() || null;
  if (e.prepNotes !== undefined) patch.prepNotes = e.prepNotes?.trim() || null;
  if (e.forMemberId !== undefined) patch.forMemberId = e.forMemberId || null;
  if (e.driverMemberId !== undefined) patch.driverMemberId = e.driverMemberId || null;
  if (e.visibility !== undefined) patch.visibility = e.visibility;
  await database.update(s.familyEvents).set(patch).where(eq(s.familyEvents.id, id));
  if (e.visibility !== undefined) { await database.delete(s.shares).where(and(eq(s.shares.entityType, "event"), eq(s.shares.entityId, String(id)))); if (e.visibility === "custom" && e.sharedWith?.length) await database.insert(s.shares).values(e.sharedWith.map((memberId) => ({ entityType: "event", entityId: String(id), memberId }))).onConflictDoNothing(); }
  if (e.reminders !== undefined) { await database.delete(s.eventReminders).where(and(eq(s.eventReminders.eventId, id), isNull(s.eventReminders.sentAt))); if (e.reminders.length) await database.insert(s.eventReminders).values(e.reminders.map((minutesBefore) => ({ eventId: id, minutesBefore }))); }
}

export async function deleteEvent(id: number): Promise<void> {
  const database = requireDb();
  await database.delete(s.shares).where(and(eq(s.shares.entityType, "event"), eq(s.shares.entityId, String(id))));
  await database.delete(s.familyEvents).where(eq(s.familyEvents.id, id));
}

/** Reminders whose fire time has passed and that haven't been sent (skips anything more than a day stale). */
export async function dueReminders(now: Date): Promise<{ reminderId: number; event: typeof s.familyEvents.$inferSelect; minutesBefore: number }[]> {
  if (!isDbConfigured || !db) return [];
  const pending = await db.select().from(s.eventReminders).where(isNull(s.eventReminders.sentAt)).catch(() => [] as (typeof s.eventReminders.$inferSelect)[]);
  if (!pending.length) return [];
  const events = await db.select().from(s.familyEvents).where(inArray(s.familyEvents.id, pending.map((p) => p.eventId))).catch(() => [] as (typeof s.familyEvents.$inferSelect)[]);
  const byId = new Map(events.map((e) => [e.id, e]));
  const out: { reminderId: number; event: typeof s.familyEvents.$inferSelect; minutesBefore: number }[] = [];
  for (const p of pending) {
    const ev = byId.get(p.eventId);
    if (!ev) continue;
    const due = reminderDueAt(String(ev.date), ev.time, p.minutesBefore).getTime();
    if (due <= now.getTime() && now.getTime() - due < 86400000) out.push({ reminderId: p.id, event: ev, minutesBefore: p.minutesBefore });
  }
  return out;
}

export async function markReminderSent(ids: number[]): Promise<void> {
  if (ids.length) await requireDb().update(s.eventReminders).set({ sentAt: new Date() }).where(inArray(s.eventReminders.id, ids));
}

// ---- cached readers (see src/lib/cache.ts) ----
export const getFeeds = cached("calendar:getFeeds", ["calendar"], getFeeds__live);
export const getEvent = cached("calendar:getEvent", ["calendar"], getEvent__live);
export const listAppointments = cached("calendar:listAppointments", ["calendar"], listAppointments__live);
const familyItems = cached("calendar:familyItems", ["calendar"], familyItems__live);
const tripItems = cached("calendar:tripItems", ["trips", "calendar"], tripItems__live);
