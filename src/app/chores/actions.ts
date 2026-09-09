"use server";
/**
 * Chores actions. Adults (and the owner) manage the schedule and check work;
 * anyone signed in can mark a chore done — on the kitchen tablet that's an
 * adult tapping for a kid until kid logins exist.
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as c from "@/db/chores";
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
const refresh = () => { revalidatePath("/chores"); revalidatePath("/"); };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIMES: c.TimeOfDay[] = ["morning", "afternoon", "evening", "any"];

export interface ChoreInput { title: string; icon?: string | null; assigneeMemberId?: string | null; days: string; timeOfDay: c.TimeOfDay; points: number; needsCheck: boolean }

function validate(i: ChoreInput): { ok: true; clean: ChoreInput } | { ok: false; error: string } {
  const title = i.title?.trim();
  if (!title) return { ok: false, error: "Name the chore" };
  const days = Array.from(new Set((i.days || "").split("").filter((d) => /^[0-6]$/.test(d)))).sort().join("");
  if (!days) return { ok: false, error: "Pick at least one day" };
  return { ok: true, clean: { title, icon: i.icon && c.CHORE_ICONS.includes(i.icon) ? i.icon : null, assigneeMemberId: i.assigneeMemberId || null, days, timeOfDay: TIMES.includes(i.timeOfDay) ? i.timeOfDay : "any", points: Math.max(0, Math.min(20, Math.round(Number(i.points) || 1))), needsCheck: !!i.needsCheck } };
}

export async function createChoreAction(input: ChoreInput) {
  const u = await adult();
  const v = validate(input);
  if (!v.ok) return { ok: false as const, error: v.error };
  const id = crypto.randomUUID();
  await c.createChore({ id, ...v.clean, createdBy: u.memberId });
  refresh();
  return { ok: true as const, id };
}

export async function updateChoreAction(id: string, input: Partial<ChoreInput> & { active?: boolean }) {
  await adult();
  const chores = await c.listChores({ includeInactive: true });
  const cur = chores.find((x) => x.id === id);
  if (!cur) return { ok: false as const, error: "Not found" };
  const v = validate({ title: input.title ?? cur.title, icon: input.icon !== undefined ? input.icon : cur.icon, assigneeMemberId: input.assigneeMemberId !== undefined ? input.assigneeMemberId : cur.assigneeMemberId, days: input.days ?? cur.days, timeOfDay: input.timeOfDay ?? cur.timeOfDay, points: input.points ?? cur.points, needsCheck: input.needsCheck ?? cur.needsCheck });
  if (!v.ok) return { ok: false as const, error: v.error };
  await c.updateChore(id, { ...v.clean, active: input.active ?? cur.active });
  refresh();
  return { ok: true as const };
}

export async function deleteChoreAction(id: string) {
  await adult();
  await c.deleteChore(id);
  refresh();
  return { ok: true as const };
}

/** Mark a chore done for a day. `memberId` says who did it (shared chores); defaults to whoever is signed in. */
export async function completeChoreAction(choreId: string, day: string, memberId?: string | null) {
  const u = await who();
  if (!ISO.test(day)) return { ok: false as const, error: "Bad day" };
  const chores = await c.listChores();
  const chore = chores.find((x) => x.id === choreId);
  if (!chore) return { ok: false as const, error: "Not found" };
  const doer = memberId ?? chore.assigneeMemberId ?? u.memberId;
  await c.completeChore(choreId, day, doer);
  if (chore.needsCheck) {
    const people = await getPeople().catch(() => []);
    const name = people.find((p) => p.id === doer)?.greetingName ?? "Someone";
    for (const a of people.filter((p) => p.kind === "adult" && p.id !== u.memberId)) await createNotification({ type: "chore_check", module: "chores", tone: "info", icon: "square-check", audience: "member", memberId: a.id, title: `${name} finished ${chore.title}`, body: "Tap to give it a check.", linkTo: `/chores?day=${day}`, dedupeKey: `chore-${choreId}-${day}-${a.id}` }).catch(() => {});
  }
  refresh();
  return { ok: true as const };
}

export async function uncompleteChoreAction(choreId: string, day: string) {
  await who();
  if (!ISO.test(day)) return { ok: false as const, error: "Bad day" };
  await c.uncompleteChore(choreId, day);
  refresh();
  return { ok: true as const };
}

export async function checkChoreAction(completionId: number, checked: boolean) {
  const u = await adult();
  await c.checkChore(completionId, u.memberId, checked);
  refresh();
  return { ok: true as const };
}

export async function todayAction() { return familyTodayISO(); }
