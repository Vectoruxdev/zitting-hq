"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { markNotificationsRead } from "@/db/mutations";

export async function markRead(ids?: number[]) {
  const u = isAuthConfigured ? await getCurrentUser() : null;
  if (isAuthConfigured && !u) throw new Error("Not authorized");
  await markNotificationsRead({ memberId: u?.memberId ?? null, role: u?.role ?? "owner" }, ids);
  revalidatePath("/notifications"); revalidatePath("/", "layout");
  return { ok: true as const };
}
