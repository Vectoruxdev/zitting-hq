/**
 * Supabase's public JWT signing keys (ES256), cached per server instance so a
 * session can be verified locally — no round trip to the Auth server on every
 * request. Refreshed every 10 minutes; supabase-js also fetches on its own if
 * it meets a key id it doesn't know (key rotation).
 */
import type { JWK } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const TTL_MS = 10 * 60_000;

let cached: { keys: JWK[]; at: number } | null = null;
let inflight: Promise<{ keys: JWK[] } | undefined> | null = null;

export function getJwks(): Promise<{ keys: JWK[] } | undefined> {
  if (!SUPABASE_URL) return Promise.resolve(undefined);
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve({ keys: cached.keys });
  if (!inflight) {
    inflight = fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(4000), cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`jwks ${r.status}`);
        const j = (await r.json()) as { keys?: JWK[] };
        cached = { keys: j.keys ?? [], at: Date.now() };
        return { keys: cached.keys };
      })
      .catch(() => (cached ? { keys: cached.keys } : undefined))
      .finally(() => { inflight = null; });
  }
  return inflight;
}
