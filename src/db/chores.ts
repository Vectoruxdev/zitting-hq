/**
 * Chores — a weekly schedule per person (or "anyone"), completions per day,
 * and an adult's check for the ones that need one. Pure helpers for due-ness,
 * streaks and points live here so the chart and Home agree.
 */
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";
export interface Chore { id: string; title: string; icon: string | null; assigneeMemberId: string | null; days: string; timeOfDay: TimeOfDay; points: number; needsCheck: boolean; active: boolean; sort: number }
export interface Completion { id: number; choreId: string; memberId: string | null; day: string; doneAt: string | null; checkedBy: string | null; checkedAt: string | null }

export const TIME_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "any"];
export const CHORE_ICONS = ["square-check", "bed", "trash-2", "utensils", "cooking-pot", "refrigerator", "shopping-basket", "book-open", "leaf", "dumbbell", "school", "baby", "heart", "star", "sparkles", "sun", "moon", "activity", "clipboard-list", "folder"];

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekdayOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

/** Sunday..Saturday of the week containing `iso`. */
export function weekOf(iso: string): string[] {
  const start = addDays(iso, -weekdayOf(iso));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isDue(chore: { days: string; active: boolean }, iso: string): boolean {
  return chore.active && chore.days.includes(String(weekdayOf(iso)));
}

export interface PersonDay { memberId: string | null; due: Chore[]; done: Completion[]; allDone: boolean; points: number; possible: number; waitingCheck: number }

/** What each person owes on a day and what's done. `null` memberId = the shared "anyone" chores. */
export function dayFor(chores: Chore[], completions: Completion[], memberIds: (string | null)[], iso: string): PersonDay[] {
  const todays = completions.filter((c) => c.day === iso);
  return memberIds.map((memberId) => {
    const due = chores.filter((c) => c.assigneeMemberId === memberId && isDue(c, iso)).sort((a, b) => TIME_ORDER.indexOf(a.timeOfDay) - TIME_ORDER.indexOf(b.timeOfDay) || a.sort - b.sort);
    const done = todays.filter((c) => due.some((d) => d.id === c.choreId));
    const counted = done.filter((c) => { const ch = due.find((d) => d.id === c.choreId)!; return !ch.needsCheck || !!c.checkedAt; });
    return { memberId, due, done, allDone: due.length > 0 && done.length === due.length, points: counted.reduce((a, c) => a + (due.find((d) => d.id === c.choreId)?.points ?? 0), 0), possible: due.reduce((a, c) => a + c.points, 0), waitingCheck: done.filter((c) => due.find((d) => d.id === c.choreId)?.needsCheck && !c.checkedAt).length };
  });
}

/** Consecutive days (ending today or yesterday) on which every due chore was done. Days with nothing due don't break it. */
export function choreStreak(chores: Chore[], completions: Completion[], memberId: string, todayISO: string, maxDays = 365): number {
  const mine = chores.filter((c) => c.assigneeMemberId === memberId);
  if (!mine.length) return 0;
  const doneOn = (iso: string, id: string) => completions.some((c) => c.choreId === id && c.day === iso);
  const complete = (iso: string) => { const due = mine.filter((c) => isDue(c, iso)); return due.length ? due.every((c) => doneOn(iso, c.id)) : null; };
  let d = todayISO, n = 0;
  // Today only counts once it's complete; an unfinished today doesn't break yesterday's streak.
  const today = complete(todayISO);
  if (today === false) d = addDays(todayISO, -1);
  for (let i = 0; i < maxDays; i++) {
    const r = complete(d);
    if (r === false) break;
    if (r === true) n++;
    d = addDays(d, -1);
  }
  return n;
}

export function weekPoints(chores: Chore[], completions: Completion[], memberId: string, weekDays: string[]): { points: number; possible: number } {
  return weekDays.reduce((acc, day) => { const [p] = dayFor(chores, completions, [memberId], day); return { points: acc.points + p.points, possible: acc.possible + p.possible }; }, { points: 0, possible: 0 });
}

// ── reads ──────────────────────────────────────────────────────────────────
type ChoreRow = typeof s.chores.$inferSelect;
type CompRow = typeof s.choreCompletions.$inferSelect;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const toChore = (r: ChoreRow): Chore => ({ id: r.id, title: r.title, icon: r.icon, assigneeMemberId: r.assigneeMemberId, days: r.days, timeOfDay: (TIME_ORDER.includes(r.timeOfDay as TimeOfDay) ? r.timeOfDay : "any") as TimeOfDay, points: r.points, needsCheck: r.needsCheck, active: r.active, sort: r.sort });
const toComp = (r: CompRow): Completion => ({ id: r.id, choreId: r.choreId, memberId: r.memberId, day: String(r.day), doneAt: iso(r.doneAt), checkedBy: r.checkedBy, checkedAt: iso(r.checkedAt) });

export async function listChores(opts?: { includeInactive?: boolean }): Promise<Chore[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.chores).orderBy(asc(s.chores.sort), asc(s.chores.createdAt)).catch(() => [] as ChoreRow[]);
  return rows.map(toChore).filter((c) => opts?.includeInactive || c.active);
}

