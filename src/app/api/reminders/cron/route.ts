import { NextResponse } from "next/server";
import { dueReminders, markReminderSent } from "@/db/calendar";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";
import { fmtNight } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Event / appointment reminders (Vercel cron, every 15 minutes — see
 * vercel.json). Fires each pending reminder whose time has come to the people
 * involved: the person it's for and the driver (adults), or everyone for a plain
 * family event. Idempotent per reminder row. Guarded by CRON_SECRET (Bearer).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const due = await dueReminders(new Date());
    if (!due.length) return NextResponse.json({ ok: true, sent: 0 });
    const people = await getPeople().catch(() => []);
    const adult = (id: string | null) => !!id && people.some((p) => p.id === id && p.kind === "adult");
    const name = (id: string | null) => people.find((p) => p.id === id)?.greetingName ?? null;
    const sent: number[] = [];
    for (const { reminderId, event, minutesBefore } of due) {
      const when = `${fmtNight(String(event.date))}${event.time ? ` · ${event.time}` : ""}`;
      const lead = minutesBefore >= 1440 ? `${Math.round(minutesBefore / 1440)} day${minutesBefore >= 2880 ? "s" : ""} out` : minutesBefore >= 60 ? `in ${Math.round(minutesBefore / 60)} hour${minutesBefore >= 120 ? "s" : ""}` : `in ${minutesBefore} minutes`;
      const isAppt = event.kind === "appointment";
      const title = isAppt ? `${event.title}${event.forMemberId ? ` — ${name(event.forMemberId) ?? ""}` : ""} ${lead}`.replace(/\s+/g, " ").trim() : `${event.title} ${lead}`;
      const body = [when, event.location, event.driverMemberId ? `${name(event.driverMemberId)} drives` : null, event.prepNotes ? `Before: ${event.prepNotes}` : null].filter(Boolean).join(" · ");
      const targets = new Set<string>();
      if (isAppt) { if (adult(event.forMemberId)) targets.add(event.forMemberId!); if (adult(event.driverMemberId)) targets.add(event.driverMemberId!); }
      const link = `/calendar?event=${event.id}`;
      if (targets.size) {
        for (const m of targets) await createNotification({ type: "appointment_reminder", module: "calendar", tone: "info", icon: isAppt ? "stethoscope" : "calendar", audience: "member", memberId: m, title, body, linkTo: link, dedupeKey: `rem-${reminderId}-${m}` }).catch(() => {});
      } else {
        await createNotification({ type: "appointment_reminder", module: "calendar", tone: "info", icon: isAppt ? "stethoscope" : "calendar", audience: "all", title, body, linkTo: link, dedupeKey: `rem-${reminderId}` }).catch(() => {});
      }
      sent.push(reminderId);
    }
    await markReminderSent(sent);
    return NextResponse.json({ ok: true, sent: sent.length });
  } catch (err) {
    console.error("[reminders cron]", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
