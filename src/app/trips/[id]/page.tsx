import { notFound, redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { getTrip } from "@/db/trips";
import { recentPhotos } from "@/db/photos";
import { familyTodayISO } from "@/db/dashboard";
import { getPeople } from "@/db/profiles";
import { TripClient } from "./trip-client";

export const dynamic = "force-dynamic";

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (isAuthConfigured && !user) redirect(`/login?redirect=/trips/${id}`);
  await guardModule(user, "trips");
  const { tab } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const trip = await getTrip(id, viewer, familyTodayISO());
  if (!trip) notFound();
  const [ctx, people, photos] = await Promise.all([frameContext(user), getPeople().catch(() => []), recentPhotos(viewer, 30).catch(() => [])]);
  return (
    <AppFrame user={ctx}>
      <TripClient trip={trip} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl, kind: p.kind }))} me={user?.memberId ?? null} isOwner={viewer.role === "owner"} recentPhotos={photos} initialTab={["plan", "docs", "packing", "people"].includes(tab || "") ? tab! : "plan"} />
    </AppFrame>
  );
}
