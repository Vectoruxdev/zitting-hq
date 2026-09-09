import type { SupabaseClient } from "@supabase/supabase-js";
import { getJwks } from "./jwks";

export interface VerifiedClaims {
  id: string;
  email: string;
  metadata: Record<string, unknown>;
}

/**
 * Who holds this session — proven by verifying the access token's signature
 * against Supabase's public keys, right here. Replaces `auth.getUser()`, which
 * asked the Auth server on every request (a cross-country round trip in the
 * proxy AND again in the page). Only an expired token still goes over the
 * network, to refresh. Null when signed out.
 */
export async function getVerifiedClaims(supabase: Pick<SupabaseClient, "auth">): Promise<VerifiedClaims | null> {
  const jwks = await getJwks();
  const { data, error } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined);
  if (error || !data?.claims?.sub) return null;
  const c = data.claims;
  return {
    id: c.sub,
    email: String(c.email ?? "").toLowerCase(),
    metadata: (c.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
}
