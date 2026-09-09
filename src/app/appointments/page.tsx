import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { listAppointments } from "@/db/calendar";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { AppointmentsClient } from "./appointments-client";

export const metadata = { title: "Appointments · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/appointments");
  await guardModule(user, "appointments");
  const { event } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const todayISO = familyTodayISO();
  const [ctx, items, people] = await Promise.all([frameContext(user), listAppointments(viewer, todayISO), getPeople().catch(() => [])]);
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <AppointmentsClient items={items} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} todayISO={todayISO} viewer={viewer} openEventId={event && /^\d+$/.test(event) ? Number(event) : null} />
      </Suspense>
    </AppFrame>
  );
}
