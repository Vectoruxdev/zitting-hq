/**
 * Home data — one server round-trip for the per-person dashboard. Composes the
 * module summaries (dashboard.ts, unchanged) with the people strip, the quote
 * of the day and the unread count. Every section is defensive: a failing
 * module renders its empty state, never a broken Home. Photos and goals land
 * in Phases 3 and 5; their slots are here already so the layout is stable.
 */
import { getDashboardData, familyDateLabel, familyHour, familyTodayISO, type DashboardData } from "./dashboard";
import { getPeople, type Person } from "./profiles";
import { quoteOfTheDay, type Quote } from "./quotes";
import { unreadCount } from "./notifications";
import { getNights, listSwaps } from "./kitchen";
import { photoOfTheDay, recentPhotos } from "./photos";
import { getCalendar, type CalItem } from "./calendar";
import { addDaysISO } from "./household";
import { homeGoals } from "./goals";
import { choreStreak, dayFor, listChores, listCompletions, type Chore, type Completion } from "./chores";
import { getModuleAccess } from "./permissions";
import { isModuleEnabled, modulesFor } from "@/lib/modules";
import { fetchWeather, type Weather } from "@/lib/weather";
import { scenicForDay, type Scenic } from "@/lib/scenic";
import type { Viewer } from "./queries";

export interface HomeData {
  todayISO: string;
  dateLabel: string;
  /** morning | afternoon | evening | late */
  daypart: "morning" | "afternoon" | "evening" | "late";
  greetingName: string;
  viewer: { memberId: string | null; role: Viewer["role"]; kind: "adult" | "child"; hue: number; avatarUrl: string | null; modules: string[] };
  people: Pick<Person, "id" | "name" | "greetingName" | "hue" | "avatarUrl" | "kind">[];
  quote: Pick<Quote, "id" | "text" | "saidByMemberId" | "saidByName" | "saidOn"> | null;
  photoOfDay: { id?: string; src: string; title: string | null; by: string | null; album: string | null; count: number } | null;
  recentPhotos: { id: string | number; src: string }[];
  /** Photos module switched on? When off, Home shows a scenic picture and no upload prompts. */
  photosEnabled: boolean;
  /** Today's scenic picture (the country around Colorado City) with its credit. */
  scenic: Scenic;
  /** Weather at home (Colorado City, AZ); null when the forecast couldn't be fetched. */
  weather: Weather | null;
  goals: { id: string; title: string; value: number; current?: number; target?: number; unit?: string | null; money: boolean; people: number[]; progressKind: "checkoff" | "count" | "streak" | "savings"; doneToday: boolean; streak: number; mine: boolean }[];
  /** Chores today per person (kids first), and how many finished chores are waiting for an adult's check. */
  chores: { people: { memberId: string; items: { choreId: string; title: string; icon: string | null; done: boolean; needsCheck: boolean; checked: boolean }[]; done: number; total: number; points: number; possible: number; streak: number }[]; toCheck: number };
  unread: number;
  /** Tonight's cook and dish duty (Phase 2). */
  tonight: { cook: string | null; dish: string[]; note: string | null } | null;
  /** Swap requests waiting on this viewer. */
  pendingSwaps: number;
  /** Unified calendar for today + the next 7 days (events, appointments, trips, feeds). */
  upNext: Pick<CalItem, "key" | "kind" | "title" | "dateISO" | "time" | "location" | "forMemberId" | "driverMemberId" | "familyEventId" | "tripId" | "dayOfTrip">[];
  dashboard: DashboardData;
}

export function daypartFor(hour: number): HomeData["daypart"] {
  if (hour < 5) return "late";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** A read that can neither throw nor hang: its fallback after `ms`, and on error. */
function guarded<T>(label: string, p: Promise<T>, fallback: () => T, ms = 8000): Promise<T> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const t = setTimeout(() => { console.error(`[home] ${label} timed out after ${ms}ms — using its empty state`); resolve(fallback()); }, ms);
    p.then((v) => { clearTimeout(t); const took = Date.now() - t0; if (took > 1500) console.log(`[home] ${label} slow: ${took}ms`); resolve(v); }, (e) => { clearTimeout(t); console.error(`[home] ${label} failed after ${Date.now() - t0}ms:`, e instanceof Error ? e.message : e); resolve(fallback()); });
  });
}

