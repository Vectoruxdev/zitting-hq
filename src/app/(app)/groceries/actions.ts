"use server";

import { touched } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as h from "@/db/household";

/** Shared family space: any signed-in family member may read/write. */
async function ensureFamily() {
  if (!isAuthConfigured) return null; // local dev / no auth → allow
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

const refresh = () => { touched("groceries", "/groceries"); touched("groceries", "/"); };

export async function addShoppingItem(args: { name: string; note?: string | null; category?: string | null; assigneeMemberId?: string | null }) {
  const u = await ensureFamily();
  const res = await h.addShoppingItem({ ...args, addedBy: u?.memberId ?? null });
  if (res.ok && args.assigneeMemberId) await h.setShoppingAssignee(res.id, args.assigneeMemberId, u?.memberId ?? null).catch(() => {});
  refresh();
  return res;
}
export async function setShoppingAssignee(id: number, assigneeMemberId: string | null) {
  const u = await ensureFamily();
  const res = await h.setShoppingAssignee(id, assigneeMemberId, u?.memberId ?? null);
  refresh();
  return res;
}
export async function setShoppingChecked(id: number, checked: boolean) {
  await ensureFamily();
  const res = await h.setShoppingChecked(id, checked);
  refresh();
  return res;
}
export async function deleteShoppingItem(id: number) {
  await ensureFamily();
  const res = await h.deleteShoppingItem(id);
  refresh();
  return res;
}
export async function clearBought() {
  await ensureFamily();
  const res = await h.archiveCheckedShoppingItems();
  refresh();
  return res;
}
export async function addPantryItem(args: { name: string; category?: string | null; staple?: boolean; level?: string }) {
  await ensureFamily();
  const res = await h.addPantryItem(args);
  refresh();
  return res;
}
export async function setPantryLevel(id: number, level: "ok" | "low" | "out") {
  await ensureFamily();
  const res = await h.setPantryLevel(id, level);
  refresh();
  return res;
}
export async function setPantryStaple(id: number, staple: boolean) {
  await ensureFamily();
  const res = await h.setPantryStaple(id, staple);
  refresh();
  return res;
}
export async function deletePantryItem(id: number) {
  await ensureFamily();
  const res = await h.deletePantryItem(id);
  refresh();
  return res;
}
export async function sendPantryItemToList(id: number) {
  await ensureFamily();
  const res = await h.sendPantryItemToList(id);
  refresh();
  return res;
}
