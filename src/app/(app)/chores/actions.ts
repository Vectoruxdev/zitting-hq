"use server";
/**
 * Cleaning actions. Adults (and the owner) manage lists and tasks, hand
 * things off and check kids' work; anyone signed in can mark something done.
 * Kids have no logins — an adult ticks for them.
 */
import { touched } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as k from "@/db/cleaning";
import { validateAssign, validateRhythm, type Assign, type Rhythm, type TimeOfDay } from "@/lib/cleaning/schedule";
import { CLEANING_TEMPLATES } from "@/db/cleaning-templates";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";
import { familyTodayISO } from "@/db/dashboard";

async function who() {
  if (!isAuthConfigured) return { memberId: null as string | null, role: "owner" as const, name: "Preview" };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return { memberId: u.memberId, role: u.role, name: u.name };
}
async function adult() {
  const u = await who();
  if (u.role === "owner" || !u.memberId) return u;
  const people = await getPeople().catch(() => []);
  if (people.find((p) => p.id === u.memberId)?.kind === "child") throw new Error("Grown-ups only");
  return u;
}
const refresh = () => { touched("chores", "/chores"); touched("chores", "/"); };
const PERIOD_KEY = /^\d{4}-\d{2}(-\d{2})?$/;
const TIMES: TimeOfDay[] = ["morning", "afternoon", "evening", "any"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lists this person may see (family + their own personal ones). */
async function myList(id: string, me: string | null) {
  const lists = await k.listLists();
  const list = k.visibleLists(lists, me).find((l) => l.id === id);
  if (!list) throw new Error("That list isn't yours to change");
  return list;
}

// ── lists ────────────────────────────────────────────────────────────────
export interface ListInput { name: string; icon?: string | null; tint?: string | null; visibility: k.ListVisibility; remindTime?: string | null }
function cleanList(i: ListInput): { ok: true; clean: ListInput } | { ok: false; error: string } {
  const name = i.name?.trim();
  if (!name) return { ok: false, error: "Name the list" };
  if (i.remindTime && !HHMM.test(i.remindTime)) return { ok: false, error: "Reminder time looks off" };
  return { ok: true, clean: { name, icon: i.icon && k.LIST_ICONS.includes(i.icon) ? i.icon : null, tint: i.tint && (k.LIST_TINTS as readonly string[]).includes(i.tint) ? i.tint : null, visibility: i.visibility === "personal" ? "personal" : "family", remindTime: i.remindTime || null } };
}
export async function createListAction(input: ListInput) {
  const u = await adult();
  const v = cleanList(input);
  if (!v.ok) return { ok: false as const, error: v.error };
  const id = crypto.randomUUID();
  const lists = await k.listLists();
  await k.createList({ id, ...v.clean, ownerMemberId: u.memberId, createdBy: u.memberId, sort: lists.length });
  refresh();
  return { ok: true as const, id };
}
export async function updateListAction(id: string, input: Partial<ListInput>) {
  const u = await adult();
  const cur = await myList(id, u.memberId);
  const v = cleanList({ name: input.name ?? cur.name, icon: input.icon !== undefined ? input.icon : cur.icon, tint: input.tint !== undefined ? input.tint : cur.tint, visibility: input.visibility ?? cur.visibility, remindTime: input.remindTime !== undefined ? input.remindTime : cur.remindTime });
  if (!v.ok) return { ok: false as const, error: v.error };
  await k.updateList(id, { ...v.clean, ownerMemberId: v.clean.visibility === "personal" ? cur.ownerMemberId ?? u.memberId : null });
  refresh();
  return { ok: true as const };
}
export async function deleteListAction(id: string) {
  const u = await adult();
  await myList(id, u.memberId);
  await k.deleteList(id);
  refresh();
  return { ok: true as const };
}

// ── tasks ────────────────────────────────────────────────────────────────
export interface TaskFormInput { listId: string; title: string; icon?: string | null; notes?: string | null; rhythm: unknown; assign: unknown; timeOfDay: TimeOfDay; points: number; needsCheck: boolean }
async function cleanTask(i: TaskFormInput, todayISO: string): Promise<{ ok: true; clean: k.TaskInput } | { ok: false; error: string }> {
  const title = i.title?.trim();
  if (!title) return { ok: false, error: "Name the task" };
  const r = validateRhythm(i.rhythm);
  if (!r.ok) return { ok: false, error: r.error };
  const people = await getPeople().catch(() => []);
  const a = validateAssign(i.assign, people.map((p) => p.id));
  if (!a.ok) return { ok: false, error: a.error };
  const assign: Assign = a.assign.mode === "rotation" ? { ...a.assign, anchor: a.assign.anchor ?? todayISO } : a.assign;
  const points = Number.isFinite(i.points) ? Math.max(0, Math.min(20, Math.round(i.points))) : 0;
  return { ok: true, clean: { listId: i.listId, title, icon: i.icon && k.TASK_ICONS.includes(i.icon) ? i.icon : null, notes: i.notes ?? null, rhythm: r.rhythm as Rhythm, assign, timeOfDay: TIMES.includes(i.timeOfDay) ? i.timeOfDay : "any", points, needsCheck: !!i.needsCheck } };
}
export async function createTaskAction(input: TaskFormInput) {
  const u = await adult();
  await myList(input.listId, u.memberId);
  const v = await cleanTask(input, familyTodayISO());
  if (!v.ok) return { ok: false as const, error: v.error };
  const id = crypto.randomUUID();
  const tasks = await k.listTasks();
  await k.createTask({ id, ...v.clean, createdBy: u.memberId, sort: tasks.filter((t) => t.listId === input.listId).length });
  refresh();
  return { ok: true as const, id };
}
export async function updateTaskAction(id: string, input: Partial<TaskFormInput> & { active?: boolean }) {
  const u = await adult();
  const cur = (await k.listTasks()).find((t) => t.id === id);
  if (!cur) return { ok: false as const, error: "Not found" };
  await myList(cur.listId, u.memberId);
  if (input.listId && input.listId !== cur.listId) await myList(input.listId, u.memberId);
  const v = await cleanTask({ listId: input.listId ?? cur.listId, title: input.title ?? cur.title, icon: input.icon !== undefined ? input.icon : cur.icon, notes: input.notes !== undefined ? input.notes : cur.notes, rhythm: input.rhythm ?? cur.rhythm, assign: input.assign ?? cur.assign, timeOfDay: input.timeOfDay ?? cur.timeOfDay, points: input.points ?? cur.points, needsCheck: input.needsCheck ?? cur.needsCheck }, familyTodayISO());
  if (!v.ok) return { ok: false as const, error: v.error };
  await k.updateTask(id, { ...v.clean, active: input.active ?? cur.active });
  refresh();
  return { ok: true as const };
}
export async function deleteTaskAction(id: string) {
  const u = await adult();
  const cur = (await k.listTasks()).find((t) => t.id === id);
  if (!cur) return { ok: true as const };
  await myList(cur.listId, u.memberId);
  await k.deleteTask(id);
  refresh();
  return { ok: true as const };
}

// ── doing the work ───────────────────────────────────────────────────────
/** Mark a period done. `memberId` says who did it (for "anyone" tasks and kids); defaults to the task's person, then whoever is signed in. */
export async function completeTaskAction(taskId: string, periodKey: string, memberId?: string | null) {
  const u = await who();
  if (!PERIOD_KEY.test(periodKey)) return { ok: false as const, error: "Bad period" };
  const task = (await k.listTasks()).find((t) => t.id === taskId);
  if (!task) return { ok: false as const, error: "Not found" };
  const doer = memberId ?? (task.assign.mode === "person" ? task.assign.memberId : null) ?? u.memberId;
  await k.completeTask(taskId, periodKey, doer);
  if (task.needsCheck) {
    const people = await getPeople().catch(() => []);
    const name = people.find((p) => p.id === doer)?.greetingName ?? "Someone";
    for (const a of people.filter((p) => p.kind === "adult" && p.id !== u.memberId)) {
      await createNotification({ type: "chore_check", module: "chores", tone: "info", icon: "badge-check", audience: "member", memberId: a.id, title: `${name} finished “${task.title}”`, body: "Give it a look and check it off.", linkTo: "/chores", dedupeKey: `clean-check-${taskId}-${periodKey}-${a.id}` }).catch(() => {});
    }
  }
  refresh();
  return { ok: true as const };
}
export async function uncompleteTaskAction(taskId: string, periodKey: string) {
  await who();
  if (!PERIOD_KEY.test(periodKey)) return { ok: false as const, error: "Bad period" };
  await k.uncompleteTask(taskId, periodKey);
  refresh();
  return { ok: true as const };
}
export async function checkTaskAction(completionId: number, checked: boolean) {
  const u = await adult();
  await k.checkCompletion(completionId, u.memberId, checked);
  refresh();
  return { ok: true as const };
}

/** "Take this" (memberId = me) or "Hand to…" for one period; null puts it back on the usual rule. */
export async function handoffAction(taskId: string, periodKey: string, memberId: string | null) {
  const u = await adult();
  if (!PERIOD_KEY.test(periodKey)) return { ok: false as const, error: "Bad period" };
  const task = (await k.listTasks()).find((t) => t.id === taskId);
  if (!task) return { ok: false as const, error: "Not found" };
  await k.setHandoff(taskId, periodKey, memberId, u.memberId);
  if (memberId && memberId !== u.memberId) {
    const people = await getPeople().catch(() => []);
    const to = people.find((p) => p.id === memberId);
    if (to?.kind === "adult") await createNotification({ type: "cleaning_assigned", module: "chores", tone: "accent", icon: "sparkles", audience: "member", memberId, title: `${u.name.split(" ")[0]} handed you “${task.title}”`, body: "It's on your Cleaning list now.", linkTo: "/chores", dedupeKey: `clean-handoff-${taskId}-${periodKey}-${memberId}` }).catch(() => {});
  }
  refresh();
  return { ok: true as const };
}

// ── starters ─────────────────────────────────────────────────────────────
export async function applyTemplateAction(key: string) {
  const u = await adult();
  const tpl = CLEANING_TEMPLATES.find((t) => t.key === key);
  if (!tpl) return { ok: false as const, error: "No such template" };
  const today = familyTodayISO();
  const people = await getPeople().catch(() => []);
  const adults = people.filter((p) => p.kind === "adult" && p.id !== "household").map((p) => p.id);
  const kids = people.filter((p) => p.kind === "child").map((p) => p.id);
  const lists = await k.listLists();
  const listId = crypto.randomUUID();
  await k.createList({ id: listId, name: tpl.name, icon: tpl.icon, tint: tpl.tint, visibility: "family", createdBy: u.memberId, sort: lists.length });
  let i = 0;
  for (const t of tpl.tasks) {
    const rhythm: Rhythm = t.rhythm.type === "every_weeks" ? { type: "every_weeks", n: t.rhythm.n, weekday: t.rhythm.weekday, anchor: today } : t.rhythm;
    const assign: Assign = t.who === "adults" && adults.length >= 2 ? { mode: "rotation", memberIds: adults, anchor: today } : t.who === "kids" && kids.length === 1 ? { mode: "person", memberId: kids[0] } : { mode: "anyone" };
    await k.createTask({ id: crypto.randomUUID(), listId, title: t.title, icon: t.icon, rhythm, assign, timeOfDay: t.timeOfDay ?? "any", points: t.points ?? 0, needsCheck: t.who === "kids", createdBy: u.memberId, sort: i++ });
  }
  refresh();
  return { ok: true as const, id: listId };
}

/** A kid for the parents to organise around — no login, no email. */
export async function addKidAction(name: string) {
  await adult();
  const n = name.trim();
  if (!n) return { ok: false as const, error: "What's their name?" };
  const people = await getPeople().catch(() => []);
  const used = new Set(people.map((p) => p.hue));
  const hue = [1, 2, 3, 4, 5, 6].find((h) => !used.has(h)) ?? null;
  const id = await k.addKid(n, hue);
  touched("people", "/chores"); touched("people", "/people"); touched("people", "/");
  return { ok: true as const, id };
}

export async function todayAction() { return familyTodayISO(); }
