import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { guardModule } from "@/lib/module-access";
import { listAlbums, listPhotos, photoCountsByPerson } from "@/db/photos";
import { getPeople } from "@/db/profiles";
import { familyTodayISO } from "@/db/dashboard";
import { PhotosClient } from "./photos-client";

export const metadata = { title: "Photos · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ tab?: string; person?: string; photo?: string; add?: string; trash?: string }> }) {
  const user = await getCurrentUser();
  if (isAuthConfigured && !user) redirect("/login?redirect=/photos");
  await guardModule(user, "photos");
  const { tab, person, photo, add, trash } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const isTrash = trash === "1" && viewer.role === "owner";
  const [ctx, photos, albums, people, counts] = await Promise.all([
    frameContext(user),
    listPhotos(viewer, { personId: person || null, trash: isTrash, limit: 300 }),
    listAlbums(viewer),
    getPeople().catch(() => []),
    tab === "people" ? photoCountsByPerson(viewer).catch(() => new Map<string, number>()) : Promise.resolve(new Map<string, number>()),
  ]);
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <PhotosClient photos={photos} albums={albums} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl }))} counts={Object.fromEntries(counts)} todayISO={familyTodayISO()} viewer={viewer} initialTab={["recent", "albums", "people", "favorites"].includes(tab || "") ? tab! : "recent"} personId={person || null} openPhotoId={photo || null} addOpen={add === "1"} trash={isTrash} />
      </Suspense>
    </AppFrame>
  );
}
