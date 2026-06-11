import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getMealsData, addDaysISO, localISO } from "@/db/household";
import { MealsClient } from "./meals-client";

export const metadata = { title: "Meals · Zitting HQ" };
export const dynamic = "force-dynamic";

/** Monday of the week containing `d` (local time). */
function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 = Sun
  x.setDate(x.getDate() - ((day + 6) % 7));
  return localISO(x);
}

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/meals");

  const { week } = await searchParams;
  const todayISO = localISO(new Date());
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? mondayOf(new Date(week + "T00:00:00")) : mondayOf(new Date());
  const data = await getMealsData(weekStart);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(20px, 4vw, 40px) 18px 56px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <MealsClient
            configured={data.configured}
            weekStart={weekStart}
            prevWeek={addDaysISO(weekStart, -7)}
            nextWeek={addDaysISO(weekStart, 7)}
            todayISO={todayISO}
            recipes={data.recipes.map((r) => ({
              id: r.id,
              name: r.name,
              emoji: r.emoji,
              ingredients: r.ingredients || [],
              notes: r.notes,
            }))}
            plan={data.plan.map((m) => ({
              id: m.id,
              date: String(m.date),
              slot: m.slot,
              recipeId: m.recipeId,
              title: m.title,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
