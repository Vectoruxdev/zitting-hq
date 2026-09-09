/**
 * Which modules a signed-in person may open. The owner sees everything; other
 * members see every module they're eligible for by role, minus the ones the
 * owner switched off in People & permissions. Server-only.
 */
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { modulesFor } from "@/lib/modules";
import { getModuleAccess } from "@/db/permissions";

/** Slugs the owner can switch per person (finance is governed by role, home is always on). */
export const SWITCHABLE_MODULES = ["photos", "meals", "groceries", "calendar", "appointments", "quotes", "goals", "trips", "chores"];

export async function allowedModules(user: CurrentUser | null | undefined): Promise<string[]> {
  const role = user?.role ?? "owner";
  const all = modulesFor(role).map((m) => m.slug);
  if (role === "owner" || !user?.memberId) return all;
  const access: Record<string, boolean> = await getModuleAccess(user.memberId).catch(() => ({} as Record<string, boolean>));
  return all.filter((slug) => access[slug] !== false);
}

/** Call after the sign-in check on a module page; sends anyone without access Home. */
export async function guardModule(user: CurrentUser | null | undefined, slug: string) {
  const allowed = await allowedModules(user);
  if (!allowed.includes(slug)) redirect("/");
}
