/**
 * Timing probe for the reads behind Home — returns only milliseconds and
 * error names, never data. Used by /api/health/db?deep=1 to find out which
 * read is slow on a deployment.
 */
import { getDashboardData, familyTodayISO } from "./dashboard";
import { getPeople } from "./profiles";
import { quoteOfTheDay } from "./quotes";
import { unreadCount } from "./notifications";
import { getNights, listSwaps } from "./kitchen";
import { homeGoals } from "./goals";
import { listChores, listCompletions } from "./chores";
import { photoOfTheDay, recentPhotos } from "./photos";
import { getCalendar } from "./calendar";
import { getFinanceData } from "./queries";
import { addDaysISO } from "./household";

type Step = { step: string; ms: number; ok: boolean; error?: string };

async function timed(step: string, fn: () => Promise<unknown>, cap = 25000): Promise<Step> {
  const t0 = Date.now();
  const timeout = new Promise<Step>((resolve) => setTimeout(() => resolve({ step, ms: Date.now() - t0, ok: false, error: `timed out after ${cap}ms` }), cap));
  const run = fn().then(() => ({ step, ms: Date.now() - t0, ok: true }), (e: unknown) => ({ step, ms: Date.now() - t0, ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }));
  return Promise.race([run, timeout]);
}

export async function probeHomeReads(): Promise<Step[]> {
  const todayISO = familyTodayISO();
  const viewer = { memberId: null, role: "owner" as const };
  const out: Step[] = [];
  out.push(await timed("people", () => getPeople()));
  out.push(await timed("unread", () => unreadCount(viewer)));
  out.push(await timed("quote", () => quoteOfTheDay(viewer, todayISO)));
  out.push(await timed("nights", () => getNights(todayISO, 1)));
  out.push(await timed("swaps", () => listSwaps("pending")));
  out.push(await timed("goals", () => homeGoals(viewer, todayISO)));
  out.push(await timed("chores", () => listChores()));
  out.push(await timed("completions", () => listCompletions(addDaysISO(todayISO, -60), todayISO)));
  out.push(await timed("photoOfTheDay", () => photoOfTheDay(viewer, todayISO)));
  out.push(await timed("recentPhotos", () => recentPhotos(viewer, 6)));
  out.push(await timed("calendar", () => getCalendar(viewer, todayISO, addDaysISO(todayISO, 7), { dinners: false })));
  out.push(await timed("financeData", () => getFinanceData(viewer), 40000));
  out.push(await timed("dashboard", () => getDashboardData(viewer), 40000));
  return out;
}
