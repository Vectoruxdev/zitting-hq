/**
 * The kitchen — dinner nights (rotation, overrides, dish duty, swaps), meal
 * ideas, recipe covers. Sequential, defensive reads. Pure helpers are exported
 * for tests (cookForDate, applySwap, detectPlatform, parseOpenGraph).
 */
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { addDaysISO, localISO } from "./household";
import { getAdminClient } from "@/lib/supabase/admin";
import { cached } from "@/lib/cache";

export const RECIPES_BUCKET = "recipes";

export interface RotationDay { weekday: number; cookMemberId: string | null; dishMemberIds: string[] }
export interface Assignment { date: string; cookMemberId: string | null; dishMemberIds: string[]; note: string | null; source: string }
export interface NightPlan { date: string; weekday: number; cook: string | null; dish: string[]; note: string | null; overridden: boolean }
export interface Swap { id: number; fromMemberId: string; toMemberId: string; fromDate: string; toDate: string; status: string; message: string | null; createdAt: string | null }
export interface Idea { id: number; url: string; platform: string; title: string | null; imageUrl: string | null; author: string | null; notes: string | null; postedBy: string | null; status: string; recipeId: number | null; createdAt: string | null; reactions: { memberId: string; emoji: string }[] }

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db;
}

/* ---------- pure ---------- */

/** Who's on tonight: the date's override, else the weekday's rotation. */
export function cookForDate(dateISO: string, rotation: RotationDay[], assignments: Assignment[]): NightPlan {
  const weekday = new Date(dateISO + "T00:00:00").getDay();
  const a = assignments.find((x) => x.date === dateISO);
  const r = rotation.find((x) => x.weekday === weekday);
  if (a) return { date: dateISO, weekday, cook: a.cookMemberId, dish: a.dishMemberIds, note: a.note, overridden: true };
  return { date: dateISO, weekday, cook: r?.cookMemberId ?? null, dish: r?.dishMemberIds ?? [], note: null, overridden: false };
}

/** The two overrides an accepted swap writes: each date gets the other person as cook. */
export function applySwap(swap: Pick<Swap, "fromMemberId" | "toMemberId" | "fromDate" | "toDate">, rotation: RotationDay[], assignments: Assignment[]): Assignment[] {
  const a = cookForDate(swap.fromDate, rotation, assignments);
  const b = cookForDate(swap.toDate, rotation, assignments);
  return [
    { date: swap.fromDate, cookMemberId: swap.toMemberId, dishMemberIds: a.dish, note: a.note, source: "swap" },
    { date: swap.toDate, cookMemberId: swap.fromMemberId, dishMemberIds: b.dish, note: b.note, source: "swap" },
  ];
}

export type SwapStatus = "pending" | "accepted" | "declined" | "cancelled";
/** Allowed transitions: only pending swaps move; the recipient accepts/declines, the requester cancels. */
export function nextSwapStatus(current: string, action: "accept" | "decline" | "cancel", actor: string, swap: Pick<Swap, "fromMemberId" | "toMemberId">, isOwner = false): SwapStatus | null {
  if (current !== "pending") return null;
  if (action === "cancel") return actor === swap.fromMemberId || isOwner ? "cancelled" : null;
  if (actor !== swap.toMemberId && !isOwner) return null;
  return action === "accept" ? "accepted" : "declined";
}

export function detectPlatform(url: string): "tiktok" | "instagram" | "youtube" | "web" {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
    if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return "youtube";
  } catch { /* not a URL */ }
  return "web";
}

