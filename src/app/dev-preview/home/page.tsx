import { notFound } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { HomeScreen } from "@/app/(app)/(home)/home-screen";
import type { HomeData } from "@/db/home";
import { scenicForDay } from "@/lib/scenic";

export const metadata = { title: "Home preview · Zitting HQ" };
export const dynamic = "force-dynamic";

// Dev-only Home on placeholder data, both variants: ?variant=owner|wife and
// ?state=full|empty. Placeholder people and fake money only — never real data.
const PEOPLE: HomeData["people"] = [
  { id: "jared", name: "Jared", greetingName: "Jared", hue: 1, avatarUrl: "https://picsum.photos/seed/zh-jared/200/200", kind: "adult" },
  { id: "jaelynn", name: "Jaelynn", greetingName: "Jaelynn", hue: 2, avatarUrl: "https://picsum.photos/seed/zh-jae/200/200", kind: "adult" },
  { id: "katelynn", name: "Katelynn", greetingName: "Katelynn", hue: 3, avatarUrl: "https://picsum.photos/seed/zh-kate/200/200", kind: "adult" },
  { id: "azaleah", name: "Azaleah", greetingName: "Azaleah", hue: 4, avatarUrl: null, kind: "child" },
  { id: "emerick", name: "Emerick", greetingName: "Emerick", hue: 5, avatarUrl: null, kind: "child" },
  { id: "jae", name: "Jae", greetingName: "Jae", hue: 6, avatarUrl: "https://picsum.photos/seed/zh-jj/200/200", kind: "child" },
];

