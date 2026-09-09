/**
 * Goals — family and personal, four progress kinds. Savings goals link to the
 * finance module's savings_goals (read-only here; money moves in Finance);
 * everything else is check-ins. canView on every read; sequential, defensive.
 */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { canView, type Viewer } from "@/lib/access";
import { signMany } from "./photos";

export type ProgressKind = "checkoff" | "count" | "streak" | "savings";
export type GoalKind = "family" | "personal";
export interface Checkin { id: number; memberId: string | null; day: string; amount: number; note: string | null; createdAt: string | null }
export interface Progress {
  /** 0..1 */
  value: number;
  current: number;
  target: number | null;
  unit: string | null;
  money: boolean;
  /** streak goals: consecutive days ending today or yesterday */
  streak: number;
  doneToday: boolean;
  /** reached (completed, or the target is met) */
  done: boolean;
}
export interface Goal {
  id: string; title: string; description: string | null; kind: GoalKind; progressKind: ProgressKind; target: number | null; unit: string | null;
  savingsGoalId: string | null; savingsGoalName: string | null; coverPhotoId: string | null; cover: string | null; dueOn: string | null; hue: number | null;
  createdBy: string | null; visibility: string; sharedWith: string[]; participants: string[];
  completedAt: string | null; completedBy: string | null; createdAt: string | null;
  progress: Progress; checkinCount: number; lastCheckin: { memberId: string | null; day: string } | null;
}
export interface GoalDetail extends Goal { checkins: Checkin[] }

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Consecutive check-in days ending today (or yesterday, so a streak survives until the day is over). */
export function currentStreak(days: Iterable<string>, todayISO: string): number {
  const set = new Set(days);
  let d = set.has(todayISO) ? todayISO : addDays(todayISO, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function daysUntil(dueOn: string | null | undefined, todayISO: string): number | null {
  if (!dueOn) return null;
  return Math.round((Date.parse(dueOn + "T00:00:00Z") - Date.parse(todayISO + "T00:00:00Z")) / 86400000);
}

export function computeProgress(goal: { progressKind: string; target: number | null; unit?: string | null; completedAt?: string | null }, checkins: { day: string; amount: number }[], todayISO: string, savings?: { saved: number; target: number } | null): Progress {
  const completed = !!goal.completedAt;
  const doneToday = checkins.some((c) => c.day === todayISO);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  switch (goal.progressKind) {
    case "count": {
      const current = checkins.reduce((a, c) => a + c.amount, 0);
      const target = goal.target;
      const met = !!target && current >= target;
      return { value: completed ? 1 : target ? clamp(current / target) : 0, current, target, unit: goal.unit ?? null, money: false, streak: 0, doneToday, done: completed || met };
    }
    case "streak": {
      const days = new Set(checkins.map((c) => c.day));
      const current = days.size, target = goal.target;
      const met = !!target && current >= target;
      return { value: completed ? 1 : target ? clamp(current / target) : 0, current, target, unit: "days", money: false, streak: currentStreak(days, todayISO), doneToday, done: completed || met };
    }
    case "savings": {
      const current = savings?.saved ?? 0, target = savings?.target ?? goal.target ?? null;
      const met = !!target && current >= target;
      return { value: completed ? 1 : target ? clamp(current / target) : 0, current, target, unit: null, money: true, streak: 0, doneToday, done: completed || met };
    }
    default:
      return { value: completed ? 1 : 0, current: completed ? 1 : 0, target: 1, unit: null, money: false, streak: 0, doneToday, done: completed };
  }
}

type GoalRow = typeof s.goals.$inferSelect;
type CheckRow = typeof s.goalCheckins.$inferSelect;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const num = (x: string | number | null | undefined) => (x == null ? null : Number(x));

/** Linked finance goals: saved = the contributions ledger when it has rows, else the legacy `saved` column. */
async function savingsSnapshot(ids: string[]): Promise<Map<string, { name: string; saved: number; target: number }>> {
  const out = new Map<string, { name: string; saved: number; target: number }>();
  if (!db || !ids.length) return out;
  const rows = await db.select({ id: s.savingsGoals.id, name: s.savingsGoals.name, saved: s.savingsGoals.saved, target: s.savingsGoals.target }).from(s.savingsGoals).where(inArray(s.savingsGoals.id, ids)).catch(() => [] as { id: string; name: string; saved: string; target: string }[]);
  const contribs = rows.length ? await db.select({ goalId: s.savingsContributions.goalId, amount: s.savingsContributions.amount }).from(s.savingsContributions).where(inArray(s.savingsContributions.goalId, rows.map((r) => r.id))).catch(() => [] as { goalId: string; amount: string }[]) : [];
  for (const r of rows) {
    const mine = contribs.filter((c) => c.goalId === r.id);
    out.set(r.id, { name: r.name, saved: mine.length ? mine.reduce((a, c) => a + Number(c.amount), 0) : Number(r.saved), target: Number(r.target) });
  }
  return out;
}

export async function listSavingsGoalOptions(): Promise<{ id: string; name: string; saved: number; target: number }[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select({ id: s.savingsGoals.id }).from(s.savingsGoals).where(isNull(s.savingsGoals.archivedAt)).orderBy(asc(s.savingsGoals.sortOrder)).catch(() => [] as { id: string }[]);
  const snap = await savingsSnapshot(rows.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, ...snap.get(r.id)! })).filter((r) => r.name);
}

