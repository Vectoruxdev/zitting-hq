import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { runScheduledTransfers, reconcilePendingTransfers, createNotification } from "@/db/mutations";

export const dynamic = "force-dynamic";

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Daily scheduled-transfers job (Vercel cron → see vercel.json). Generates the
 * planned transfer for every due `scheduled` allocation rule, auto-reconciles any
 * pending transfer whose real transaction has posted, and emits one idempotent
 * "transfers to make" notification. The app never moves money — these are the
 * reminders; the bank (or a standing order) does the actual transfer.
 *
 * Guarded by CRON_SECRET when set (Vercel sends it as a Bearer token).
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
    const today = todayISO();
    const generated = await runScheduledTransfers(today);
    const reconciled = await reconcilePendingTransfers();

    // One idempotent daily nudge summarizing what's still pending.
    let notified = false;
    if (db) {
      const pend = await db
        .select({ amount: s.transferInstances.amount })
        .from(s.transferInstances)
        .where(eq(s.transferInstances.status, "pending"));
      if (pend.length) {
        const total = pend.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
        const usd = "$" + Math.round(total).toLocaleString("en-US");
        const res = await createNotification({
          type: "transfers",
          tone: "warning",
          icon: "transfers",
          audience: "owners",
          title: `${pend.length} transfer${pend.length === 1 ? "" : "s"} to make`,
          body: `${usd} ready to move across your accounts.`,
          linkTo: "transfers",
          dedupeKey: `transfers:ready:${today}`,
        });
        notified = !("skipped" in res && res.skipped);
      }
    }

    return NextResponse.json({
      ok: true,
      generated: generated.created,
      reconciled: reconciled.matched,
      notified,
    });
  } catch (e) {
    console.error("[transfers cron] failed", e);
    return NextResponse.json({ ok: false, error: true }, { status: 500 });
  }
}
