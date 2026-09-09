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
import { resetDb } from "@/db";

/** What Home needs to paint its top half: greeting, family row, hero, weather, quote. Read first, sent at once. */
export interface HomeCore {
  todayISO: string;
  dateLabel: string;
  /** morning | afternoon | evening | late */
  daypart: "morning" | "afternoon" | "evening" | "late";
  greetingName: string;
  viewer: {
    memberId: string | null; role: Viewer["role"]; kind: "adult" | "child"; hue: number; avatarUrl: string | null; modules: string[];
    /** The real person is the owner — possibly looking at the app as `memberId` right now. */
    actingOwner: boolean;
    /** The real person's roster id (the owner's, while viewing as someone else). */
    realMemberId: string | null;
  };
  people: Pick<Person, "id" | "name" | "greetingName" | "hue" | "avatarUrl" | "kind">[];
  quote: Pick<Quote, "id" | "text" | "saidByMemberId" | "saidByName" | "saidOn" | "saved"> | null;
  photoOfDay: { id?: string; src: string; title: string | null; by: string | null; album: string | null; count: number } | null;
  recentPhotos: { id: string | number; src: string }[];
  /** Photos module switched on? When off, Home shows a scenic picture and no upload prompts. */
  photosEnabled: boolean;
  /** Today's scenic picture (the country around Colorado City) with its credit. */
  scenic: Scenic;
  /** Weather at home (Colorado City, AZ); null when the forecast couldn't be fetched. */
  weather: Weather | null;
  unread: number;
  /** Tonight's cook and dish duty (Phase 2). */
  tonight: { cook: string | null; dish: string[]; note: string | null } | null;
  /** Swap requests waiting on this viewer. */
  pendingSwaps: number;
}

/** The sections that take longer (money, calendar, chores, goals) — streamed in behind their skeletons. */
export interface HomeSlow {
  goals: { id: string; title: string; value: number; current?: number; target?: number; unit?: string | null; money: boolean; people: number[]; progressKind: "checkoff" | "count" | "streak" | "savings"; doneToday: boolean; streak: number; mine: boolean }[];
  /** Chores today per person (kids first), and how many finished chores are waiting for an adult's check. */
  chores: { people: { memberId: string; items: { choreId: string; title: string; icon: string | null; done: boolean; needsCheck: boolean; checked: boolean }[]; done: number; total: number; points: number; possible: number; streak: number }[]; toCheck: number };
  /** Unified calendar for today + the next 7 days (events, appointments, trips, feeds). */
  upNext: Pick<CalItem, "key" | "kind" | "title" | "dateISO" | "time" | "location" | "forMemberId" | "driverMemberId" | "familyEventId" | "tripId" | "dayOfTrip">[];
  dashboard: DashboardData;
}

export type HomeData = HomeCore & HomeSlow;

export function daypartFor(hour: number): HomeData["daypart"] {
  if (hour < 5) return "late";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * A read that can neither throw nor hang: its fallback after `ms`, and on
 * error. A database read that trips the watchdog also resets the connection
 * pool — a hang here means a dead pooled socket, and everything after it
 * should reconnect rather than wait its own turn to time out.
 */
function guarded<T>(label: string, p: Promise<T>, fallback: () => T, ms = 6000, opts: { db?: boolean } = {}): Promise<T> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      console.error(`[home] ${label} timed out after ${ms}ms — using its empty state`);
      if (opts.db !== false) resetDb(`home ${label} > ${ms}ms`);
      resolve(fallback());
    }, ms);
    p.then((v) => { clearTimeout(t); const took = Date.now() - t0; if (took > 1500) console.log(`[home] ${label} slow: ${took}ms`); resolve(v); }, (e) => { clearTimeout(t); console.error(`[home] ${label} failed after ${Date.now() - t0}ms:`, e instanceof Error ? e.message : e); resolve(fallback()); });
  });
}

