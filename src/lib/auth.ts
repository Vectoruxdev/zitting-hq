import { createSupabaseServerClient, isAuthConfigured } from "./supabase/server";
import { db } from "@/db";
import { familyMembers } from "@/db/schema";

export type Role = "owner" | "partner" | "member";

export interface CurrentUser {
  email: string;
  name: string;
  role: Role;
}

/**
 * Owner allowlist bootstraps the first owner before any family member is linked
 * by email. After that, roles come from the family_members table (the People &
 * Access screen), matched by email.
 */
const OWNER_EMAILS = (process.env.OWNER_EMAILS || "jared@vectorux.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function roleForEmail(email?: string | null): Role {
  return email && OWNER_EMAILS.includes(email.toLowerCase()) ? "owner" : "member";
}

/** The signed-in user with role + name, synced from family_members by email. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = (user.email ?? "").toLowerCase();
  let role: Role = roleForEmail(email);
  let name =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (email ? email.split("@")[0] : "there");

  // Sync role + display name from the family_members roster (by email).
  try {
    if (db && email) {
      const rows = await db.select().from(familyMembers);
      const m = rows.find((r) => (r.email ?? "").toLowerCase() === email);
      if (m) {
        role = (m.role as Role) || role;
        name = m.name || name;
      } else if (OWNER_EMAILS.includes(email)) {
        role = "owner";
      }
    }
  } catch {
    /* DB unavailable — fall back to allowlist role */
  }

  return { email, name, role };
}
