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
    return { error: "Wrong email or password." };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
