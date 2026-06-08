import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads the project URL + anon key from the env the Vercel→Supabase
 * integration injects (works at runtime even though the values are "sensitive"
 * and can't be pulled locally).
 */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Throws when called from a Server Component (read-only cookies) — the
        // proxy refreshes the session, so this is safe to ignore there.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* called from a Server Component; ignore */
        }
      },
    },
  });
}

export const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
