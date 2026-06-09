import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (service role) for inviting/removing users. Server-only.
 * The service-role key is injected at runtime on Vercel (blank locally, so
 * invite/remove are verified on the deploy).
 */
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isAdminConfigured = Boolean(URL && SERVICE_ROLE);

export function getAdminClient() {
  if (!isAdminConfigured) return null;
  return createClient(URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zitting-hq.vercel.app";
