import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { getGoal, listSavingsGoalOptions } from "@/db/goals";
import { recentPhotos } from "@/db/photos";
import { isModuleEnabled } from "@/lib/modules";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { GoalClient } from "./goal-client";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (isAuthConfigured && !user) redirect(`/login?redirect=/goals/${id}`);
  await guardModule(user, "goals");
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const todayISO = familyTodayISO();
  const goal = await getGoal(id, viewer, todayISO);
  if (!goal) notFound();
  const [people, photos, savings] = await Promise.all([getPeople().catch(() => []), (isModuleEnabled("photos") ? recentPhotos(viewer, 30).catch(() => []) : Promise.resolve([])), viewer.role === "owner" ? listSavingsGoalOptions().catch(() => []) : Promise.resolve([])]);
  return (
    <>
      <GoalClient goal={goal} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} me={user?.memberId ?? null} isOwner={viewer.role === "owner"} todayISO={todayISO} savingsOptions={savings} recentPhotos={photos} photosEnabled={isModuleEnabled("photos")} />
    </>
  );
}
