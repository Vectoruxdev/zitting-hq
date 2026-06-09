"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (used by the invite set-password flow). Null if unconfigured. */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
