/**
 * Event / appointment reminders — the sending logic shared by the daily cron
 * (Vercel Hobby allows one run a day) and the opportunistic tick that Home
 * triggers on every visit, so reminders land within minutes whenever anyone
 * in the family has the app open. Idempotent per reminder row.
 */
import { dueReminders, markReminderSent } from "./calendar";
import { createNotification } from "./mutations";
import { getPeople } from "./profiles";
import { fmtNight } from "@/lib/dates";

export async function sendDueReminders(now = new Date()): Promise<number> {
  const due = await dueReminders(now);
  if (!due.length) return 0;
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
  return sent.length;
}

// Opportunistic tick: at most once every 5 minutes per warm server instance,
// never throws (it runs after the response via next/server `after`).
let lastTick = 0;
const TICK_MS = 5 * 60 * 1000;
export async function tickReminders(): Promise<void> {
  const now = Date.now();
  if (now - lastTick < TICK_MS) return;
  lastTick = now;
  try { await sendDueReminders(new Date(now)); } catch (err) { console.error("[reminders tick]", err); }
}
