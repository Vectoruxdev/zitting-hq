import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { listQuotes } from "@/db/quotes";
import { getPeople } from "@/db/profiles";
import { QuotesClient } from "./quotes-client";

export const metadata = { title: "Quotes · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/quotes");
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const [ctx, quotes, people] = await Promise.all([frameContext(user), listQuotes(viewer), getPeople().catch(() => [])]);
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <QuotesClient quotes={quotes} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl }))} viewer={viewer} />
      </Suspense>
    </AppFrame>
  );
}
