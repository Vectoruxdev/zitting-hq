/**
 * Cleaning — lists of tasks with rhythms (daily, certain days, every N weeks,
 * monthly, once), completions recorded per period, and hand-offs for one
 * period. The pure schedule maths lives in lib/cleaning/schedule.ts; this file is
 * the database and the view models Home and the Cleaning page share.
 */
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { cached } from "@/lib/cache";
import { addDays, type Assign, type Rhythm, type TimeOfDay } from "@/lib/cleaning/schedule";
import { TIME_ORDER, type CleaningCompletion, type CleaningList, type CleaningTask, type Handoff, type ListVisibility } from "@/lib/cleaning/view";

export * from "@/lib/cleaning/view";

// ── reads ─────────────────────────────────────────────────────────────────
type ListRow = typeof s.cleaningLists.$inferSelect;
type TaskRow = typeof s.cleaningTasks.$inferSelect;
type CompRow = typeof s.cleaningCompletions.$inferSelect;
type HandRow = typeof s.cleaningHandoffs.$inferSelect;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const toList = (r: ListRow): CleaningList => ({ id: r.id, name: r.name, icon: r.icon, tint: r.tint, visibility: r.visibility === "personal" ? "personal" : "family", ownerMemberId: r.ownerMemberId, remindTime: r.remindTime, sort: r.sort, createdBy: r.createdBy });
const toTask = (r: TaskRow): CleaningTask => ({ id: r.id, listId: r.listId, title: r.title, icon: r.icon, notes: r.notes, rhythm: r.rhythm as Rhythm, assign: (r.assign ?? { mode: "anyone" }) as Assign, timeOfDay: (TIME_ORDER.includes(r.timeOfDay as TimeOfDay) ? r.timeOfDay : "any") as TimeOfDay, points: r.points, needsCheck: r.needsCheck, active: r.active, sort: r.sort, createdBy: r.createdBy, createdOn: (r.createdAt ? new Date(r.createdAt) : new Date()).toISOString().slice(0, 10) });
const toComp = (r: CompRow): CleaningCompletion => ({ id: r.id, taskId: r.taskId, periodKey: r.periodKey, memberId: r.memberId, doneAt: iso(r.doneAt), checkedBy: r.checkedBy, checkedAt: iso(r.checkedAt) });
const toHand = (r: HandRow): Handoff => ({ taskId: r.taskId, periodKey: r.periodKey, memberId: r.memberId, byMemberId: r.byMemberId });

async function listLists__live(): Promise<CleaningList[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.cleaningLists).orderBy(asc(s.cleaningLists.sort), asc(s.cleaningLists.createdAt)).catch(() => [] as ListRow[]);
  return rows.filter((r) => !r.archivedAt).map(toList);
}
async function listTasks__live(): Promise<CleaningTask[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.cleaningTasks).orderBy(asc(s.cleaningTasks.sort), asc(s.cleaningTasks.createdAt)).catch(() => [] as TaskRow[]);
  return rows.map(toTask);
}
/** Completions recorded since a date (90 days covers every period that can still be open). */
async function listCompletions__live(sinceISO: string): Promise<CleaningCompletion[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.cleaningCompletions).where(gte(s.cleaningCompletions.doneAt, new Date(sinceISO + "T00:00:00Z"))).orderBy(desc(s.cleaningCompletions.doneAt)).catch(() => [] as CompRow[]);
  return rows.map(toComp);
}
async function listHandoffs__live(sinceISO: string): Promise<Handoff[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.cleaningHandoffs).where(gte(s.cleaningHandoffs.createdAt, new Date(sinceISO + "T00:00:00Z"))).catch(() => [] as HandRow[]);
  return rows.map(toHand);
}

// ---- cached readers (tag "chores" — the module's slug; see src/lib/cache.ts) ----
export const listLists = cached("cleaning:lists", ["chores"], listLists__live);
export const listTasks = cached("cleaning:tasks", ["chores"], listTasks__live);
export const listCompletions = cached("cleaning:completions", ["chores"], listCompletions__live);
export const listHandoffs = cached("cleaning:handoffs", ["chores"], listHandoffs__live);

/** Everything the screens need, read together. */
export async function loadCleaning(todayISO: string) {
  const since = addDays(todayISO, -90);
  const [lists, tasks, completions, handoffs] = await Promise.all([listLists(), listTasks(), listCompletions(since), listHandoffs(since)]);
  return { lists, tasks, completions, handoffs };
}

// ── writes ────────────────────────────────────────────────────────────────
function requireDb() { if (!db) throw new Error("Database not configured"); return db; }

