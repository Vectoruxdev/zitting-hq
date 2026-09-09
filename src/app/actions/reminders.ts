"use server";
/**
 * Reminder tick, fired once per app open from the frame (Vercel Hobby crons
 * run once a day; this is what makes "15 minutes before" land). Signed-in
 * only; returns nothing about anyone.
 */
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { tickReminders } from "@/db/reminders";

export async function tickRemindersAction(): Promise<{ ok: true }> {
  if (isAuthConfigured && !(await getCurrentUser())) return { ok: true };
  await tickReminders();
  return { ok: true };
}
