import { NextResponse } from "next/server";
import { sendDueReminders } from "@/db/reminders";
import { touchedByJob } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * Event / appointment reminders. Vercel Hobby runs this once a day (see
 * vercel.json) as the backstop; the same sender also ticks from Home on every
 * visit (src/db/reminders.ts), which is what makes "15 minutes before" land.
 * An external scheduler may also call this every 15 min with the CRON_SECRET
 * bearer. Guarded by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const sent = await sendDueReminders(new Date());
    touchedByJob("notifications");
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[reminders cron]", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