async function hydrate(rows: GoalRow[], viewer: Viewer, todayISO: string, withCheckins: boolean): Promise<GoalDetail[]> {
  if (!db || !rows.length) return [];
  const ids = rows.map((r) => r.id);
  const shareRows = await db.select({ entityId: s.shares.entityId, memberId: s.shares.memberId }).from(s.shares).where(and(eq(s.shares.entityType, "goal"), inArray(s.shares.entityId, ids))).catch(() => [] as { entityId: string; memberId: string }[]);
  const visible = rows.filter((r) => canView({ visibility: r.visibility, ownerId: r.createdBy, sharedWith: shareRows.filter((x) => x.entityId === r.id).map((x) => x.memberId) }, viewer));
  if (!visible.length) return [];
  const vids = visible.map((r) => r.id);
  const partRows = await db.select({ goalId: s.goalParticipants.goalId, memberId: s.goalParticipants.memberId }).from(s.goalParticipants).where(inArray(s.goalParticipants.goalId, vids)).catch(() => [] as { goalId: string; memberId: string }[]);
  const checkRows = await db.select().from(s.goalCheckins).where(inArray(s.goalCheckins.goalId, vids)).orderBy(desc(s.goalCheckins.day), desc(s.goalCheckins.id)).catch(() => [] as CheckRow[]);
  const snap = await savingsSnapshot(visible.map((r) => r.savingsGoalId).filter((x): x is string => !!x));
  const coverIds = visible.map((r) => r.coverPhotoId).filter((x): x is string => !!x);
  const covers = coverIds.length ? await db.select({ id: s.photos.id, full: s.photos.storagePath }).from(s.photos).where(inArray(s.photos.id, coverIds)).catch(() => [] as { id: string; full: string }[]) : [];
  const urls = await signMany(covers.map((c) => c.full));
  return visible.map((r) => {
    const checks = checkRows.filter((c) => c.goalId === r.id).map((c) => ({ id: c.id, memberId: c.memberId, day: String(c.day), amount: Number(c.amount), note: c.note, createdAt: iso(c.createdAt) }));
    const sv = r.savingsGoalId ? snap.get(r.savingsGoalId) ?? null : null;
    const cover = covers.find((c) => c.id === r.coverPhotoId);
    return {
      id: r.id, title: r.title, description: r.description, kind: (r.kind === "personal" ? "personal" : "family") as GoalKind, progressKind: (["checkoff", "count", "streak", "savings"].includes(r.progressKind) ? r.progressKind : "checkoff") as ProgressKind,
      target: num(r.target), unit: r.unit, savingsGoalId: r.savingsGoalId, savingsGoalName: sv?.name ?? null, coverPhotoId: r.coverPhotoId, cover: cover ? urls.get(cover.full) ?? null : null,
      dueOn: r.dueOn ? String(r.dueOn) : null, hue: r.hue, createdBy: r.createdBy, visibility: r.visibility,
      sharedWith: shareRows.filter((x) => x.entityId === r.id).map((x) => x.memberId), participants: partRows.filter((p) => p.goalId === r.id).map((p) => p.memberId),
      completedAt: iso(r.completedAt), completedBy: r.completedBy, createdAt: iso(r.createdAt),
      progress: computeProgress({ progressKind: r.progressKind, target: num(r.target), unit: r.unit, completedAt: iso(r.completedAt) }, checks, todayISO, sv),
      checkinCount: checks.length, lastCheckin: checks[0] ? { memberId: checks[0].memberId, day: checks[0].day } : null,
      checkins: withCheckins ? checks : [],
    };
  });
}

