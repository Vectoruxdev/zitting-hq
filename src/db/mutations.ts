/**
 * Finance write layer (Drizzle). All multi-statement writes run inside
 * db.transaction (serialized, pooler-safe). Every write that changes a FK
 * backfills the legacy label columns so the label-based UI keeps rendering.
 *
 * These are plain async functions; the "use server" boundary + auth checks
 * live in src/app/finance/actions.ts.
 */
import { and, eq, inArray, or, isNull, lt } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { computeMemberProgress } from "./allowance";
import { channelsFor, mergePrefs } from "./notifyPrefs";
import { findExactDuplicates } from "./dedupe";
import { dedupeKey, markDuplicates, extractMerchant, exactMerchantKey, scoreCategory, REVIEW_THRESHOLD, type MemoryMap, type RuleLike } from "./categorize";
import { matchTransfers } from "./transfers";
import { generateInstances, reconcileInstances } from "./allocate";
import { firstRunOnOrAfter, nextOccurrence, dueRuns, type Cadence } from "./schedule";
import { UNCATEGORIZED_ID } from "./seedCategories";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function requireDb() {
  if (!db) throw new Error("Database not configured");
  return db;
}

// ---- lookups (small, sequential) ----
async function catMap() {
  const rows = await requireDb().select().from(s.categories);
  return new Map(rows.map((c) => [c.id, c]));
}
async function memberMap() {
  const rows = await requireDb().select().from(s.familyMembers);
  return new Map(rows.map((m) => [m.id, m]));
}
async function accountLabel(accountId: string | null | undefined): Promise<string | null> {
  if (!accountId) return null;
  const [a] = await requireDb().select().from(s.accounts).where(eq(s.accounts.id, accountId));
  if (!a) return null;
  return a.mask ? `${a.name} ••${a.mask}` : a.name;
}

// ---- categorization engine inputs ----
async function loadRules(): Promise<RuleLike[]> {
  const rows = await requireDb().select().from(s.categorizationRules);
  return rows as unknown as RuleLike[];
}
async function loadMemory(): Promise<MemoryMap> {
  const rows = await requireDb().select().from(s.merchantMemory);
  const map: MemoryMap = new Map();
  for (const r of rows) {
    if (!r.categoryId) continue;
    const arr = map.get(r.merchantKey) || [];
    arr.push({
      categoryId: r.categoryId,
      count: r.count,
      member: r.member,
      lastSeen: r.updatedAt ? new Date(r.updatedAt).getTime() : undefined,
    });
    map.set(r.merchantKey, arr);
  }
  return map;
}

/** categoryId → kind ("income" | "expense" | "transfer") — the sign guard. */
async function kindMap(): Promise<Map<string, string>> {
  const rows = await requireDb().select({ id: s.categories.id, kind: s.categories.kind }).from(s.categories);
  return new Map(rows.map((c) => [c.id, c.kind]));
}

/** Increment learned memory for a merchant key → category (the learning loop). */
export async function learnMerchant(merchantKey: string, categoryId: string, member?: string | null, delta = 1) {
  if (!merchantKey || !categoryId || categoryId === UNCATEGORIZED_ID) return;
  const database = requireDb();
  const [existing] = await database
    .select()
    .from(s.merchantMemory)
    .where(and(eq(s.merchantMemory.merchantKey, merchantKey), eq(s.merchantMemory.categoryId, categoryId)));
  if (existing) {
    await database
      .update(s.merchantMemory)
      .set({ count: existing.count + delta, member: member ?? existing.member, updatedAt: new Date() })
      .where(eq(s.merchantMemory.id, existing.id));
  } else {
    await database.insert(s.merchantMemory).values({ merchantKey, categoryId, member: member ?? null, count: delta });
  }
}

/** Decrement learned memory for a merchant key → category; delete the row when
 *  it drops to zero. Used for NEGATIVE learning — when the user corrects an
 *  auto-suggested category, the wrong one fades so it stops being suggested. */
async function penalizeMerchant(merchantKey: string, categoryId: string, delta = 1) {
  if (!merchantKey || !categoryId) return;
  const database = requireDb();
  const [existing] = await database
    .select()
    .from(s.merchantMemory)
    .where(and(eq(s.merchantMemory.merchantKey, merchantKey), eq(s.merchantMemory.categoryId, categoryId)));
  if (!existing) return;
  const next = existing.count - delta;
  if (next <= 0) {
    await database.delete(s.merchantMemory).where(eq(s.merchantMemory.id, existing.id));
  } else {
    await database.update(s.merchantMemory).set({ count: next, updatedAt: new Date() }).where(eq(s.merchantMemory.id, existing.id));
  }
}

/** Learn a category from a full transaction description — reinforces BOTH the
 *  broad token key and the precise exact key, so future variants and exact
 *  repeats both benefit. */
export async function learnTxn(desc: string, categoryId: string, member?: string | null, delta = 1) {
  if (!desc) return;
  await learnMerchant(extractMerchant(desc), categoryId, member, delta);
  await learnMerchant(exactMerchantKey(desc), categoryId, member, delta);
}
/** Negative learning for a correction — fade the wrong category on both keys. */
async function penalizeTxn(desc: string, categoryId: string, delta = 1) {
  if (!desc) return;
  await penalizeMerchant(extractMerchant(desc), categoryId, delta);
  await penalizeMerchant(exactMerchantKey(desc), categoryId, delta);
}

/** All memory rows whose key is the given token key OR a precise "x:" key
 *  derived from it (so owner-facing "forget/relabel" hits both tiers). */
async function memoryRowsForKey(tokenKey: string) {
  const rows = await requireDb().select().from(s.merchantMemory);
  const exactPrefix = "x:" + tokenKey;
  return rows.filter((r) => r.merchantKey === tokenKey || r.merchantKey.startsWith(exactPrefix));
}

/** Forget everything learned for a merchant (both key tiers). */
export async function forgetMerchant(tokenKey: string) {
  if (!tokenKey) return { ok: true as const };
  const database = requireDb();
  const rows = await memoryRowsForKey(tokenKey);
  const ids = rows.map((r) => r.id);
  if (ids.length) await database.delete(s.merchantMemory).where(inArray(s.merchantMemory.id, ids));
  return { ok: true as const, removed: ids.length };
}

/** Authoritatively set what a merchant is learned as: clear its prior memory,
 *  then seed a confident entry so the engine uses it from now on. */
export async function setMerchantCategory(tokenKey: string, categoryId: string, member?: string | null) {
  if (!tokenKey || !categoryId) return { ok: true as const };
  await forgetMerchant(tokenKey);
  // Seed both tiers with a solid count so it wins immediately.
  await learnMerchant(tokenKey, categoryId, member ?? null, 5);
  await learnMerchant("x:" + tokenKey, categoryId, member ?? null, 5);
  return { ok: true as const };
}

/** Suggest categories for a batch of rows (used by import + Plaid sync). */
export async function suggestCategories(
  rows: { merchant: string; amount: number; accountId?: string | null; type?: string | null; isTransfer?: boolean }[]
) {
  const rules = await loadRules();
  const memory = await loadMemory();
  const catKind = await kindMap();
  const now = Date.now();
  return rows.map((r) => scoreCategory(r, { rules, memory, catKind, now }));
}

// ====================================================================
// Family members (people)
// ====================================================================
export async function createMember(args: {
  name: string;
  role?: string;
  email?: string | null;
  color?: string | null;
  status?: string;
  authId?: string | null;
}) {
  const id = crypto.randomUUID();
  await requireDb().insert(s.familyMembers).values({
    id,
    name: args.name,
    role: args.role || "member",
    email: args.email ?? null,
    color: args.color ?? null,
    status: args.status || "none",
    authId: args.authId ?? null,
  });
  return { ok: true as const, id };
}

export async function updateMember(
  id: string,
  patch: { name?: string; role?: string; email?: string | null; color?: string | null; status?: string; authId?: string | null }
) {
  const database = requireDb();
  await database.update(s.familyMembers).set(patch).where(eq(s.familyMembers.id, id));
  // keep denormalized txn "who" label in sync on rename
  if (patch.name !== undefined) {
    await database.update(s.transactions).set({ who: patch.name }).where(eq(s.transactions.memberId, id));
  }
  return { ok: true as const };
}

/** Remove a member: detach their transactions, then delete. Returns authId for cleanup. */
export async function removeMember(id: string) {
  const database = requireDb();
  const [member] = await database.select().from(s.familyMembers).where(eq(s.familyMembers.id, id));
  await database.transaction(async (tx) => {
    await tx.update(s.transactions).set({ memberId: null, who: "Household" }).where(eq(s.transactions.memberId, id));
    await tx.delete(s.familyMembers).where(eq(s.familyMembers.id, id));
  });
  return { ok: true as const, authId: member?.authId ?? null };
}

