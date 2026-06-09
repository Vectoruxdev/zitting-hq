"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getAdminClient, SITE_URL } from "@/lib/supabase/admin";
import * as m from "@/db/mutations";

async function ensureOwner() {
  if (!isAuthConfigured) return; // local dev / no auth → allow
  const u = await getCurrentUser();
  if (!u || u.role !== "owner") throw new Error("Not authorized");
  return u;
}

const refresh = () => revalidatePath("/finance");

// ---- people / members ----
export async function addMember(args: { name: string; email?: string | null; role: string; color?: string | null; invite?: boolean }) {
  await ensureOwner();
  const email = args.email?.trim().toLowerCase() || null;
  let authId: string | null = null;
  let status = "none";
  let inviteSent = false;
  let inviteError: string | null = null;

  if (args.invite && email) {
    const admin = getAdminClient();
    if (!admin) {
      inviteError = "Email invites aren't configured on the server.";
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name: args.name, role: args.role },
        redirectTo: `${SITE_URL}/auth/set-password`,
      });
      if (error) inviteError = error.message;
      else {
        authId = data.user?.id ?? null;
        status = "invited";
        inviteSent = true;
      }
    }
  }

  const res = await m.createMember({ name: args.name, role: args.role, email, color: args.color, status, authId });
  refresh();
  return { ...res, inviteSent, inviteError };
}

export async function updateMember(id: string, patch: Parameters<typeof m.updateMember>[1]) {
  await ensureOwner();
  const res = await m.updateMember(id, patch);
  refresh();
  return res;
}

export async function removeMember(id: string) {
  await ensureOwner();
  const res = await m.removeMember(id);
  if (res.authId) {
    const admin = getAdminClient();
    if (admin) await admin.auth.admin.deleteUser(res.authId).catch(() => {});
  }
  refresh();
  return { ok: true as const };
}

/** A copyable set-password link for an invited member (fallback when email is flaky). */
export async function getInviteLink(email: string) {
  await ensureOwner();
  const admin = getAdminClient();
  if (!admin) return { ok: false as const, error: "Admin not configured" };
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: { redirectTo: `${SITE_URL}/auth/set-password` },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, link: data.properties?.action_link ?? null };
}

// ---- accounts ----
export async function createAccount(args: Parameters<typeof m.createAccount>[0]) {
  await ensureOwner();
  const res = await m.createAccount(args);
  refresh();
  return res;
}
export async function updateAccount(id: string, patch: Parameters<typeof m.updateAccount>[1]) {
  await ensureOwner();
  const res = await m.updateAccount(id, patch);
  refresh();
  return res;
}
export async function deleteAccount(id: string) {
  await ensureOwner();
  const res = await m.deleteAccount(id);
  refresh();
  return res;
}

// ---- import ----
export async function commitImport(args: Parameters<typeof m.commitImport>[0]) {
  const u = await ensureOwner();
  const res = await m.commitImport({ ...args, createdBy: args.createdBy ?? u?.email ?? null });
  refresh();
  return res;
}
export async function deleteImport(batchId: string) {
  await ensureOwner();
  const res = await m.deleteImport(batchId);
  refresh();
  return res;
}
export async function findExistingHashes(accountId: string, hashes: string[]) {
  await ensureOwner();
  return m.findExistingHashes(accountId, hashes);
}
export async function suggestCategories(
  rows: { merchant: string; amount: number; accountId?: string | null; type?: string | null; isTransfer?: boolean }[]
) {
  await ensureOwner();
  return m.suggestCategories(rows);
}
export async function listColumnTemplates(accountId?: string | null) {
  await ensureOwner();
  return m.listColumnTemplates(accountId);
}
export async function saveColumnTemplate(args: Parameters<typeof m.saveColumnTemplate>[0]) {
  await ensureOwner();
  return m.saveColumnTemplate(args);
}

// ---- transaction edits ----
export async function updateTransaction(id: number, patch: m.TxnPatch, opts?: { learn?: boolean }) {
  await ensureOwner();
  const res = await m.updateTransaction(id, patch, opts);
  refresh();
  return res;
}
export async function bulkUpdateTransactions(ids: number[], patch: m.TxnPatch) {
  await ensureOwner();
  // Bulk setting a category is a manual choice → learn from it.
  const res = await m.bulkUpdateTransactions(ids, patch, { learn: patch.categoryId != null });
  refresh();
  return res;
}
export async function confirmTransactions(ids: number[]) {
  await ensureOwner();
  const res = await m.confirmTransactions(ids);
  refresh();
  return res;
}
export async function markTransfer(id: number, isTransfer: boolean) {
  await ensureOwner();
  const res = await m.markTransfer(id, isTransfer);
  refresh();
  return res;
}
export async function splitTransaction(id: number, splits: { categoryId: string; amount: number }[]) {
  await ensureOwner();
  const res = await m.splitTransaction(id, splits);
  refresh();
  return res;
}
export async function unsplitTransaction(id: number) {
  await ensureOwner();
  const res = await m.unsplitTransaction(id);
  refresh();
  return res;
}

// ---- categories ----
export async function createCategory(args: Parameters<typeof m.createCategory>[0]) {
  await ensureOwner();
  const res = await m.createCategory(args);
  refresh();
  return res;
}
export async function updateCategory(id: string, patch: Parameters<typeof m.updateCategory>[1]) {
  await ensureOwner();
  const res = await m.updateCategory(id, patch);
  refresh();
  return res;
}
export async function deleteCategory(id: string) {
  await ensureOwner();
  const res = await m.deleteCategory(id);
  refresh();
  return res;
}

// ---- rules ----
export async function createRule(args: Parameters<typeof m.createRule>[0]) {
  await ensureOwner();
  const res = await m.createRule(args);
  refresh();
  return res;
}
export async function updateRule(id: number, patch: Parameters<typeof m.updateRule>[1]) {
  await ensureOwner();
  const res = await m.updateRule(id, patch);
  refresh();
  return res;
}
export async function deleteRule(id: number) {
  await ensureOwner();
  const res = await m.deleteRule(id);
  refresh();
  return res;
}
export async function recategorizeAll(opts?: { onlyUnreviewed?: boolean }) {
  await ensureOwner();
  const res = await m.recategorizeAll(opts);
  refresh();
  return res;
}
export async function rebuildMemoryFromHistory() {
  await ensureOwner();
  const res = await m.rebuildMemoryFromHistory();
  refresh();
  return res;
}
