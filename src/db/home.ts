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
import type { Viewer } from "./queries";

export interface HomeData {
  todayISO: string;
  dateLabel: string;
  /** morning | afternoon | evening | late */
  daypart: "morning" | "afternoon" | "evening" | "late";
  greetingName: string;
  viewer: { memberId: string | null; role: Viewer["role"]; kind: "adult" | "child"; hue: number; avatarUrl: string | null };
  people: Pick<Person, "id" | "name" | "greetingName" | "hue" | "avatarUrl" | "kind">[];
  quote: Pick<Quote, "id" | "text" | "saidByMemberId" | "saidByName" | "saidOn"> | null;
  photoOfDay: { id?: string; src: string; title: string | null; by: string | null; album: string | null; count: number } | null;
  recentPhotos: { id: string | number; src: string }[];
  goals: { id: string; title: string; value: number; current?: number; target?: number; money: boolean; people: number[] }[];
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

export async function getHomeData(viewer: Viewer, fallbackName: string): Promise<HomeData> {
  const todayISO = familyTodayISO();
  const [dashboard, people, quote, unread, nights, swaps] = await Promise.all([
    getDashboardData(viewer),
    getPeople().catch(() => [] as Person[]),
    quoteOfTheDay({ memberId: viewer.memberId, role: viewer.role }, todayISO).catch(() => null),
    unreadCount({ memberId: viewer.memberId, role: viewer.role }).catch(() => 0),
    getNights(todayISO, 1).catch(() => []),
    listSwaps("pending").catch(() => []),
  ]);
  const av = { memberId: viewer.memberId, role: viewer.role };
  const [pod, recent, cal] = await Promise.all([photoOfTheDay(av, todayISO).catch(() => null), recentPhotos(av, 6).catch(() => []), getCalendar(av, todayISO, addDaysISO(todayISO, 7), { dinners: false }).catch(() => ({ items: [] as CalItem[], feeds: [], configured: false }))]);
  const tonightPlan = nights[0];
  const me = people.find((p) => p.id === viewer.memberId) ?? null;
  return {
    todayISO,
    dateLabel: familyDateLabel(),
    daypart: daypartFor(familyHour()),
    greetingName: me?.greetingName || fallbackName.split(" ")[0] || "there",
    viewer: { memberId: viewer.memberId, role: viewer.role, kind: me?.kind ?? "adult", hue: me?.hue ?? 1, avatarUrl: me?.avatarUrl ?? null },
    people: people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind })),
    quote: quote ? { id: quote.id, text: quote.text, saidByMemberId: quote.saidByMemberId, saidByName: quote.saidByName, saidOn: quote.saidOn } : null,
    photoOfDay: pod && pod.src ? { id: pod.id, src: pod.src, title: pod.caption, by: people.find((x) => x.id === pod.uploadedBy)?.greetingName ?? null, album: null, count: 0 } : null,
    recentPhotos: recent.filter((x) => x.thumb || x.src).map((x) => ({ id: x.id, src: (x.thumb || x.src) as string })),
    goals: [],
    unread,
    tonight: tonightPlan ? { cook: tonightPlan.cook, dish: tonightPlan.dish, note: tonightPlan.note } : null,
    pendingSwaps: swaps.filter((sw) => sw.toMemberId === viewer.memberId).length,
    upNext: cal.items.slice(0, 12).map((i) => ({ key: i.key, kind: i.kind, title: i.title, dateISO: i.dateISO, time: i.time, location: i.location, forMemberId: i.forMemberId, driverMemberId: i.driverMemberId, familyEventId: i.familyEventId, tripId: i.tripId, dayOfTrip: i.dayOfTrip })),
    dashboard,
  };
}