// ====================================================================
// Accounts
// ====================================================================
export async function createAccount(args: {
  name: string;
  institution?: string;
  type: string; // checking | savings | credit
  mask?: string | null;
  who?: string;
}) {
  const id = crypto.randomUUID();
  await requireDb().insert(s.accounts).values({
    id,
    name: args.name,
    institution: args.institution || "",
    type: args.type,
    mask: args.mask || null,
    who: args.who || "Household",
  });
  return { ok: true as const, id };
}

export async function updateAccount(
  id: string,
  patch: { name?: string; institution?: string; type?: string; mask?: string | null; who?: string; destLabel?: string | null; balance?: number }
) {
  // `balance` is the OPENING balance (numeric column stored as string).
  const { balance, ...rest } = patch;
  const values: Record<string, unknown> = { ...rest };
  if (balance !== undefined && Number.isFinite(balance)) values.balance = String(balance);
  if (Object.keys(values).length) {
    await requireDb().update(s.accounts).set(values).where(eq(s.accounts.id, id));
  }
  return { ok: true as const };
}

export async function deleteAccount(id: string) {
  const database = requireDb();
  await database.transaction(async (tx) => {
    await tx.delete(s.transactions).where(eq(s.transactions.accountId, id));
    await tx.delete(s.importBatches).where(eq(s.importBatches.accountId, id));
    await tx.delete(s.accountMembers).where(eq(s.accountMembers.accountId, id));
    await tx.delete(s.accounts).where(eq(s.accounts.id, id));
  });
  return { ok: true as const };
}

/** Move an account between the household and a separate space (e.g. business).
 *  "business" accounts are hidden from the household view + skipped by sync. */
export async function setAccountSpace(id: string, space: "household" | "business") {
  await requireDb().update(s.accounts).set({ space }).where(eq(s.accounts.id, id));
  return { ok: true as const };
}

// ---- member ↔ account assignment + allowance ----

/** Accounts a member is "in charge of". Fail-closed (empty set) on any error. */
export async function managedAccountIds(memberId: string): Promise<Set<string>> {
  try {
    const rows = await requireDb()
      .select({ accountId: s.accountMembers.accountId })
      .from(s.accountMembers)
      .where(eq(s.accountMembers.memberId, memberId));
    return new Set(rows.map((r) => r.accountId));
  } catch {
    return new Set();
  }
}

/** Accounts touched by a set of transaction ids (null accountId → "__none__"
 *  sentinel so a member can never be authorized for an unowned/legacy row). */
export async function accountIdsForTxns(ids: number[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await requireDb()
    .select({ accountId: s.transactions.accountId })
    .from(s.transactions)
    .where(inArray(s.transactions.id, ids));
  return new Set(rows.map((r) => r.accountId ?? "__none__"));
}

/** Replace the set of members in charge of an account (≤2, deduped). */
export async function setAccountMembers(accountId: string, memberIds: string[]) {
  const database = requireDb();
  const unique = Array.from(new Set(memberIds)).slice(0, 2);
  await database.transaction(async (tx) => {
    await tx.delete(s.accountMembers).where(eq(s.accountMembers.accountId, accountId));
    if (unique.length) await tx.insert(s.accountMembers).values(unique.map((memberId) => ({ accountId, memberId })));
  });
  return { ok: true as const };
}

/** Set (or clear) a member's fixed monthly allowance. */
export async function setMemberAllowance(memberId: string, amount: number | null) {
  const value = amount == null || !Number.isFinite(amount) ? null : String(amount);
  await requireDb().update(s.familyMembers).set({ allowance: value }).where(eq(s.familyMembers.id, memberId));
  return { ok: true as const };
}

/** Record that a member just opened the app. Throttled (only writes if the last
 *  stamp is missing or older than ~10 min) and defensive (no-op pre-migration),
 *  so it's cheap to call on every authenticated load. */
export async function touchMemberLastSeen(memberId: string | null | undefined) {
  if (!memberId || !db) return;
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    await db
      .update(s.familyMembers)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(s.familyMembers.id, memberId), or(isNull(s.familyMembers.lastSeenAt), lt(s.familyMembers.lastSeenAt, cutoff))));
  } catch {
    /* column not migrated yet — ignore */
  }
}

// ====================================================================
// Import
// ====================================================================
export interface ImportRow {
  date: string; // YYYY-MM-DD
  merchant: string;
  description?: string | null; // full raw bank text, when richer than `merchant`
  amount: number; // signed
  income?: boolean;
  categoryId?: string | null;
  memberId?: string | null;
  isTransfer?: boolean;
  externalId?: string | null;
  categorySource?: string | null; // engine source, or "manual" if user overrode
  categoryConfidence?: number | null;
}

export async function commitImport(args: {
  accountId: string;
  filename?: string | null;
  createdBy?: string | null;
  accountBalance?: number | null; // latest running balance from the CSV
  source?: "csv" | "plaid"; // how the rows arrived (default csv)
  rows: ImportRow[];
}) {
  const database = requireDb();
  const cats = await catMap();
  const members = await memberMap();
  const acctLabel = await accountLabel(args.accountId);

  // How many of each dedupe hash ALREADY exist in this account, then apply the
  // shared multiset-aware dedup (re-imports and overlapping date ranges skip
  // exactly what's already stored; existing records are kept). The server is
  // authoritative — even if the client preview is stale or a duplicate row was
  // force-included, this is where the final decision is made.
  const existingRows = await database
    .select({ h: s.transactions.dedupeHash })
    .from(s.transactions)
    .where(eq(s.transactions.accountId, args.accountId));
  const existingCounts = new Map<string, number>();
  for (const r of existingRows) {
    if (r.h) existingCounts.set(r.h, (existingCounts.get(r.h) || 0) + 1);
  }
  const keyed = args.rows.map((r) => ({
    row: r,
    dedupeKey: dedupeKey({ externalId: r.externalId, date: r.date, amount: r.amount, merchant: r.merchant, accountId: args.accountId }),
  }));
  const decided = markDuplicates(keyed, existingCounts);

  const batchId = crypto.randomUUID();
  const inserts: (typeof s.transactions.$inferInsert)[] = [];
  const learnQueue: { merchant: string; categoryId: string; member: string | null }[] = [];
  let skipped = 0;

  for (const d of decided) {
    if (d.duplicate) {
      skipped++;
      continue;
    }
    const r = d.row.row;
    const key = d.row.dedupeKey;
    const cat = r.categoryId ? cats.get(r.categoryId) : undefined;
    const mem = r.memberId ? members.get(r.memberId) : undefined;
    const conf = r.categoryConfidence ?? null;
    const reviewed = r.categorySource === "manual" ? true : (conf ?? 0) >= REVIEW_THRESHOLD;
    if (r.categorySource === "manual" && r.categoryId && r.categoryId !== UNCATEGORIZED_ID) {
      learnQueue.push({ merchant: r.merchant, categoryId: r.categoryId, member: mem?.id ?? r.memberId ?? null });
    }
    inserts.push({
      date: r.date,
      accountId: args.accountId,
      categoryId: r.categoryId ?? null,
      memberId: r.memberId ?? null,
      importBatchId: batchId,
      isTransfer: Boolean(r.isTransfer),
      dedupeHash: key,
      merchant: r.merchant,
      description: r.description ?? null,
      amount: String(r.amount),
      income: r.income ?? r.amount > 0,
      categorySource: r.categorySource ?? null,
      categoryConfidence: conf != null ? String(conf) : null,
      reviewed,
      // backfilled labels
      dateLabel: dateLabel(r.date),
      category: cat?.name ?? null,
      color: cat?.color ?? null,
      who: mem?.name ?? null,
      accountLabel: acctLabel,
    });
  }

  await database.transaction(async (tx) => {
    await tx.insert(s.importBatches).values({
      id: batchId,
      accountId: args.accountId,
      filename: args.filename ?? null,
      rowsTotal: args.rows.length,
      rowsImported: inserts.length,
      rowsSkipped: skipped,
      source: args.source ?? "csv",
      createdBy: args.createdBy ?? null,
    });
    // onConflictDoNothing: once the unique (account_id, dedupe_hash) index exists
    // (supabase-dedupe-transactions.sql), this makes inserts idempotent at the DB
    // level — so even two syncs racing on the same Plaid txn can't double-insert.
    // No-op (plain insert) until that index is added, so it's safe to ship now.
    if (inserts.length) await tx.insert(s.transactions).values(inserts).onConflictDoNothing();
  });

  // Learn from rows the user explicitly categorized during import.
  for (const l of learnQueue) await learnTxn(l.merchant, l.categoryId, l.member);

  // `accounts.balance` is the OPENING balance; the displayed balance is
  // opening + the net of all the account's transactions (see getFinanceData).
  // The CSV gives the latest RUNNING balance, so back out the transaction net
  // and store opening such that (opening + net) reconciles to the bank figure.
  if (args.accountBalance != null && Number.isFinite(args.accountBalance)) {
    const balRows = await database
      .select({ a: s.transactions.amount })
      .from(s.transactions)
      .where(eq(s.transactions.accountId, args.accountId));
    const net = balRows.reduce((sum, r) => sum + Number(r.a ?? 0), 0);
    const opening = args.accountBalance - net;
    await database.update(s.accounts).set({ balance: String(opening) }).where(eq(s.accounts.id, args.accountId));
  }

  // Link the new rows to any matching opposite leg in another account, so
  // internal transfers (checking↔savings, card payments) are flagged and never
  // double-counted. Runs after the insert commits so it sees the full picture.
  const linked = await autoLinkTransfers();

  // Generate pending transfers from any genuine income just imported (run the
  // allocation waterfall per income txn), then auto-complete any pending
  // transfers whose real transaction just landed.
  let generated = 0;
  const incomeRows = await database
    .select({ id: s.transactions.id })
    .from(s.transactions)
    .where(
      and(
        eq(s.transactions.importBatchId, batchId),
        eq(s.transactions.income, true),
        eq(s.transactions.isTransfer, false)
      )
    );
  for (const row of incomeRows) {
    const g = await generateTransfersForIncome(row.id);
    generated += g.created;
  }
  const reconciled = await reconcilePendingTransfers();

  return {
    ok: true as const,
    batchId,
    imported: inserts.length,
    skipped,
    linkedTransfers: linked.linked,
    generatedTransfers: generated,
    reconciledTransfers: reconciled.matched,
    // Lightweight summary of what actually landed (post-dedup) — lets callers
    // (e.g. Plaid sync) build notifications without re-querying.
    insertedRows: inserts.map((i) => ({
      merchant: i.merchant,
      amount: Number(i.amount),
      date: i.date ?? null,
      externalId: i.dedupeHash ?? null,
      isTransfer: Boolean(i.isTransfer),
      income: Boolean(i.income),
    })),
  };
}