/** Minimal Open Graph reader (title, image, site) from an HTML string. */
export function parseOpenGraph(html: string): { title: string | null; image: string | null; author: string | null } {
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
    const m = html.match(re) || html.match(re2);
    return m ? decodeEntities(m[1]) : null;
  };
  const titleTag = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return { title: meta("og:title") || meta("twitter:title") || (titleTag ? decodeEntities(titleTag[1].trim()) : null), image: meta("og:image") || meta("twitter:image"), author: meta("og:site_name") || meta("author") };
}
function decodeEntities(x: string): string {
  return x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/* ---------- link metadata (server) ---------- */

/** Best-effort metadata for a pasted link. TikTok and YouTube have public oEmbed; Instagram needs a Meta token, so it falls back to Open Graph (often blocked) and then to the bare link. Never throws. */
export async function fetchLinkMeta(url: string): Promise<{ platform: string; title: string | null; image: string | null; author: string | null }> {
  const platform = detectPlatform(url);
  const timeout = () => AbortSignal.timeout(5000);
  try {
    if (platform === "tiktok" || platform === "youtube") {
      const ep = platform === "tiktok" ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
      const r = await fetch(ep, { signal: timeout(), headers: { accept: "application/json" } });
      if (r.ok) {
        const j = (await r.json()) as { title?: string; thumbnail_url?: string; author_name?: string };
        return { platform, title: j.title ?? null, image: j.thumbnail_url ?? null, author: j.author_name ?? null };
      }
    }
    const r = await fetch(url, { signal: timeout(), headers: { "user-agent": "Mozilla/5.0 (compatible; ZittingHQ/1.0)", accept: "text/html" }, redirect: "follow" });
    if (r.ok) {
      const html = (await r.text()).slice(0, 200_000);
      const og = parseOpenGraph(html);
      return { platform, ...og };
    }
  } catch { /* offline, blocked, or not HTML */ }
  return { platform, title: null, image: null, author: null };
}

/* ---------- reads ---------- */

export async function coverUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage.from(RECIPES_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

async function getRotation__live(): Promise<RotationDay[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.dinnerRotation).orderBy(asc(s.dinnerRotation.weekday)).catch(() => [] as (typeof s.dinnerRotation.$inferSelect)[]);
  return rows.map((r) => ({ weekday: r.weekday, cookMemberId: r.cookMemberId, dishMemberIds: r.dishMemberIds ?? [] }));
}

async function getAssignments__live(fromISO: string, toISO: string): Promise<Assignment[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.dinnerAssignments).where(and(gte(s.dinnerAssignments.date, fromISO), lte(s.dinnerAssignments.date, toISO))).catch(() => [] as (typeof s.dinnerAssignments.$inferSelect)[]);
  return rows.map((r) => ({ date: String(r.date), cookMemberId: r.cookMemberId, dishMemberIds: r.dishMemberIds ?? [], note: r.note, source: r.source }));
}

/** Nights for a date range with cooks resolved. */
async function getNights__live(fromISO: string, days: number): Promise<NightPlan[]> {
  const toISO = addDaysISO(fromISO, days - 1);
  const [rotation, assignments] = [await getRotation(), await getAssignments(fromISO, toISO)];
  return Array.from({ length: days }, (_, i) => cookForDate(addDaysISO(fromISO, i), rotation, assignments));
}

async function listSwaps__live(status: "pending" | "all" = "pending"): Promise<Swap[]> {
  if (!isDbConfigured || !db) return [];
  const q = db.select().from(s.dinnerSwaps).orderBy(desc(s.dinnerSwaps.createdAt));
  const rows = await (status === "pending" ? q.where(eq(s.dinnerSwaps.status, "pending")) : q).catch(() => [] as (typeof s.dinnerSwaps.$inferSelect)[]);
  return rows.map((r) => ({ id: r.id, fromMemberId: r.fromMemberId, toMemberId: r.toMemberId, fromDate: String(r.fromDate), toDate: String(r.toDate), status: r.status, message: r.message, createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null }));
}

async function listIdeas__live(): Promise<Idea[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.mealIdeas).orderBy(desc(s.mealIdeas.createdAt)).catch(() => [] as (typeof s.mealIdeas.$inferSelect)[]);
  const reactions = rows.length ? await db.select().from(s.mealIdeaReactions).where(inArray(s.mealIdeaReactions.ideaId, rows.map((r) => r.id))).catch(() => [] as (typeof s.mealIdeaReactions.$inferSelect)[]) : [];
  return rows.map((r) => ({ id: r.id, url: r.url, platform: r.platform, title: r.title, imageUrl: r.imageUrl, author: r.author, notes: r.notes, postedBy: r.postedBy, status: r.status, recipeId: r.recipeId, createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null, reactions: reactions.filter((x) => x.ideaId === r.id).map((x) => ({ memberId: x.memberId, emoji: x.emoji })) }));
}

/* ---------- writes ---------- */

export async function setRotationDay(weekday: number, cookMemberId: string | null, dishMemberIds: string[]) {
  const database = requireDb();
  await database.insert(s.dinnerRotation).values({ weekday, cookMemberId, dishMemberIds, updatedAt: new Date() }).onConflictDoUpdate({ target: s.dinnerRotation.weekday, set: { cookMemberId, dishMemberIds, updatedAt: new Date() } });
}

