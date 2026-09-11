import { notFound } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { MealsClient } from "@/app/(app)/meals/meals-client";
import type { Recipe, PlanCell } from "@/app/(app)/meals/meals-client";
import { addDaysISO, localISO } from "@/db/household";
import { cookForDate, weekStartOf } from "@/db/kitchen";
import type { Idea, RotationDay, Swap } from "@/db/kitchen";
import { familyTodayISO } from "@/db/dashboard";

export const metadata = { title: "Dev preview · Meals" };
export const dynamic = "force-dynamic";

/**
 * Dev-only visual QA for the Meals screens with made-up data (no sign-in,
 * no database). Saves fail here — that's expected; it exists to look at the
 * week, the night / swap / rotation sheets and the recipe box at phone and
 * desktop widths. `?empty=1` shows the first-run state (no rotation);
 * `?tab=recipes|ideas`, `?week=` and `?swap=` work like the real page; `?me=j`
 * views as Jaelynn (a partner) instead of Katelynn (the owner); `?degraded=1`
 * shows the page as it renders after a failed database read.
 */
export default async function DevMealsPage({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string; swap?: string; empty?: string; me?: string; degraded?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { tab, week, swap, empty, me: meParam, degraded } = await searchParams;
  const todayISO = familyTodayISO();
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? weekStartOf(new Date(week + "T00:00:00")) : weekStartOf(new Date(todayISO + "T00:00:00"));
  const K = "katelynn", J = "jaelynn", A = "azaleah", E = "emerick";
  const people = [
    { id: K, name: "Katelynn Zitting", greetingName: "Katelynn", hue: 5, avatarUrl: null, kind: "adult" as const },
    { id: J, name: "Jaelynn Zitting", greetingName: "Jaelynn", hue: 2, avatarUrl: null, kind: "adult" as const },
    { id: A, name: "Azaleah", greetingName: "Azaleah", hue: 3, avatarUrl: null, kind: "child" as const },
    { id: E, name: "Emerick", greetingName: "Emerick", hue: 4, avatarUrl: null, kind: "child" as const },
  ];
  const me = meParam === "j" ? J : K;
  // Mon–Wed set, Thu–Sun still "Nobody": the state the rotation bug was reported in.
  const rotation: RotationDay[] = empty ? [] : [
    { weekday: 1, cookMemberId: K, dishMemberIds: [A] },
    { weekday: 2, cookMemberId: J, dishMemberIds: [] },
    { weekday: 3, cookMemberId: K, dishMemberIds: [E] },
  ];
  const assignments = empty ? [] : [{ date: addDaysISO(weekStart, 2), cookMemberId: J, dishMemberIds: [K], note: "Late meeting", source: "override" }];
  const nights = Array.from({ length: 14 }, (_, i) => cookForDate(addDaysISO(weekStart, i), rotation, assignments));
  const recipes: Recipe[] = empty ? [] : [
    { id: 1, name: "Sheet-pan chicken", ingredients: [{ name: "Chicken thighs", qty: "2 lb" }, { name: "Potatoes", qty: "4" }, { name: "Broccoli" }], notes: "425° for 35 min", servings: 6, prepMinutes: 45, tags: ["weeknight"], sourceUrl: null, lastMadeOn: null, coverUrl: null },
    { id: 2, name: "Tacos", ingredients: [{ name: "Ground beef", qty: "1 lb" }, { name: "Tortillas" }, { name: "Cheese" }], notes: null, servings: 5, prepMinutes: 25, tags: ["kids love it"], sourceUrl: null, lastMadeOn: null, coverUrl: null },
  ];
  const plan: PlanCell[] = empty ? [] : [
    { id: 1, date: addDaysISO(weekStart, 1), slot: "dinner", recipeId: 1, title: null, note: null },
    { id: 2, date: addDaysISO(weekStart, 4), slot: "dinner", recipeId: null, title: "Pizza night", note: null },
  ];
  const swaps: Swap[] = empty ? [] : [{ id: 7, fromMemberId: J, toMemberId: K, fromDate: addDaysISO(weekStart, 9), toDate: addDaysISO(weekStart, 8), status: "pending", message: "Dentist", createdAt: null }];
  const ideas: Idea[] = empty ? [] : [{ id: 1, url: "https://www.tiktok.com/@someone/video/1", platform: "tiktok", title: "One-pot lemon pasta", imageUrl: null, author: "@someone", notes: null, postedBy: J, status: "new", recipeId: null, createdAt: null, reactions: [{ memberId: K, emoji: "heart" }] }];
  return (
    <AppFrame user={{ name: "Preview", role: "owner", person: 1 }}>
      <MealsClient
        configured weekStart={weekStart} prevWeek={addDaysISO(weekStart, -7)} nextWeek={addDaysISO(weekStart, 7)} todayISO={todayISO} localToday={localISO(new Date())}
        initialTab={tab === "recipes" || tab === "ideas" ? tab : "week"} swapDate={swap && /^\d{4}-\d{2}-\d{2}$/.test(swap) ? swap : null} swapId={null}
        recipes={recipes} plan={plan} nights={nights} swaps={swaps} rotation={rotation} ideas={ideas} people={people}
        viewer={{ memberId: me, role: me === K ? "owner" : "partner" }}
        degraded={!!degraded}
      />
    </AppFrame>
  );
}
