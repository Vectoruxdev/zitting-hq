"use server";
/**
 * Owner only: look at the app as another person sees it (reads only — every
 * server action still runs as the real owner). One cookie, an hour at most.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, VIEW_AS_COOKIE } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { db } from "@/db";
import { familyMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function viewAsAction(memberId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAuthConfigured) return { ok: true };
  const u = await getCurrentUser();
  if (!u || u.role !== "owner" || u.viewingAs) {
    // Exiting is always allowed; entering needs the real owner.
    if (memberId) return { ok: false, error: "Owner only" };
  }
  const jar = await cookies();
  if (!memberId) {
    jar.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: true });
  } else {
    if (!db) return { ok: false, error: "Database not configured" };
    const [m] = await db.select({ id: familyMembers.id }).from(familyMembers).where(eq(familyMembers.id, memberId)).limit(1);
    if (!m) return { ok: false, error: "Not found" };
    jar.set(VIEW_AS_COOKIE, memberId, { path: "/", maxAge: 60 * 60, httpOnly: true, sameSite: "lax", secure: true });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
