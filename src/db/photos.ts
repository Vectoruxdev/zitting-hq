/**
 * Photos — the family library. Sequential, defensive reads; every list is
 * filtered through canView (owner sees everything). Signed URLs come from the
 * private 'photos' bucket in one batch per page render.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { canView, type Viewer } from "@/lib/access";
import { getAdminClient } from "@/lib/supabase/admin";

export const PHOTOS_BUCKET = "photos";

export interface Photo {
  id: string;
  src: string | null;       // signed full-size URL
  thumb: string | null;     // signed thumbnail URL
  width: number | null;
  height: number | null;
  takenAt: string | null;   // ISO
  uploadedBy: string | null;
  caption: string | null;
  visibility: string;
  people: string[];
  favorite: boolean;        // by the viewer
  favorites: number;
  albums: string[];
  sharedWith: string[];
}
export interface Album { id: string; name: string; description: string | null; coverPhotoId: string | null; cover: string | null; createdBy: string | null; visibility: string; count: number; sharedWith: string[] }

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db;
}

import { pickForDay } from "@/lib/photo-utils";
export { pickForDay, groupByDay, localDay } from "@/lib/photo-utils";

/* ---------- signed urls ---------- */

// Signed URLs live for an hour; reuse them for 45 minutes within a warm server
// instance so Home, the grid and the lightbox don't re-sign the same photos on
// every request. Keyed by storage path; misses are signed in batches of 100.
const SIGN_TTL_MS = 45 * 60 * 1000;
const signCache = new Map<string, { url: string; at: number }>();

export async function signMany(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (!clean.length) return out;
  const now = Date.now();
  const misses: string[] = [];
  for (const path of clean) {
    const hit = signCache.get(path);
    if (hit && now - hit.at < SIGN_TTL_MS) out.set(path, hit.url);
    else misses.push(path);
  }
  if (!misses.length) return out;
  const admin = getAdminClient();
  if (!admin) return out;
  for (let i = 0; i < misses.length; i += 100) {
    const { data } = await admin.storage.from(PHOTOS_BUCKET).createSignedUrls(misses.slice(i, i + 100), 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) { out.set(d.path, d.signedUrl); signCache.set(d.path, { url: d.signedUrl, at: now }); }
  }
  if (signCache.size > 5000) for (const [k, v] of signCache) if (now - v.at >= SIGN_TTL_MS) signCache.delete(k);
  return out;
}

/* ---------- reads ---------- */

type Row = typeof s.photos.$inferSelect;

