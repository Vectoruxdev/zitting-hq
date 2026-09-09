import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { timed } from "@/lib/timing";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { listQuotes } from "@/db/quotes";
import { getPeople } from "@/db/profiles";
import { QuotesClient } from "./quotes-client";

export const metadata = { title: "Quotes · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const user = await timed("/quotes", getCurrentUser());
  if (isAuthConfigured && !user) redirect("/login?redirect=/quotes");
  await guardModule(user, "quotes");
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const [quotes, people] = await Promise.all([listQuotes(viewer), getPeople().catch(() => [])]);
  return (
    <>
      <Suspense fallback={null}>
        <QuotesClient quotes={quotes} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl }))} viewer={viewer} />
      </Suspense>
    </>
  );
}
