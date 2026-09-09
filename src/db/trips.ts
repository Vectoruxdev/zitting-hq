/**
 * Trips & plans — itinerary, documents (private bucket), packing list,
 * participants, audience. Visibility via canView; sequential, defensive reads.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { canView, type Viewer } from "@/lib/access";
import { getAdminClient } from "@/lib/supabase/admin";
import { signMany } from "./photos";
import { daysBetween } from "@/lib/zoned-time";

export const DOCUMENTS_BUCKET = "documents";

export interface Trip { id: string; name: string; destination: string | null; startsOn: string | null; endsOn: string | null; cover: string | null; coverPhotoId: string | null; notes: string | null; createdBy: string | null; visibility: string; participants: string[]; sharedWith: string[]; goalId: string | null; countdown: number | null; itemCount: number; docCount: number; packedOf: { done: number; total: number } }
export interface TripItem { id: number; day: string | null; time: string | null; title: string; location: string | null; notes: string | null; url: string | null; sort: number }
export interface TripDocument { id: string; name: string; mime: string | null; sizeBytes: number | null; uploadedBy: string | null; url: string | null; createdAt: string | null }
export interface PackingItem { id: number; label: string; assigneeMemberId: string | null; checked: boolean; sort: number }
export interface TripDetail extends Trip { items: TripItem[]; documents: TripDocument[]; packing: PackingItem[] }

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db;
}

/** Days until the trip starts (0 = today, negative = started/over). Pure. */
export function countdown(startsOn: string | null, endsOn: string | null, todayISO: string): number | null {
  if (!startsOn) return null;
  if (endsOn && endsOn < todayISO) return null; // over
  return daysBetween(todayISO, startsOn);
}

export async function listTrips(viewer: Viewer, todayISO: string): Promise<Trip[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.trips).orderBy(asc(s.trips.startsOn)).catch(() => [] as (typeof s.trips.$inferSelect)[]);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [parts, shares, items, docs, packing] = [
    await db.select().from(s.tripParticipants).where(inArray(s.tripParticipants.tripId, ids)).catch(() => [] as (typeof s.tripParticipants.$inferSelect)[]),
    await db.select().from(s.shares).where(and(eq(s.shares.entityType, "trip"), inArray(s.shares.entityId, ids))).catch(() => [] as (typeof s.shares.$inferSelect)[]),
    await db.select({ tripId: s.tripItems.tripId }).from(s.tripItems).where(inArray(s.tripItems.tripId, ids)).catch(() => [] as { tripId: string }[]),
    await db.select({ tripId: s.tripDocuments.tripId }).from(s.tripDocuments).where(inArray(s.tripDocuments.tripId, ids)).catch(() => [] as { tripId: string }[]),
    await db.select({ tripId: s.tripPacking.tripId, checked: s.tripPacking.checked }).from(s.tripPacking).where(inArray(s.tripPacking.tripId, ids)).catch(() => [] as { tripId: string; checked: boolean }[]),
  ];
  const coverIds = rows.map((r) => r.coverPhotoId).filter((x): x is string => !!x);
  const covers = coverIds.length ? await db.select({ id: s.photos.id, thumb: s.photos.thumbPath, full: s.photos.storagePath }).from(s.photos).where(inArray(s.photos.id, coverIds)).catch(() => [] as { id: string; thumb: string | null; full: string }[]) : [];
  const urls = await signMany(covers.map((c) => c.full));
  return rows
    .map((r) => {
      const cover = covers.find((c) => c.id === r.coverPhotoId);
      const pk = packing.filter((p) => p.tripId === r.id);
      return {
        id: r.id, name: r.name, destination: r.destination, startsOn: r.startsOn ? String(r.startsOn) : null, endsOn: r.endsOn ? String(r.endsOn) : null,
        cover: cover ? urls.get(cover.full) ?? null : null, coverPhotoId: r.coverPhotoId, notes: r.notes, createdBy: r.createdBy, visibility: r.visibility, goalId: r.goalId,
        participants: parts.filter((p) => p.tripId === r.id).map((p) => p.memberId), sharedWith: shares.filter((x) => x.entityId === r.id).map((x) => x.memberId),
        countdown: countdown(r.startsOn ? String(r.startsOn) : null, r.endsOn ? String(r.endsOn) : null, todayISO),
        itemCount: items.filter((i) => i.tripId === r.id).length, docCount: docs.filter((d) => d.tripId === r.id).length, packedOf: { done: pk.filter((p) => p.checked).length, total: pk.length },
      };
    })
    .filter((t) => canView({ visibility: t.visibility, ownerId: t.createdBy, sharedWith: t.sharedWith }, viewer) || (!!viewer.memberId && t.participants.includes(viewer.memberId)));
}

export async function getTrip(id: string, viewer: Viewer, todayISO: string): Promise<TripDetail | null> {
  const trip = (await listTrips(viewer, todayISO)).find((t) => t.id === id);
  if (!trip || !db) return null;
  const [items, docs, packing] = [
    await db.select().from(s.tripItems).where(eq(s.tripItems.tripId, id)).orderBy(asc(s.tripItems.day), asc(s.tripItems.sort), asc(s.tripItems.id)).catch(() => [] as (typeof s.tripItems.$inferSelect)[]),
    await db.select().from(s.tripDocuments).where(eq(s.tripDocuments.tripId, id)).orderBy(asc(s.tripDocuments.createdAt)).catch(() => [] as (typeof s.tripDocuments.$inferSelect)[]),
    await db.select().from(s.tripPacking).where(eq(s.tripPacking.tripId, id)).orderBy(asc(s.tripPacking.sort), asc(s.tripPacking.id)).catch(() => [] as (typeof s.tripPacking.$inferSelect)[]),
  ];
  const admin = getAdminClient();
  const urls = new Map<string, string>();
  if (admin && docs.length) { const { data } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrls(docs.map((d) => d.storagePath), 3600); for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl); }
  return {
    ...trip,
    items: items.map((i) => ({ id: i.id, day: i.day ? String(i.day) : null, time: i.time, title: i.title, location: i.location, notes: i.notes, url: i.url, sort: i.sort })),
    documents: docs.map((d) => ({ id: d.id, name: d.name, mime: d.mime, sizeBytes: d.sizeBytes, uploadedBy: d.uploadedBy, url: urls.get(d.storagePath) ?? null, createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null })),
    packing: packing.map((p) => ({ id: p.id, label: p.label, assigneeMemberId: p.assigneeMemberId, checked: p.checked, sort: p.sort })),
  };
}

