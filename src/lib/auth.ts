import { createSupabaseServerClient, isAuthConfigured } from "./supabase/server";

export type Role = "owner" | "member";

export interface CurrentUser {
  email: string;
  name: string;
  role: Role;
}

/**
 * Owner allowlist. Anyone signed in whose email is here is the Owner (full
 * control); every other authenticated user is a Member (restricted Spendable
 * view). Override with the OWNER_EMAILS env var (comma-separated).
 */
const OWNER_EMAILS = (process.env.OWNER_EMAILS || "jared@vectorux.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function roleForEmail(email?: string | null): Role {
  return email && OWNER_EMAILS.includes(email.toLowerCase()) ? "owner" : "member";
}

/** The signed-in user (with derived role), or null. Safe when auth isn't configured. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const email = user.email ?? "";
  const name =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (email ? email.split("@")[0] : "there");
  return { email, name, role: roleForEmail(email) };
}