export async function deleteImport(batchId: string) {
  const database = requireDb();
  await database.transaction(async (tx) => {
    await tx.delete(s.transactions).where(eq(s.transactions.importBatchId, batchId));
    await tx.delete(s.importBatches).where(eq(s.importBatches.id, batchId));
  });
  return { ok: true as const };
}

/**
 * Find (and optionally remove) exact-duplicate transactions — rows that share
 * the same account AND dedupe key, which the ingestion dedup should have
 * collapsed but didn't (e.g. two syncs racing on the same Plaid transaction).
 * Keeps the earliest; safe to run anytime (never touches legit lookalikes).
 */
export async function dedupeTransactions(opts?: { apply?: boolean }) {
  const database = requireDb();
  const rows = await database
    .select({ id: s.transactions.id, accountId: s.transactions.accountId, dedupeHash: s.transactions.dedupeHash })
    .from(s.transactions);
  const { removeIds, groups } = findExactDuplicates(rows);
  let removed = 0;
  if (opts?.apply && removeIds.length) {
    await database.transaction(async (tx) => {
      await tx.delete(s.transactionSplits).where(inArray(s.transactionSplits.transactionId, removeIds));
      await tx.delete(s.transactions).where(inArray(s.transactions.id, removeIds));
    });
    removed = removeIds.length;
  }
  return { ok: true as const, duplicates: removeIds.length, groups, removed };
}

/** How many transactions ALREADY exist in this account for each dedupe hash.
 *  Returns a count map so the import preview can match the same multiset-aware
 *  logic the server uses (re-imports and overlapping date ranges skip exactly
 *  the rows that already exist, keeping what's in the system). */
export async function findExistingHashes(accountId: string, hashes: string[]): Promise<Record<string, number>> {
  if (!accountId || !hashes.length) return {};
  const unique = Array.from(new Set(hashes));
  const rows = await requireDb()
    .select({ h: s.transactions.dedupeHash })
    .from(s.transactions)
    .where(and(eq(s.transactions.accountId, accountId), inArray(s.transactions.dedupeHash, unique)));
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (r.h) counts[r.h] = (counts[r.h] || 0) + 1;
  }
  return counts;
}

// ---- column-mapping templates ----
export async function listColumnTemplates(accountId?: string | null) {
  const rows = await requireDb().select().from(s.columnMappingTemplates);
  return accountId ? rows.filter((r) => r.accountId === accountId || !r.accountId) : rows;
}
export async function saveColumnTemplate(args: {
  accountId?: string | null;
  bank?: string | null;
  name: string;
  mapping: Record<string, unknown>;
}) {
  await requireDb().insert(s.columnMappingTemplates).values({
    accountId: args.accountId ?? null,
    bank: args.bank ?? null,
    name: args.name,
    mapping: args.mapping,
  });
  return { ok: true as const };
}

// ====================================================================
// Transaction edits
// ====================================================================
export interface TxnPatch {
  categoryId?: string | null;
  memberId?: string | null;
  isTransfer?: boolean;
  transferPairId?: number | null;
  flagged?: boolean;
  reviewed?: boolean;
  notes?: string | null;
}

async function buildPatchValues(patch: TxnPatch, opts?: { categorizedBy?: string | null }) {
  const values: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) {
    values.categoryId = patch.categoryId;
    const cats = await catMap();
    const c = patch.categoryId ? cats.get(patch.categoryId) : undefined;
    values.category = c?.name ?? null;
    values.color = c?.color ?? null;
    // A manual category set counts as reviewed + a confident, user-sourced choice.
    values.categorySource = "manual";
    values.categoryConfidence = "1.000";
    values.reviewed = true;
    // Tag who deliberately set the category, and when. `categorizedBy` may be
    // null (e.g. owner not in the roster, or local dev with auth off) — we still
    // record the timestamp so the drawer can show "categorized just now".
    if (opts && "categorizedBy" in opts) {
      values.categorizedBy = opts.categorizedBy ?? null;
      values.categorizedAt = new Date();
    }
  }
  if (patch.memberId !== undefined) {
    values.memberId = patch.memberId;
    const members = await memberMap();
    values.who = patch.memberId ? members.get(patch.memberId)?.name ?? null : null;
  }
  if (patch.isTransfer !== undefined) values.isTransfer = patch.isTransfer;
  if (patch.transferPairId !== undefined) values.transferPairId = patch.transferPairId;
  if (patch.flagged !== undefined) values.flagged = patch.flagged;
  if (patch.reviewed !== undefined) values.reviewed = patch.reviewed;
  if (patch.notes !== undefined) values.notes = patch.notes;
  return values;
}

export async function updateTransaction(id: number, patch: TxnPatch, opts?: { learn?: boolean; categorizedBy?: string | null }) {
  const database = requireDb();
  // Capture the row BEFORE the update so we know the category being replaced
  // (for negative learning) and the merchant string.
  const [before] = await database.select().from(s.transactions).where(eq(s.transactions.id, id));
  const values = await buildPatchValues(patch, opts);
  if (Object.keys(values).length) {
    await database.update(s.transactions).set(values).where(eq(s.transactions.id, id));
  }
  // Learning loop: reinforce the chosen category and fade the one it replaced.
  if (opts?.learn && patch.categoryId && before?.merchant) {
    const oldCat = before.categoryId;
    if (oldCat && oldCat !== patch.categoryId && oldCat !== UNCATEGORIZED_ID) {
      await penalizeTxn(before.merchant, oldCat);
    }
    await learnTxn(before.merchant, patch.categoryId, patch.memberId ?? before.memberId ?? null);
  }
  return { ok: true as const };
}

export async function bulkUpdateTransactions(ids: number[], patch: TxnPatch, opts?: { learn?: boolean; categorizedBy?: string | null }) {
  if (!ids.length) return { ok: true as const };
  const database = requireDb();
  const before = opts?.learn && patch.categoryId
    ? await database.select().from(s.transactions).where(inArray(s.transactions.id, ids))
    : [];
  const values = await buildPatchValues(patch, opts);
  if (Object.keys(values).length) {
    await database.update(s.transactions).set(values).where(inArray(s.transactions.id, ids));
  }
  if (opts?.learn && patch.categoryId) {
    for (const row of before) {
      if (!row.merchant) continue;
      const oldCat = row.categoryId;
      if (oldCat && oldCat !== patch.categoryId && oldCat !== UNCATEGORIZED_ID) {
        await penalizeTxn(row.merchant, oldCat);
      }
      await learnTxn(row.merchant, patch.categoryId, patch.memberId ?? row.memberId ?? null);
    }
  }
  return { ok: true as const };
}

