import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Database reachability probe — no data, just whether a trivial query returns
 * and how long it takes. Public so it can be hit from a deployment check.
 */
export async function GET() {
  if (!isDbConfigured || !db) return NextResponse.json({ ok: false, configured: false });
  const t0 = Date.now();
  const timeout = new Promise<{ ok: false; error: string }>((resolve) => setTimeout(() => resolve({ ok: false, error: "timed out after 15000ms" }), 15000));
  const probe = db.execute(sql`select 1 as one`).then(() => ({ ok: true as const }), (e: unknown) => ({ ok: false as const, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }));
  const res = await Promise.race([probe, timeout]);
  return NextResponse.json({ ...res, configured: true, ms: Date.now() - t0, region: process.env.VERCEL_REGION ?? null, env: process.env.VERCEL_ENV ?? null });
}
