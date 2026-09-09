"use server";
/**
 * Photos actions. Any signed-in member uploads and tags; editing/deleting a
 * photo is for its uploader or the owner. Visibility follows canView.
 */
import { touched } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import * as ph from "@/db/photos";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";

async function who() {
  if (!isAuthConfigured) return { memberId: null as string | null, role: "owner" as const, name: "Preview" };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authorized");
  return { memberId: u.memberId, role: u.role, name: u.name };
}
const viewerOf = (u: { memberId: string | null; role: "owner" | "partner" | "member" }) => ({ memberId: u.memberId, role: u.role });
const refresh = () => { touched("photos", "/photos"); touched("photos", "/"); };
const VIS = ["family", "private", "custom"];
const MAX = 12 * 1024 * 1024;

export async function uploadPhoto(formData: FormData) {
  const u = await who();
  const full = formData.get("full"), thumb = formData.get("thumb");
  if (!(full instanceof File) || full.size === 0) return { ok: false as const, error: "No image received" };
  if (!full.type.startsWith("image/")) return { ok: false as const, error: "Photos must be images" };
  if (full.size > MAX) return { ok: false as const, error: "Image is over the 12MB limit" };
  const admin = getAdminClient();
  if (!admin) return { ok: false as const, error: "Photo storage isn't configured on this server" };
  const id = crypto.randomUUID();
  const year = new Date().getFullYear();
  const fullPath = `${year}/${id}-full.jpg`, thumbPath = `${year}/${id}-thumb.jpg`;
  const up = await admin.storage.from(ph.PHOTOS_BUCKET).upload(fullPath, await full.arrayBuffer(), { contentType: "image/jpeg", upsert: false });
  if (up.error) return { ok: false as const, error: `Upload failed: ${up.error.message}` };
  let thumbOk = false;
  if (thumb instanceof File && thumb.size > 0) { const t = await admin.storage.from(ph.PHOTOS_BUCKET).upload(thumbPath, await thumb.arrayBuffer(), { contentType: "image/jpeg", upsert: false }); thumbOk = !t.error; }
  const takenAtRaw = String(formData.get("takenAt") || "");
  const takenAt = takenAtRaw ? new Date(takenAtRaw) : null;
  const visibility = VIS.includes(String(formData.get("visibility"))) ? String(formData.get("visibility")) : "family";
  const people = formData.getAll("people").map(String).filter(Boolean);
  const sharedWith = formData.getAll("sharedWith").map(String).filter(Boolean);
  const albumId = String(formData.get("albumId") || "") || null;
  await ph.insertPhoto({ id, storagePath: fullPath, thumbPath: thumbOk ? thumbPath : null, width: Number(formData.get("width")) || null, height: Number(formData.get("height")) || null, takenAt: takenAt && !isNaN(takenAt.getTime()) ? takenAt : null, uploadedBy: u.memberId, caption: String(formData.get("caption") || "").trim().slice(0, 300) || null, visibility, sharedWith, people, albumId });
  // Tell the people it was shared with (custom) — not the whole family for every snap.
  if (visibility === "custom" && sharedWith.length) {
    const roster = await getPeople().catch(() => []);
    const from = roster.find((p) => p.id === u.memberId)?.greetingName ?? u.name;
    for (const m of sharedWith.filter((m) => m !== u.memberId)) await createNotification({ type: "shared_with_you", module: "photos", tone: "accent", icon: "image", audience: "member", memberId: m, title: `${from} shared a photo with you`, linkTo: `/photos?photo=${id}`, dedupeKey: `photo-${id}-${m}` }).catch(() => {});
  }
  refresh();
  const photo = await ph.getPhoto(id, viewerOf(u));
  return { ok: true as const, photo };
}

async function canEditPhoto(id: string) {
  const u = await who();
  const p = await ph.getPhoto(id, viewerOf(u));
  if (!p) throw new Error("Photo not found");
  if (u.role !== "owner" && p.uploadedBy !== u.memberId) throw new Error("Not authorized");
  return u;
}

