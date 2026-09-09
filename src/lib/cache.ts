/**
 * The server data cache — "cache it, and update it when something changes".
 *
 * Every screen's reader is wrapped with `cached(key, tags, fn)`. The result is
 * remembered in Vercel's data cache under its tags (per argument set, so per
 * person where the reader takes a viewer) with a 10-minute safety expiry.
 * Every write then names the tags it touched:
 *
 *   touched("quotes", "/quotes")   in a Server Action — your own change is
 *                                  visible on the very next screen (updateTag)
 *   touchedByJob("finance")        from a cron / webhook / route handler —
 *                                  marked stale, refreshed on the next visit
 *   touchedAnywhere("notifications") from code that runs in both places
 *
 * Readers must take everything they need as arguments (no cookies()/headers()
 * inside) and return data, not class instances. Dates, Maps and Sets survive
 * the round trip; anything else exotic is flattened to JSON.
 */
import { unstable_cache, revalidatePath, revalidateTag, updateTag } from "next/cache";

export type CacheTag =
  | "people"        // roster, profiles, module access, account access
  | "quotes"
  | "calendar"      // family events, appointments, feeds config
  | "meals"         // dinner nights, rotation, swaps, meal ideas, week plans
  | "groceries"
  | "goals"
  | "chores"
  | "trips"
  | "notifications" // per-person hub items + unread counts
  | "finance"       // the whole money model (accounts, transactions, rules…)
  | "photos"
  | "nest";

const SAFETY_TTL_SECONDS = 600;
/** Vercel's data cache refuses entries over 2 MB; stay well under. */
const MAX_ENTRY_BYTES = 1_500_000;
const oversized = new Set<string>();
let cacheUsable = true;

type Encoded = { $d: string } | { $m: [unknown, unknown][] } | { $s: unknown[] } | unknown;

export function encode(v: unknown): Encoded {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Date) return { $d: v.toISOString() };
  if (v instanceof Map) return { $m: [...v.entries()].map(([k, x]) => [encode(k), encode(x)] as [unknown, unknown]) };
  if (v instanceof Set) return { $s: [...v].map(encode) };
  if (Array.isArray(v)) return v.map(encode);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (x !== undefined) out[k] = encode(x);
  return out;
}

export function decode(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(decode);
  const o = v as Record<string, unknown>;
  if (typeof o.$d === "string" && Object.keys(o).length === 1) return new Date(o.$d);
  if (Array.isArray(o.$m) && Object.keys(o).length === 1) return new Map((o.$m as [unknown, unknown][]).map(([k, x]) => [decode(k), decode(x)]));
  if (Array.isArray(o.$s) && Object.keys(o).length === 1) return new Set((o.$s as unknown[]).map(decode));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(o)) out[k] = decode(x);
  return out;
}

/**
 * Wrap a reader. `key` must be unique across the app (use "module:function").
 * Falls back to the live reader outside a Next runtime (tests, scripts) and
 * for results too large to store.
 */
export function cached<A extends unknown[], R>(
  key: string,
  tags: CacheTag[],
  fn: (...args: A) => Promise<R>,
  opts: { revalidate?: number } = {}
): (...args: A) => Promise<R> {
  const inner = unstable_cache(
    async (...args: A) => {
      const enc = encode(await fn(...args));
      const bytes = JSON.stringify(enc).length;
      if (bytes > MAX_ENTRY_BYTES && !oversized.has(key)) {
        oversized.add(key);
        console.warn(`[cache] ${key} is ${Math.round(bytes / 1024)} KB — too big to cache, reading live from now on`);
      }
      return enc;
    },
    [key],
    { tags, revalidate: opts.revalidate ?? SAFETY_TTL_SECONDS }
  );
  return async (...args: A) => {
    if (!cacheUsable || oversized.has(key)) return fn(...args);
    try {
      return decode(await inner(...args)) as R;
    } catch (e) {
      // No incremental cache here (vitest, a script): read live, quietly, from now on.
      if (e instanceof Error && /incrementalCache/.test(e.message)) { cacheUsable = false; return fn(...args); }
      throw e;
    }
  };
}

const list = (t: CacheTag | CacheTag[]) => (Array.isArray(t) ? t : [t]);

/** From a Server Action: expire now, so the person's own change shows on the very next screen. */
export function touched(tags: CacheTag | CacheTag[], path?: string, type?: "page" | "layout") {
  for (const t of list(tags)) {
    try { updateTag(t); } catch { try { revalidateTag(t, "max"); } catch { /* outside a request */ } }
  }
  if (path) { try { revalidatePath(path, type); } catch { /* outside a request */ } }
}

/** From a cron, webhook or route handler: mark stale; the next visit refreshes in the background. */
export function touchedByJob(tags: CacheTag | CacheTag[]) {
  for (const t of list(tags)) { try { revalidateTag(t, "max"); } catch { /* outside a request */ } }
}

/** From code that runs in both actions and jobs (db/mutations.ts). */
export function touchedAnywhere(tags: CacheTag | CacheTag[]) { touched(tags); }
