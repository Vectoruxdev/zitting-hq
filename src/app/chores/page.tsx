import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { listChores, listCompletions, weekOf } from "@/db/chores";
import { addDaysISO } from "@/db/household";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { ChoresClient } from "./chores-client";

export const metadata = { title: "Chores · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function ChoresPage({ searchParams }: { searchParams: Promise<{ day?: string; tab?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/chores");
  await guardModule(user, "chores");
  const { day, tab } = await searchParams;
  const todayISO = familyTodayISO();
  const dayISO = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayISO;
  const week = weekOf(dayISO);
  const [ctx, people, chores, completions] = await Promise.all([frameContext(user), getPeople().catch(() => []), listChores({ includeInactive: true }), listCompletions(addDaysISO(week[0], -70), week[6])]);
  const meKind = people.find((p) => p.id === user?.memberId)?.kind ?? "adult";
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <ChoresClient chores={chores} completions={completions} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} me={user?.memberId ?? null} isAdult={(user?.role ?? "owner") === "owner" || meKind === "adult"} todayISO={todayISO} dayISO={dayISO} week={week} initialTab={tab === "chart" || tab === "manage" ? tab : "today"} />
      </Suspense>
    </AppFrame>
  );
}