async function hydrate(rows: Row[], viewer: Viewer): Promise<Photo[]> {
  if (!db || !rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [people, favs, albums, shares, urls] = [
    await db.select().from(s.photoPeople).where(inArray(s.photoPeople.photoId, ids)).catch(() => [] as (typeof s.photoPeople.$inferSelect)[]),
    await db.select().from(s.photoFavorites).where(inArray(s.photoFavorites.photoId, ids)).catch(() => [] as (typeof s.photoFavorites.$inferSelect)[]),
    await db.select().from(s.albumPhotos).where(inArray(s.albumPhotos.photoId, ids)).catch(() => [] as (typeof s.albumPhotos.$inferSelect)[]),
    await db.select().from(s.shares).where(and(eq(s.shares.entityType, "photo"), inArray(s.shares.entityId, ids))).catch(() => [] as (typeof s.shares.$inferSelect)[]),
    await signMany(rows.flatMap((r) => [r.storagePath, r.thumbPath])),
  ];
  return rows
    .map((r) => ({
      id: r.id, src: urls.get(r.storagePath) ?? null, thumb: (r.thumbPath && urls.get(r.thumbPath)) || urls.get(r.storagePath) || null, width: r.width, height: r.height,
      takenAt: r.takenAt ? new Date(r.takenAt).toISOString() : r.createdAt ? new Date(r.createdAt).toISOString() : null,
      uploadedBy: r.uploadedBy, caption: r.caption, visibility: r.visibility,
      people: people.filter((p) => p.photoId === r.id).map((p) => p.memberId),
      favorite: !!viewer.memberId && favs.some((f) => f.photoId === r.id && f.memberId === viewer.memberId),
      favorites: favs.filter((f) => f.photoId === r.id).length,
      albums: albums.filter((a) => a.photoId === r.id).map((a) => a.albumId),
      sharedWith: shares.filter((x) => x.entityId === r.id).map((x) => x.memberId),
    }))
    .filter((p) => canView({ visibility: p.visibility, ownerId: p.uploadedBy, sharedWith: p.sharedWith }, viewer));
}

export interface ListOpts { limit?: number; personId?: string | null; albumId?: string | null; favoritesOf?: string | null; trash?: boolean }

export async function listPhotos(viewer: Viewer, opts: ListOpts = {}): Promise<Photo[]> {
  if (!isDbConfigured || !db) return [];
  const limit = Math.min(opts.limit ?? 200, 600);
  let ids: string[] | null = null;
  if (opts.albumId) ids = (await db.select({ id: s.albumPhotos.photoId }).from(s.albumPhotos).where(eq(s.albumPhotos.albumId, opts.albumId)).catch(() => [] as { id: string }[])).map((x) => x.id);
  if (opts.personId) { const mine = (await db.select({ id: s.photoPeople.photoId }).from(s.photoPeople).where(eq(s.photoPeople.memberId, opts.personId)).catch(() => [] as { id: string }[])).map((x) => x.id); ids = ids ? ids.filter((i) => mine.includes(i)) : mine; }
  if (opts.favoritesOf) { const f = (await db.select({ id: s.photoFavorites.photoId }).from(s.photoFavorites).where(eq(s.photoFavorites.memberId, opts.favoritesOf)).catch(() => [] as { id: string }[])).map((x) => x.id); ids = ids ? ids.filter((i) => f.includes(i)) : f; }
  if (ids && !ids.length) return [];
  const where = and(opts.trash ? sql`${s.photos.deletedAt} IS NOT NULL` : isNull(s.photos.deletedAt), ids ? inArray(s.photos.id, ids) : undefined);
  const rows = await db.select().from(s.photos).where(where).orderBy(desc(s.photos.takenAt), desc(s.photos.createdAt)).limit(limit).catch(() => [] as Row[]);
  return hydrate(rows, viewer);
}

export async function getPhoto(id: string, viewer: Viewer): Promise<Photo | null> {
  if (!isDbConfigured || !db) return null;
  const rows = await db.select().from(s.photos).where(eq(s.photos.id, id)).limit(1).catch(() => [] as Row[]);
  return (await hydrate(rows, viewer))[0] ?? null;
}

export async function recentPhotos(viewer: Viewer, n = 6): Promise<Photo[]> {
  return listPhotos(viewer, { limit: n });
}

/** Photo of the day: the same one for everyone all day, from what the viewer can see (favorites preferred). */
export async function photoOfTheDay(viewer: Viewer, dateISO: string): Promise<Photo | null> {
  if (!isDbConfigured || !db) return null;
  const rows = await db.select().from(s.photos).where(isNull(s.photos.deletedAt)).orderBy(desc(s.photos.takenAt)).limit(400).catch(() => [] as Row[]);
  const visible = await hydrate(rows, viewer);
  const favs = visible.filter((p) => p.favorites > 0);
  return pickForDay(favs.length >= 3 ? favs : visible, dateISO);
}

export async function listAlbums(viewer: Viewer): Promise<Album[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.albums).orderBy(desc(s.albums.createdAt)).catch(() => [] as (typeof s.albums.$inferSelect)[]);
  if (!rows.length) return [];
  const links = await db.select().from(s.albumPhotos).where(inArray(s.albumPhotos.albumId, rows.map((r) => r.id))).catch(() => [] as (typeof s.albumPhotos.$inferSelect)[]);
  const shares = await db.select().from(s.shares).where(and(eq(s.shares.entityType, "album"), inArray(s.shares.entityId, rows.map((r) => r.id)))).catch(() => [] as (typeof s.shares.$inferSelect)[]);
  // cover: explicit cover, else the newest photo in the album
  const coverIds = rows.map((r) => r.coverPhotoId || links.filter((l) => l.albumId === r.id).sort((a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0))[0]?.photoId || null);
  const coverRows = coverIds.some(Boolean) ? await db.select({ id: s.photos.id, thumb: s.photos.thumbPath, full: s.photos.storagePath }).from(s.photos).where(inArray(s.photos.id, coverIds.filter((x): x is string => !!x))).catch(() => [] as { id: string; thumb: string | null; full: string }[]) : [];
  const urls = await signMany(coverRows.map((c) => c.thumb || c.full));
  return rows
    .map((r, i) => {
      const cover = coverRows.find((c) => c.id === coverIds[i]);
      return { id: r.id, name: r.name, description: r.description, coverPhotoId: coverIds[i], cover: cover ? urls.get(cover.thumb || cover.full) ?? null : null, createdBy: r.createdBy, visibility: r.visibility, count: links.filter((l) => l.albumId === r.id).length, sharedWith: shares.filter((x) => x.entityId === r.id).map((x) => x.memberId) };
    })
    .filter((a) => canView({ visibility: a.visibility, ownerId: a.createdBy, sharedWith: a.sharedWith }, viewer));
}