export async function createTrip(t: { id: string; name: string; destination?: string | null; startsOn?: string | null; endsOn?: string | null; notes?: string | null; createdBy: string | null; visibility?: string; sharedWith?: string[]; participants?: string[] }) {
  const database = requireDb();
  await database.insert(s.trips).values({ id: t.id, name: t.name.trim(), destination: t.destination?.trim() || null, startsOn: t.startsOn || null, endsOn: t.endsOn || t.startsOn || null, notes: t.notes?.trim() || null, createdBy: t.createdBy, visibility: t.visibility ?? "family" });
  if (t.visibility === "custom" && t.sharedWith?.length) await database.insert(s.shares).values(t.sharedWith.map((memberId) => ({ entityType: "trip", entityId: t.id, memberId }))).onConflictDoNothing();
  if (t.participants?.length) await database.insert(s.tripParticipants).values(t.participants.map((memberId) => ({ tripId: t.id, memberId }))).onConflictDoNothing();
}

export async function updateTrip(id: string, patch: Partial<{ name: string; destination: string | null; startsOn: string | null; endsOn: string | null; notes: string | null; coverPhotoId: string | null; visibility: string; goalId: string | null }>, extras?: { sharedWith?: string[]; participants?: string[] }) {
  const database = requireDb();
  if (Object.keys(patch).length) await database.update(s.trips).set(patch).where(eq(s.trips.id, id));
  if (extras?.sharedWith !== undefined) { await database.delete(s.shares).where(and(eq(s.shares.entityType, "trip"), eq(s.shares.entityId, id))); if (extras.sharedWith.length) await database.insert(s.shares).values(extras.sharedWith.map((memberId) => ({ entityType: "trip", entityId: id, memberId }))).onConflictDoNothing(); }
  if (extras?.participants !== undefined) { await database.delete(s.tripParticipants).where(eq(s.tripParticipants.tripId, id)); if (extras.participants.length) await database.insert(s.tripParticipants).values(extras.participants.map((memberId) => ({ tripId: id, memberId }))).onConflictDoNothing(); }
}

export async function deleteTrip(id: string) {
  const database = requireDb();
  const docs = await database.select({ path: s.tripDocuments.storagePath }).from(s.tripDocuments).where(eq(s.tripDocuments.tripId, id));
  const admin = getAdminClient();
  if (admin && docs.length) await admin.storage.from(DOCUMENTS_BUCKET).remove(docs.map((d) => d.path)).catch(() => {});
  await database.delete(s.shares).where(and(eq(s.shares.entityType, "trip"), eq(s.shares.entityId, id)));
  await database.delete(s.trips).where(eq(s.trips.id, id));
}

export async function addTripItem(i: { tripId: string; day?: string | null; time?: string | null; title: string; location?: string | null; notes?: string | null; url?: string | null }) {
  const [row] = await requireDb().insert(s.tripItems).values({ tripId: i.tripId, day: i.day || null, time: i.time?.trim() || null, title: i.title.trim(), location: i.location?.trim() || null, notes: i.notes?.trim() || null, url: i.url?.trim() || null }).returning({ id: s.tripItems.id });
  return row.id;
}
export async function updateTripItem(id: number, patch: Partial<{ day: string | null; time: string | null; title: string; location: string | null; notes: string | null; url: string | null; sort: number }>) { await requireDb().update(s.tripItems).set(patch).where(eq(s.tripItems.id, id)); }
export async function deleteTripItem(id: number) { await requireDb().delete(s.tripItems).where(eq(s.tripItems.id, id)); }

export async function addTripDocument(d: { id: string; tripId: string; storagePath: string; name: string; mime: string | null; sizeBytes: number | null; uploadedBy: string | null }) { await requireDb().insert(s.tripDocuments).values(d); }
export async function deleteTripDocument(id: string) {
  const database = requireDb();
  const [d] = await database.select().from(s.tripDocuments).where(eq(s.tripDocuments.id, id)).limit(1);
  if (!d) return;
  const admin = getAdminClient();
  if (admin) await admin.storage.from(DOCUMENTS_BUCKET).remove([d.storagePath]).catch(() => {});
  await database.delete(s.tripDocuments).where(eq(s.tripDocuments.id, id));
}

export async function addPacking(tripId: string, label: string, assigneeMemberId: string | null) { const [row] = await requireDb().insert(s.tripPacking).values({ tripId, label: label.trim(), assigneeMemberId }).returning({ id: s.tripPacking.id }); return row.id; }
export async function setPacking(id: number, patch: Partial<{ checked: boolean; assigneeMemberId: string | null; label: string }>) { await requireDb().update(s.tripPacking).set(patch).where(eq(s.tripPacking.id, id)); }
export async function deletePacking(id: number) { await requireDb().delete(s.tripPacking).where(eq(s.tripPacking.id, id)); }