export async function listGoals(viewer: Viewer, todayISO: string): Promise<Goal[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select().from(s.goals).where(isNull(s.goals.archivedAt)).orderBy(asc(s.goals.sort), desc(s.goals.createdAt)).catch(() => [] as GoalRow[]);
  return hydrate(rows, viewer, todayISO, false);
}

export async function getGoal(id: string, viewer: Viewer, todayISO: string): Promise<GoalDetail | null> {
  if (!isDbConfigured || !db) return null;
  const rows = await db.select().from(s.goals).where(eq(s.goals.id, id)).limit(1).catch(() => [] as GoalRow[]);
  const [g] = await hydrate(rows, viewer, todayISO, true);
  return g ?? null;
}

/** Home: active goals the viewer is part of first, then the rest of the family's. */
export async function homeGoals(viewer: Viewer, todayISO: string, n = 3): Promise<Goal[]> {
  const all = (await listGoals(viewer, todayISO)).filter((g) => !g.completedAt);
  const mine = all.filter((g) => viewer.memberId && g.participants.includes(viewer.memberId));
  const rest = all.filter((g) => !mine.includes(g) && g.kind === "family");
  return [...mine, ...rest].slice(0, n);
}

// ── writes ─────────────────────────────────────────────────────────────────
function requireDb() { if (!db) throw new Error("Database not configured"); return db; }

export async function createGoal(g: { id: string; title: string; description?: string | null; kind: GoalKind; progressKind: ProgressKind; target?: number | null; unit?: string | null; savingsGoalId?: string | null; dueOn?: string | null; hue?: number | null; createdBy: string | null; visibility: string; sharedWith?: string[]; participants?: string[] }) {
  const database = requireDb();
  await database.insert(s.goals).values({ id: g.id, title: g.title.trim(), description: g.description?.trim() || null, kind: g.kind, progressKind: g.progressKind, target: g.target != null ? String(g.target) : null, unit: g.unit?.trim() || null, savingsGoalId: g.savingsGoalId || null, dueOn: g.dueOn || null, hue: g.hue ?? null, createdBy: g.createdBy, visibility: g.visibility });
  if (g.visibility === "custom" && g.sharedWith?.length) await database.insert(s.shares).values(g.sharedWith.map((memberId) => ({ entityType: "goal", entityId: g.id, memberId }))).onConflictDoNothing();
  if (g.participants?.length) await database.insert(s.goalParticipants).values(g.participants.map((memberId) => ({ goalId: g.id, memberId }))).onConflictDoNothing();
}

export async function updateGoal(id: string, patch: Partial<{ title: string; description: string | null; kind: GoalKind; progressKind: ProgressKind; target: string | null; unit: string | null; savingsGoalId: string | null; coverPhotoId: string | null; dueOn: string | null; hue: number | null; visibility: string; completedAt: Date | null; completedBy: string | null; archivedAt: Date | null }>, extras?: { sharedWith?: string[]; participants?: string[] }) {
  const database = requireDb();
  if (Object.keys(patch).length) await database.update(s.goals).set({ ...patch, updatedAt: new Date() }).where(eq(s.goals.id, id));
  if (extras?.sharedWith !== undefined) { await database.delete(s.shares).where(and(eq(s.shares.entityType, "goal"), eq(s.shares.entityId, id))); if (extras.sharedWith.length) await database.insert(s.shares).values(extras.sharedWith.map((memberId) => ({ entityType: "goal", entityId: id, memberId }))).onConflictDoNothing(); }
  if (extras?.participants !== undefined) { await database.delete(s.goalParticipants).where(eq(s.goalParticipants.goalId, id)); if (extras.participants.length) await database.insert(s.goalParticipants).values(extras.participants.map((memberId) => ({ goalId: id, memberId }))).onConflictDoNothing(); }
}

export async function deleteGoal(id: string) {
  const database = requireDb();
  await database.delete(s.shares).where(and(eq(s.shares.entityType, "goal"), eq(s.shares.entityId, id)));
  await database.delete(s.goals).where(eq(s.goals.id, id));
}

export async function addCheckin(c: { goalId: string; memberId: string | null; day: string; amount?: number; note?: string | null }) {
  const [row] = await requireDb().insert(s.goalCheckins).values({ goalId: c.goalId, memberId: c.memberId, day: c.day, amount: String(c.amount ?? 1), note: c.note?.trim() || null }).returning({ id: s.goalCheckins.id });
  return row.id;
}

export async function removeCheckin(id: number, goalId: string) {
  await requireDb().delete(s.goalCheckins).where(and(eq(s.goalCheckins.id, id), eq(s.goalCheckins.goalId, goalId)));
}