/** Confirm suggestions without changing them — marks reviewed + reinforces learning. */
export async function confirmTransactions(ids: number[]) {
  if (!ids.length) return { ok: true as const };
  const database = requireDb();
  const rows = await database.select().from(s.transactions).where(inArray(s.transactions.id, ids));
  await database.update(s.transactions).set({ reviewed: true }).where(inArray(s.transactions.id, ids));
  for (const row of rows) {
    if (row.merchant && row.categoryId && row.categoryId !== UNCATEGORIZED_ID) {
      await learnTxn(row.merchant, row.categoryId, row.memberId ?? null);
    }
  }
  return { ok: true as const };
}

/**
 * Apply categories to many merchant groups at once. Snapshots the prior
 * category + reviewed state of every affected row FIRST (returned for undo),
 * then categorizes each group through the normal learning loop (so bulk
 * categorizing also trains the engine). One round trip for the whole batch.
 */
export async function applyBulkCategories(groups: { ids: number[]; categoryId: string }[], opts?: { categorizedBy?: string | null }) {
  const database = requireDb();
  const allIds = [...new Set(groups.flatMap((g) => g.ids))];
  if (!allIds.length) return { ok: true as const, updated: 0, undo: [] as { id: number; categoryId: string | null; reviewed: boolean }[] };
  const before = await database
    .select({ id: s.transactions.id, categoryId: s.transactions.categoryId, reviewed: s.transactions.reviewed })
    .from(s.transactions)
    .where(inArray(s.transactions.id, allIds));
  const undo = before.map((r) => ({ id: r.id, categoryId: r.categoryId, reviewed: r.reviewed }));
  let updated = 0;
  for (const g of groups) {
    if (!g.ids.length || !g.categoryId) continue;
    await bulkUpdateTransactions(g.ids, { categoryId: g.categoryId }, { learn: true, categorizedBy: opts?.categorizedBy ?? null });
    updated += g.ids.length;
  }
  return { ok: true as const, updated, undo };
}

/** Restore exact prior category + reviewed state (the Undo for a bulk apply).
 *  Does NOT re-train memory. */
export async function restoreTransactionCategories(pairs: { id: number; categoryId: string | null; reviewed: boolean }[]) {
  if (!pairs.length) return { ok: true as const };
  const database = requireDb();
  const cats = await catMap();
  // Group identical (categoryId, reviewed) targets so we can bulk-update each.
  const byTarget = new Map<string, { categoryId: string | null; reviewed: boolean; ids: number[] }>();
  for (const p of pairs) {
    const k = `${p.categoryId ?? ""}|${p.reviewed ? 1 : 0}`;
    const t = byTarget.get(k) || { categoryId: p.categoryId, reviewed: p.reviewed, ids: [] };
    t.ids.push(p.id);
    byTarget.set(k, t);
  }
  await database.transaction(async (tx) => {
    for (const t of byTarget.values()) {
      const c = t.categoryId ? cats.get(t.categoryId) : undefined;
      await tx
        .update(s.transactions)
        .set({ categoryId: t.categoryId, category: c?.name ?? null, color: c?.color ?? null, reviewed: t.reviewed })
        .where(inArray(s.transactions.id, t.ids));
    }
  });
  return { ok: true as const };
}

export async function markTransfer(id: number, isTransfer: boolean) {
  return updateTransaction(id, { isTransfer, categoryId: isTransfer ? "transfer" : undefined });
}

const TRANSFER_CAT_ID = "transfer";

/**
 * Detect internal transfers (opposite-amount legs across two accounts within a
 * few days) and link them: both legs get isTransfer + the "transfer" category +
 * a mutual transferPairId. Idempotent — only ever pairs not-yet-linked rows, so
 * it's safe to call after every import. Returns how many pairs were linked.
 */
export async function autoLinkTransfers() {
  const database = requireDb();
  const rows = await database
    .select({
      id: s.transactions.id,
      accountId: s.transactions.accountId,
      amount: s.transactions.amount,
      date: s.transactions.date,
      isTransfer: s.transactions.isTransfer,
      transferPairId: s.transactions.transferPairId,
      merchant: s.transactions.merchant,
    })
    .from(s.transactions);

  const pairs = matchTransfers(
    rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      amount: Number(r.amount ?? 0),
      date: (r.date as string | null) ?? null,
      isTransfer: r.isTransfer,
      transferPairId: r.transferPairId,
    }))
  );
  if (!pairs.length) return { ok: true as const, linked: 0 };

  const cats = await catMap();
  const transferCat = cats.get(TRANSFER_CAT_ID);
  await database.transaction(async (tx) => {
    for (const p of pairs) {
      for (const [id, pairId] of [[p.outId, p.inId], [p.inId, p.outId]] as const) {
        await tx
          .update(s.transactions)
          .set({
            isTransfer: true,
            transferPairId: pairId,
            categoryId: TRANSFER_CAT_ID,
            category: transferCat?.name ?? "Transfer",
            color: transferCat?.color ?? null,
            categorySource: "transfer",
            reviewed: true,
          })
          .where(eq(s.transactions.id, id));
      }
    }
  });
  return { ok: true as const, linked: pairs.length };
}

/**
 * Undo a transfer link: clears isTransfer + the pair on BOTH legs and resets
 * them to Uncategorized so they re-enter spending/income for re-review.
 */
export async function unlinkTransfer(id: number) {
  const database = requireDb();
  const [row] = await database.select().from(s.transactions).where(eq(s.transactions.id, id));
  if (!row) return { ok: true as const };
  const ids = [id, row.transferPairId].filter((x): x is number => x != null);
  await database.transaction(async (tx) => {
    await tx
      .update(s.transactions)
      .set({
        isTransfer: false,
        transferPairId: null,
        categoryId: UNCATEGORIZED_ID,
        category: null,
        color: null,
        categorySource: null,
        categoryConfidence: null,
        reviewed: false,
      })
      .where(inArray(s.transactions.id, ids));
  });
  return { ok: true as const };
}

// ====================================================================
// Allocation / transfer rules (the unified engine)
// ====================================================================
export async function createAllocationRule(args: {
  name: string;
  method: string; // "%" | "Fixed" | "Remainder"
  value?: number | null;
  fromAccountId?: string | null;
  toAccountId: string;
  memberId?: string | null;
  trigger?: string;
  enabled?: boolean;
  incomeMatch?: string | null;
  cadence?: string | null; // scheduled rules only
  anchorDate?: string | null; // scheduled rules only (YYYY-MM-DD)
  icon?: string | null;
}) {
  const database = requireDb();
  const id = crypto.randomUUID();
  const dest = (await accountLabel(args.toAccountId)) ?? args.name;
  const existing = await database.select({ so: s.allocationRules.sortOrder }).from(s.allocationRules);
  const sortOrder = existing.reduce((mx, r) => Math.max(mx, r.so), -1) + 1;
  // Scheduled rules are Fixed-amount, time-driven (no income context). Compute
  // the first run date from cadence + anchor.
  const scheduled = args.trigger === "scheduled";
  const cadence = scheduled ? (args.cadence ?? "monthly") : null;
  const anchorDate = scheduled ? (args.anchorDate ?? todayISO()) : null;
  const nextRunDate = scheduled && cadence ? firstRunOnOrAfter(cadence as Cadence, anchorDate, todayISO()) : null;
  await database.insert(s.allocationRules).values({
    id,
    name: args.name,
    method: scheduled ? "Fixed" : args.method,
    value: args.value == null ? null : String(args.value),
    dest,
    fromAccountId: args.fromAccountId ?? null,
    toAccountId: args.toAccountId,
    memberId: args.memberId ?? null,
    trigger: args.trigger ?? "on_income",
    enabled: args.enabled ?? true,
    incomeMatch: args.incomeMatch ?? null,
    cadence,
    anchorDate,
    nextRunDate,
    icon: args.icon ?? "transfers",
    sortOrder,
  });
  return { ok: true as const, id };
}

