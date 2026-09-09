import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { getMealsData, addDaysISO, localISO } from "@/db/household";
import { coverUrl, getNights, listIdeas, listSwaps, getRotation, weekStartOf } from "@/db/kitchen";
import { getPeople } from "@/db/profiles";
import { familyTodayISO } from "@/db/dashboard";
import { MealsClient } from "./meals-client";

export const metadata = { title: "Meals · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ week?: string; tab?: string; swap?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/meals");
  await guardModule(user, "meals");
  const ctx = await frameContext(user);
  const { week, tab, swap } = await searchParams;
  const todayISO = familyTodayISO();
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? weekStartOf(new Date(week + "T00:00:00")) : weekStartOf(new Date(todayISO + "T00:00:00"));
  const [data, nights, swaps, rotation, ideas, people] = await Promise.all([
    getMealsData(weekStart),
    getNights(weekStart, 14).catch(() => []),
    listSwaps("pending").catch(() => []),
    getRotation().catch(() => []),
    listIdeas().catch(() => []),
    getPeople().catch(() => []),
  ]);
  const recipes = await Promise.all(data.recipes.map(async (r) => ({
    id: r.id, name: r.name, ingredients: r.ingredients || [], notes: r.notes, servings: r.servings ?? null, prepMinutes: r.prepMinutes ?? null, tags: r.tags ?? [], sourceUrl: r.sourceUrl ?? null, lastMadeOn: r.lastMadeOn ? String(r.lastMadeOn) : null,
    coverUrl: await coverUrl(r.coverPhotoPath).catch(() => null),
  })));
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <MealsClient
          configured={data.configured}
          weekStart={weekStart} prevWeek={addDaysISO(weekStart, -7)} nextWeek={addDaysISO(weekStart, 7)} todayISO={todayISO}
          initialTab={tab === "recipes" || tab === "ideas" ? tab : "week"} swapDate={swap && /^\d{4}-\d{2}-\d{2}$/.test(swap) ? swap : null} swapId={swap && /^\d+$/.test(swap) ? Number(swap) : null}
          recipes={recipes}
          plan={data.plan.map((m) => ({ id: m.id, date: String(m.date), slot: m.slot, recipeId: m.recipeId, title: m.title, note: m.note }))}
          nights={nights} swaps={swaps} rotation={rotation} ideas={ideas}
          people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))}
          viewer={{ memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" }}
          localToday={localISO(new Date())}
        />
      </Suspense>
    </AppFrame>
  );
}