export async function getHomeCore(viewer: Viewer, fallbackName: string, real: { actingOwner: boolean; realMemberId: string | null } = { actingOwner: viewer.role === "owner", realMemberId: viewer.memberId }): Promise<HomeCore> {
  const todayISO = familyTodayISO();
  const av = { memberId: viewer.memberId, role: viewer.role };
  // The quick reads, all at once: enough to paint the greeting, family row,
  // hero and quote. The heavier sections stream in from getHomeSlow. Each
  // read is fenced so one slow module renders as its empty state, never a
  // hung page.
  const tHome = Date.now();
  const photosEnabled = isModuleEnabled("photos");
  const [people, quote, unread, nights, swaps, access, pod, recent, weather] = await Promise.all([
    guarded("people", getPeople(), () => [] as Person[]),
    guarded("quote", quoteOfTheDay(av, todayISO), () => null),
    guarded("unread", unreadCount(av), () => 0),
    guarded("nights", getNights(todayISO, 1), () => []),
    guarded("swaps", listSwaps("pending"), () => []),
    viewer.role !== "owner" && viewer.memberId
      ? guarded("module access", getModuleAccess(viewer.memberId), () => ({} as Record<string, boolean>))
      : Promise.resolve({} as Record<string, boolean>),
    photosEnabled ? guarded("photo of the day", photoOfTheDay(av, todayISO), () => null) : Promise.resolve(null as Awaited<ReturnType<typeof photoOfTheDay>>),
    photosEnabled ? guarded("recent photos", recentPhotos(av, 6), () => []) : Promise.resolve([] as Awaited<ReturnType<typeof recentPhotos>>),
    guarded("weather", fetchWeather(), () => null, 5000, { db: false }),
  ]);
  const allowedSlugs = modulesFor(viewer.role).map((m) => m.slug).filter((slug) => access[slug] !== false);
  console.log(`[home] core reads ${Date.now() - tHome}ms`);
  const tonightPlan = nights[0];
  const me = people.find((p) => p.id === viewer.memberId) ?? null;
  return {
    todayISO,
    dateLabel: familyDateLabel(),
    daypart: daypartFor(familyHour()),
    greetingName: me?.greetingName || fallbackName.split(" ")[0] || "there",
    viewer: { memberId: viewer.memberId, role: viewer.role, kind: me?.kind ?? "adult", hue: me?.hue ?? 1, avatarUrl: me?.avatarUrl ?? null, modules: allowedSlugs, actingOwner: real.actingOwner, realMemberId: real.realMemberId },
    people: people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind })),
    quote: quote ? { id: quote.id, text: quote.text, saidByMemberId: quote.saidByMemberId, saidByName: quote.saidByName, saidOn: quote.saidOn, saved: quote.saved } : null,
    photoOfDay: pod && pod.src ? { id: pod.id, src: pod.src, title: pod.caption, by: people.find((x) => x.id === pod.uploadedBy)?.greetingName ?? null, album: null, count: 0 } : null,
    recentPhotos: recent.filter((x) => x.thumb || x.src).map((x) => ({ id: x.id, src: (x.thumb || x.src) as string })),
    photosEnabled,
    scenic: scenicForDay(todayISO),
    weather,
    unread,
    tonight: tonightPlan ? { cook: tonightPlan.cook, dish: tonightPlan.dish, note: tonightPlan.note } : null,
    pendingSwaps: swaps.filter((sw) => sw.toMemberId === viewer.memberId).length,
  };
}

/**
 * The heavier half of Home — money model, calendar (incl. Google feeds),
 * chores and goals — read together and streamed to the client behind their
 * section skeletons, so the top of the page never waits for them.
 */
export async function getHomeSlow(viewer: Viewer, core: Pick<HomeCore, "todayISO" | "people">): Promise<HomeSlow> {
  const todayISO = core.todayISO;
  const people = core.people;
  const av = { memberId: viewer.memberId, role: viewer.role };
  const t0 = Date.now();
  const [dashboard, goals, chores, completions, cal] = await Promise.all([
    getDashboardData(viewer),
    guarded("goals", homeGoals(av, todayISO), () => []),
    guarded("chores", listChores(), () => [] as Chore[]),
    guarded("chore completions", listCompletions(addDaysISO(todayISO, -60), todayISO), () => [] as Completion[]),
    guarded("calendar", getCalendar(av, todayISO, addDaysISO(todayISO, 7), { dinners: false }), () => ({ items: [] as CalItem[], feeds: [], configured: false }), 8000),
  ]);
  console.log(`[home] slow reads ${Date.now() - t0}ms`);
  return {
    goals: goals.map((g) => ({ id: g.id, title: g.title, value: g.progress.value, current: g.progress.current, target: g.progress.target ?? undefined, unit: g.progress.unit, money: g.progress.money, people: g.participants.map((id) => people.find((p) => p.id === id)?.hue ?? 1), progressKind: g.progressKind, doneToday: g.progress.doneToday, streak: g.progress.streak, mine: !!viewer.memberId && g.participants.includes(viewer.memberId) })),
    chores: (() => {
      const ordered = [...people].sort((a, b) => Number(a.kind === "adult") - Number(b.kind === "adult"));
      const days = dayFor(chores, completions, ordered.map((p) => p.id), todayISO).filter((d) => d.due.length);
      return {
        people: days.map((d) => ({ memberId: d.memberId as string, items: d.due.map((c) => { const done = d.done.find((x) => x.choreId === c.id); return { choreId: c.id, title: c.title, icon: c.icon, done: !!done, needsCheck: c.needsCheck, checked: !!done?.checkedAt }; }), done: d.done.length, total: d.due.length, points: d.points, possible: d.possible, streak: choreStreak(chores, completions, d.memberId as string, todayISO) })),
        toCheck: days.reduce((a, d) => a + d.waitingCheck, 0),
      };
    })(),
    upNext: cal.items.slice(0, 12).map((i) => ({ key: i.key, kind: i.kind, title: i.title, dateISO: i.dateISO, time: i.time, location: i.location, forMemberId: i.forMemberId, driverMemberId: i.driverMemberId, familyEventId: i.familyEventId, tripId: i.tripId, dayOfTrip: i.dayOfTrip })),
    dashboard,
  };
}

/** Everything Home shows, in one await (tests, previews, callers that don't stream). */
export async function getHomeData(viewer: Viewer, fallbackName: string, real: { actingOwner: boolean; realMemberId: string | null } = { actingOwner: viewer.role === "owner", realMemberId: viewer.memberId }): Promise<HomeData> {
  const core = await getHomeCore(viewer, fallbackName, real);
  return { ...core, ...(await getHomeSlow(viewer, core)) };
}
