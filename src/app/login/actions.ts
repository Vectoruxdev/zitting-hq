"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error?: string };

export async function signIn(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirect") || "/") || "/";

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[signIn] auth error:", error.status, error.message);
    const m = error.message || "";
    if (/confirm/i.test(m)) {
      return { error: "Account not confirmed. In Supabase → Authentication → Users, confirm this user (or re-add with “Auto Confirm User” on)." };
    }
    return { error: "Wrong email or password." };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * "Forgot your password?" — sends a reset link if (and only if) the address
 * belongs to someone on the family roster. Always answers the same way, so
 * the sign-in page never confirms who is or isn't in the family.
 */
export async function requestPasswordReset(emailArg: string): Promise<{ ok: true }> {
  const email = (emailArg || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: true };
  try {
    const { db } = await import("@/db");
    const { familyMembers } = await import("@/db/schema");
    if (!db) return { ok: true };
    const rows = await db.select({ email: familyMembers.email, name: familyMembers.name }).from(familyMembers);
    const m = rows.find((r) => (r.email ?? "").toLowerCase() === email);
    if (!m) return { ok: true };
    const { sendPasswordResetEmail } = await import("@/lib/password-reset");
    const r = await sendPasswordResetEmail(email, { name: m.name });
    if (!r.sent) console.error("[password reset] not sent:", r.error);
  } catch (e) {
    console.error("[password reset]", e instanceof Error ? e.message : e);
  }
  return { ok: true };
}
