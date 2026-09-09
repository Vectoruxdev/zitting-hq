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
import { getHomeData } from "./home";
import { getPerson } from "./profiles";
import { getModuleAccess } from "./permissions";
import { db } from "./index";
import * as sch from "./schema";
import { eq } from "drizzle-orm";

type Step = { step: string; ms: number; ok: boolean; error?: string };

async function timed(step: string, fn: () => Promise<unknown>, cap = 25000): Promise<Step> {
  const t0 = Date.now();
  const timeout = new Promise<Step>((resolve) => setTimeout(() => resolve({ step, ms: Date.now() - t0, ok: false, error: `timed out after ${cap}ms` }), cap));
  const run = fn().then(() => ({ step, ms: Date.now() - t0, ok: true }), (e: unknown) => ({ step, ms: Date.now() - t0, ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }));
  return Promise.race([run, timeout]);
}

export async function probeHomeReads(as: "anon" | "owner" = "anon"): Promise<Step[]> {
  const todayISO = familyTodayISO();
  let viewer: { memberId: string | null; role: "owner" } = { memberId: null, role: "owner" };
  const out: Step[] = [];
  if (as === "owner" && db) {
    // Same shape as a signed-in owner on the roster (id only, never surfaced).
    out.push(await timed("lookup owner", async () => { const [row] = await db!.select({ id: sch.familyMembers.id }).from(sch.familyMembers).where(eq(sch.familyMembers.role, "owner")).limit(1); if (row) viewer = { memberId: row.id, role: "owner" }; }));
    out.push(await timed("frame:getPerson", () => getPerson(viewer.memberId)));
    out.push(await timed("frame:unread", () => unreadCount(viewer)));
    out.push(await timed("frame:modules", () => (viewer.memberId ? getModuleAccess(viewer.memberId) : Promise.resolve({}))));
    out.push(await timed("home:getHomeData", () => getHomeData(viewer, "there"), 90000));
  }
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