export async function updateAllocationRule(
  id: string,
  patch: {
    name?: string;
    method?: string;
    value?: number | null;
    fromAccountId?: string | null;
    toAccountId?: string;
    memberId?: string | null;
    trigger?: string;
    enabled?: boolean;
    incomeMatch?: string | null;
    cadence?: string | null;
    anchorDate?: string | null;
    icon?: string | null;
    sortOrder?: number;
  }
) {
  const database = requireDb();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.method !== undefined) values.method = patch.method;
  if (patch.value !== undefined) values.value = patch.value == null ? null : String(patch.value);
  if (patch.fromAccountId !== undefined) values.fromAccountId = patch.fromAccountId;
  if (patch.toAccountId !== undefined) {
    values.toAccountId = patch.toAccountId;
    values.dest = (await accountLabel(patch.toAccountId)) ?? undefined;
  }
  if (patch.memberId !== undefined) values.memberId = patch.memberId;
  if (patch.trigger !== undefined) values.trigger = patch.trigger;
  if (patch.enabled !== undefined) values.enabled = patch.enabled;
  if (patch.incomeMatch !== undefined) values.incomeMatch = patch.incomeMatch;
  if (patch.cadence !== undefined) values.cadence = patch.cadence;
  if (patch.anchorDate !== undefined) values.anchorDate = patch.anchorDate;
  if (patch.icon !== undefined) values.icon = patch.icon;
  if (patch.sortOrder !== undefined) values.sortOrder = patch.sortOrder;
  // Recompute the schedule when the trigger/cadence/anchor changes.
  if (patch.trigger !== undefined || patch.cadence !== undefined || patch.anchorDate !== undefined) {
    const [cur] = await database.select().from(s.allocationRules).where(eq(s.allocationRules.id, id));
    const trigger = patch.trigger ?? cur?.trigger;
    if (trigger === "scheduled") {
      const cadence = (patch.cadence ?? (cur?.cadence as string | null) ?? "monthly") as Cadence;
      const anchor = patch.anchorDate ?? (cur?.anchorDate as string | null) ?? todayISO();
      values.method = "Fixed";
      values.cadence = cadence;
      values.anchorDate = anchor;
      values.nextRunDate = firstRunOnOrAfter(cadence, anchor, todayISO());
    } else {
      values.nextRunDate = null; // no longer scheduled → stop generating
    }
  }
  if (Object.keys(values).length) {
    await database.update(s.allocationRules).set(values).where(eq(s.allocationRules.id, id));
  }
  return { ok: true as const };
}

export async function deleteAllocationRule(id: string) {
  const database = requireDb();
  await database.transaction(async (tx) => {
    // detach any generated instances so the FK doesn't block the delete
    await tx.update(s.transferInstances).set({ ruleId: null }).where(eq(s.transferInstances.ruleId, id));
    await tx.delete(s.allocationRules).where(eq(s.allocationRules.id, id));
  });
  return { ok: true as const };
}

// ====================================================================
// Transfer instances (pending checklist + history)
// ====================================================================
export async function createManualTransfer(args: {
  fromAccountId: string;
  toAccountId: string;
  memberId?: string | null;
  amount: number;
  plannedDate?: string | null; // YYYY-MM-DD
  note?: string | null;
}) {
  const database = requireDb();
  const [row] = await database
    .insert(s.transferInstances)
    .values({
      ruleId: null,
      fromAccountId: args.fromAccountId,
      toAccountId: args.toAccountId,
      memberId: args.memberId ?? null,
      amount: String(args.amount),
      method: "manual",
      plannedDate: args.plannedDate ?? null,
      status: "pending",
      triggeredBy: "manual",
      note: args.note ?? null,
    })
    .returning({ id: s.transferInstances.id });
  return { ok: true as const, id: row?.id };
}

export async function markTransferInstance(id: number, done: boolean) {
  const database = requireDb();
  await database
    .update(s.transferInstances)
    .set({
      status: done ? "done" : "pending",
      completedAt: done ? new Date() : null,
      ...(done ? {} : { completedTxnId: null }),
    })
    .where(eq(s.transferInstances.id, id));
  return { ok: true as const };
}

export async function skipTransferInstance(id: number) {
  await requireDb().update(s.transferInstances).set({ status: "skipped" }).where(eq(s.transferInstances.id, id));
  return { ok: true as const };
}

export async function deleteTransferInstance(id: number) {
  await requireDb().delete(s.transferInstances).where(eq(s.transferInstances.id, id));
  return { ok: true as const };
}

/**
 * Generate pending transfers from the enabled on-income rules for a single
 * income transaction (the waterfall). Idempotent: keyed by the income txn id, so
 * re-importing the same paycheck never double-generates.
 */
export async function generateTransfersForIncome(incomeTxnId: number) {
  const database = requireDb();
  const [txn] = await database.select().from(s.transactions).where(eq(s.transactions.id, incomeTxnId));
  if (!txn) return { ok: true as const, created: 0 };
  const amount = Number(txn.amount ?? 0);
  if (!txn.income || txn.isTransfer || amount <= 0) return { ok: true as const, created: 0 };

  const already = await database
    .select({ id: s.transferInstances.id })
    .from(s.transferInstances)
    .where(eq(s.transferInstances.triggerIncomeTxnId, incomeTxnId));
  if (already.length) return { ok: true as const, created: 0 };

  const merchantKey = extractMerchant(txn.merchant);
  const ruleRows = await database.select().from(s.allocationRules);
  const rules = ruleRows
    .filter((r) => r.enabled && r.trigger === "on_income" && r.toAccountId)
    .filter((r) => !r.incomeMatch || r.incomeMatch === merchantKey)
    .map((r) => ({
      id: r.id,
      method: r.method,
      value: r.value == null ? null : Number(r.value),
      fromAccountId: r.fromAccountId,
      toAccountId: r.toAccountId,
      memberId: r.memberId,
      sortOrder: r.sortOrder,
    }));
  if (!rules.length) return { ok: true as const, created: 0 };

  const { instances } = generateInstances(amount, rules);
  if (!instances.length) return { ok: true as const, created: 0 };
  await database.insert(s.transferInstances).values(
    instances.map((i) => ({
      ruleId: i.ruleId,
      fromAccountId: i.fromAccountId,
      toAccountId: i.toAccountId,
      memberId: i.memberId,
      amount: String(i.amount),
      method: i.method,
      plannedDate: (txn.date as string | null) ?? null,
      status: "pending",
      triggeredBy: `income:${incomeTxnId}`,
      triggerIncomeTxnId: incomeTxnId,
    }))
  );
  return { ok: true as const, created: instances.length };
}

/**
 * Auto-complete pending transfers whose real transaction has been imported.
 * Builds resolved pairs from the persisted transfer links (set by
 * autoLinkTransfers), then matches them to pending instances by account + amount
 * + date. Only touches `pending` rows, so it's safe to re-run after every import.
 */
export async function reconcilePendingTransfers() {
  const database = requireDb();
  const pendingRows = await database
    .select()
    .from(s.transferInstances)
    .where(eq(s.transferInstances.status, "pending"));
  if (!pendingRows.length) return { ok: true as const, matched: 0 };

  const txnRows = await database
    .select({
      id: s.transactions.id,
      accountId: s.transactions.accountId,
      amount: s.transactions.amount,
      date: s.transactions.date,
      transferPairId: s.transactions.transferPairId,
    })
    .from(s.transactions);
  const byId = new Map(txnRows.map((t) => [t.id, t]));

  // Each linked transfer appears as two legs; canonicalize on the outflow leg.
  const resolved = [] as Parameters<typeof reconcileInstances>[1];
  for (const t of txnRows) {
    if (t.transferPairId == null) continue;
    if (Number(t.amount ?? 0) >= 0) continue; // outflow leg only
    const inn = byId.get(t.transferPairId);
    if (!inn) continue;
    resolved.push({
      outId: t.id,
      outAccountId: t.accountId,
      inId: inn.id,
      inAccountId: inn.accountId,
      amount: Math.abs(Number(inn.amount ?? 0)),
      inDate: (inn.date as string | null) ?? null,
    });
  }
  if (!resolved.length) return { ok: true as const, matched: 0 };

  const pending = pendingRows.map((r) => ({
    id: r.id,
    fromAccountId: r.fromAccountId,
    toAccountId: r.toAccountId,
    amount: Number(r.amount),
    plannedDate: (r.plannedDate as string | null) ?? null,
  }));
  const recs = reconcileInstances(pending, resolved);
  if (!recs.length) return { ok: true as const, matched: 0 };

  await database.transaction(async (tx) => {
    for (const rec of recs) {
      await tx
        .update(s.transferInstances)
        .set({ status: "auto", completedTxnId: rec.completedTxnId, completedAt: new Date() })
        .where(eq(s.transferInstances.id, rec.instanceId));
    }
  });
  return { ok: true as const, matched: recs.length };
}

/**
 * Generate planned transfers for every due `scheduled` rule (run daily by the
 * cron, or on demand). Each due run-date becomes one pending transfer instance;
 * `triggeredBy = scheduled:<ruleId>:<runDate>` makes it idempotent (re-runs and
 * catch-up cycles never double-create). Then the rule's nextRunDate is advanced.
 * The money isn't moved here — these are reminders that `reconcilePendingTransfers`
 * later auto-checks-off once the real transfer is detected.
 */