export async function getAlbum(id: string, viewer: Viewer): Promise<Album | null> {
  return (await listAlbums(viewer)).find((a) => a.id === id) ?? null;
}

/** Photos attached to other things, keyed by entity id (recipe/event/goal/trip/quote/night). */
export async function attachmentsFor(entityType: string, entityIds: string[], viewer: Viewer): Promise<Map<string, Photo[]>> {
  const out = new Map<string, Photo[]>();
  if (!isDbConfigured || !db || !entityIds.length) return out;
  const links = await db.select().from(s.attachments).where(and(eq(s.attachments.entityType, entityType), inArray(s.attachments.entityId, entityIds))).catch(() => [] as (typeof s.attachments.$inferSelect)[]);
  if (!links.length) return out;
  const rows = await db.select().from(s.photos).where(and(inArray(s.photos.id, links.map((l) => l.photoId)), isNull(s.photos.deletedAt))).catch(() => [] as Row[]);
  const photosById = new Map((await hydrate(rows, viewer)).map((p) => [p.id, p]));
  for (const l of links.sort((a, b) => a.sort - b.sort)) { const p = photosById.get(l.photoId); if (!p) continue; const arr = out.get(l.entityId) || []; arr.push(p); out.set(l.entityId, arr); }
  return out;
}

export async function photoCountsByPerson(viewer: Viewer): Promise<Map<string, number>> {
  const all = await listPhotos(viewer, { limit: 600 });
  const m = new Map<string, number>();
  for (const p of all) for (const id of p.people) m.set(id, (m.get(id) || 0) + 1);
  return m;
}

/* ---------- writes ---------- */

export async function insertPhoto(row: { id: string; storagePath: string; thumbPath: string | null; width: number | null; height: number | null; takenAt: Date | null; uploadedBy: string | null; caption: string | null; visibility: string; sharedWith?: string[]; people?: string[]; albumId?: string | null }) {
  const database = requireDb();
  await database.insert(s.photos).values({ id: row.id, storagePath: row.storagePath, thumbPath: row.thumbPath, width: row.width, height: row.height, takenAt: row.takenAt, uploadedBy: row.uploadedBy, caption: row.caption, visibility: row.visibility });
  if (row.visibility === "custom" && row.sharedWith?.length) await database.insert(s.shares).values(row.sharedWith.map((memberId) => ({ entityType: "photo", entityId: row.id, memberId }))).onConflictDoNothing();
  if (row.people?.length) await database.insert(s.photoPeople).values(row.people.map((memberId) => ({ photoId: row.id, memberId }))).onConflictDoNothing();
  if (row.albumId) await database.insert(s.albumPhotos).values({ albumId: row.albumId, photoId: row.id }).onConflictDoNothing();
}

export async function updatePhoto(id: string, patch: Partial<{ caption: string | null; visibility: string; takenAt: Date | null }>, extras?: { people?: string[]; sharedWith?: string[] }) {
  const database = requireDb();
  if (Object.keys(patch).length) await database.update(s.photos).set(patch).where(eq(s.photos.id, id));
  if (extras?.people) { await database.delete(s.photoPeople).where(eq(s.photoPeople.photoId, id)); if (extras.people.length) await database.insert(s.photoPeople).values(extras.people.map((memberId) => ({ photoId: id, memberId }))).onConflictDoNothing(); }
  if (extras?.sharedWith) { await database.delete(s.shares).where(and(eq(s.shares.entityType, "photo"), eq(s.shares.entityId, id))); if (extras.sharedWith.length) await database.insert(s.shares).values(extras.sharedWith.map((memberId) => ({ entityType: "photo", entityId: id, memberId }))).onConflictDoNothing(); }
}

