import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";
import * as s from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Database reachability probe — no data, just whether trivial queries return
 * and how long they take. `?n=5` runs n queries concurrently (forces n pool
 * connections), `?serial=1` runs them one after another. Public so it can be
 * hit from a deployment check.
 */
export async function GET(req: Request) {
  if (!isDbConfigured || !db) return NextResponse.json({ ok: false, configured: false });
  const u = new URL(req.url);
  const n = Math.max(1, Math.min(8, Number(u.searchParams.get("n") || 1)));
  const serial = u.searchParams.get("serial") === "1";
  const one = async (i: number) => {
    const t0 = Date.now();
    const timeout = new Promise<{ ok: false; error: string }>((resolve) => setTimeout(() => resolve({ ok: false, error: "timed out after 12000ms" }), 12000));
    const q = db!.execute(sql`select pg_sleep(0.2), ${i} as i`).then(() => ({ ok: true as const }), (e: unknown) => ({ ok: false as const, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }));
    const r = await Promise.race([q, timeout]);
    return { i, ms: Date.now() - t0, ...r };
  };
  // `?drizzle=1` also runs one real Drizzle select (a single quote id) — the
  // code path every screen's reads take, so the query wrapper is exercised too.
  const drizzle = u.searchParams.get("drizzle") === "1"
    ? await (async () => {
        const t = Date.now();
        try { const rows = await db!.select({ id: s.quotes.id }).from(s.quotes).limit(1); return { ok: true as const, rows: rows.length, ms: Date.now() - t }; }
        catch (e) { return { ok: false as const, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t }; }
      })()
    : undefined;
  const t0 = Date.now();
  const results = serial ? await (async () => { const out = []; for (let i = 0; i < n; i++) out.push(await one(i)); return out; })() : await Promise.all(Array.from({ length: n }, (_, i) => one(i)));
  return NextResponse.json({ ok: results.every((r) => r.ok) && (drizzle?.ok ?? true), n, serial, totalMs: Date.now() - t0, results, drizzle, region: process.env.VERCEL_REGION ?? null, env: process.env.VERCEL_ENV ?? null, node: process.version });
}