export async function updatePhotoMeta(id: string, patch: { caption?: string | null; visibility?: string; people?: string[]; sharedWith?: string[]; takenAt?: string | null }) {
  await canEditPhoto(id);
  const clean: Parameters<typeof ph.updatePhoto>[1] = {};
  if (patch.caption !== undefined) clean.caption = patch.caption?.trim().slice(0, 300) || null;
  if (patch.visibility !== undefined && VIS.includes(patch.visibility)) clean.visibility = patch.visibility;
  if (patch.takenAt !== undefined) { const d = patch.takenAt ? new Date(patch.takenAt) : null; clean.takenAt = d && !isNaN(d.getTime()) ? d : null; }
  await ph.updatePhoto(id, clean, { people: patch.people, sharedWith: patch.visibility === "custom" ? patch.sharedWith ?? [] : patch.visibility ? [] : undefined });
  refresh();
  return { ok: true as const };
}

export async function favoritePhoto(id: string) {
  const u = await who();
  if (!u.memberId) return { ok: false as const, error: "Your login isn't linked to a family member yet" };
  const on = await ph.toggleFavorite(id, u.memberId);
  refresh();
  return { ok: true as const, on };
}

export async function trashPhoto(id: string) { await canEditPhoto(id); await ph.softDeletePhoto(id); refresh(); return { ok: true as const }; }
export async function restorePhoto(id: string) { await canEditPhoto(id); await ph.softDeletePhoto(id, true); refresh(); return { ok: true as const }; }
export async function purgeTrashAction() { const u = await who(); if (u.role !== "owner") throw new Error("Owner only"); const n = await ph.purgeTrash(30); refresh(); return { ok: true as const, purged: n }; }

export async function createAlbumAction(input: { name: string; description?: string | null; visibility?: string; sharedWith?: string[] }) {
  const u = await who();
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Give the album a name" };
  const id = crypto.randomUUID();
  await ph.createAlbum({ id, name, description: input.description, createdBy: u.memberId, visibility: VIS.includes(input.visibility || "") ? input.visibility : "family", sharedWith: input.sharedWith });
  refresh();
  return { ok: true as const, id };
}
export async function updateAlbumAction(id: string, patch: { name?: string; description?: string | null; coverPhotoId?: string | null; visibility?: string }, sharedWith?: string[]) {
  const u = await who();
  const a = await ph.getAlbum(id, viewerOf(u));
  if (!a) throw new Error("Album not found");
  if (u.role !== "owner" && a.createdBy !== u.memberId) throw new Error("Not authorized");
  const clean: Parameters<typeof ph.updateAlbum>[1] = {};
  if (patch.name !== undefined) { const n = patch.name.trim(); if (n) clean.name = n; }
  if (patch.description !== undefined) clean.description = patch.description?.trim() || null;
  if (patch.coverPhotoId !== undefined) clean.coverPhotoId = patch.coverPhotoId;
  if (patch.visibility !== undefined && VIS.includes(patch.visibility)) clean.visibility = patch.visibility;
  await ph.updateAlbum(id, clean, patch.visibility === "custom" ? sharedWith ?? [] : patch.visibility ? [] : undefined);
  refresh(); touched("photos", `/photos/albums/${id}`);
  return { ok: true as const };
}
export async function deleteAlbumAction(id: string) { const u = await who(); const a = await ph.getAlbum(id, viewerOf(u)); if (!a) throw new Error("Album not found"); if (u.role !== "owner" && a.createdBy !== u.memberId) throw new Error("Not authorized"); await ph.deleteAlbum(id); refresh(); return { ok: true as const }; }
export async function addPhotosToAlbum(albumId: string, photoIds: string[]) { await who(); await ph.addToAlbum(albumId, photoIds.slice(0, 200)); refresh(); touched("photos", `/photos/albums/${albumId}`); return { ok: true as const }; }
export async function removePhotoFromAlbum(albumId: string, photoId: string) { await who(); await ph.removeFromAlbum(albumId, photoId); refresh(); touched("photos", `/photos/albums/${albumId}`); return { ok: true as const }; }
export async function attachPhoto(entityType: string, entityId: string, photoId: string) { await who(); await ph.attach(entityType, entityId, photoId); refresh(); return { ok: true as const }; }
export async function detachPhoto(entityType: string, entityId: string, photoId: string) { await who(); await ph.detach(entityType, entityId, photoId); refresh(); return { ok: true as const }; }
