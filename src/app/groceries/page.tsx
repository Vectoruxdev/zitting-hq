import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getGroceriesData } from "@/db/household";
import { GroceriesClient } from "./groceries-client";

export const metadata = { title: "Groceries · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/groceries");

  const data = await getGroceriesData();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "clamp(20px, 4vw, 40px) 18px 56px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <GroceriesClient
            configured={data.configured}
            items={data.items.map((i) => ({
              id: i.id,
              name: i.name,
              note: i.note,
              category: i.category,
              checked: i.checked,
              source: i.source,
            }))}
            pantry={data.pantry.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              level: p.level,
              staple: p.staple,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
