import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { runScheduledTransfers, runMonthlyAllowances, reconcilePendingTransfers, createNotification } from "@/db/mutations";

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
    const allowances = await runMonthlyAllowances(new Date());
    const reconciled = await reconcilePendingTransfers();

    // Daily nudges: a per-item reminder for each transfer reaching its date
    // today, plus one idempotent summary of everything DUE (planned date arrived
    // or none). Future-dated transfers stay quiet until their day.
    let notified = false;
    if (db) {
      const pend = await db
        .select({ id: s.transferInstances.id, amount: s.transferInstances.amount, plannedDate: s.transferInstances.plannedDate })
        .from(s.transferInstances)
        .where(eq(s.transferInstances.status, "pending"));
      const dateOf = (p: { plannedDate: unknown }) => (p.plannedDate ? String(p.plannedDate).slice(0, 10) : null);
      const due = pend.filter((p) => { const d = dateOf(p); return !d || d <= today; });
      // Per-item: a transfer whose planned date is exactly today.
      for (const p of pend.filter((p) => dateOf(p) === today)) {
        const usd = "$" + Math.round(Number(p.amount ?? 0)).toLocaleString("en-US");
        await createNotification({
          type: "transfer-due",
          tone: "warning",
          icon: "transfers",
          audience: "owners",
          title: `Transfer due today · ${usd}`,
          body: "A scheduled transfer reaches its date today.",
          linkTo: "transfers",
          dedupeKey: `transfer-due:${p.id}`,
        });
      }
      if (due.length) {
        const total = due.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
        const usd = "$" + Math.round(total).toLocaleString("en-US");
        const res = await createNotification({
          type: "transfers",
          tone: "warning",
          icon: "transfers",
          audience: "owners",
          title: `${due.length} transfer${due.length === 1 ? "" : "s"} to make`,
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
      allowances: allowances.created,
      reconciled: reconciled.matched,
      notified,
    });
  } catch (e) {
    console.error("[transfers cron] failed", e);
    return NextResponse.json({ ok: false, error: true }, { status: 500 });
  }
}
