/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Family dashboard data — one compact summary per module for the home page.
 *
 * Reuses each module's own read layer (finance via getFinanceData, hub data
 * via household.ts) so the numbers always agree with the module screens.
 * Every section is defensive: a failing module renders as its empty state,
 * never a broken dashboard.
 */
import { getFinanceData, type Viewer } from "./queries";
import { getGroceriesData, getMealsData, getCalendarConfig, addDaysISO } from "./household";
import { expandIcs } from "@/lib/ics";

const TZ = "America/Denver";

/** Today's YYYY-MM-DD in the family's timezone (server runs in UTC). */
export function familyTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Hour 0-23 in the family's timezone, for the greeting. */
export function familyHour(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date()));
}

export function familyDateLabel(): string {
  return new Date().toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
}

function mondayOfISO(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return addDaysISO(iso, -((d.getDay() + 6) % 7));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayChip(iso: string, todayISO: string): string {
  if (iso === todayISO) return "Today";
  if (iso === addDaysISO(todayISO, 1)) return "Tomorrow";
  return WEEKDAYS[new Date(iso + "T00:00:00").getDay()];
}

export interface DashboardData {
  todayISO: string;
  finance: {
    role: "owner" | "partner" | "member";
    // owner/partner
    totalCash?: string;
    netWorth?: string;
    spending?: string;
    income?: string;
    transfersPending?: number;
    transfersPendingTotal?: string;
    toReview?: number;
    spendTrend?: number[];
    // member
    memberName?: string;
    remainingLabel?: string | null;
    allowanceLabel?: string | null;
    memberToReview?: number;
    monthLabel?: string;
  };
  meals: {
    tonight: { name: string; emoji: string | null; note: string | null } | null;
    upcoming: { chip: string; name: string; emoji: string | null }[];
  };
  groceries: { listCount: number; lowCount: number; lowNames: string[] };
  calendar: {
    events: { chip: string; dateISO: string; title: string; time: string | null; color: string }[];
    feedCount: number;
  };
}

const FEED_COLORS = ["var(--accent)", "var(--indigo-500)", "var(--amber-500)", "var(--data-2, #7c8cf8)", "var(--gray-500)"];

export async function getDashboardData(viewer: Viewer): Promise<DashboardData> {
  const todayISO = familyTodayISO();

  // ---- finance ----
  const finance: DashboardData["finance"] = { role: viewer.role };
  try {
    const d: any = await getFinanceData(viewer);
    if (viewer.role === "member") {
      const h = d.memberHome;
      if (h) {
        finance.memberName = h.name;
        finance.remainingLabel = h.allowance > 0 ? h.remainingLabel : null;
        finance.allowanceLabel = h.allowance > 0 ? h.allowanceLabel : null;
        finance.memberToReview = h.totalRemaining ?? 0;
        finance.monthLabel = h.monthLabel;
      }
    } else {
      finance.totalCash = d.stats?.totalCash;
      finance.netWorth = d.stats?.netWorth;
      finance.spending = d.stats?.spending;
      finance.income = d.stats?.income;
      finance.transfersPending = d.transfersPending ?? 0;
      finance.transfersPendingTotal = d.transfersPendingTotal;
      finance.toReview = Array.isArray(d.txns) ? d.txns.filter((t: any) => !t.reviewed).length : 0;
      finance.spendTrend = d.trend?.spending ?? [];
      finance.monthLabel = new Date().toLocaleDateString("en-US", { timeZone: TZ, month: "long" });
    }
  } catch {
    /* finance card renders its empty state */
  }

  // ---- meals: tonight + the next few planned dinners (this week + next) ----
  const meals: DashboardData["meals"] = { tonight: null, upcoming: [] };
  try {
    const weekStart = mondayOfISO(todayISO);
    const [thisWeek, nextWeek] = [await getMealsData(weekStart), await getMealsData(addDaysISO(weekStart, 7))];
    const recipes = new Map([...thisWeek.recipes, ...nextWeek.recipes].map((r: any) => [r.id, r]));
    const plan = [...thisWeek.plan, ...nextWeek.plan]
      .filter((m: any) => String(m.date) >= todayISO && (m.slot ?? "dinner") === "dinner")
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
    const nameOf = (m: any) => {
      const r = m.recipeId ? recipes.get(m.recipeId) : null;
      return { name: r?.name || m.title || "Dinner", emoji: r?.emoji ?? null, note: m.note ?? null };
    };
    const tonight = plan.find((m: any) => String(m.date) === todayISO);
    if (tonight) meals.tonight = nameOf(tonight);
    meals.upcoming = plan
      .filter((m: any) => String(m.date) > todayISO)
      .slice(0, 3)
      .map((m: any) => {
        const v = nameOf(m);
        return { chip: dayChip(String(m.date), todayISO), name: v.name, emoji: v.emoji };
      });
  } catch {
    /* empty meals card */
  }

  // ---- groceries ----
  const groceries: DashboardData["groceries"] = { listCount: 0, lowCount: 0, lowNames: [] };
  try {
    const g = await getGroceriesData();
    groceries.listCount = g.items.filter((i: any) => !i.checked).length;
    const low = g.pantry.filter((p: any) => p.level === "low" || p.level === "out");
    groceries.lowCount = low.length;
    groceries.lowNames = low.slice(0, 3).map((p: any) => p.name);
  } catch {
    /* empty groceries card */
  }

  // ---- calendar: the next 7 days across feeds + family events ----
  const calendar: DashboardData["calendar"] = { events: [], feedCount: 0 };
  try {
    const cfg = await getCalendarConfig();
    const windowEnd = addDaysISO(todayISO, 7);
    const enabled = cfg.feeds.filter((f: any) => f.enabled);
    calendar.feedCount = enabled.length;
    const events: DashboardData["calendar"]["events"] = [];
    for (const feed of enabled) {
      try {
        const res = await fetch(feed.url, { next: { revalidate: 900 } });
        if (!res.ok) continue;
        const color = feed.color || FEED_COLORS[(feed.id - 1) % FEED_COLORS.length];
        for (const ev of expandIcs(await res.text(), todayISO, windowEnd)) {
          events.push({ chip: dayChip(ev.dateISO, todayISO), dateISO: ev.dateISO, title: ev.title, time: ev.time ?? null, color });
        }
      } catch {
        /* one broken feed never hides the rest */
      }
    }
    for (const ev of cfg.events) {
      const date = String(ev.date);
      if (date < todayISO || date > windowEnd) continue;
      events.push({ chip: dayChip(date, todayISO), dateISO: date, title: ev.title, time: ev.time ?? null, color: "var(--accent)" });
    }
    events.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || String(a.time ?? "99").localeCompare(String(b.time ?? "99")));
    calendar.events = events.slice(0, 5);
  } catch {
    /* empty calendar card */
  }

  return { todayISO, finance, meals, groceries, calendar };
}
