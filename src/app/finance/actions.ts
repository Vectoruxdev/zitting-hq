"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getAdminClient, SITE_URL } from "@/lib/supabase/admin";
import * as m from "@/db/mutations";
import * as plaidDb from "@/db/plaid";

async function ensureOwner() {
  if (!isAuthConfigured) return; // local dev / no auth → allow
  const u = await getCurrentUser();
  if (!u || u.role !== "owner") throw new Error("Not authorized");
  return u;
}

/**
 * Authorize a transaction edit. Owner/partner may edit anything; a member may
 * only edit transactions on accounts they're in charge of. Used for all
 * transaction-level edits so members can categorize their own accounts.
 */
async function ensureCanEditTxns(ids: number[]) {
  if (!isAuthConfigured) return; // local dev / no auth → allow
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authorized");
  if (u.role === "owner" || u.role === "partner") return u;
  if (!u.memberId) throw new Error("Not authorized");
  const managed = await m.managedAccountIds(u.memberId);
  const touched = await m.accountIdsForTxns(ids);
  for (const acctId of touched) {
    if (!managed.has(acctId)) throw new Error("Not authorized");
  }
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
export async function setAccountMembers(accountId: string, memberIds: string[]) {
  await ensureOwner();
  if (memberIds.length > 2) throw new Error("At most 2 people can manage an account");
  const res = await m.setAccountMembers(accountId, memberIds);
  refresh();
  return res;
}
export async function setMemberAllowance(memberId: string, amount: number | null) {
  await ensureOwner();
  const res = await m.setMemberAllowance(memberId, amount);
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
  const u = await ensureCanEditTxns([id]);
  // Setting a category is always a deliberate manual choice (owner OR member),
  // so learn by default whenever one is present — a caller can still opt out
  // with { learn: false }. This guarantees the learning loop is fed from every
  // categorize surface without relying on each client to remember the flag.
  const learn = opts?.learn ?? patch.categoryId != null;
  const res = await m.updateTransaction(id, patch, { ...opts, learn });
  if (u?.role === "member") await m.notifyOwnersIfMemberCaughtUp(u.memberId);
  refresh();
  return res;
}
export async function bulkUpdateTransactions(ids: number[], patch: m.TxnPatch) {
  const u = await ensureCanEditTxns(ids);
  // Bulk setting a category is a manual choice → learn from it.
  const res = await m.bulkUpdateTransactions(ids, patch, { learn: patch.categoryId != null });
  if (u?.role === "member") await m.notifyOwnersIfMemberCaughtUp(u.memberId);
  refresh();
  return res;
}
export async function confirmTransactions(ids: number[]) {
  const u = await ensureCanEditTxns(ids);
  const res = await m.confirmTransactions(ids);
  if (u?.role === "member") await m.notifyOwnersIfMemberCaughtUp(u.memberId);
  refresh();
  return res;
}
export async function markTransfer(id: number, isTransfer: boolean) {
  await ensureCanEditTxns([id]);
  const res = await m.markTransfer(id, isTransfer);
  refresh();
  return res;
}
export async function autoLinkTransfers() {
  await ensureOwner();
  const res = await m.autoLinkTransfers();
  refresh();
  return res;
}
export async function unlinkTransfer(id: number) {
  await ensureCanEditTxns([id]);
  const res = await m.unlinkTransfer(id);
  refresh();
  return res;
}
export async function splitTransaction(id: number, splits: { categoryId: string; amount: number }[]) {
  await ensureCanEditTxns([id]);
  const res = await m.splitTransaction(id, splits);
  refresh();
  return res;
}
export async function unsplitTransaction(id: number) {
  await ensureCanEditTxns([id]);
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

// ---- category groups (parent categories) ----
export async function createCategoryGroup(args: Parameters<typeof m.createCategoryGroup>[0]) {
  await ensureOwner();
  const res = await m.createCategoryGroup(args);
  refresh();
  return res;
}
export async function updateCategoryGroup(id: string, patch: Parameters<typeof m.updateCategoryGroup>[1]) {
  await ensureOwner();
  const res = await m.updateCategoryGroup(id, patch);
  refresh();
  return res;
}
export async function deleteCategoryGroup(id: string) {
  await ensureOwner();
  const res = await m.deleteCategoryGroup(id);
  refresh();
  return res;
}

// ---- budgets ----
export async function createBudget(args: Parameters<typeof m.createBudget>[0]) {
  await ensureOwner();
  const res = await m.createBudget(args);
  refresh();
  return res;
}
export async function updateBudget(id: number, patch: Parameters<typeof m.updateBudget>[1]) {
  await ensureOwner();
  const res = await m.updateBudget(id, patch);
  refresh();
  return res;
}
export async function deleteBudget(id: number) {
  await ensureOwner();
  const res = await m.deleteBudget(id);
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
// ---- learned memory (owner spot-fixes) ----
export async function forgetLearnedMerchant(key: string) {
  await ensureOwner();
  const res = await m.forgetMerchant(key);
  refresh();
  return res;
}
export async function setLearnedMerchant(key: string, categoryId: string) {
  await ensureOwner();
  const res = await m.setMerchantCategory(key, categoryId);
  refresh();
  return res;
}

export async function rebuildMemoryFromHistory() {
  await ensureOwner();
  const res = await m.rebuildMemoryFromHistory();
  refresh();
  return res;
}

// ---- allocation / transfer rules ----
export async function createAllocationRule(args: Parameters<typeof m.createAllocationRule>[0]) {
  await ensureOwner();
  const res = await m.createAllocationRule(args);
  refresh();
  return res;
}
export async function updateAllocationRule(id: string, patch: Parameters<typeof m.updateAllocationRule>[1]) {
  await ensureOwner();
  const res = await m.updateAllocationRule(id, patch);
  refresh();
  return res;
}
export async function deleteAllocationRule(id: string) {
  await ensureOwner();
  const res = await m.deleteAllocationRule(id);
  refresh();
  return res;
}

// ---- transfers (instances) ----
export async function createManualTransfer(args: Parameters<typeof m.createManualTransfer>[0]) {
  await ensureOwner();
  const res = await m.createManualTransfer(args);
  refresh();
  return res;
}
export async function markTransferInstance(id: number, done: boolean) {
  await ensureOwner();
  const res = await m.markTransferInstance(id, done);
  refresh();
  return res;
}
export async function skipTransferInstance(id: number) {
  await ensureOwner();
  const res = await m.skipTransferInstance(id);
  refresh();
  return res;
}
export async function deleteTransferInstance(id: number) {
  await ensureOwner();
  const res = await m.deleteTransferInstance(id);
  refresh();
  return res;
}
export async function generateTransfersForIncome(incomeTxnId: number) {
  await ensureOwner();
  const res = await m.generateTransfersForIncome(incomeTxnId);
  refresh();
  return res;
}
export async function reconcilePendingTransfers() {
  await ensureOwner();
  const res = await m.reconcilePendingTransfers();
  refresh();
  return res;
}
/** Generate due scheduled transfers now, then reconcile (same as the daily cron). */
export async function runScheduledTransfersNow() {
  await ensureOwner();
  const gen = await m.runScheduledTransfers();
  const rec = await m.reconcilePendingTransfers();
  refresh();
  return { ok: true as const, generated: gen.created, reconciled: rec.matched };
}

// ---- notifications ----
/** Mark alerts read for the current viewer (all visible, or a specific set). */
export async function markNotificationsRead(ids?: number[]) {
  const u = isAuthConfigured ? await getCurrentUser() : null;
  const viewer = { memberId: u?.memberId ?? null, role: u?.role ?? "owner" };
  const res = await m.markNotificationsRead(viewer, ids);
  refresh();
  return res;
}

/** Owner sets which events notify, and on which channel (in-app / push). */
export async function setNotificationPref(event: string, patch: { enabled?: boolean; inApp?: boolean; push?: boolean }) {
  await ensureOwner();
  const res = await m.setNotificationPref(event, patch);
  refresh();
  return res;
}

// ---- web push (device notifications) ----
/** Register this device for push, tagged to the signed-in person. */
export async function subscribePush(sub: { endpoint: string; p256dh: string; auth: string }) {
  const u = isAuthConfigured ? await getCurrentUser() : null;
  return m.savePushSubscription(sub, {
    memberId: u?.memberId ?? null,
    role: u?.role ?? "owner",
    email: u?.email ?? null,
  });
}
/** Remove this device's push subscription. */
export async function unsubscribePush(endpoint: string) {
  return m.deletePushSubscription(endpoint);
}

// ---- savings goals ----
export async function createSavingsGoal(args: m.SavingsGoalInput) {
  const u = await ensureOwner();
  const res = await m.createSavingsGoal({ ...args, createdBy: args.createdBy ?? u?.email ?? null });
  refresh();
  return res;
}
export async function updateSavingsGoal(id: string, patch: Parameters<typeof m.updateSavingsGoal>[1]) {
  await ensureOwner();
  const res = await m.updateSavingsGoal(id, patch);
  refresh();
  return res;
}
export async function deleteSavingsGoal(id: string) {
  await ensureOwner();
  const res = await m.deleteSavingsGoal(id);
  refresh();
  return res;
}
export async function archiveSavingsGoal(id: string, archived: boolean) {
  await ensureOwner();
  const res = await m.archiveSavingsGoal(id, archived);
  refresh();
  return res;
}
export async function addContribution(goalId: string, args: Parameters<typeof m.addContribution>[1]) {
  await ensureOwner();
  const res = await m.addContribution(goalId, args);
  refresh();
  return res;
}
export async function deleteContribution(id: number) {
  await ensureOwner();
  const res = await m.deleteContribution(id);
  refresh();
  return res;
}

// ---- Plaid (automatic bank sync) ----
export async function createPlaidLinkToken() {
  const u = await ensureOwner();
  try {
    // Plaid forbids PII (e.g. email) in client_user_id — use a non-PII id.
    const token = await plaidDb.createLinkToken(u?.memberId || "owner");
    return { ok: true as const, token };
  } catch (e) {
    return { ok: false as const, error: (e as Error)?.message || "Plaid request failed" };
  }
}
export async function exchangePlaidPublicToken(publicToken: string) {
  const u = await ensureOwner();
  const res = await plaidDb.exchangePublicToken(publicToken, u?.email ?? null);
  refresh();
  return res;
}
export async function syncPlaid() {
  await ensureOwner();
  const res = await plaidDb.syncAllItems();
  refresh();
  return res;
}
export async function listPlaidBanks() {
  await ensureOwner();
  return plaidDb.listPlaidItems();
}
export async function removePlaidBank(itemId: string) {
  await ensureOwner();
  const res = await plaidDb.removePlaidItem(itemId);
  refresh();
  return res;
}
