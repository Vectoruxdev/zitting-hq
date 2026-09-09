/**
 * Phase 6 permissions — who can open which module, and who can see or manage
 * which account. Reads are defensive (pre-migration → everything allowed,
 * every account_members row = manage). The owner is never restricted.
 */
import { and, eq } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { cached } from "@/lib/cache";

export type AccountAccess = "manage" | "view";
export interface AccountAccessRow { accountId: string; memberId: string; access: AccountAccess }

/** Every account ↔ member grant. Pre-migration rows read as `manage`. */
async function listAccountAccess__live(): Promise<AccountAccessRow[]> {
  if (!isDbConfigured || !db) return [];
  const full = await db.select({ accountId: s.accountMembers.accountId, memberId: s.accountMembers.memberId, access: s.accountMembers.access }).from(s.accountMembers).catch(() => null);
  if (full) return full.map((r) => ({ accountId: r.accountId, memberId: r.memberId, access: r.access === "view" ? "view" : "manage" }));
  const legacy = await db.select({ accountId: s.accountMembers.accountId, memberId: s.accountMembers.memberId }).from(s.accountMembers).catch(() => [] as { accountId: string; memberId: string }[]);
  return legacy.map((r) => ({ ...r, access: "manage" as const }));
}

/** Set (or clear with null) one member's access to one account. */
export async function setAccountAccess(accountId: string, memberId: string, access: AccountAccess | null) {
  if (!db) throw new Error("Database not configured");
  await db.delete(s.accountMembers).where(and(eq(s.accountMembers.accountId, accountId), eq(s.accountMembers.memberId, memberId)));
  if (access) await db.insert(s.accountMembers).values({ accountId, memberId, access });
}

/** module slug → allowed, for one member. Missing rows are allowed. */
async function getModuleAccess__live(memberId: string): Promise<Record<string, boolean>> {
  if (!isDbConfigured || !db) return {};
  const rows = await db.select().from(s.memberModuleAccess).where(eq(s.memberModuleAccess.memberId, memberId)).catch(() => [] as (typeof s.memberModuleAccess.$inferSelect)[]);
  return Object.fromEntries(rows.map((r) => [r.module, r.allowed]));
}

async function listModuleAccess__live(): Promise<{ memberId: string; module: string; allowed: boolean }[]> {
  if (!isDbConfigured || !db) return [];
  return db.select().from(s.memberModuleAccess).catch(() => []);
}

export async function setModuleAccess(memberId: string, module: string, allowed: boolean) {
  if (!db) throw new Error("Database not configured");
  await db.insert(s.memberModuleAccess).values({ memberId, module, allowed }).onConflictDoUpdate({ target: [s.memberModuleAccess.memberId, s.memberModuleAccess.module], set: { allowed } });
}

// ── People & permissions page reads ────────────────────────────────────────
export interface MemberAdmin { id: string; name: string; role: "owner" | "partner" | "member"; email: string | null; status: string; allowance: number | null; lastSeenAt: string | null; color: string | null }
export interface HouseholdAccount { id: string; name: string; institution: string; mask: string | null; type: string }

async function listMembersAdmin__live(): Promise<MemberAdmin[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select({ id: s.familyMembers.id, name: s.familyMembers.name, role: s.familyMembers.role, email: s.familyMembers.email, status: s.familyMembers.status, allowance: s.familyMembers.allowance, lastSeenAt: s.familyMembers.lastSeenAt, color: s.familyMembers.color }).from(s.familyMembers).catch(() => [] as { id: string; name: string; role: string; email: string | null; status: string; allowance: string | null; lastSeenAt: Date | null; color: string | null }[]);
  return rows.filter((m) => (m.name ?? "").trim().toLowerCase() !== "household").map((m) => ({ id: m.id, name: m.name, role: (["owner", "partner", "member"].includes(m.role) ? m.role : "member") as MemberAdmin["role"], email: m.email, status: m.status, allowance: m.allowance != null ? Number(m.allowance) : null, lastSeenAt: m.lastSeenAt ? new Date(m.lastSeenAt).toISOString() : null, color: m.color }));
}

/** Household accounts only — business-space accounts never appear in member grants. */
async function listHouseholdAccounts__live(): Promise<HouseholdAccount[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db.select({ id: s.accounts.id, name: s.accounts.name, institution: s.accounts.institution, mask: s.accounts.mask, type: s.accounts.type, space: s.accounts.space, sortOrder: s.accounts.sortOrder }).from(s.accounts).catch(() => [] as { id: string; name: string; institution: string; mask: string | null; type: string; space: string; sortOrder: number }[]);
  return rows.filter((a) => a.space !== "business").sort((a, b) => a.sortOrder - b.sortOrder).map(({ id, name, institution, mask, type }) => ({ id, name, institution, mask, type }));
}

// ---- cached readers (see src/lib/cache.ts) ----
export const getModuleAccess = cached("permissions:getModuleAccess", ["people"], getModuleAccess__live);
export const listModuleAccess = cached("permissions:listModuleAccess", ["people"], listModuleAccess__live);
export const listMembersAdmin = cached("permissions:listMembersAdmin", ["people"], listMembersAdmin__live);
export const listHouseholdAccounts = cached("permissions:listHouseholdAccounts", ["people", "finance"], listHouseholdAccounts__live);
export const listAccountAccess = cached("permissions:listAccountAccess", ["people", "finance"], listAccountAccess__live);
