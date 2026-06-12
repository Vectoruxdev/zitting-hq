import { NextResponse } from "next/server";
import { syncAllItems } from "@/db/plaid";

export const dynamic = "force-dynamic";
// Full headroom: a multi-account sync (paginated pulls + balance calls + import
// + reconcile) can take a few minutes when the bank is slow.
export const maxDuration = 300;

/**
 * Nightly safety-net sync (Vercel cron → see vercel.json). Pulls any new
 * transactions for every connected bank in case a webhook was missed.
 *
 * Guarded by CRON_SECRET when set: Vercel cron sends it as a Bearer token. If
 * CRON_SECRET isn't configured, the endpoint still runs (sync is read-only and
 * idempotent), but setting it is recommended.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  try {
    const res = await syncAllItems();
    // Per-bank failures surface as a 500 so Vercel's cron monitoring flags the
    // run instead of recording a green check over a bank that didn't sync.
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  } catch (e) {
    console.error("[plaid cron] sync failed", e);
    return NextResponse.json({ ok: false, error: true }, { status: 500 });
  }
}
