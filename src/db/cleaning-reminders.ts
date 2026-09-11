/**
 * Cleaning reminders — a morning note per grown-up with what's on their list
 * (and the kids' lists) today, and an optional evening nudge for what is still
 * open. Idempotent per person and day, so it can run from the Home tick, the
 * keep-warm ping (/api/tick) and the daily cron without doubling up.
 */
import { createNotification } from "./mutations";
import { familyTodayISO } from "./dashboard";
import { getPeople } from "./profiles";
import { DEFAULT_REMIND_TIME, loadCleaning, openOn, visibleLists, type OpenItem } from "./cleaning";
import { fmtShort } from "@/lib/dates";

const TZ = "America/Denver"; // family time, same as dashboard.ts
const EVENING = "18:00";

/** "HH:MM" in family time. */
export function familyHHMM(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00", m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h === "24" ? "00" : h}:${m}`;
}

const line = (items: OpenItem[]) => { const t = items.map((i) => i.task.title); return t.length <= 3 ? t.join(", ") : `${t.slice(0, 3).join(", ")} +${t.length - 3} more`; };

export async function sendCleaningReminders(now = new Date()): Promise<number> {
  const todayISO = familyTodayISO();
  const hhmm = familyHHMM(now);
  const people = await getPeople().catch(() => []);
  const adults = people.filter((p) => p.kind === "adult" && p.id !== "household");
  if (!adults.length) return 0;
  const data = await loadCleaning(todayISO);
  if (!data.tasks.length) return 0;
  let sent = 0;
  for (const me of adults) {
    const lists = visibleLists(data.lists, me.id);
    const ids = new Set(lists.map((l) => l.id));
    const items = openOn(todayISO, data.tasks.filter((t) => ids.has(t.listId)), lists, data.completions, data.handoffs);
    const open = items.filter((i) => !i.completion);
    const mine = open.filter((i) => i.assignee === me.id || i.assignee === null);
    const kids = people.filter((p) => p.kind === "child").map((k) => ({ k, items: open.filter((i) => i.assignee === k.id) })).filter((x) => x.items.length);
    if (!mine.length && !kids.length) continue;
    // Morning: the earliest reminder time among the lists that have something for this person today.
    const times = mine.map((i) => i.list.remindTime || DEFAULT_REMIND_TIME);
    const at = times.length ? times.sort()[0] : DEFAULT_REMIND_TIME;
    if (hhmm >= at) {
      const dueToday = mine.filter((i) => i.occ.dueISO === todayISO || i.occ.period === "day");
      const title = mine.length ? `Today: ${mine.length} thing${mine.length === 1 ? "" : "s"} on your list${dueToday.length && dueToday.length < mine.length ? ` (${dueToday.length} due today)` : ""}` : `The kids have ${kids.reduce((a, x) => a + x.items.length, 0)} things today`;
      const body = [mine.length ? line(mine) : null, ...kids.map((x) => `${x.k.greetingName}: ${line(x.items)}`)].filter(Boolean).join(" · ");
      const r = await createNotification({ type: "cleaning_today", module: "chores", tone: "info", icon: "sparkles", audience: "member", memberId: me.id, title, body, linkTo: "/chores", dedupeKey: `clean-today-${me.id}-${todayISO}` }).catch(() => null);
      if (r && !r.skipped) sent++;
    }
    // Evening: what is still open (off unless the person switches it on).
    if (hhmm >= EVENING && mine.length) {
      const late = mine.filter((i) => i.occ.period === "day" || i.occ.dueISO <= todayISO);
      if (late.length) {
        const r = await createNotification({ type: "cleaning_evening", module: "chores", tone: "info", icon: "moon", audience: "member", memberId: me.id, title: `Still open: ${late.length} thing${late.length === 1 ? "" : "s"}`, body: `${line(late)} · ${fmtShort(todayISO)}`, linkTo: "/chores", dedupeKey: `clean-evening-${me.id}-${todayISO}` }).catch(() => null);
        if (r && !r.skipped) sent++;
      }
    }
  }
  return sent;
}
