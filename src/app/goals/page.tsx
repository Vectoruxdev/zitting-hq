import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { listGoals, listSavingsGoalOptions } from "@/db/goals";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { GoalsClient } from "./goals-client";

export const metadata = { title: "Goals · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/goals");
  const { add } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const todayISO = familyTodayISO();
  const [ctx, goals, people, savings] = await Promise.all([frameContext(user), listGoals(viewer, todayISO), getPeople().catch(() => []), viewer.role === "owner" ? listSavingsGoalOptions().catch(() => []) : Promise.resolve([])]);
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <GoalsClient goals={goals} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} me={user?.memberId ?? null} isOwner={viewer.role === "owner"} todayISO={todayISO} savingsOptions={savings} addOpen={add === "1"} />
      </Suspense>
    </AppFrame>
  );
}
