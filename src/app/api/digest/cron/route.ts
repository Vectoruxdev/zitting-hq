import { NextResponse } from "next/server";
import { runDigests } from "@/db/digestSend";
import { sendDueReminders } from "@/db/reminders";
import { touchedByJob } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * Daily email-digest job (Vercel cron → see vercel.json). Self-gates on the
 * household cadence (weekly/biweekly/monthly) + last-sent, so running daily is
 * safe: it only sends when a digest is actually due, and digest_log dedupes per
 * recipient+period. Guarded by CRON_SECRET when set.
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
    // Daily backstop for event/appointment reminders (Vercel Hobby allows only
    // daily crons; the live path is the Home-visit tick in src/db/reminders.ts).
    const reminders = await sendDueReminders(new Date()).catch((e) => { console.error("[reminders backstop]", e); return 0; });
    const res = await runDigests(new Date().toISOString().slice(0, 10));
    touchedByJob("notifications");
    return NextResponse.json({ ok: true, reminders, ...res });
  } catch (e) {
    console.error("[digest cron] failed", e);
    return NextResponse.json({ ok: false, error: true }, { status: 500 });
  }
}
