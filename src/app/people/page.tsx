import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getPeople } from "@/db/profiles";
import { listAccountAccess, listHouseholdAccounts, listMembersAdmin, listModuleAccess } from "@/db/permissions";
import { SWITCHABLE_MODULES } from "@/lib/module-access";
import { MODULES } from "@/lib/modules";
import { PeopleClient } from "./people-client";

export const metadata = { title: "People · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/people");
  if (user && user.role !== "owner") redirect("/");
  const { who } = await searchParams;
  const [ctx, people, admin, accounts, access, moduleAccess] = await Promise.all([frameContext(user), getPeople().catch(() => []), listMembersAdmin(), listHouseholdAccounts(), listAccountAccess(), listModuleAccess()]);
  const merged = admin.map((m) => { const p = people.find((x) => x.id === m.id); return { id: m.id, name: m.name, greetingName: p?.greetingName ?? m.name.split(" ")[0], hue: p?.hue ?? 1, avatarUrl: p?.avatarUrl ?? null, kind: p?.kind ?? ("adult" as const), role: m.role, email: m.email, status: m.status, allowance: m.allowance, lastSeenAt: m.lastSeenAt }; }).sort((a, b) => Number(a.role !== "owner") - Number(b.role !== "owner") || Number(a.kind === "child") - Number(b.kind === "child") || a.name.localeCompare(b.name));
  const modules = SWITCHABLE_MODULES.map((slug) => { const m = MODULES.find((x) => x.slug === slug)!; return { slug, name: m.name, icon: m.icon }; });
  return (
    <AppFrame user={ctx}>
      <PeopleClient people={merged} accounts={accounts} access={access} moduleAccess={moduleAccess} modules={modules} me={user?.memberId ?? null} initialId={who && merged.some((m) => m.id === who) ? who : null} />
    </AppFrame>
  );
}
