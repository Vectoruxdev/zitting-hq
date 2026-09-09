/**
 * Family quotes — read/write layer. Sequential, defensive reads (a
 * pre-migration DB returns []). Visibility via the shared canView predicate.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { canView, type Viewer } from "@/lib/access";

export interface Quote {
  id: number;
  text: string;
  saidByMemberId: string | null;
  saidByName: string | null;
  saidOn: string | null;
  addedBy: string | null;
  visibility: string;
  favorite: boolean;
  showOnLogin: boolean;
  source: string;
  sharedWith: string[];
  /** Saved by the viewer (their own list on the Quotes page). */
  saved: boolean;
  /** When the viewer saved it, for ordering the Saved tab. */
  savedAt: string | null;
}

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db;
}

async function sharesFor(ids: number[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!db || !ids.length) return map;
  const rows = await db
    .select()
    .from(s.shares)
    .where(inArray(s.shares.entityId, ids.map(String)))
    .catch(() => [] as (typeof s.shares.$inferSelect)[]);
  for (const r of rows) {
    if (r.entityType !== "quote") continue;
    const arr = map.get(r.entityId) || [];
    arr.push(r.memberId);
    map.set(r.entityId, arr);
  }
  return map;
}

/** Every quote the viewer may see, newest said first. */
export async function listQuotes(viewer: Viewer): Promise<Quote[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db
    .select()
    .from(s.quotes)
    .orderBy(desc(s.quotes.saidOn), desc(s.quotes.id))
    .catch(() => [] as (typeof s.quotes.$inferSelect)[]);
  const shares = await sharesFor(rows.filter((r) => r.visibility === "custom").map((r) => r.id));
  const saves = viewer.memberId
    ? await db.select().from(s.quoteSaves).where(eq(s.quoteSaves.memberId, viewer.memberId)).catch(() => [] as (typeof s.quoteSaves.$inferSelect)[])
    : [];
  const savedAt = new Map(saves.map((x) => [x.quoteId, x.createdAt ? new Date(x.createdAt).toISOString() : null]));
  return rows
    .map((r) => ({
      id: r.id, text: r.text, saidByMemberId: r.saidByMemberId, saidByName: r.saidByName, saidOn: r.saidOn ? String(r.saidOn) : null,
      addedBy: r.addedBy, visibility: r.visibility, favorite: r.favorite, showOnLogin: r.showOnLogin, source: r.source,
      sharedWith: shares.get(String(r.id)) || [],
      saved: savedAt.has(r.id), savedAt: savedAt.get(r.id) ?? null,
    }))
    .filter((q) => canView({ visibility: q.visibility, ownerId: q.addedBy, sharedWith: q.sharedWith }, viewer));
}

/** Deterministic pick for a date so everyone sees the same quote all day. Pure. */
export function pickQuoteOfDay<T>(items: T[], dateISO: string): T | null {
  if (!items.length) return null;
  let h = 0;
  for (let i = 0; i < dateISO.length; i++) h = (h * 31 + dateISO.charCodeAt(i)) >>> 0;
  return items[h % items.length];
}

export async function quoteOfTheDay(viewer: Viewer, dateISO: string): Promise<Quote | null> {
  // One pick a day from everything the viewer may see — the family's own words
  // and the seeded scripture and prophets alike (Jared, 2026-09-09).
  const all = await listQuotes(viewer);
  return pickQuoteOfDay([...all].sort((a, b) => a.id - b.id), dateISO);
}

/** Pre-auth login page: only the curated subset flagged show_on_login. */
export async function loginQuote(dateISO: string): Promise<{ text: string; who: string | null } | null> {
  if (!isDbConfigured || !db) return null;
  const rows = await db
    .select({ text: s.quotes.text, who: s.quotes.saidByName })
    .from(s.quotes)
    .where(eq(s.quotes.showOnLogin, true))
    .orderBy(asc(s.quotes.id))
    .catch(() => [] as { text: string; who: string | null }[]);
  return pickQuoteOfDay(rows, dateISO);
}

export async function addQuote(args: { text: string; saidByMemberId?: string | null; saidByName?: string | null; saidOn?: string | null; addedBy: string | null; visibility?: string; sharedWith?: string[] }) {
  const database = requireDb();
  const [row] = await database
    .insert(s.quotes)
    .values({ text: args.text.trim(), saidByMemberId: args.saidByMemberId ?? null, saidByName: args.saidByName?.trim() || null, saidOn: args.saidOn ?? null, addedBy: args.addedBy, visibility: args.visibility ?? "family" })
    .returning({ id: s.quotes.id });
  if (args.visibility === "custom" && args.sharedWith?.length) {
    await database.insert(s.shares).values(args.sharedWith.map((memberId) => ({ entityType: "quote", entityId: String(row.id), memberId }))).onConflictDoNothing();
  }
  return row.id;
}

export async function updateQuote(id: number, patch: Partial<{ text: string; saidByMemberId: string | null; saidByName: string | null; saidOn: string | null; visibility: string; favorite: boolean; showOnLogin: boolean }>, sharedWith?: string[]) {
  const database = requireDb();
  await database.update(s.quotes).set(patch).where(eq(s.quotes.id, id));
  if (sharedWith) {
    await database.delete(s.shares).where(eq(s.shares.entityId, String(id)));
    if (sharedWith.length) await database.insert(s.shares).values(sharedWith.map((memberId) => ({ entityType: "quote", entityId: String(id), memberId }))).onConflictDoNothing();
  }
}

export async function deleteQuote(id: number) {
  const database = requireDb();
  await database.delete(s.shares).where(eq(s.shares.entityId, String(id)));
  await database.delete(s.quotes).where(eq(s.quotes.id, id));
}

export async function getQuote(id: number) {
  if (!isDbConfigured || !db) return null;
  const [row] = await db.select().from(s.quotes).where(eq(s.quotes.id, id)).limit(1).catch(() => []);
  return row ?? null;
}

/** Save (or unsave) a quote for one person. */
export async function setQuoteSaved(quoteId: number, memberId: string, saved: boolean) {
  const database = requireDb();
  if (saved) await database.insert(s.quoteSaves).values({ quoteId, memberId }).onConflictDoNothing();
  else await database.delete(s.quoteSaves).where(and(eq(s.quoteSaves.quoteId, quoteId), eq(s.quoteSaves.memberId, memberId)));
}
