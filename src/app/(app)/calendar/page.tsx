import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { getCalendar } from "@/db/calendar";
import { addDaysISO } from "@/db/household";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ event?: string; date?: string; view?: string; feeds?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/calendar");
  await guardModule(user, "calendar");
  const { event, date, view, feeds } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const todayISO = familyTodayISO();
  // Agenda covers the next 30 days; week/month views need the surrounding range too.
  const fromISO = addDaysISO(todayISO, -31), toISO = addDaysISO(todayISO, 62);
  const [cal, people] = await Promise.all([getCalendar(viewer, fromISO, toISO), getPeople().catch(() => [])]);
  return (
    <>
      <Suspense fallback={null}>
        <CalendarClient configured={cal.configured} items={cal.items} feeds={cal.feeds} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} todayISO={todayISO} fromISO={todayISO} toISO={addDaysISO(todayISO, 30)} viewer={viewer} viewerKind={people.find((p) => p.id === user?.memberId)?.kind ?? "adult"} initialFeedsOpen={feeds === "1"} openEventId={event && /^\d+$/.test(event) ? Number(event) : null} initialDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null} initialView={view === "week" || view === "month" ? view : "agenda"} />
      </Suspense>
    </>
  );
}
