import { notFound } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { CleaningClient } from "@/app/(app)/chores/cleaning-client";
import { CLEANING_TEMPLATES } from "@/db/cleaning-templates";
import { familyTodayISO } from "@/db/dashboard";
import { addDays, weekStart } from "@/lib/cleaning/schedule";
import type { CleaningCompletion, CleaningList, CleaningTask, Handoff } from "@/lib/cleaning/view";

export const metadata = { title: "Dev preview · Cleaning" };
export const dynamic = "force-dynamic";

/**
 * Dev-only visual QA for the Cleaning screens with made-up data (no sign-in,
 * no database). Actions will fail here — that's expected; it exists to look
 * at the layout at phone and desktop widths. `?empty=1` shows the first-run
 * state; `?tab=week|lists` and `?day=` work like the real page.
 */
export default async function DevCleaningPage({ searchParams }: { searchParams: Promise<{ tab?: string; day?: string; empty?: string; me?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { tab, day, empty, me: meParam } = await searchParams;
  const todayISO = familyTodayISO();
  const dayISO = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayISO;
  const sunday = weekStart(todayISO);
  const K = "katelynn", J = "jaelynn", A = "azaleah", E = "emerick";
  const people = [
    { id: K, name: "Katelynn Zitting", greetingName: "Katelynn", hue: 5, avatarUrl: null, kind: "adult" as const },
    { id: J, name: "Jaelynn Zitting", greetingName: "Jaelynn", hue: 2, avatarUrl: null, kind: "adult" as const },
    { id: A, name: "Azaleah", greetingName: "Azaleah", hue: 3, avatarUrl: null, kind: "child" as const },
    { id: E, name: "Emerick", greetingName: "Emerick", hue: 4, avatarUrl: null, kind: "child" as const },
  ];
  const me = meParam === "j" ? J : K;
  const allLists: CleaningList[] = [
    { id: "daily", name: "Daily basics", icon: "sun", tint: "butter", visibility: "family", ownerMemberId: null, remindTime: null, sort: 0, createdBy: K },
    { id: "sat", name: "Saturday deep clean", icon: "sparkles", tint: "mint", visibility: "family", ownerMemberId: null, remindTime: "09:00", sort: 1, createdBy: K },
    { id: "some", name: "Every so often", icon: "calendar-days", tint: "sky", visibility: "family", ownerMemberId: null, remindTime: null, sort: 2, createdBy: J },
    { id: "kat", name: "Katelynn's list", icon: "user", tint: "rose", visibility: "personal", ownerMemberId: K, remindTime: "07:30", sort: 3, createdBy: K },
  ];
  const lists: CleaningList[] = empty ? [] : allLists.filter((l) => l.visibility === "family" || l.ownerMemberId === me);
  const t = (id: string, listId: string, title: string, icon: string, rhythm: CleaningTask["rhythm"], assign: CleaningTask["assign"], extra: Partial<CleaningTask> = {}): CleaningTask => ({ id, listId, title, icon, notes: null, rhythm, assign, timeOfDay: "any", points: 0, needsCheck: false, active: true, sort: 0, createdBy: K, createdOn: addDays(sunday, -14), ...extra });
  const tasks: CleaningTask[] = empty ? [] : [
    t("t1", "daily", "Make the beds", "bed", { type: "daily" }, { mode: "anyone" }, { timeOfDay: "morning" }),
    t("t2", "daily", "Dishes and counters", "utensils", { type: "daily" }, { mode: "anyone" }, { timeOfDay: "evening" }),
    t("t3", "daily", "Sweep the kitchen floor", "sparkles", { type: "daily" }, { mode: "person", memberId: K }),
    t("t4", "daily", "One load of laundry", "wind", { type: "weekly", weekdays: [1, 2, 3, 4, 5] }, { mode: "person", memberId: K }, { timeOfDay: "morning" }),
    t("t5", "daily", "Take the trash out", "trash-2", { type: "weekly", weekdays: [1, 4] }, { mode: "person", memberId: J }, { timeOfDay: "evening" }),
    t("t6", "sat", "Vacuum the whole house", "sparkles", { type: "every_weeks", n: 1, weekday: 6, anchor: sunday }, { mode: "anyone" }),
    t("t7", "sat", "Mop the floors", "droplets", { type: "every_weeks", n: 1, weekday: 6, anchor: sunday }, { mode: "rotation", memberIds: [J, K], anchor: sunday }),
    t("t8", "sat", "Bathrooms: toilets, showers, tubs", "droplets", { type: "every_weeks", n: 1, weekday: 6, anchor: sunday }, { mode: "rotation", memberIds: [K, J], anchor: sunday }),
    t("t9", "sat", "Kids' rooms: floor clear, toys away", "baby", { type: "every_weeks", n: 1, weekday: 6, anchor: sunday }, { mode: "person", memberId: A }, { points: 2, needsCheck: true }),
    t("t10", "some", "AC and furnace filters", "snowflake", { type: "every_weeks", n: 2, weekday: 6, anchor: sunday }, { mode: "rotation", memberIds: [J, K], anchor: sunday }),
    t("t11", "some", "Clean out the fridge", "refrigerator", { type: "monthly", day: 1 }, { mode: "anyone" }),
    t("t12", "some", "Wash the windows", "sun", { type: "monthly", day: 15 }, { mode: "anyone" }),
    t("t13", "some", "Flip the mattresses", "bed", { type: "every_weeks", n: 12, weekday: 6, anchor: addDays(sunday, -7) }, { mode: "anyone" }, { active: false }),
    t("t14", "daily", "Feed the dog", "heart", { type: "daily" }, { mode: "person", memberId: E }, { points: 1 }),
    t("t15", "daily", "Read 20 minutes", "book-open", { type: "daily" }, { mode: "person", memberId: A }, { points: 1, needsCheck: true }),
    ...(lists.some((l) => l.id === "kat") ? [t("t16", "kat", "Water the plants", "leaf", { type: "weekly", weekdays: [1, 4] }, { mode: "person", memberId: K }), t("t17", "kat", "Wipe the front door glass", "sun", { type: "every_weeks", n: 1, weekday: 5, anchor: sunday }, { mode: "person", memberId: K })] : []),
  ];
  const c = (id: number, taskId: string, periodKey: string, memberId: string | null, checked = false): CleaningCompletion => ({ id, taskId, periodKey, memberId, doneAt: `${periodKey.slice(0, 10)}T15:00:00.000Z`, checkedBy: checked ? J : null, checkedAt: checked ? `${periodKey.slice(0, 10)}T16:00:00.000Z` : null });
  const completions: CleaningCompletion[] = empty ? [] : [
    c(1, "t1", todayISO, J), c(2, "t14", todayISO, E), c(3, "t15", todayISO, A),
    c(4, "t3", addDays(todayISO, -1), K), c(5, "t1", addDays(todayISO, -1), K), c(6, "t14", addDays(todayISO, -1), E), c(7, "t15", addDays(todayISO, -1), A, true), c(8, "t14", addDays(todayISO, -2), E), c(9, "t15", addDays(todayISO, -2), A, true),
    c(10, "t6", sunday, J), c(11, "t11", todayISO.slice(0, 7), K),
  ];
  const handoffs: Handoff[] = empty ? [] : [{ taskId: "t8", periodKey: sunday, memberId: J, byMemberId: K }];
  return (
    <AppFrame user={{ name: "Preview", role: "owner", person: 1 }}>
      <CleaningClient lists={lists} tasks={tasks} completions={completions} handoffs={handoffs} people={people} me={me} isAdult todayISO={todayISO} dayISO={dayISO} initialTab={tab === "week" || tab === "lists" ? tab : "today"} templates={CLEANING_TEMPLATES.map((x) => ({ key: x.key, name: x.name, icon: x.icon, body: x.body, count: x.tasks.length }))} />
    </AppFrame>
  );
}
