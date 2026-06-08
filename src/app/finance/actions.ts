"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as m from "@/db/mutations";

async function ensureOwner() {
  if (!isAuthConfigured) return; // local dev / no auth → allow
  const u = await getCurrentUser();
  if (!u || u.role !== "owner") throw new Error("Not authorized");
  return u;
}

const refresh = () => revalidatePath("/finance");

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
export async function previewCategorize(rows: { merchant: string; amount: number; accountId?: string | null }[]) {
  await ensureOwner();
  return m.previewCategorize(rows);
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
  const res = await m.bulkUpdateTransactions(ids, patch);
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
export async function applyRulesToPast(opts?: { onlyUncategorized?: boolean }) {
  await ensureOwner();
  const res = await m.applyRulesToPast(opts);
  refresh();
  return res;
}
