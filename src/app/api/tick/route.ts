import { NextResponse } from "next/server";
import { sendDueReminders } from "@/db/reminders";
import { sendCleaningReminders } from "@/db/cleaning-reminders";
import { touchedByJob } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * Public, secret-free tick: sends whatever reminders are already due (event
 * and appointment reminders, the cleaning digests). Every sender is idempotent
 * per reminder / person / day, so calling this early or often changes nothing
 * but the timing — the Supabase keep-warm ping hits it every 4 minutes
 * (supabase-keep-warm.sql), which is what makes an 8:00 digest land at 8:00
 * on a Hobby plan with daily crons. Returns counts only.
 */
export async function GET() {
  try {
    const now = new Date();
    const events = await sendDueReminders(now).catch((e) => { console.error("[tick] reminders", e); return 0; });
    const cleaning = await sendCleaningReminders(now).catch((e) => { console.error("[tick] cleaning", e); return 0; });
    if (events || cleaning) touchedByJob("notifications");
    return NextResponse.json({ ok: true, events, cleaning });
  } catch (err) {
    console.error("[tick]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