export async function toggleFavorite(photoId: string, memberId: string): Promise<boolean> {
  const database = requireDb();
  const [ex] = await database.select().from(s.photoFavorites).where(and(eq(s.photoFavorites.photoId, photoId), eq(s.photoFavorites.memberId, memberId))).limit(1);
  if (ex) { await database.delete(s.photoFavorites).where(and(eq(s.photoFavorites.photoId, photoId), eq(s.photoFavorites.memberId, memberId))); return false; }
  await database.insert(s.photoFavorites).values({ photoId, memberId });
  return true;
}

export async function softDeletePhoto(id: string, restore = false) {
  await requireDb().update(s.photos).set({ deletedAt: restore ? null : new Date() }).where(eq(s.photos.id, id));
}

/** Permanently remove photos in the trash for more than `days` (storage objects too). */
export async function purgeTrash(days = 30): Promise<number> {
  const database = requireDb();
  const cutoff = new Date(Date.now() - days * 86400000);
  const rows = await database.select({ id: s.photos.id, full: s.photos.storagePath, thumb: s.photos.thumbPath }).from(s.photos).where(sql`${s.photos.deletedAt} IS NOT NULL AND ${s.photos.deletedAt} < ${cutoff}`);
  if (!rows.length) return 0;
  const admin = getAdminClient();
  if (admin) await admin.storage.from(PHOTOS_BUCKET).remove(rows.flatMap((r) => [r.full, r.thumb].filter((x): x is string => !!x))).catch(() => {});
  await database.delete(s.photos).where(inArray(s.photos.id, rows.map((r) => r.id)));
  return rows.length;
}

export async function createAlbum(a: { id: string; name: string; description?: string | null; createdBy: string | null; visibility?: string; sharedWith?: string[] }) {
  const database = requireDb();
  await database.insert(s.albums).values({ id: a.id, name: a.name.trim(), description: a.description?.trim() || null, createdBy: a.createdBy, visibility: a.visibility ?? "family" });
  if (a.visibility === "custom" && a.sharedWith?.length) await database.insert(s.shares).values(a.sharedWith.map((memberId) => ({ entityType: "album", entityId: a.id, memberId }))).onConflictDoNothing();
}
export async function updateAlbum(id: string, patch: Partial<{ name: string; description: string | null; coverPhotoId: string | null; visibility: string }>, sharedWith?: string[]) {
  const database = requireDb();
  if (Object.keys(patch).length) await database.update(s.albums).set(patch).where(eq(s.albums.id, id));
  if (sharedWith) { await database.delete(s.shares).where(and(eq(s.shares.entityType, "album"), eq(s.shares.entityId, id))); if (sharedWith.length) await database.insert(s.shares).values(sharedWith.map((memberId) => ({ entityType: "album", entityId: id, memberId }))).onConflictDoNothing(); }
}
export async function deleteAlbum(id: string) { await requireDb().delete(s.albums).where(eq(s.albums.id, id)); }
export async function addToAlbum(albumId: string, photoIds: string[]) { if (photoIds.length) await requireDb().insert(s.albumPhotos).values(photoIds.map((photoId) => ({ albumId, photoId }))).onConflictDoNothing(); }
export async function removeFromAlbum(albumId: string, photoId: string) { await requireDb().delete(s.albumPhotos).where(and(eq(s.albumPhotos.albumId, albumId), eq(s.albumPhotos.photoId, photoId))); }

export async function attach(entityType: string, entityId: string, photoId: string) { await requireDb().insert(s.attachments).values({ entityType, entityId, photoId }).onConflictDoNothing(); }
export async function detach(entityType: string, entityId: string, photoId: string) { await requireDb().delete(s.attachments).where(and(eq(s.attachments.entityType, entityType), eq(s.attachments.entityId, entityId), eq(s.attachments.photoId, photoId))); }