export async function setAssignment(a: Assignment) {
  const database = requireDb();
  await database.insert(s.dinnerAssignments).values({ date: a.date, cookMemberId: a.cookMemberId, dishMemberIds: a.dishMemberIds, note: a.note, source: a.source, updatedAt: new Date() }).onConflictDoUpdate({ target: s.dinnerAssignments.date, set: { cookMemberId: a.cookMemberId, dishMemberIds: a.dishMemberIds, note: a.note, source: a.source, updatedAt: new Date() } });
}

export async function clearAssignment(dateISO: string) {
  await requireDb().delete(s.dinnerAssignments).where(eq(s.dinnerAssignments.date, dateISO));
}

export async function createSwap(args: { fromMemberId: string; toMemberId: string; fromDate: string; toDate: string; message?: string | null }) {
  const [row] = await requireDb().insert(s.dinnerSwaps).values({ ...args, message: args.message?.trim() || null }).returning({ id: s.dinnerSwaps.id });
  return row.id;
}

export async function getSwap(id: number): Promise<Swap | null> {
  if (!isDbConfigured || !db) return null;
  const [r] = await db.select().from(s.dinnerSwaps).where(eq(s.dinnerSwaps.id, id)).limit(1).catch(() => []);
  return r ? { id: r.id, fromMemberId: r.fromMemberId, toMemberId: r.toMemberId, fromDate: String(r.fromDate), toDate: String(r.toDate), status: r.status, message: r.message, createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null } : null;
}

export async function resolveSwap(swap: Swap, status: SwapStatus) {
  const database = requireDb();
  await database.update(s.dinnerSwaps).set({ status, resolvedAt: new Date() }).where(eq(s.dinnerSwaps.id, swap.id));
  if (status === "accepted") {
    const rotation = await getRotation();
    const lo = swap.fromDate < swap.toDate ? swap.fromDate : swap.toDate, hi = swap.fromDate < swap.toDate ? swap.toDate : swap.fromDate;
    const assignments = await getAssignments(lo, hi);
    for (const a of applySwap(swap, rotation, assignments)) await setAssignment(a);
  }
}

export async function addIdea(args: { url: string; notes?: string | null; postedBy: string | null }) {
  const meta = await fetchLinkMeta(args.url);
  const [row] = await requireDb().insert(s.mealIdeas).values({ url: args.url, platform: meta.platform, title: meta.title, imageUrl: meta.image, author: meta.author, notes: args.notes?.trim() || null, postedBy: args.postedBy }).returning({ id: s.mealIdeas.id });
  return { id: row.id, ...meta };
}

export async function updateIdea(id: number, patch: Partial<{ title: string | null; notes: string | null; status: string; recipeId: number | null; imageUrl: string | null }>) {
  await requireDb().update(s.mealIdeas).set(patch).where(eq(s.mealIdeas.id, id));
}

export async function deleteIdea(id: number) {
  await requireDb().delete(s.mealIdeas).where(eq(s.mealIdeas.id, id));
}

export async function toggleReaction(ideaId: number, memberId: string, emoji = "heart") {
  const database = requireDb();
  const [existing] = await database.select().from(s.mealIdeaReactions).where(and(eq(s.mealIdeaReactions.ideaId, ideaId), eq(s.mealIdeaReactions.memberId, memberId))).limit(1);
  if (existing) { await database.delete(s.mealIdeaReactions).where(and(eq(s.mealIdeaReactions.ideaId, ideaId), eq(s.mealIdeaReactions.memberId, memberId))); return false; }
  await database.insert(s.mealIdeaReactions).values({ ideaId, memberId, emoji });
  return true;
}

export async function setRecipeCover(recipeId: number, path: string | null) {
  await requireDb().update(s.recipes).set({ coverPhotoPath: path }).where(eq(s.recipes.id, recipeId));
}

export async function updateRecipeMeta(recipeId: number, patch: Partial<{ servings: number | null; prepMinutes: number | null; tags: string[]; sourceUrl: string | null; lastMadeOn: string | null }>) {
  await requireDb().update(s.recipes).set(patch).where(eq(s.recipes.id, recipeId));
}

export const weekStartOf = (d: Date): string => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return localISO(x); };

// ---- cached readers (see src/lib/cache.ts) ----
export const getNights = cached("kitchen:getNights", ["meals"], getNights__live);
export const listSwaps = cached("kitchen:listSwaps", ["meals"], listSwaps__live);
export const getRotation = cached("kitchen:getRotation", ["meals"], getRotation__live);
export const getAssignments = cached("kitchen:getAssignments", ["meals"], getAssignments__live);
export const listIdeas = cached("kitchen:listIdeas", ["meals"], listIdeas__live);
