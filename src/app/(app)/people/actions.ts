"use server";
/**
 * People & permissions — owner only. Kind, hue, finance role, module switches,
 * account access levels, allowance. Adding/removing people and invites reuse
 * the finance actions (same owner guard).
 */
import { touched } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as m from "@/db/mutations";
import { upsertProfile } from "@/db/profiles";
import { listHouseholdAccounts, setAccountAccess, setModuleAccess, type AccountAccess } from "@/db/permissions";
import { SWITCHABLE_MODULES } from "@/lib/module-access";
import { sendPasswordResetEmail } from "@/lib/password-reset";
import { listMembersAdmin } from "@/db/permissions";

async function ensureOwner() {
  if (!isAuthConfigured) return { memberId: null as string | null };
  const u = await getCurrentUser();
  if (!u || u.role !== "owner") throw new Error("Not authorized");
  return { memberId: u.memberId };
}
const refresh = () => { touched(["people", "finance"], "/people"); touched(["people", "finance"], "/"); touched(["people", "finance"], "/finance"); };

export async function setKindAction(memberId: string, kind: "adult" | "child") {
  await ensureOwner();
  await upsertProfile(memberId, { kind: kind === "child" ? "child" : "adult" });
  refresh();
  return { ok: true as const };
}

export async function setHueAction(memberId: string, hue: number) {
  await ensureOwner();
  await upsertProfile(memberId, { hue: Math.max(1, Math.min(6, Math.round(hue))) });
  refresh();
  return { ok: true as const };
}

export async function setRoleAction(memberId: string, role: "owner" | "partner" | "member") {
  const u = await ensureOwner();
  if (!["owner", "partner", "member"].includes(role)) return { ok: false as const, error: "Bad role" };
  if (u.memberId && u.memberId === memberId) return { ok: false as const, error: "You can't change your own role" };
  await m.updateMember(memberId, { role });
  refresh();
  return { ok: true as const };
}

export async function renameAction(memberId: string, patch: { name?: string; email?: string | null }) {
  await ensureOwner();
  const clean: { name?: string; email?: string | null } = {};
  if (patch.name !== undefined) { const n = patch.name.trim(); if (!n) return { ok: false as const, error: "A name is needed" }; clean.name = n; }
  if (patch.email !== undefined) clean.email = patch.email?.trim().toLowerCase() || null;
  await m.updateMember(memberId, clean);
  refresh();
  return { ok: true as const };
}

export async function setAllowanceAction(memberId: string, amount: number | null) {
  await ensureOwner();
  await m.setMemberAllowance(memberId, amount != null && Number.isFinite(amount) && amount >= 0 ? amount : null);
  refresh();
  return { ok: true as const };
}

export async function setModuleAccessAction(memberId: string, module: string, allowed: boolean) {
  await ensureOwner();
  if (!SWITCHABLE_MODULES.includes(module)) return { ok: false as const, error: "Unknown module" };
  await setModuleAccess(memberId, module, !!allowed);
  refresh();
  return { ok: true as const };
}

export async function setAccountAccessAction(accountId: string, memberId: string, access: AccountAccess | null) {
  await ensureOwner();
  if (access && access !== "manage" && access !== "view") return { ok: false as const, error: "Bad access level" };
  if (!(await listHouseholdAccounts()).some((a) => a.id === accountId)) return { ok: false as const, error: "Only household accounts can be shared" };
  await setAccountAccess(accountId, memberId, access);
  refresh();
  return { ok: true as const };
}

/** Email a password-reset link to one person (owner). Returns the link too when email isn't set up. */
export async function sendPasswordResetAction(memberId: string) {
  await ensureOwner();
  const m = (await listMembersAdmin()).find((x) => x.id === memberId);
  if (!m) return { ok: false as const, sent: false, link: null, error: "Not found" };
  if (!m.email) return { ok: false as const, sent: false, link: null, error: "No email on file for this person." };
  const r = await sendPasswordResetEmail(m.email, { name: m.name });
  return { ok: r.ok, sent: r.sent, link: r.link, error: r.error };
}
