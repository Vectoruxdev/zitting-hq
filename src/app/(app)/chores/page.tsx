import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { timed } from "@/lib/timing";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { loadCleaning, visibleLists } from "@/db/cleaning";
import { CLEANING_TEMPLATES } from "@/db/cleaning-templates";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { CleaningClient } from "./cleaning-client";

export const metadata = { title: "Cleaning · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function CleaningPage({ searchParams }: { searchParams: Promise<{ day?: string; tab?: string; new?: string }> }) {
  const user = await timed("/chores", getCurrentUser());
  if (isAuthConfigured && !user) redirect("/login?redirect=/chores");
  await guardModule(user, "chores");
  const { day, tab, new: openNew } = await searchParams;
  const todayISO = familyTodayISO();
  const dayISO = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayISO;
  const [peopleAll, data] = await Promise.all([getPeople().catch(() => []), loadCleaning(todayISO)]);
  const people = peopleAll.filter((p) => p.id !== "household");
  const me = user?.memberId ?? null;
  // Personal lists belong to their owner: nothing from anyone else's leaves the server.
  const lists = visibleLists(data.lists, me);
  const listIds = new Set(lists.map((l) => l.id));
  const tasks = data.tasks.filter((t) => listIds.has(t.listId));
  const taskIds = new Set(tasks.map((t) => t.id));
  const meKind = people.find((p) => p.id === me)?.kind ?? "adult";
  return (
    <Suspense fallback={null}>
      <CleaningClient
        lists={lists} tasks={tasks} completions={data.completions.filter((c) => taskIds.has(c.taskId))} handoffs={data.handoffs.filter((h) => taskIds.has(h.taskId))}
        people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))}
        me={me} isAdult={user?.role === "owner" || meKind === "adult"} todayISO={todayISO} dayISO={dayISO} initialTab={tab === "week" || tab === "lists" ? tab : "today"} openNew={openNew === "1"}
        templates={CLEANING_TEMPLATES.map((t) => ({ key: t.key, name: t.name, icon: t.icon, body: t.body, count: t.tasks.length }))}
      />
    </Suspense>
  );
}
