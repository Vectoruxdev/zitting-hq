import { cookies, headers } from "next/headers";
import { createSupabaseServerClient, isAuthConfigured } from "./supabase/server";
import { db } from "@/db";
import { familyMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Role = "owner" | "partner" | "member";

export interface CurrentUser {
  email: string;
  name: string;
  role: Role;
  memberId: string | null; // the family_members row id linked by email, if any
  /** Set while the owner is looking at the app as another person (reads only). */
  viewingAs?: { id: string; name: string; role: Role } | null;
}

export const VIEW_AS_COOKIE = "zhq-view-as";

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
  let memberId: string | null = null;
  let name =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (email ? email.split("@")[0] : "there");

  // Sync role + display name + member id from the family_members roster (by
  // email). Column-explicit select so a not-yet-migrated `allowance` column
  // can't break auth.
  try {
    if (db && email) {
      const rows = await db
        .select({ id: familyMembers.id, name: familyMembers.name, role: familyMembers.role, email: familyMembers.email })
        .from(familyMembers);
      const m = rows.find((r) => (r.email ?? "").toLowerCase() === email);
      if (m) {
        role = (m.role as Role) || role;
        name = m.name || name;
        memberId = m.id;
      } else if (OWNER_EMAILS.includes(email)) {
        role = "owner";
      }
    }
  } catch {
    /* DB unavailable — fall back to allowlist role */
  }

  // Owner "view as": a cookie set from People / the family row swaps the
  // identity for page reads only — server actions (the Next-Action header)
  // always run as the real owner, so nothing gets written in someone's name.
  if (role === "owner") {
    try {
      const target = (await cookies()).get(VIEW_AS_COOKIE)?.value;
      const isAction = !!(await headers()).get("next-action");
      if (target && !isAction && db) {
        const [m] = await db.select({ id: familyMembers.id, name: familyMembers.name, role: familyMembers.role }).from(familyMembers).where(eq(familyMembers.id, target)).limit(1);
        if (m && m.id !== memberId) {
          const asRole = (["owner", "partner", "member"].includes(m.role) ? m.role : "member") as Role;
          return { email, name: m.name, role: asRole, memberId: m.id, viewingAs: { id: m.id, name: m.name, role: asRole } };
        }
      }
    } catch {
      /* no cookie / no DB — plain owner */
    }
  }

  return { email, name, role, memberId, viewingAs: null };
}
