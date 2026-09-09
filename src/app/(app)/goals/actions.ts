"use server";
/**
 * Goals actions. Anyone signed in makes goals; a goal is edited by whoever
 * made it, its participants, or the owner. Check-ins are open to anyone who
 * can see a family goal; personal goals take check-ins from their people.
 */
import { touched } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as g from "@/db/goals";
import { audienceFor } from "@/lib/access";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";
import { familyTodayISO } from "@/db/dashboard";

async function who() {
  if (!isAuthConfigured) return { memberId: null as string | null, role: "owner" as const, name: "Preview" };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return { memberId: u.memberId, role: u.role, name: u.name };
}
const refresh = (id?: string) => { touched("goals", "/goals"); touched("goals", "/"); if (id) touched("goals", `/goals/${id}`); };
const VIS = ["family", "private", "custom"];
const KINDS: g.ProgressKind[] = ["checkoff", "count", "streak", "savings"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface GoalInput { title: string; description?: string | null; kind: g.GoalKind; progressKind: g.ProgressKind; target?: number | null; unit?: string | null; savingsGoalId?: string | null; dueOn?: string | null; hue?: number | null; visibility?: string; sharedWith?: string[]; participants?: string[] }

function validate(input: GoalInput): { ok: true; clean: Required<Pick<GoalInput, "title" | "kind" | "progressKind">> & GoalInput } | { ok: false; error: string } {
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Give the goal a name" };
  if (!KINDS.includes(input.progressKind)) return { ok: false, error: "Pick how progress is measured" };
  const target = input.target != null && Number.isFinite(Number(input.target)) ? Number(input.target) : null;
  if ((input.progressKind === "count" || input.progressKind === "streak") && (!target || target <= 0)) return { ok: false, error: input.progressKind === "count" ? "How many is the target?" : "How many days?" };
  if (input.progressKind === "savings" && !input.savingsGoalId) return { ok: false, error: "Choose the savings goal it follows" };
  if (input.dueOn && !ISO.test(input.dueOn)) return { ok: false, error: "Bad date" };
  return { ok: true, clean: { ...input, title, kind: input.kind === "personal" ? "personal" : "family", progressKind: input.progressKind, target, visibility: VIS.includes(input.visibility || "") ? input.visibility : input.kind === "personal" ? "private" : "family" } };
}

async function load(id: string) {
  const u = await who();
  const goal = await g.getGoal(id, { memberId: u.memberId, role: u.role }, familyTodayISO());
  if (!goal) throw new Error("Goal not found");
  return { u, goal };
}
const mayEdit = (u: { memberId: string | null; role: string }, goal: g.Goal) => u.role === "owner" || goal.createdBy === u.memberId || (!!u.memberId && goal.participants.includes(u.memberId));
const mayCheckIn = (u: { memberId: string | null; role: string }, goal: g.Goal) => goal.kind === "family" || mayEdit(u, goal);

async function notifyDone(goal: g.Goal, actor: { memberId: string | null; name: string }) {
  const people = await getPeople().catch(() => []);
  const from = people.find((p) => p.id === actor.memberId)?.greetingName ?? actor.name;
  const audience = audienceFor({ visibility: goal.visibility, ownerId: goal.createdBy, sharedWith: goal.sharedWith }, people.filter((p) => p.kind === "adult").map((p) => ({ id: p.id, role: p.role })));
  for (const m of audience.filter((m) => m !== actor.memberId)) await createNotification({ type: "goal_completed", module: "goals", tone: "accent", icon: "party-popper", audience: "member", memberId: m, title: `Goal reached: ${goal.title}`, body: `${from} marked it done.`, linkTo: `/goals/${goal.id}`, dedupeKey: `goal-done-${goal.id}-${m}` }).catch(() => {});
}

export async function createGoalAction(input: GoalInput) {
  const u = await who();
  const v = validate(input);
  if (!v.ok) return { ok: false as const, error: v.error };
  const id = crypto.randomUUID();
  const participants = v.clean.participants?.length ? v.clean.participants : v.clean.kind === "personal" && u.memberId ? [u.memberId] : [];
  await g.createGoal({ id, title: v.clean.title, description: v.clean.description, kind: v.clean.kind, progressKind: v.clean.progressKind, target: v.clean.target, unit: v.clean.unit, savingsGoalId: v.clean.progressKind === "savings" ? v.clean.savingsGoalId : null, dueOn: v.clean.dueOn || null, hue: v.clean.hue, createdBy: u.memberId, visibility: v.clean.visibility!, sharedWith: v.clean.sharedWith, participants });
  const people = await getPeople().catch(() => []);
  const from = people.find((p) => p.id === u.memberId)?.greetingName ?? u.name;
  for (const m of participants.filter((m) => m !== u.memberId && people.some((p) => p.id === m && p.kind === "adult"))) await createNotification({ type: "shared_with_you", module: "goals", tone: "accent", icon: "target", audience: "member", memberId: m, title: `${from} added a goal: ${v.clean.title}`, body: v.clean.kind === "family" ? "You're in on it." : undefined, linkTo: `/goals/${id}`, dedupeKey: `goal-${id}-${m}` }).catch(() => {});
  refresh(id);
  return { ok: true as const, id };
}

export async function updateGoalAction(id: string, input: Partial<GoalInput>) {
  const { u, goal } = await load(id);
  if (!mayEdit(u, goal)) throw new Error("Not authorized");
  const merged: GoalInput = { title: input.title ?? goal.title, description: input.description ?? goal.description, kind: input.kind ?? goal.kind, progressKind: input.progressKind ?? goal.progressKind, target: input.target !== undefined ? input.target : goal.target, unit: input.unit !== undefined ? input.unit : goal.unit, savingsGoalId: input.savingsGoalId !== undefined ? input.savingsGoalId : goal.savingsGoalId, dueOn: input.dueOn !== undefined ? input.dueOn : goal.dueOn, hue: input.hue !== undefined ? input.hue : goal.hue, visibility: input.visibility ?? goal.visibility, sharedWith: input.sharedWith ?? goal.sharedWith, participants: input.participants ?? goal.participants };
  const v = validate(merged);
  if (!v.ok) return { ok: false as const, error: v.error };
  await g.updateGoal(id, { title: v.clean.title, description: v.clean.description?.trim() || null, kind: v.clean.kind, progressKind: v.clean.progressKind, target: v.clean.target != null ? String(v.clean.target) : null, unit: v.clean.unit?.trim() || null, savingsGoalId: v.clean.progressKind === "savings" ? v.clean.savingsGoalId ?? null : null, dueOn: v.clean.dueOn || null, hue: v.clean.hue ?? null, visibility: v.clean.visibility! }, { sharedWith: v.clean.visibility === "custom" ? v.clean.sharedWith ?? [] : [], participants: v.clean.participants });
  refresh(id);
  return { ok: true as const };
}

export async function setGoalCoverAction(id: string, photoId: string | null) {
  const { u, goal } = await load(id);
  if (!mayEdit(u, goal)) throw new Error("Not authorized");
  await g.updateGoal(id, { coverPhotoId: photoId });
  refresh(id);
  return { ok: true as const };
}

export async function deleteGoalAction(id: string) {
  const { u, goal } = await load(id);
  if (u.role !== "owner" && goal.createdBy !== u.memberId) throw new Error("Not authorized");
  await g.deleteGoal(id);
  refresh();
  return { ok: true as const };
}

/** Record progress. Returns `completed: true` the moment this check-in reaches the target so the screen can celebrate. */
export async function checkInAction(id: string, input?: { amount?: number; note?: string | null; day?: string }) {
  const { u, goal } = await load(id);
  if (!mayCheckIn(u, goal)) throw new Error("Not authorized");
  if (goal.progressKind === "savings") return { ok: false as const, error: "Money moves in Finance" };
  if (goal.completedAt) return { ok: false as const, error: "Already done" };
  const day = input?.day && ISO.test(input.day) ? input.day : familyTodayISO();
  const amount = goal.progressKind === "count" ? Math.max(0.01, Number(input?.amount ?? 1)) : 1;
  if (goal.progressKind === "streak" && goal.checkins.some((c) => c.day === day)) return { ok: true as const, completed: false, alreadyToday: true };
  const checkinId = await g.addCheckin({ goalId: id, memberId: u.memberId, day, amount, note: input?.note });
  const after = g.computeProgress({ progressKind: goal.progressKind, target: goal.target, unit: goal.unit }, [...goal.checkins, { day, amount }], familyTodayISO());
  let completed = false;
  if (after.done && goal.progressKind !== "checkoff") {
    await g.updateGoal(id, { completedAt: new Date(), completedBy: u.memberId });
    completed = true;
    await notifyDone(goal, u);
  }
  refresh(id);
  return { ok: true as const, completed, checkinId };
}

export async function undoCheckInAction(id: string, checkinId: number) {
  const { u, goal } = await load(id);
  const c = goal.checkins.find((x) => x.id === checkinId);
  if (!c) return { ok: false as const, error: "Not found" };
  if (!(u.role === "owner" || c.memberId === u.memberId || goal.createdBy === u.memberId)) throw new Error("Not authorized");
  await g.removeCheckin(checkinId, id);
  // Reopen if the undo drops it back under the target.
  if (goal.completedAt && goal.progressKind !== "checkoff") {
    const after = g.computeProgress({ progressKind: goal.progressKind, target: goal.target }, goal.checkins.filter((x) => x.id !== checkinId), familyTodayISO());
    if (!after.done) await g.updateGoal(id, { completedAt: null, completedBy: null });
  }
  refresh(id);
  return { ok: true as const };
}

export async function completeGoalAction(id: string) {
  const { u, goal } = await load(id);
  if (!mayCheckIn(u, goal)) throw new Error("Not authorized");
  if (goal.completedAt) return { ok: true as const };
  await g.updateGoal(id, { completedAt: new Date(), completedBy: u.memberId });
  await notifyDone(goal, u);
  refresh(id);
  return { ok: true as const };
}

export async function reopenGoalAction(id: string) {
  const { u, goal } = await load(id);
  if (!mayEdit(u, goal)) throw new Error("Not authorized");
  await g.updateGoal(id, { completedAt: null, completedBy: null });
  refresh(id);
  return { ok: true as const };
}
