import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { getGroceriesData } from "@/db/household";
import { getPeople } from "@/db/profiles";
import { GroceriesClient } from "./groceries-client";

export const metadata = { title: "Groceries · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/groceries");
  await guardModule(user, "groceries");
  const [ctx, data, people] = await Promise.all([frameContext(user), getGroceriesData(), getPeople().catch(() => [])]);
  return (
    <AppFrame user={ctx}>
      <GroceriesClient
        configured={data.configured}
        items={data.items.map((i) => ({ id: i.id, name: i.name, note: i.note, category: i.category, checked: i.checked, source: i.source, assigneeMemberId: i.assigneeMemberId ?? null, requestedBy: i.requestedBy ?? null }))}
        pantry={data.pantry.map((p) => ({ id: p.id, name: p.name, category: p.category, level: p.level, staple: p.staple }))}
        people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl }))}
        me={user?.memberId ?? null}
      />
    </AppFrame>
  );
}
