"use server";
/**
 * Meals & dinner nights. Shared family space: any signed-in member may plan,
 * cook, and swap; swaps are guarded by the state machine in db/kitchen.ts.
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import * as h from "@/db/household";
import * as k from "@/db/kitchen";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";
import { fmtNight } from "@/lib/dates";

async function ensureFamily() {
  if (!isAuthConfigured) return null;
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return u;
}
const refresh = () => { revalidatePath("/meals"); revalidatePath("/groceries"); revalidatePath("/"); };

export async function saveRecipe(args: Parameters<typeof h.saveRecipe>[0] & { servings?: number | null; prepMinutes?: number | null; tags?: string[]; sourceUrl?: string | null }) {
  await ensureFamily();
  const res = await h.saveRecipe(args);
  if (res.ok && (args.servings !== undefined || args.prepMinutes !== undefined || args.tags || args.sourceUrl !== undefined)) {
    await k.updateRecipeMeta(res.id, { servings: args.servings ?? null, prepMinutes: args.prepMinutes ?? null, tags: (args.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12), sourceUrl: args.sourceUrl?.trim() || null }).catch(() => {});
  }
  refresh();
  return res;
}
export async function deleteRecipe(id: number) { await ensureFamily(); const res = await h.deleteRecipe(id); refresh(); return res; }
export async function setMeal(args: Parameters<typeof h.setMeal>[0]) { await ensureFamily(); const res = await h.setMeal(args); refresh(); return res; }
export async function sendRecipeToList(recipeId: number) { await ensureFamily(); const res = await h.sendRecipeToList(recipeId); refresh(); return res; }

const COVER_MAX = 8 * 1024 * 1024;
export async function uploadRecipeCover(recipeId: number, formData: FormData) {
  await ensureFamily();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return { ok: false as const, error: "Choose an image" };
  if (file.size > COVER_MAX) return { ok: false as const, error: "Image is over the 8MB limit" };
  const admin = getAdminClient();
  if (!admin) return { ok: false as const, error: "Photo storage isn't configured on this server" };
  const path = `${recipeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await admin.storage.from(k.RECIPES_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (error) return { ok: false as const, error: error.message };
  await k.setRecipeCover(recipeId, path);
  refresh();
  return { ok: true as const, url: await k.coverUrl(path) };
}

/* ---- dinner nights ---- */

export async function setRotationDay(weekday: number, cookMemberId: string | null, dishMemberIds: string[]) {
  await ensureFamily();
  if (weekday < 0 || weekday > 6) return { ok: false as const, error: "Bad weekday" };
  await k.setRotationDay(weekday, cookMemberId, dishMemberIds.slice(0, 4));
  refresh();
  return { ok: true as const };
}

export async function setNight(date: string, patch: { cookMemberId?: string | null; dishMemberIds?: string[]; note?: string | null; reset?: boolean }) {
  await ensureFamily();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: "Bad date" };
  if (patch.reset) { await k.clearAssignment(date); refresh(); return { ok: true as const }; }
  const current = (await k.getNights(date, 1))[0];
  await k.setAssignment({ date, cookMemberId: patch.cookMemberId === undefined ? current.cook : patch.cookMemberId, dishMemberIds: patch.dishMemberIds ?? current.dish, note: patch.note === undefined ? current.note : patch.note?.trim() || null, source: "override" });
  refresh();
  return { ok: true as const };
}

export async function requestSwap(args: { toMemberId: string; fromDate: string; toDate: string; message?: string | null }) {
  const u = await ensureFamily();
  const me = u?.memberId ?? null;
  if (!me) return { ok: false as const, error: "Your login isn't linked to a family member yet" };
  if (args.toMemberId === me) return { ok: false as const, error: "Pick someone else" };
  if (![args.fromDate, args.toDate].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) return { ok: false as const, error: "Bad dates" };
  const id = await k.createSwap({ fromMemberId: me, toMemberId: args.toMemberId, fromDate: args.fromDate, toDate: args.toDate, message: args.message });
  const people = await getPeople().catch(() => []);
  const from = people.find((p) => p.id === me);
  await createNotification({ type: "dinner_swap", module: "meals", tone: "accent", icon: "chef-hat", audience: "member", memberId: args.toMemberId, title: `${from?.greetingName ?? "Someone"} asked to swap dinner nights`, body: `${fmtNight(args.fromDate)} for your ${fmtNight(args.toDate)}${args.message ? ` — “${args.message.trim()}”` : ""}`, linkTo: `/meals?swap=${id}`, dedupeKey: `swap-${id}-request` }).catch(() => {});
  refresh();
  return { ok: true as const, id };
}