function mock(variant: "owner" | "wife", state: "full" | "empty"): HomeData {
  const full = state === "full";
  const member = variant === "wife";
  return {
    todayISO: "2026-09-08", dateLabel: "Tuesday, September 8", daypart: "afternoon", greetingName: member ? "Jaelynn" : "Jared",
    viewer: { memberId: member ? "jaelynn" : "jared", role: member ? "member" : "owner", kind: "adult", hue: member ? 2 : 1, avatarUrl: null, modules: [], actingOwner: !member, realMemberId: member ? "jaelynn" : "jared" },
    people: PEOPLE,
    quote: full ? { id: 1, text: "Mom, can the moon come to dinner?", saidByMemberId: "jae", saidByName: null, saidOn: "2026-09-02", saved: false } : null,
    photoOfDay: full ? { src: "https://picsum.photos/seed/zh-lake/1200/800", title: "Saturday at the lake", by: "Katelynn", album: "Lake weekend", count: 42 } : null,
    recentPhotos: full ? [1, 2, 3, 4, 5, 6].map((i) => ({ id: i, src: `https://picsum.photos/seed/zh-r${i}/400/400` })) : [],
    photosEnabled: false,
    scenic: scenicForDay("2026-09-08"),
    weather: full ? { temp: 74, feelsLike: 64, code: 0, label: "Sunny", icon: "sun", isDay: true, wind: 15, humidity: 19, sunrise: "2026-09-08T07:09", sunset: "2026-09-08T19:48", fetchedAt: "2026-09-08T14:45:00Z", today: { dateISO: "2026-09-08", hi: 91, lo: 66, code: 0, label: "Sunny", icon: "sun", precip: 1 }, days: [{ dateISO: "2026-09-09", hi: 93, lo: 72, code: 3, label: "Overcast", icon: "cloud", precip: 2 }, { dateISO: "2026-09-10", hi: 88, lo: 70, code: 53, label: "Drizzle", icon: "cloud-drizzle", precip: 36 }, { dateISO: "2026-09-11", hi: 87, lo: 71, code: 2, label: "Partly cloudy", icon: "cloud-sun", precip: 5 }] } : null,
    goals: full ? [{ id: "hawaii", title: "Hawaii, spring break", value: 0.4, current: 3200, target: 8000, money: true, people: [1, 2, 3], progressKind: "savings" as const, doneToday: false, streak: 0, mine: true }, { id: "read", title: "Read together every night", value: 0.71, current: 21, target: 30, unit: null, money: false, people: [4, 5, 6], progressKind: "streak" as const, doneToday: true, streak: 6, mine: true }] : [],
    chores: full ? { people: [{ memberId: "azaleah", items: [{ taskId: "c1", periodKey: "2026-09-08", title: "Make the bed", icon: "bed", done: true, needsCheck: false, checked: false, due: null, list: "Kids" }, { taskId: "c2", periodKey: "2026-09-08", title: "Clear the table", icon: "utensils", done: true, needsCheck: true, checked: false, due: null, list: "Kids" }, { taskId: "c3", periodKey: "2026-09-08", title: "Read 20 minutes", icon: "book-open", done: false, needsCheck: false, checked: false, due: null, list: "Kids" }], done: 2, total: 3, points: 1, possible: 4, streak: 4 }, { memberId: "emerick", items: [{ taskId: "c4", periodKey: "2026-09-08", title: "Feed the dog", icon: "heart", done: true, needsCheck: false, checked: false, due: null, list: "Kids" }], done: 1, total: 1, points: 1, possible: 1, streak: 9 }], anyone: [{ taskId: "a1", periodKey: "2026-09-08", title: "Dishes and counters", icon: "utensils", done: false, needsCheck: false, checked: false, due: null, list: "Daily basics" }, { taskId: "a2", periodKey: "2026-09-06", title: "Mop the floors", icon: "droplets", done: false, needsCheck: false, checked: false, due: "2026-09-12", list: "Saturday deep clean" }], toCheck: 1 } : { people: [], anyone: [], toCheck: 0 },
    unread: full ? 3 : 0,
    tonight: full ? { cook: "jaelynn", dish: ["katelynn"], note: null } : null,
    pendingSwaps: full && member ? 1 : 0,
    upNext: full ? [
      { key: "a", kind: "event", title: "School drop-off", dateISO: "2026-09-08", time: "8:15", location: null, forMemberId: null, driverMemberId: null, familyEventId: 1, tripId: null, dayOfTrip: undefined },
      { key: "b", kind: "appointment", title: "Dentist", dateISO: "2026-09-08", time: "15:30", location: "Sunrise Pediatric Dental", forMemberId: "azaleah", driverMemberId: "katelynn", familyEventId: 2, tripId: null, dayOfTrip: undefined },
      { key: "c", kind: "appointment", title: "Speech therapy", dateISO: "2026-09-10", time: "10:00", location: null, forMemberId: "jae", driverMemberId: "jaelynn", familyEventId: 3, tripId: null, dayOfTrip: undefined },
      { key: "d", kind: "trip", title: "Lake weekend", dateISO: "2026-09-12", time: null, location: "Bear Lake", forMemberId: null, driverMemberId: null, familyEventId: null, tripId: "t1", dayOfTrip: { n: 1, of: 3 } },
    ] : [],
    dashboard: {
      todayISO: "2026-09-08",
      finance: member
        ? { role: "member", memberName: "Jaelynn", remainingLabel: "$318.40", allowanceLabel: "$600", memberSpent: 281.6, memberSpentLabel: "$281.60", memberAllowance: 600, memberUnlocked: true, memberToReview: full ? 2 : 0, monthLabel: "September" }
        : { role: "owner", totalCash: "$4,218.40", netWorth: "$17,058.52", spending: "$2,418.22", income: "$6,420.00", transfersPending: full ? 2 : 0, transfersPendingTotal: "$440.00", toReview: full ? 3 : 0, spendTrend: [400, 900, 1300, 1700, 1980, 2200, 2418], monthLabel: "September", billsDueSoon: full ? 1 : 0, billsChanged: 0 },
      meals: { tonight: full ? { name: "Street tacos", emoji: null, note: null } : null, upcoming: full ? [{ chip: "Wed", name: "Leftovers night", emoji: null }, { chip: "Thu", name: "Pasta bake", emoji: null }] : [] },
      groceries: { listCount: full ? 7 : 0, lowCount: full ? 2 : 0, lowNames: full ? ["Milk", "Eggs"] : [] },
      calendar: { events: full ? [{ chip: "Today", dateISO: "2026-09-08", title: "School drop-off", time: "8:15", color: "var(--hue-sky)" }, { chip: "Today", dateISO: "2026-09-08", title: "Dentist — Azaleah", time: "3:30", color: "var(--hue-lilac)" }] : [], feedCount: full ? 1 : 0 },
      today: { events: full ? [{ title: "School drop-off", time: "8:15", color: "var(--hue-sky)" }, { title: "Dentist — Azaleah", time: "3:30", color: "var(--hue-lilac)" }] : [], dinner: full ? { name: "Street tacos", emoji: null } : null },
      needsAttention: full ? (member ? [{ key: "review", label: "2 purchases to review", href: "/finance", tone: "warn" }, { key: "pantry", label: "2 items running low", href: "/groceries", tone: "warn" }] : [{ key: "transfers", label: "2 transfers ready · $440.00", href: "/finance", tone: "accent" }, { key: "review", label: "3 transactions to review", href: "/finance", tone: "warn" }, { key: "pantry", label: "2 items running low", href: "/groceries", tone: "warn" }]) : [],
    },
  };
}

export default async function HomePreview({ searchParams }: { searchParams: Promise<{ variant?: string; state?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { variant, state } = await searchParams;
  const v = variant === "wife" ? "wife" : "owner";
  const data = mock(v, state === "empty" ? "empty" : "full");
  return (
    <AppFrame user={{ name: data.greetingName, role: data.viewer.role, person: data.viewer.hue, unread: data.unread }}>
      <HomeScreen data={data} />
    </AppFrame>
  );
}
