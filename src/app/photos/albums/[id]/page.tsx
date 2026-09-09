import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { frameContext } from "@/lib/frame";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getAlbum, listAlbums, listPhotos } from "@/db/photos";
import { getPeople } from "@/db/profiles";
import { familyTodayISO } from "@/db/dashboard";
import { PhotosClient } from "../../photos-client";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ photo?: string; add?: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (isAuthConfigured && !user) redirect(`/login?redirect=/photos/albums/${id}`);
  const { photo, add } = await searchParams;
  const viewer = { memberId: user?.memberId ?? null, role: (user?.role ?? "owner") as "owner" | "partner" | "member" };
  const album = await getAlbum(id, viewer);
  if (!album) notFound();
  const [ctx, photos, albums, people] = await Promise.all([frameContext(user), listPhotos(viewer, { albumId: id, limit: 400 }), listAlbums(viewer), getPeople().catch(() => [])]);
  return (
    <AppFrame user={ctx}>
      <Suspense fallback={null}>
        <PhotosClient photos={photos} albums={albums} album={album} people={people.map((p) => ({ id: p.id, name: p.name, greetingName: p.greetingName, hue: p.hue, avatarUrl: p.avatarUrl }))} counts={{}} todayISO={familyTodayISO()} viewer={viewer} initialTab="recent" personId={null} openPhotoId={photo || null} addOpen={add === "1"} trash={false} />
      </Suspense>
    </AppFrame>
  );
}