export async function listCompletions(fromISO: string, toISO: string): Promise<Completion[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.choreCompletions).where(and(gte(s.choreCompletions.day, fromISO), lte(s.choreCompletions.day, toISO))).orderBy(desc(s.choreCompletions.day)).catch(() => [] as CompRow[]);
  return rows.map(toComp);
}

// ── writes ─────────────────────────────────────────────────────────────────
function requireDb() { if (!db) throw new Error("Database not configured"); return db; }

export async function createChore(c: { id: string; title: string; icon?: string | null; assigneeMemberId?: string | null; days: string; timeOfDay: TimeOfDay; points: number; needsCheck: boolean; createdBy: string | null }) {
  await requireDb().insert(s.chores).values({ id: c.id, title: c.title.trim(), icon: c.icon || null, assigneeMemberId: c.assigneeMemberId || null, days: c.days, timeOfDay: c.timeOfDay, points: c.points, needsCheck: c.needsCheck, createdBy: c.createdBy });
}

export async function updateChore(id: string, patch: Partial<{ title: string; icon: string | null; assigneeMemberId: string | null; days: string; timeOfDay: TimeOfDay; points: number; needsCheck: boolean; active: boolean; sort: number }>) {
  if (Object.keys(patch).length) await requireDb().update(s.chores).set(patch).where(eq(s.chores.id, id));
}

export async function deleteChore(id: string) {
  await requireDb().delete(s.chores).where(eq(s.chores.id, id));
}

/** Mark done for a day (idempotent per chore/day). Returns the completion id. */
export async function completeChore(choreId: string, day: string, memberId: string | null): Promise<number> {
  const database = requireDb();
  const [row] = await database.insert(s.choreCompletions).values({ choreId, day, memberId }).onConflictDoNothing().returning({ id: s.choreCompletions.id });
  if (row) return row.id;
  const [existing] = await database.select({ id: s.choreCompletions.id }).from(s.choreCompletions).where(and(eq(s.choreCompletions.choreId, choreId), eq(s.choreCompletions.day, day))).limit(1);
  return existing.id;
}

export async function uncompleteChore(choreId: string, day: string) {
  await requireDb().delete(s.choreCompletions).where(and(eq(s.choreCompletions.choreId, choreId), eq(s.choreCompletions.day, day)));
}

export async function checkChore(completionId: number, by: string | null, checked: boolean) {
  await requireDb().update(s.choreCompletions).set(checked ? { checkedBy: by, checkedAt: new Date() } : { checkedBy: null, checkedAt: null }).where(eq(s.choreCompletions.id, completionId));
}
