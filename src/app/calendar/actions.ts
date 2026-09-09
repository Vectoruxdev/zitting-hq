"use server";
/**
 * Calendar & appointments actions. Shared family space: any signed-in member
 * adds events; editing/deleting is for the creator, the people involved, or
 * the owner. Feeds are owner-managed.
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase/server";
import * as h from "@/db/household";
import * as cal from "@/db/calendar";
import { createNotification } from "@/db/mutations";
import { getPeople } from "@/db/profiles";
import { fmtNight } from "@/lib/dates";

async function who() {
  if (!isAuthConfigured) return { memberId: null as string | null, role: "owner" as const, name: "Preview" };
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return { memberId: u.memberId, role: u.role, name: u.name };
}
const refresh = () => { revalidatePath("/calendar"); revalidatePath("/appointments"); revalidatePath("/"); };
const VIS = ["family", "private", "custom"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{1,2}:\d{2}$/;

export async function addCalendarFeed(args: { name: string; url: string; color?: string | null }) { const u = await who(); if (u.role !== "owner") throw new Error("Owner only"); const res = await h.addCalendarFeed(args); refresh(); return res; }
export async function setCalendarFeedEnabled(id: number, enabled: boolean) { const u = await who(); if (u.role !== "owner") throw new Error("Owner only"); const res = await h.setCalendarFeedEnabled(id, enabled); refresh(); return res; }
export async function deleteCalendarFeed(id: number) { const u = await who(); if (u.role !== "owner") throw new Error("Owner only"); const res = await h.deleteCalendarFeed(id); refresh(); return res; }

function clean(input: Omit<cal.EventInput, "createdBy">): { ok: true; value: Omit<cal.EventInput, "createdBy"> } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give it a title" };
  if (!ISO.test(input.date)) return { ok: false, error: "Pick a date" };
  if (input.endDate && (!ISO.test(input.endDate) || input.endDate < input.date)) return { ok: false, error: "The end date is before the start" };
  if (input.time && !TIME.test(input.time)) return { ok: false, error: "Bad time" };
  return { ok: true, value: { ...input, title, kind: input.kind === "appointment" ? "appointment" : "event", visibility: VIS.includes(input.visibility || "") ? input.visibility : "family", reminders: (input.reminders ?? []).filter((m) => Number.isFinite(m) && m >= 0 && m <= 20160).slice(0, 4) } };
}

export async function createEventAction(input: Omit<cal.EventInput, "createdBy">) {
  const u = await who();
  const c = clean(input);
  if (!c.ok) return c;
  const id = await cal.createEvent({ ...c.value, createdBy: u.memberId });
  // Tell the people involved (not the creator).
  const people = await getPeople().catch(() => []);
  const from = people.find((p) => p.id === u.memberId)?.greetingName ?? u.name;
  const involved = new Set([c.value.forMemberId, c.value.driverMemberId].filter((x): x is string => !!x && x !== u.memberId && people.some((p) => p.id === x && p.kind === "adult")));
  for (const m of involved) await createNotification({ type: "shared_with_you", module: "calendar", tone: "info", icon: c.value.kind === "appointment" ? "stethoscope" : "calendar", audience: "member", memberId: m, title: `${from} added ${c.value.title}`, body: `${fmtNight(c.value.date)}${c.value.time ? ` · ${c.value.time}` : ""}${c.value.driverMemberId === m ? " · you're driving" : ""}`, linkTo: `/calendar?event=${id}`, dedupeKey: `event-${id}-${m}` }).catch(() => {});
  refresh();
  return { ok: true as const, id };
}

async function canEdit(id: number) {
  const u = await who();
  const ev = await cal.getEvent(id, { memberId: u.memberId, role: u.role });
  if (!ev) throw new Error("Event not found");
  if (u.role !== "owner" && ev.createdBy !== u.memberId && ev.forMemberId !== u.memberId && ev.driverMemberId !== u.memberId) throw new Error("Not authorized");
  return u;
}

export async function updateEventAction(id: number, input: Partial<Omit<cal.EventInput, "createdBy">>) {
  await canEdit(id);
  if (input.title !== undefined && !input.title.trim()) return { ok: false as const, error: "Give it a title" };
  if (input.date !== undefined && !ISO.test(input.date)) return { ok: false as const, error: "Pick a date" };
  if (input.time && !TIME.test(input.time)) return { ok: false as const, error: "Bad time" };
  if (input.visibility !== undefined && !VIS.includes(input.visibility)) delete input.visibility;
  await cal.updateEvent(id, input);
  refresh();
  return { ok: true as const };
}

export async function deleteEventAction(id: number) { await canEdit(id); await cal.deleteEvent(id); refresh(); return { ok: true as const }; }
export async function deleteFamilyEvent(id: number) { return deleteEventAction(id); }