export async function createList(l: { id: string; name: string; icon?: string | null; tint?: string | null; visibility: ListVisibility; ownerMemberId?: string | null; remindTime?: string | null; createdBy: string | null; sort?: number }) {
  await requireDb().insert(s.cleaningLists).values({ id: l.id, name: l.name.trim(), icon: l.icon ?? null, tint: l.tint ?? null, visibility: l.visibility, ownerMemberId: l.visibility === "personal" ? l.ownerMemberId ?? null : null, remindTime: l.remindTime ?? null, createdBy: l.createdBy, sort: l.sort ?? 0 });
}
export async function updateList(id: string, patch: Partial<{ name: string; icon: string | null; tint: string | null; visibility: ListVisibility; ownerMemberId: string | null; remindTime: string | null; sort: number }>) {
  if (Object.keys(patch).length) await requireDb().update(s.cleaningLists).set(patch).where(eq(s.cleaningLists.id, id));
}
export async function deleteList(id: string) {
  await requireDb().delete(s.cleaningLists).where(eq(s.cleaningLists.id, id));
}

export interface TaskInput { listId: string; title: string; icon?: string | null; notes?: string | null; rhythm: Rhythm; assign: Assign; timeOfDay: TimeOfDay; points: number; needsCheck: boolean }
export async function createTask(t: TaskInput & { id: string; createdBy: string | null; sort?: number }) {
  await requireDb().insert(s.cleaningTasks).values({ id: t.id, listId: t.listId, title: t.title.trim(), icon: t.icon ?? null, notes: t.notes?.trim() || null, rhythm: t.rhythm, assign: t.assign, timeOfDay: t.timeOfDay, points: t.points, needsCheck: t.needsCheck, createdBy: t.createdBy, sort: t.sort ?? 0 });
}
export async function updateTask(id: string, patch: Partial<TaskInput & { active: boolean; sort: number }>) {
  if (Object.keys(patch).length) await requireDb().update(s.cleaningTasks).set({ ...patch, notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null }).where(eq(s.cleaningTasks.id, id));
}
export async function deleteTask(id: string) {
  await requireDb().delete(s.cleaningTasks).where(eq(s.cleaningTasks.id, id));
}

/** Mark a period done (idempotent per task/period). Returns the completion id. */
export async function completeTask(taskId: string, periodKey: string, memberId: string | null): Promise<number> {
  const database = requireDb();
  const [row] = await database.insert(s.cleaningCompletions).values({ taskId, periodKey, memberId }).onConflictDoNothing().returning({ id: s.cleaningCompletions.id });
  if (row) return row.id;
  const [existing] = await database.select({ id: s.cleaningCompletions.id }).from(s.cleaningCompletions).where(and(eq(s.cleaningCompletions.taskId, taskId), eq(s.cleaningCompletions.periodKey, periodKey))).limit(1);
  return existing.id;
}
export async function uncompleteTask(taskId: string, periodKey: string) {
  await requireDb().delete(s.cleaningCompletions).where(and(eq(s.cleaningCompletions.taskId, taskId), eq(s.cleaningCompletions.periodKey, periodKey)));
}
export async function checkCompletion(completionId: number, by: string | null, checked: boolean) {
  await requireDb().update(s.cleaningCompletions).set(checked ? { checkedBy: by, checkedAt: new Date() } : { checkedBy: null, checkedAt: null }).where(eq(s.cleaningCompletions.id, completionId));
}

/** Hand one period of a task to someone (null clears the hand-off). */
export async function setHandoff(taskId: string, periodKey: string, memberId: string | null, by: string | null) {
  const database = requireDb();
  if (!memberId) { await database.delete(s.cleaningHandoffs).where(and(eq(s.cleaningHandoffs.taskId, taskId), eq(s.cleaningHandoffs.periodKey, periodKey))); return; }
  await database.insert(s.cleaningHandoffs).values({ taskId, periodKey, memberId, byMemberId: by }).onConflictDoUpdate({ target: [s.cleaningHandoffs.taskId, s.cleaningHandoffs.periodKey], set: { memberId, byMemberId: by, createdAt: new Date() } });
}

/** A kid is a person without a login — a name the parents organise around. */
export async function addKid(name: string, hue: number | null): Promise<string> {
  const database = requireDb();
  const id = crypto.randomUUID();
  await database.insert(s.familyMembers).values({ id, name: name.trim(), role: "member", status: "none" });
  await database.insert(s.memberProfiles).values({ memberId: id, kind: "child", hue }).onConflictDoUpdate({ target: s.memberProfiles.memberId, set: { kind: "child", hue } });
  return id;
}
