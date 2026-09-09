import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { listTrips } from "@/db/trips";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { TripsClient } from "./trips-client";

export const metadata = { title: "Trips · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/trips");
  await guardModule(user, "trips");
  const { add } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const [trips, people] = await Promise.all([listTrips(viewer, familyTodayISO()), getPeople().catch(() => [])]);
  return (
    <>
      <Suspense fallback={null}>
        <TripsClient trips={trips} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} me={user?.memberId ?? null} addOpen={add === "1"} />
      </Suspense>
    </>
  );
}
