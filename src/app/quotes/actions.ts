"use server";
/**
 * Quotes actions. Anyone signed in can add; only the person who added a quote
 * (or the owner) can edit/delete it. Visibility follows canView.
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { addQuote, deleteQuote, getQuote, updateQuote } from "@/db/quotes";

async function who() {
  if (!isAuthConfigured) return { memberId: null as string | null, role: "owner" as const };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authorized");
  return { memberId: u.memberId, role: u.role };
}

async function canEdit(id: number) {
  const u = await who();
  const q = await getQuote(id);
  if (!q) throw new Error("Quote not found");
  if (u.role !== "owner" && q.addedBy !== u.memberId) throw new Error("Not authorized");
  return u;
}

const VIS = ["family", "private", "custom"];

export async function createQuote(input: { text: string; saidByMemberId?: string | null; saidByName?: string | null; saidOn?: string | null; visibility?: string; sharedWith?: string[] }) {
  const u = await who();
  const text = input.text.trim();
  if (!text) return { ok: false as const, error: "Say something first" };
  if (text.length > 600) return { ok: false as const, error: "Keep it under 600 characters" };
  const visibility = VIS.includes(input.visibility || "") ? input.visibility! : "family";
  const id = await addQuote({ text, saidByMemberId: input.saidByMemberId || null, saidByName: input.saidByName || null, saidOn: input.saidOn && /^\d{4}-\d{2}-\d{2}$/.test(input.saidOn) ? input.saidOn : null, addedBy: u.memberId, visibility, sharedWith: input.sharedWith });
  revalidatePath("/quotes"); revalidatePath("/");
  return { ok: true as const, id };
}

export async function toggleFavorite(id: number, favorite: boolean) {
  await who();
  await updateQuote(id, { favorite });
  revalidatePath("/quotes");
  return { ok: true as const };
}

export async function setShowOnLogin(id: number, show: boolean) {
  const u = await who();
  if (u.role !== "owner") throw new Error("Only the owner curates the login page");
  await updateQuote(id, { showOnLogin: show });
  revalidatePath("/quotes"); revalidatePath("/login");
  return { ok: true as const };
}

export async function editQuote(id: number, patch: { text?: string; saidByMemberId?: string | null; saidByName?: string | null; saidOn?: string | null; visibility?: string; sharedWith?: string[] }) {
  await canEdit(id);
  const clean: Parameters<typeof updateQuote>[1] = {};
  if (patch.text !== undefined) { const t = patch.text.trim(); if (!t) return { ok: false as const, error: "Say something first" }; clean.text = t.slice(0, 600); }
  if (patch.saidByMemberId !== undefined) clean.saidByMemberId = patch.saidByMemberId || null;
  if (patch.saidByName !== undefined) clean.saidByName = patch.saidByName?.trim() || null;
  if (patch.saidOn !== undefined) clean.saidOn = patch.saidOn && /^\d{4}-\d{2}-\d{2}$/.test(patch.saidOn) ? patch.saidOn : null;
  if (patch.visibility !== undefined && VIS.includes(patch.visibility)) clean.visibility = patch.visibility;
  await updateQuote(id, clean, patch.visibility === "custom" ? patch.sharedWith ?? [] : patch.visibility ? [] : undefined);
  revalidatePath("/quotes"); revalidatePath("/");
  return { ok: true as const };
}

export async function removeQuote(id: number) {
  await canEdit(id);
  await deleteQuote(id);
  revalidatePath("/quotes"); revalidatePath("/");
  return { ok: true as const };
}