export async function runScheduledTransfers(today?: string) {
  const database = requireDb();
  const todayStr = today ?? todayISO();
  const rules = await database
    .select()
    .from(s.allocationRules)
    .where(and(eq(s.allocationRules.trigger, "scheduled"), eq(s.allocationRules.enabled, true)));

  let created = 0;
  for (const r of rules) {
    const cadence = r.cadence as Cadence | null;
    const value = Number(r.value ?? 0);
    if (!cadence || !r.nextRunDate || !r.fromAccountId || !r.toAccountId || !(value > 0)) continue;
    const anchor = (r.anchorDate as string | null) ?? null;
    const runs = dueRuns(cadence, anchor, r.nextRunDate as string, todayStr);
    if (!runs.length) continue;

    for (const runDate of runs) {
      const triggeredBy = `scheduled:${r.id}:${runDate}`;
      const [dup] = await database
        .select({ id: s.transferInstances.id })
        .from(s.transferInstances)
        .where(eq(s.transferInstances.triggeredBy, triggeredBy))
        .limit(1);
      if (dup) continue;
      await database.insert(s.transferInstances).values({
        ruleId: r.id,
        fromAccountId: r.fromAccountId,
        toAccountId: r.toAccountId,
        memberId: r.memberId ?? null,
        amount: String(value),
        method: "Fixed",
        plannedDate: runDate,
        status: "pending",
        triggeredBy,
      });
      created++;
    }

    const last = runs[runs.length - 1];
    await database
      .update(s.allocationRules)
      .set({ nextRunDate: nextOccurrence(cadence, anchor, last), lastRunDate: last })
      .where(eq(s.allocationRules.id, r.id));
  }
  return { ok: true as const, created };
}

// ====================================================================
// Notifications
// ====================================================================
export async function createNotification(args: {
  type: string;
  tone?: string; // info | accent | warning | negative
  title: string;
  body?: string | null;
  icon?: string | null;
  timeLabel?: string | null;
  audience?: "owners" | "member" | "all"; // who sees it (default owners)
  memberId?: string | null; // recipient when audience === "member"
  linkTo?: string | null; // optional route id to deep-link to
  dedupeKey?: string | null; // idempotency — skip if one already exists
}) {
  const database = requireDb();
  // Owner preferences: a disabled event fires nothing; channel toggles gate the
  // in-app feed row and the device push independently. Fail-open if the prefs
  // table isn't there yet (pre-migration) or the type isn't tunable.
  const ch = channelsFor(args.type, await loadNotifPrefRows());
  if (!ch.enabled) return { ok: true as const, skipped: true as const };
  // Idempotency: never double-post the same logical alert (webhook + cron, etc.)
  if (args.dedupeKey) {
    const dup = await database
      .select({ id: s.notifications.id })
      .from(s.notifications)
      .where(eq(s.notifications.dedupeKey, args.dedupeKey))
      .limit(1);
    if (dup.length) return { ok: true as const, skipped: true as const };
  }
  if (ch.inApp) {
    const existing = await database.select({ so: s.notifications.sortOrder }).from(s.notifications);
    const sortOrder = existing.reduce((mx, n) => Math.max(mx, n.so), -1) + 1;
    await database.insert(s.notifications).values({
      type: args.type,
      tone: args.tone ?? "info",
      title: args.title,
      body: args.body ?? null,
      icon: args.icon ?? "bell",
      timeLabel: args.timeLabel ?? null,
      unread: true,
      audience: args.audience ?? "owners",
      memberId: args.memberId ?? null,
      linkTo: args.linkTo ?? null,
      dedupeKey: args.dedupeKey ?? null,
      sortOrder,
    });
  }
  // Fan the same alert out to subscribed devices (best-effort — a push failure
  // must never undo the stored notification). Dynamic import keeps the web-push
  // dependency out of paths that never notify.
  if (ch.push) {
    try {
      const { sendPushToAudience } = await import("@/lib/push");
      await sendPushToAudience({
        audience: args.audience ?? "owners",
        memberId: args.memberId ?? null,
        title: args.title,
        body: args.body ?? null,
        linkTo: args.linkTo ?? null,
        tag: args.dedupeKey ?? args.type,
      });
    } catch {
      /* push is optional */
    }
  }
  return { ok: true as const };
}

/** Load stored notification prefs (defensive — empty if the table isn't migrated). */
async function loadNotifPrefRows() {
  const rows = await requireDb()
    .select()
    .from(s.notificationPrefs)
    .catch(() => [] as { event: string; enabled: boolean; inApp: boolean; push: boolean }[]);
  return rows.map((r) => ({ event: r.event, enabled: r.enabled, inApp: r.inApp, push: r.push }));
}

/** Full preference list (catalog merged with stored overrides) for the UI. */
export async function getNotificationPrefs() {
  return mergePrefs(await loadNotifPrefRows());
}

/** Upsert one event's preferences. */
export async function setNotificationPref(
  event: string,
  patch: { enabled?: boolean; inApp?: boolean; push?: boolean }
) {
  const database = requireDb();
  const cur = mergePrefs(await loadNotifPrefRows()).find((m) => m.event === event);
  const next = {
    event,
    enabled: patch.enabled ?? cur?.enabled ?? true,
    inApp: patch.inApp ?? cur?.inApp ?? true,
    push: patch.push ?? cur?.push ?? true,
  };
  await database
    .insert(s.notificationPrefs)
    .values({ ...next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: s.notificationPrefs.event, set: { enabled: next.enabled, inApp: next.inApp, push: next.push, updatedAt: new Date() } });
  return { ok: true as const };
}

/** Store (or refresh) a device's push subscription, tagged with who owns it. */
export async function savePushSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  owner: { memberId: string | null; role: string; email?: string | null }
) {
  const database = requireDb();
  await database
    .insert(s.pushSubscriptions)
    .values({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      memberId: owner.memberId ?? null,
      role: owner.role,
      userEmail: owner.email ?? null,
    })
    .onConflictDoUpdate({
      target: s.pushSubscriptions.endpoint,
      set: { p256dh: sub.p256dh, auth: sub.auth, memberId: owner.memberId ?? null, role: owner.role, userEmail: owner.email ?? null },
    });
  return { ok: true as const };
}

/** Drop a device's push subscription (on disable / unsubscribe). */
export async function deletePushSubscription(endpoint: string) {
  const database = requireDb();
  await database.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.endpoint, endpoint));
  return { ok: true as const };
}

/**
 * Mark notifications read, scoped to what this viewer is allowed to see (so a
 * member can't clear owner alerts). With `ids`, only those (intersected with
 * visibility); without, every visible unread alert ("Mark all read").
 */
export async function markNotificationsRead(
  viewer: { memberId: string | null; role: string },
  ids?: number[]
) {
  const database = requireDb();
  const isMember = viewer.role === "member" && !!viewer.memberId;
  const visible = isMember
    ? or(
        eq(s.notifications.audience, "all"),
        and(eq(s.notifications.audience, "member"), eq(s.notifications.memberId, viewer.memberId!))
      )
    : or(eq(s.notifications.audience, "all"), eq(s.notifications.audience, "owners"));
  const where = ids && ids.length ? and(inArray(s.notifications.id, ids), visible) : visible;
  await database.update(s.notifications).set({ unread: false }).where(where);
  return { ok: true as const };
}

/**
 * After a member edits/confirms, notify the owners ONCE per month if that
 * member has now reviewed every current-month transaction on the accounts they
 * manage. Deduped by member+month so re-confirming doesn't re-alert.
 */
export async function notifyOwnersIfMemberCaughtUp(memberId: string | null | undefined) {
  if (!memberId) return;
  try {
    const database = requireDb();
    const managed = [...(await managedAccountIds(memberId))];
    if (!managed.length) return;
    const txns = await database
      .select({ accountId: s.transactions.accountId, date: s.transactions.date, reviewed: s.transactions.reviewed })
      .from(s.transactions)
      .where(inArray(s.transactions.accountId, managed));
    const prog = computeMemberProgress(txns, managed, new Date());
    // Only when there was work this month and it's all done.
    let currentTotal = 0;
    for (const p of prog.perAccount.values()) currentTotal += p.total;
    if (currentTotal === 0 || !prog.allCaughtUp) return;
    const [mem] = await database
      .select({ name: s.familyMembers.name })
      .from(s.familyMembers)
      .where(eq(s.familyMembers.id, memberId));
    const name = mem?.name ?? "A member";
    await createNotification({
      type: "member-complete",
      tone: "accent",
      icon: "check",
      audience: "owners",
      title: `${name} finished categorizing`,
      body: `${name} has reviewed every transaction on their accounts for this month.`,
      linkTo: "transactions",
      dedupeKey: `member-caughtup:${memberId}:${prog.monthKey}`,
    });
  } catch {
    /* notifications are best-effort — never block the edit */
  }
}

