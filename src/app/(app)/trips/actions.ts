"use server";
/**
 * Trips actions. Anyone signed in creates trips and adds items; editing the
 * trip itself is for its creator, its participants, or the owner.
 */
import { touched } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import * as t from "@/db/trips";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";
import { familyTodayISO } from "@/db/dashboard";

async function who() {
  if (!isAuthConfigured) return { memberId: null as string | null, role: "owner" as const, name: "Preview" };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return { memberId: u.memberId, role: u.role, name: u.name };
}
const refresh = (id?: string) => { touched(["trips", "calendar"], "/trips"); touched(["trips", "calendar"], "/calendar"); touched(["trips", "calendar"], "/"); if (id) touched(["trips", "calendar"], `/trips/${id}`); };
const VIS = ["family", "private", "custom"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function canEdit(id: string) {
  const u = await who();
  const trip = await t.getTrip(id, { memberId: u.memberId, role: u.role }, familyTodayISO());
  if (!trip) throw new Error("Trip not found");
  if (u.role !== "owner" && trip.createdBy !== u.memberId && !(u.memberId && trip.participants.includes(u.memberId))) throw new Error("Not authorized");
  return { u, trip };
}

export async function createTripAction(input: { name: string; destination?: string | null; startsOn?: string | null; endsOn?: string | null; notes?: string | null; visibility?: string; sharedWith?: string[]; participants?: string[] }) {
  const u = await who();
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Name the trip" };
  if (input.startsOn && !ISO.test(input.startsOn)) return { ok: false as const, error: "Bad start date" };
  if (input.endsOn && (!ISO.test(input.endsOn) || (input.startsOn && input.endsOn < input.startsOn))) return { ok: false as const, error: "The end is before the start" };
  const id = crypto.randomUUID();
  await t.createTrip({ id, name, destination: input.destination, startsOn: input.startsOn, endsOn: input.endsOn, notes: input.notes, createdBy: u.memberId, visibility: VIS.includes(input.visibility || "") ? input.visibility : "family", sharedWith: input.sharedWith, participants: input.participants });
  const people = await getPeople().catch(() => []);
  const from = people.find((p) => p.id === u.memberId)?.greetingName ?? u.name;
  for (const m of (input.participants ?? []).filter((m) => m !== u.memberId && people.some((p) => p.id === m && p.kind === "adult"))) await createNotification({ type: "shared_with_you", module: "trips", tone: "accent", icon: "plane", audience: "member", memberId: m, title: `${from} started planning ${name}`, body: input.startsOn ? `Starts ${input.startsOn}` : undefined, linkTo: `/trips/${id}`, dedupeKey: `trip-${id}-${m}` }).catch(() => {});
  refresh(id);
  return { ok: true as const, id };
}

export async function updateTripAction(id: string, patch: { name?: string; destination?: string | null; startsOn?: string | null; endsOn?: string | null; notes?: string | null; coverPhotoId?: string | null; visibility?: string }, extras?: { sharedWith?: string[]; participants?: string[] }) {
  await canEdit(id);
  const clean: Parameters<typeof t.updateTrip>[1] = {};
  if (patch.name !== undefined) { const n = patch.name.trim(); if (n) clean.name = n; }
  if (patch.destination !== undefined) clean.destination = patch.destination?.trim() || null;
  if (patch.startsOn !== undefined) clean.startsOn = patch.startsOn && ISO.test(patch.startsOn) ? patch.startsOn : null;
  if (patch.endsOn !== undefined) clean.endsOn = patch.endsOn && ISO.test(patch.endsOn) ? patch.endsOn : null;
  if (patch.notes !== undefined) clean.notes = patch.notes?.trim() || null;
  if (patch.coverPhotoId !== undefined) clean.coverPhotoId = patch.coverPhotoId;
  if (patch.visibility !== undefined && VIS.includes(patch.visibility)) clean.visibility = patch.visibility;
  await t.updateTrip(id, clean, { sharedWith: patch.visibility === "custom" ? extras?.sharedWith ?? [] : patch.visibility ? [] : undefined, participants: extras?.participants });
  refresh(id);
  return { ok: true as const };
}

export async function deleteTripAction(id: string) { const { u, trip } = await canEdit(id); if (u.role !== "owner" && trip.createdBy !== u.memberId) throw new Error("Only the person who made the trip can delete it"); await t.deleteTrip(id); refresh(); return { ok: true as const }; }

export async function addTripItemAction(input: { tripId: string; day?: string | null; time?: string | null; title: string; location?: string | null; notes?: string | null; url?: string | null }) {
  await canEdit(input.tripId);
  if (!input.title.trim()) return { ok: false as const, error: "Give it a title" };
  if (input.day && !ISO.test(input.day)) return { ok: false as const, error: "Bad day" };
  const id = await t.addTripItem(input);
  refresh(input.tripId);
  return { ok: true as const, id };
}
export async function updateTripItemAction(tripId: string, id: number, patch: Parameters<typeof t.updateTripItem>[1]) { await canEdit(tripId); await t.updateTripItem(id, patch); refresh(tripId); return { ok: true as const }; }
export async function deleteTripItemAction(tripId: string, id: number) { await canEdit(tripId); await t.deleteTripItem(id); refresh(tripId); return { ok: true as const }; }

const DOC_MAX = 12 * 1024 * 1024;
const DOC_TYPES = /^(application\/pdf|image\/|text\/plain|application\/vnd\.(openxmlformats|ms-excel|ms-powerpoint)|application\/msword)/;
export async function uploadTripDocument(tripId: string, formData: FormData) {
  const { u } = await canEdit(tripId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No file received" };
  if (!DOC_TYPES.test(file.type)) return { ok: false as const, error: "PDFs, images and office documents only" };
  if (file.size > DOC_MAX) return { ok: false as const, error: "File is over the 12MB limit" };
  const admin = getAdminClient();
  if (!admin) return { ok: false as const, error: "Document storage isn't configured on this server" };
  const id = crypto.randomUUID();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `trips/${tripId}/${id}.${ext}`;
  const { error } = await admin.storage.from(t.DOCUMENTS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return { ok: false as const, error: `Upload failed: ${error.message}` };
  await t.addTripDocument({ id, tripId, storagePath: path, name: file.name.slice(0, 120), mime: file.type, sizeBytes: file.size, uploadedBy: u.memberId });
  refresh(tripId);
  return { ok: true as const, id };
}
export async function deleteTripDocumentAction(tripId: string, id: string) { await canEdit(tripId); await t.deleteTripDocument(id); refresh(tripId); return { ok: true as const }; }

export async function addPackingAction(tripId: string, label: string, assigneeMemberId: string | null) { await canEdit(tripId); if (!label.trim()) return { ok: false as const, error: "Type something" }; const id = await t.addPacking(tripId, label, assigneeMemberId); refresh(tripId); return { ok: true as const, id }; }
export async function setPackingAction(tripId: string, id: number, patch: { checked?: boolean; assigneeMemberId?: string | null; label?: string }) { await canEdit(tripId); await t.setPacking(id, patch); refresh(tripId); return { ok: true as const }; }
export async function deletePackingAction(tripId: string, id: number) { await canEdit(tripId); await t.deletePacking(id); refresh(tripId); return { ok: true as const }; }