export async function getHomeData(viewer: Viewer, fallbackName: string): Promise<HomeData> {
  const todayISO = familyTodayISO();
  const av = { memberId: viewer.memberId, role: viewer.role };
  // Sequential on purpose. The Supabase transaction pooler scrambles queries
  // that postgres.js pipelines when many run at once — a Promise.all here is
  // exactly what hung Home on the first preview deploy. Each read is also
  // fenced so one slow module renders as its empty state, never a hung page.
  const tHome = Date.now();
  const dashboard = await getDashboardData(viewer);
  const people = await guarded("people", getPeople(), () => [] as Person[]);
  const quote = await guarded("quote", quoteOfTheDay(av, todayISO), () => null);
  const unread = await guarded("unread", unreadCount(av), () => 0);
  const nights = await guarded("nights", getNights(todayISO, 1), () => []);
  const swaps = await guarded("swaps", listSwaps("pending"), () => []);
  const access: Record<string, boolean> = viewer.role !== "owner" && viewer.memberId ? await guarded("module access", getModuleAccess(viewer.memberId), () => ({} as Record<string, boolean>)) : {};
  const allowedSlugs = modulesFor(viewer.role).map((m) => m.slug).filter((slug) => access[slug] !== false);
  const goals = await guarded("goals", homeGoals(av, todayISO), () => []);
  const chores = await guarded("chores", listChores(), () => [] as Chore[]);
  const completions = await guarded("chore completions", listCompletions(addDaysISO(todayISO, -60), todayISO), () => [] as Completion[]);
  const photosEnabled = isModuleEnabled("photos");
  const pod = photosEnabled ? await guarded("photo of the day", photoOfTheDay(av, todayISO), () => null) : null;
  const recent = photosEnabled ? await guarded("recent photos", recentPhotos(av, 6), () => []) : [];
  const weather = await guarded("weather", fetchWeather(), () => null, 5000);
  const cal = await guarded("calendar", getCalendar(av, todayISO, addDaysISO(todayISO, 7), { dinners: false }), () => ({ items: [] as CalItem[], feeds: [], configured: false }), 12000);
  console.log(`[home] reads ${Date.now() - tHome}ms`);
  const tonightPlan = nights[0];
  const me = people.find((p) => p.id === viewer.memberId) ?? null;
  return {
    todayISO,
    dateLabel: familyDateLabel(),
    daypart: daypartFor(familyHour()),
    greetingName: me?.greetingName || fallbackName.split(" ")[0] || "there",
    viewer: { memberId: viewer.memberId, role: viewer.role, kind: me?.kind ?? "adult", hue: me?.hue ?? 1, avatarUrl: me?.avatarUrl ?? null, modules: allowedSlugs },
    people: people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind })),
    quote: quote ? { id: quote.id, text: quote.text, saidByMemberId: quote.saidByMemberId, saidByName: quote.saidByName, saidOn: quote.saidOn } : null,
    photoOfDay: pod && pod.src ? { id: pod.id, src: pod.src, title: pod.caption, by: people.find((x) => x.id === pod.uploadedBy)?.greetingName ?? null, album: null, count: 0 } : null,
    recentPhotos: recent.filter((x) => x.thumb || x.src).map((x) => ({ id: x.id, src: (x.thumb || x.src) as string })),
    photosEnabled,
    scenic: scenicForDay(todayISO),
    weather,
    goals: goals.map((g) => ({ id: g.id, title: g.title, value: g.progress.value, current: g.progress.current, target: g.progress.target ?? undefined, unit: g.progress.unit, money: g.progress.money, people: g.participants.map((id) => people.find((p) => p.id === id)?.hue ?? 1), progressKind: g.progressKind, doneToday: g.progress.doneToday, streak: g.progress.streak, mine: !!viewer.memberId && g.participants.includes(viewer.memberId) })),
    chores: (() => {
      const ordered = [...people].sort((a, b) => Number(a.kind === "adult") - Number(b.kind === "adult"));
      const days = dayFor(chores, completions, ordered.map((p) => p.id), todayISO).filter((d) => d.due.length);
      return {
        people: days.map((d) => ({ memberId: d.memberId as string, items: d.due.map((c) => { const done = d.done.find((x) => x.choreId === c.id); return { choreId: c.id, title: c.title, icon: c.icon, done: !!done, needsCheck: c.needsCheck, checked: !!done?.checkedAt }; }), done: d.done.length, total: d.due.length, points: d.points, possible: d.possible, streak: choreStreak(chores, completions, d.memberId as string, todayISO) })),
        toCheck: days.reduce((a, d) => a + d.waitingCheck, 0),
      };
    })(),
    unread,
    tonight: tonightPlan ? { cook: tonightPlan.cook, dish: tonightPlan.dish, note: tonightPlan.note } : null,
    pendingSwaps: swaps.filter((sw) => sw.toMemberId === viewer.memberId).length,
    upNext: cal.items.slice(0, 12).map((i) => ({ key: i.key, kind: i.kind, title: i.title, dateISO: i.dateISO, time: i.time, location: i.location, forMemberId: i.forMemberId, driverMemberId: i.driverMemberId, familyEventId: i.familyEventId, tripId: i.tripId, dayOfTrip: i.dayOfTrip })),
    dashboard,
  };
}