// ---- splits ----
export async function splitTransaction(
  id: number,
  splits: { categoryId: string; amount: number }[]
) {
  const database = requireDb();
  await database.transaction(async (tx) => {
    await tx.delete(s.transactionSplits).where(eq(s.transactionSplits.transactionId, id));
    if (splits.length) {
      await tx.insert(s.transactionSplits).values(
        splits.map((sp, i) => ({
          transactionId: id,
          categoryId: sp.categoryId,
          amount: String(sp.amount),
          sortOrder: i,
        }))
      );
    }
    await tx
      .update(s.transactions)
      .set({ hasSplit: splits.length > 0, category: splits.length ? "Split" : null })
      .where(eq(s.transactions.id, id));
  });
  return { ok: true as const };
}

export async function unsplitTransaction(id: number) {
  return splitTransaction(id, []);
}

// ====================================================================
// Categories
// ====================================================================
export async function createCategory(args: {
  id: string;
  name: string;
  groupId?: string | null;
  color?: string;
  icon?: string | null;
  kind?: string;
  excludeFromBudget?: boolean;
  sortOrder?: number;
}) {
  await requireDb().insert(s.categories).values({
    id: args.id,
    name: args.name,
    groupId: args.groupId ?? null,
    color: args.color ?? "var(--gray-500)",
    icon: args.icon ?? null,
    kind: args.kind ?? "expense",
    excludeFromBudget: Boolean(args.excludeFromBudget),
    sortOrder: args.sortOrder ?? 0,
  });
  return { ok: true as const };
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string; icon?: string | null; groupId?: string | null; kind?: string; excludeFromBudget?: boolean; sortOrder?: number }
) {
  const database = requireDb();
  await database.update(s.categories).set(patch).where(eq(s.categories.id, id));
  // keep denormalized txn labels in sync when name/color change
  if (patch.name !== undefined || patch.color !== undefined) {
    const [c] = await database.select().from(s.categories).where(eq(s.categories.id, id));
    if (c) {
      await database
        .update(s.transactions)
        .set({ category: c.name, color: c.color })
        .where(eq(s.transactions.categoryId, id));
    }
  }
  return { ok: true as const };
}

/** System categories the engine depends on — never user-deletable. */
const PROTECTED_CATEGORY_IDS = new Set([UNCATEGORIZED_ID, "transfer"]);

export async function deleteCategory(id: string) {
  if (PROTECTED_CATEGORY_IDS.has(id)) return { ok: false as const, error: "Cannot delete this category" };
  const database = requireDb();
  await database.transaction(async (tx) => {
    const [unc] = await tx.select().from(s.categories).where(eq(s.categories.id, UNCATEGORIZED_ID));
    await tx
      .update(s.transactions)
      .set({ categoryId: UNCATEGORIZED_ID, category: unc?.name ?? "Uncategorized", color: unc?.color ?? "var(--gray-500)" })
      .where(eq(s.transactions.categoryId, id));
    await tx.delete(s.transactionSplits).where(eq(s.transactionSplits.categoryId, id));
    await tx.update(s.categorizationRules).set({ enabled: false }).where(eq(s.categorizationRules.categoryId, id));
    await tx.delete(s.categories).where(eq(s.categories.id, id));
  });
  return { ok: true as const };
}

// ====================================================================
// Category groups (parent categories)
// ====================================================================
/** Groups that hold a system category — can't be deleted out from under it. */
const PROTECTED_GROUP_IDS = new Set(["transfers", "other"]);

export async function createCategoryGroup(args: { id: string; name: string; sortOrder?: number }) {
  const database = requireDb();
  let sortOrder = args.sortOrder;
  if (sortOrder == null) {
    const existing = await database.select({ so: s.categoryGroups.sortOrder }).from(s.categoryGroups);
    sortOrder = existing.reduce((mx, g) => Math.max(mx, g.so), -1) + 1;
  }
  await database.insert(s.categoryGroups).values({ id: args.id, name: args.name, sortOrder });
  return { ok: true as const, id: args.id };
}

export async function updateCategoryGroup(id: string, patch: { name?: string; sortOrder?: number }) {
  await requireDb().update(s.categoryGroups).set(patch).where(eq(s.categoryGroups.id, id));
  return { ok: true as const };
}

/** Delete a parent group; its subcategories move to "Other" so nothing orphans. */
export async function deleteCategoryGroup(id: string) {
  if (PROTECTED_GROUP_IDS.has(id)) return { ok: false as const, error: "Cannot delete this group" };
  const database = requireDb();
  await database.transaction(async (tx) => {
    await tx.update(s.categories).set({ groupId: "other" }).where(eq(s.categories.groupId, id));
    await tx.delete(s.categoryGroups).where(eq(s.categoryGroups.id, id));
  });
  return { ok: true as const };
}

// ====================================================================
// Rules
// ====================================================================
export async function createRule(args: {
  matchType?: string;
  matchValue: string;
  field?: string;
  categoryId: string;
  member?: string | null;
  priority?: number;
  source?: string;
}) {
  await requireDb().insert(s.categorizationRules).values({
    matchType: args.matchType ?? "contains",
    matchValue: args.matchValue,
    field: args.field ?? "merchant",
    categoryId: args.categoryId,
    member: args.member ?? null,
    priority: args.priority ?? 100,
    source: args.source ?? "manual",
  });
  return { ok: true as const };
}

export async function updateRule(
  id: number,
  patch: { matchType?: string; matchValue?: string; field?: string; categoryId?: string; member?: string | null; priority?: number; enabled?: boolean }
) {
  await requireDb().update(s.categorizationRules).set(patch).where(eq(s.categorizationRules.id, id));
  return { ok: true as const };
}

export async function deleteRule(id: number) {
  await requireDb().delete(s.categorizationRules).where(eq(s.categorizationRules.id, id));
  return { ok: true as const };
}

/**
 * Run the full engine over existing transactions. By default only re-scores
 * rows that haven't been manually reviewed (so it never clobbers your choices).
 */
export async function recategorizeAll(opts?: { onlyUnreviewed?: boolean }) {
  const database = requireDb();
  const onlyUnreviewed = opts?.onlyUnreviewed ?? true;
  const rules = await loadRules();
  const memory = await loadMemory();
  const cats = await catMap();
  const catKind = await kindMap();
  const now = Date.now();
  const rows = await database.select().from(s.transactions);
  let updated = 0;
  for (const t of rows) {
    if (onlyUnreviewed && t.reviewed) continue;
    const sug = scoreCategory(
      { merchant: t.merchant, amount: Number(t.amount), accountId: t.accountId, isTransfer: t.isTransfer },
      { rules, memory, catKind, now }
    );
    if (sug.categoryId && sug.categoryId !== t.categoryId) {
      const c = cats.get(sug.categoryId);
      await database
        .update(s.transactions)
        .set({
          categoryId: sug.categoryId,
          category: c?.name ?? null,
          color: c?.color ?? null,
          categorySource: sug.source,
          categoryConfidence: String(sug.confidence),
        })
        .where(eq(s.transactions.id, t.id));
      updated++;
    }
  }
  return { ok: true as const, updated };
}

// ====================================================================
// Budgets
// ====================================================================

/** Resolve the denormalized display fields (name/who/icon) for a budget from
 *  its linked member (allowance) or category. */
async function resolveBudgetLabels(args: {
  kind: "allowance" | "category";
  memberId?: string | null;
  categoryId?: string | null;
  name?: string | null;
  icon?: string | null;
}): Promise<{ name: string; who: string | null; icon: string | null; memberId: string | null; categoryId: string | null }> {
  if (args.kind === "allowance" && args.memberId) {
    const members = await memberMap();
    const mem = members.get(args.memberId);
    return {
      name: mem?.name ?? args.name ?? "Allowance",
      who: mem?.name ?? args.name ?? "Member",
      icon: args.icon ?? "wallet",
      memberId: args.memberId,
      categoryId: null,
    };
  }
  if (args.kind === "category" && args.categoryId) {
    const cats = await catMap();
    const cat = cats.get(args.categoryId);
    return {
      name: cat?.name ?? args.name ?? "Category",
      who: null,
      icon: args.icon ?? cat?.icon ?? "pie",
      memberId: null,
      categoryId: args.categoryId,
    };
  }
  // Fallback: a free-form named budget with no linked target.
  return { name: args.name ?? "Budget", who: null, icon: args.icon ?? "pie", memberId: null, categoryId: null };
}

export async function createBudget(args: {
  kind: "allowance" | "category";
  memberId?: string | null;
  categoryId?: string | null;
  limit: number;
  name?: string | null;
  icon?: string | null;
}) {
  const database = requireDb();
  const labels = await resolveBudgetLabels(args);
  const existing = await database.select({ so: s.budgets.sortOrder }).from(s.budgets);
  const sortOrder = existing.reduce((mx, b) => Math.max(mx, b.so), -1) + 1;
  const [row] = await database
    .insert(s.budgets)
    .values({
      name: labels.name,
      who: labels.who,
      memberId: labels.memberId,
      categoryId: labels.categoryId,
      icon: labels.icon,
      limitAmount: String(args.limit),
      spent: "0",
      sortOrder,
    })
    .returning({ id: s.budgets.id });
  return { ok: true as const, id: row?.id };
}

