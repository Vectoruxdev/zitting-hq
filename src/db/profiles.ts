/**
 * People & profiles — the roster (family_members) joined with the Phase 1
 * profile table. Defensive: a pre-migration DB yields defaults so Home, the
 * frame and /me all render. Avatar images live in the private 'avatars'
 * bucket and are served through short-lived signed URLs.
 */
import { asc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { getAdminClient } from "@/lib/supabase/admin";
import { personIndex } from "@/lib/frame-user";

export type MemberKind = "adult" | "child";
export type ThemePref = "light" | "dark" | "system";

export interface Person {
  id: string;
  name: string;
  /** first name / chosen greeting name */
  greetingName: string;
  role: "owner" | "partner" | "member";
  kind: MemberKind;
  hue: number; // 1..6
  avatarPath: string | null;
  avatarUrl: string | null;
  birthday: string | null;
  theme: ThemePref;
  homeLayout: { order: string[]; hidden: string[] } | null;
  hasLogin: boolean;
}

export const AVATARS_BUCKET = "avatars";

/** Signed URL for an avatar object (1h). Null when storage isn't configured. */
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage.from(AVATARS_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database isn't configured");
  return db;
}

/** Everyone in the household with their profile, roster order. */
async function getPeople__live(): Promise<Person[]> {
  if (!isDbConfigured || !db) return [];
  const members = await db
    .select({ id: s.familyMembers.id, name: s.familyMembers.name, role: s.familyMembers.role, email: s.familyMembers.email, status: s.familyMembers.status })
    .from(s.familyMembers)
    .orderBy(asc(s.familyMembers.createdAt))
    .catch(() => [] as { id: string; name: string; role: string; email: string | null; status: string }[]);
  const profiles = await db.select().from(s.memberProfiles).catch(() => [] as (typeof s.memberProfiles.$inferSelect)[]);
  const byId = new Map(profiles.map((p) => [p.memberId, p]));
  const people: Person[] = [];
  for (const m of members) {
    if ((m.name ?? "").trim().toLowerCase() === "household") continue; // the roster's attribution placeholder, not a person
    const p = byId.get(m.id);
    people.push({
      id: m.id,
      name: m.name,
      greetingName: p?.greetingName || m.name.split(" ")[0],
      role: (m.role as Person["role"]) || "member",
      kind: (p?.kind as MemberKind) || "adult",
      hue: p?.hue && p.hue >= 1 && p.hue <= 6 ? p.hue : personIndex(m.id),
      avatarPath: p?.avatarPath ?? null,
      avatarUrl: await avatarUrl(p?.avatarPath),
      birthday: p?.birthday ? String(p.birthday) : null,
      theme: (p?.theme as ThemePref) || "system",
      homeLayout: p?.homeLayout ?? null,
      hasLogin: !!m.email && m.status !== "none",
    });
  }
  return people;
}

async function getPerson__live(memberId: string | null | undefined): Promise<Person | null> {
  if (!memberId) return null;
  const all = await getPeople();
  return all.find((p) => p.id === memberId) ?? null;
}

export async function upsertProfile(memberId: string, patch: Partial<{ kind: MemberKind; hue: number | null; avatarPath: string | null; birthday: string | null; greetingName: string | null; theme: ThemePref; homeLayout: { order: string[]; hidden: string[] } | null }>) {
  const database = requireDb();
  await database
    .insert(s.memberProfiles)
    .values({ memberId, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({ target: s.memberProfiles.memberId, set: { ...patch, updatedAt: new Date() } });
}

export { MEMBER_NOTIFICATION_EVENTS, type MemberPref } from "@/lib/notification-events";
import { MEMBER_NOTIFICATION_EVENTS } from "@/lib/notification-events";
import type { MemberPref } from "@/lib/notification-events";
import { cached } from "@/lib/cache";

async function getMemberNotificationPrefs__live(memberId: string): Promise<MemberPref[]> {
  if (!isDbConfigured || !db) return MEMBER_NOTIFICATION_EVENTS.map((e) => ({ event: e.key, inApp: true, push: true, email: true }));
  const rows = await db.select().from(s.memberNotificationPrefs).where(eq(s.memberNotificationPrefs.memberId, memberId)).catch(() => [] as (typeof s.memberNotificationPrefs.$inferSelect)[]);
  const byEvent = new Map(rows.map((r) => [r.event, r]));
  return MEMBER_NOTIFICATION_EVENTS.map((e) => { const r = byEvent.get(e.key); return { event: e.key, inApp: r?.inApp ?? true, push: r?.push ?? true, email: r?.email ?? true }; });
}

export async function setMemberNotificationPref(memberId: string, event: string, patch: Partial<Pick<MemberPref, "inApp" | "push" | "email">>) {
  const database = requireDb();
  const current = (await getMemberNotificationPrefs(memberId)).find((p) => p.event === event) || { event, inApp: true, push: true, email: true };
  const next = { ...current, ...patch };
  await database
    .insert(s.memberNotificationPrefs)
    .values({ memberId, event, inApp: next.inApp, push: next.push, email: next.email, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [s.memberNotificationPrefs.memberId, s.memberNotificationPrefs.event], set: { inApp: next.inApp, push: next.push, email: next.email, updatedAt: new Date() } });
}

// ---- cached readers (see src/lib/cache.ts) ----
export const getPeople = cached("profiles:getPeople", ["people"], getPeople__live);
export const getPerson = cached("profiles:getPerson", ["people"], getPerson__live);
export const getMemberNotificationPrefs = cached("profiles:getMemberNotificationPrefs", ["people"], getMemberNotificationPrefs__live);