export async function answerSwap(id: number, action: "accept" | "decline" | "cancel") {
  const u = await ensureFamily();
  const me = u?.memberId ?? null;
  const swap = await k.getSwap(id);
  if (!swap) return { ok: false as const, error: "That swap is gone" };
  const isOwner = (u?.role ?? "owner") === "owner";
  const next = k.nextSwapStatus(swap.status, action, me ?? "", swap, isOwner);
  if (!next) return { ok: false as const, error: "That swap can't be changed by you anymore" };
  await k.resolveSwap(swap, next);
  const people = await getPeople().catch(() => []);
  const name = (id2: string) => people.find((p) => p.id === id2)?.greetingName ?? "Someone";
  if (next === "accepted" || next === "declined") {
    await createNotification({ type: "dinner_swap", module: "meals", tone: next === "accepted" ? "accent" : "info", icon: "chef-hat", audience: "member", memberId: swap.fromMemberId, title: next === "accepted" ? `${name(swap.toMemberId)} took ${fmtNight(swap.fromDate)}` : `${name(swap.toMemberId)} can't swap ${fmtNight(swap.fromDate)}`, body: next === "accepted" ? `You have ${fmtNight(swap.toDate)} instead.` : "Your night stays yours.", linkTo: "/meals", dedupeKey: `swap-${id}-${next}` }).catch(() => {});
  }
  refresh();
  return { ok: true as const, status: next };
}

/* ---- meal ideas ---- */

export async function addIdea(url: string, notes?: string | null) {
  const u = await ensureFamily();
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) return { ok: false as const, error: "Paste a link that starts with http" };
  const res = await k.addIdea({ url: clean, notes, postedBy: u?.memberId ?? null });
  refresh();
  return { ok: true as const, ...res };
}
export async function editIdea(id: number, patch: { title?: string | null; notes?: string | null }) { await ensureFamily(); await k.updateIdea(id, patch); refresh(); return { ok: true as const }; }
export async function removeIdea(id: number) { await ensureFamily(); await k.deleteIdea(id); refresh(); return { ok: true as const }; }
export async function reactToIdea(id: number) {
  const u = await ensureFamily();
  if (!u?.memberId) return { ok: false as const, error: "Your login isn't linked to a family member yet" };
  const on = await k.toggleReaction(id, u.memberId);
  refresh();
  return { ok: true as const, on };
}
/** Put an idea on a night: it becomes the plan's free-text title, linking back by URL in the note. */
export async function planIdea(id: number, date: string) {
  await ensureFamily();
  const ideas = await k.listIdeas();
  const idea = ideas.find((i) => i.id === id);
  if (!idea) return { ok: false as const, error: "Idea not found" };
  await h.setMeal({ date, title: idea.title || idea.url, note: idea.url });
  await k.updateIdea(id, { status: "planned" });
  refresh();
  return { ok: true as const };
}
/** "We made it" — the idea becomes a recipe in the box (ingredients to fill in later). */
export async function ideaToRecipe(id: number) {
  const u = await ensureFamily();
  const idea = (await k.listIdeas()).find((i) => i.id === id);
  if (!idea) return { ok: false as const, error: "Idea not found" };
  const res = await h.saveRecipe({ name: idea.title || "New recipe", ingredients: [], notes: idea.notes });
  if (res.ok) {
    await k.updateRecipeMeta(res.id, { sourceUrl: idea.url, lastMadeOn: new Date().toISOString().slice(0, 10) }).catch(() => {});
    await k.updateIdea(id, { status: "made", recipeId: res.id });
    void u;
  }
  refresh();
  return res;
}