export async function updateBudget(
  id: number,
  patch: { kind?: "allowance" | "category"; memberId?: string | null; categoryId?: string | null; limit?: number }
) {
  const database = requireDb();
  const values: Record<string, unknown> = {};
  if (patch.limit !== undefined) values.limitAmount = String(patch.limit);
  // Re-targeting the budget (switch person/category) re-resolves the labels.
  if (patch.kind) {
    const labels = await resolveBudgetLabels({
      kind: patch.kind,
      memberId: patch.memberId,
      categoryId: patch.categoryId,
    });
    values.name = labels.name;
    values.who = labels.who;
    values.memberId = labels.memberId;
    values.categoryId = labels.categoryId;
    values.icon = labels.icon;
  }
  if (Object.keys(values).length) {
    await database.update(s.budgets).set(values).where(eq(s.budgets.id, id));
  }
  return { ok: true as const };
}

export async function deleteBudget(id: number) {
  await requireDb().delete(s.budgets).where(eq(s.budgets.id, id));
  return { ok: true as const };
}

/** Rebuild learned memory from everything already categorized + reviewed. */
export async function rebuildMemoryFromHistory() {
  const database = requireDb();
  await database.delete(s.merchantMemory);
  const rows = await database.select().from(s.transactions);
  let learned = 0;
  for (const t of rows) {
    if (t.reviewed && t.merchant && t.categoryId && t.categoryId !== UNCATEGORIZED_ID) {
      await learnTxn(t.merchant, t.categoryId, t.memberId ?? null);
      learned++;
    }
  }
  return { ok: true as const, learned };
}

// ====================================================================
// Savings goals
// ====================================================================

const dateOnly = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : null);
const todayISO = () => new Date().toISOString().slice(0, 10);

export interface SavingsGoalInput {
  name: string;
  target: number;
  targetDate?: string | null; // ISO YYYY-MM-DD
  accountId?: string | null; // optional linked savings account
  autoContrib?: number; // planned recurring monthly contribution
  icon?: string | null;
  color?: string | null;
  goalType?: string; // emergency | vacation | home | car | sinking | custom
  visibility?: string; // household | private
  memberIds?: string[]; // assigned members (private goals)
  notes?: string | null;
  initialSaved?: number; // optional starting balance → an "initial" contribution
  createdBy?: string | null;
}

/** Replace the member rows for a private goal (no-op cleanup for household). */
async function setGoalMembers(goalId: string, visibility: string, memberIds: string[] | undefined) {
  const database = requireDb();
  await database.delete(s.savingsGoalMembers).where(eq(s.savingsGoalMembers.goalId, goalId));
  if (visibility === "private" && memberIds?.length) {
    await database
      .insert(s.savingsGoalMembers)
      .values(memberIds.map((memberId) => ({ goalId, memberId })));
  }
}

export async function createSavingsGoal(args: SavingsGoalInput) {
  const database = requireDb();
  const id = crypto.randomUUID();
  const visibility = args.visibility === "private" ? "private" : "household";
  const label = await accountLabel(args.accountId);
  const existing = await database.select({ so: s.savingsGoals.sortOrder }).from(s.savingsGoals);
  const sortOrder = existing.reduce((mx, g) => Math.max(mx, g.so), -1) + 1;

  await database.insert(s.savingsGoals).values({
    id,
    name: args.name,
    target: String(args.target),
    targetDate: args.targetDate || null,
    accountId: args.accountId ?? null,
    accountLabel: label,
    autoContrib: String(args.autoContrib ?? 0),
    icon: args.icon ?? null,
    color: args.color || "var(--accent)",
    goalType: args.goalType ?? "custom",
    visibility,
    notes: args.notes ?? null,
    createdBy: args.createdBy ?? null,
    sortOrder,
  });

  await setGoalMembers(id, visibility, args.memberIds);

  if (args.initialSaved && args.initialSaved > 0) {
    await database.insert(s.savingsContributions).values({
      goalId: id,
      amount: String(args.initialSaved),
      date: todayISO(),
      kind: "initial",
      note: "Starting balance",
    });
  }
  return { ok: true as const, id };
}

export async function updateSavingsGoal(
  id: string,
  patch: Partial<SavingsGoalInput> & { sortOrder?: number }
) {
  const database = requireDb();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.target !== undefined) values.target = String(patch.target);
  if (patch.targetDate !== undefined) values.targetDate = patch.targetDate || null;
  if (patch.autoContrib !== undefined) values.autoContrib = String(patch.autoContrib ?? 0);
  if (patch.icon !== undefined) values.icon = patch.icon;
  if (patch.color !== undefined) values.color = patch.color || "var(--accent)";
  if (patch.goalType !== undefined) values.goalType = patch.goalType;
  if (patch.notes !== undefined) values.notes = patch.notes;
  if (patch.sortOrder !== undefined) values.sortOrder = patch.sortOrder;
  if (patch.accountId !== undefined) {
    values.accountId = patch.accountId;
    values.accountLabel = await accountLabel(patch.accountId);
  }
  const visibility = patch.visibility === "private" ? "private" : patch.visibility === "household" ? "household" : undefined;
  if (visibility !== undefined) values.visibility = visibility;

  if (Object.keys(values).length) {
    await database.update(s.savingsGoals).set(values).where(eq(s.savingsGoals.id, id));
  }
  // Re-set members when visibility or the member list was provided.
  if (visibility !== undefined || patch.memberIds !== undefined) {
    const vis = visibility ?? "private"; // memberIds only meaningful for private
    await setGoalMembers(id, vis, patch.memberIds);
  }
  return { ok: true as const };
}

export async function deleteSavingsGoal(id: string) {
  // FK onDelete cascade removes members + contributions.
  await requireDb().delete(s.savingsGoals).where(eq(s.savingsGoals.id, id));
  return { ok: true as const };
}

export async function archiveSavingsGoal(id: string, archived: boolean) {
  await requireDb()
    .update(s.savingsGoals)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(s.savingsGoals.id, id));
  return { ok: true as const };
}

export async function addContribution(
  goalId: string,
  args: { amount: number; date?: string | null; kind?: string; memberId?: string | null; accountId?: string | null; note?: string | null }
) {
  await requireDb().insert(s.savingsContributions).values({
    goalId,
    amount: String(args.amount),
    date: dateOnly(args.date) ?? todayISO(),
    kind: args.kind ?? "manual",
    memberId: args.memberId ?? null,
    accountId: args.accountId ?? null,
    note: args.note ?? null,
  });
  return { ok: true as const };
}

export async function deleteContribution(id: number) {
  await requireDb().delete(s.savingsContributions).where(eq(s.savingsContributions.id, id));
  return { ok: true as const };
}

// ====================================================================
// Email digests
// ====================================================================

export async function updateDigestSettings(patch: {
  cadence?: string; // weekly | biweekly | monthly
  enabled?: boolean;
  ownerEnabled?: boolean;
  membersEnabled?: boolean;
}) {
  const database = requireDb();
  const [cur] = await database.select().from(s.digestSettings).where(eq(s.digestSettings.id, "household"));
  const cadence = (patch.cadence ?? cur?.cadence ?? "monthly") as Cadence;
  const anchor = (cur?.anchorDate as string | null) ?? todayISO();

  if (!cur) {
    await database.insert(s.digestSettings).values({
      id: "household",
      cadence,
      enabled: patch.enabled ?? true,
      ownerEnabled: patch.ownerEnabled ?? true,
      membersEnabled: patch.membersEnabled ?? true,
      anchorDate: anchor,
      nextRunDate: firstRunOnOrAfter(cadence, anchor, todayISO()),
    }).onConflictDoNothing();
    return { ok: true as const };
  }

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.cadence !== undefined) values.cadence = patch.cadence;
  if (patch.enabled !== undefined) values.enabled = patch.enabled;
  if (patch.ownerEnabled !== undefined) values.ownerEnabled = patch.ownerEnabled;
  if (patch.membersEnabled !== undefined) values.membersEnabled = patch.membersEnabled;
  // Recompute the next send when cadence changes (or none scheduled yet).
  if (patch.cadence !== undefined || !cur.nextRunDate) {
    values.anchorDate = anchor;
    values.nextRunDate = firstRunOnOrAfter(cadence, anchor, todayISO());
  }
  await database.update(s.digestSettings).set(values).where(eq(s.digestSettings.id, "household"));
  return { ok: true as const };
}

export async function setMemberDigestOptIn(memberId: string, on: boolean) {
  await requireDb().update(s.familyMembers).set({ digestOptIn: on }).where(eq(s.familyMembers.id, memberId));
  return { ok: true as const };
}
