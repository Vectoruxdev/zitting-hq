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
  photoOfDay: { src: string; title: string | null; by: string | null; album: string | null; count: number } | null;
  recentPhotos: { id: string | number; src: string }[];
  goals: { id: string; title: string; value: number; current?: number; target?: number; money: boolean; people: number[] }[];
  unread: number;
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
  const [dashboard, people, quote, unread] = await Promise.all([
    getDashboardData(viewer),
    getPeople().catch(() => [] as Person[]),
    quoteOfTheDay({ memberId: viewer.memberId, role: viewer.role }, todayISO).catch(() => null),
    unreadCount({ memberId: viewer.memberId, role: viewer.role }).catch(() => 0),
  ]);
  const me = people.find((p) => p.id === viewer.memberId) ?? null;
  return {
    todayISO,
    dateLabel: familyDateLabel(),
    daypart: daypartFor(familyHour()),
    greetingName: me?.greetingName || fallbackName.split(" ")[0] || "there",
    viewer: { memberId: viewer.memberId, role: viewer.role, kind: me?.kind ?? "adult", hue: me?.hue ?? 1, avatarUrl: me?.avatarUrl ?? null },
    people: people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind })),
    quote: quote ? { id: quote.id, text: quote.text, saidByMemberId: quote.saidByMemberId, saidByName: quote.saidByName, saidOn: quote.saidOn } : null,
    photoOfDay: null,
    recentPhotos: [],
    goals: [],
    unread,
    dashboard,
  };
}
