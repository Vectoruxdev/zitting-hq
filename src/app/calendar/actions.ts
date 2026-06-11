"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as h from "@/db/household";

/** Shared family space: any signed-in family member may read/write. */
async function ensureFamily() {
  if (!isAuthConfigured) return null;
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

const refresh = () => revalidatePath("/calendar");

export async function addCalendarFeed(args: { name: string; url: string; color?: string | null }) {
  await ensureFamily();
  const res = await h.addCalendarFeed(args);
  refresh();
  return res;
}
export async function setCalendarFeedEnabled(id: number, enabled: boolean) {
  await ensureFamily();
  const res = await h.setCalendarFeedEnabled(id, enabled);
  refresh();
  return res;
}
export async function deleteCalendarFeed(id: number) {
  await ensureFamily();
  const res = await h.deleteCalendarFeed(id);
  refresh();
  return res;
}
export async function addFamilyEvent(args: { title: string; date: string; endDate?: string | null; time?: string | null; note?: string | null }) {
  const u = await ensureFamily();
  const res = await h.addFamilyEvent({ ...args, createdBy: u?.memberId ?? null });
  refresh();
  return res;
}
export async function deleteFamilyEvent(id: number) {
  await ensureFamily();
  const res = await h.deleteFamilyEvent(id);
  refresh();
  return res;
}
