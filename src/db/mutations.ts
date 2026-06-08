/**
 * Finance write layer (Drizzle). All multi-statement writes run inside
 * db.transaction (serialized, pooler-safe). Every write that changes a FK
 * backfills the legacy label columns so the label-based UI keeps rendering.
 *
 * These are plain async functions; the "use server" boundary + auth checks
 * live in src/app/finance/actions.ts.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { dedupeKey, matchRules, normalizeMerchant, type RuleLike } from "./categorize";
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
  patch: { name?: string; institution?: string; type?: string; mask?: string | null; who?: string; destLabel?: string | null }
) {
  await requireDb().update(s.accounts).set(patch).where(eq(s.accounts.id, id));
  return { ok: true as const };
}

export async function deleteAccount(id: string) {
  const database = requireDb();
  await database.transaction(async (tx) => {
    await tx.delete(s.transactions).where(eq(s.transactions.accountId, id));
    await tx.delete(s.importBatches).where(eq(s.importBatches.accountId, id));
    await tx.delete(s.accounts).where(eq(s.accounts.id, id));
  });
  return { ok: true as const };
}

// ====================================================================
// Import
// ====================================================================
export interface ImportRow {
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number; // signed
  income?: boolean;
  categoryId?: string | null;
  memberId?: string | null;
  isTransfer?: boolean;
  externalId?: string | null;
}

export async function commitImport(args: {
  accountId: string;
  filename?: string | null;
  createdBy?: string | null;
  rows: ImportRow[];
}) {
  const database = requireDb();
  const cats = await catMap();
  const members = await memberMap();
  const acctLabel = await accountLabel(args.accountId);

  // existing dedupe hashes for this account
  const existingRows = await database
    .select({ h: s.transactions.dedupeHash })
    .from(s.transactions)
    .where(eq(s.transactions.accountId, args.accountId));
  const seen = new Set(existingRows.map((r) => r.h).filter(Boolean) as string[]);

  const batchId = crypto.randomUUID();
  const inserts: (typeof s.transactions.$inferInsert)[] = [];
  let skipped = 0;

  for (const r of args.rows) {
    const key = dedupeKey({
      externalId: r.externalId,
      date: r.date,
      amount: r.amount,
      merchant: r.merchant,
      accountId: args.accountId,
    });
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const cat = r.categoryId ? cats.get(r.categoryId) : undefined;
    const mem = r.memberId ? members.get(r.memberId) : undefined;
    inserts.push({
      date: r.date,
      accountId: args.accountId,
      categoryId: r.categoryId ?? null,
      memberId: r.memberId ?? null,
      importBatchId: batchId,
      isTransfer: Boolean(r.isTransfer),
      dedupeHash: key,
      merchant: r.merchant,
      amount: String(r.amount),
      income: r.income ?? r.amount > 0,
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
      createdBy: args.createdBy ?? null,
    });
    if (inserts.length) await tx.insert(s.transactions).values(inserts);
  });

  return { ok: true as const, batchId, imported: inserts.length, skipped };
}

export async function deleteImport(batchId: string) {
  const database = requireDb();
  await database.transaction(async (tx) => {
    await tx.delete(s.transactions).where(eq(s.transactions.importBatchId, batchId));
    await tx.delete(s.importBatches).where(eq(s.importBatches.id, batchId));
  });
  return { ok: true as const };
}

export async function findExistingHashes(accountId: string, hashes: string[]) {
  if (!accountId || !hashes.length) return [];
  const rows = await requireDb()
    .select({ h: s.transactions.dedupeHash })
    .from(s.transactions)
    .where(and(eq(s.transactions.accountId, accountId), inArray(s.transactions.dedupeHash, hashes)));
  return rows.map((r) => r.h).filter(Boolean) as string[];
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
  flagged?: boolean;
  notes?: string | null;
}

async function buildPatchValues(patch: TxnPatch) {
  const values: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) {
    values.categoryId = patch.categoryId;
    const cats = await catMap();
    const c = patch.categoryId ? cats.get(patch.categoryId) : undefined;
    values.category = c?.name ?? null;
    values.color = c?.color ?? null;
  }
  if (patch.memberId !== undefined) {
    values.memberId = patch.memberId;
    const members = await memberMap();
    values.who = patch.memberId ? members.get(patch.memberId)?.name ?? null : null;
  }
  if (patch.isTransfer !== undefined) values.isTransfer = patch.isTransfer;
  if (patch.flagged !== undefined) values.flagged = patch.flagged;
  if (patch.notes !== undefined) values.notes = patch.notes;
  return values;
}

export async function updateTransaction(id: number, patch: TxnPatch, opts?: { learn?: boolean }) {
  const database = requireDb();
  const values = await buildPatchValues(patch);
  if (Object.keys(values).length) {
    await database.update(s.transactions).set(values).where(eq(s.transactions.id, id));
  }
  // Learn a merchant→category rule from a manual recategorization.
  if (opts?.learn && patch.categoryId) {
    const [row] = await database.select().from(s.transactions).where(eq(s.transactions.id, id));
    if (row?.merchant) await learnRuleFromEdit(row.merchant, patch.categoryId);
  }
  return { ok: true as const };
}

export async function bulkUpdateTransactions(ids: number[], patch: TxnPatch) {
  if (!ids.length) return { ok: true as const };
  const values = await buildPatchValues(patch);
  if (Object.keys(values).length) {
    await requireDb().update(s.transactions).set(values).where(inArray(s.transactions.id, ids));
  }
  return { ok: true as const };
}

export async function markTransfer(id: number, isTransfer: boolean) {
  return updateTransaction(id, { isTransfer, categoryId: isTransfer ? "transfer" : undefined });
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

export async function deleteCategory(id: string) {
  if (id === UNCATEGORIZED_ID) return { ok: false as const, error: "Cannot delete Uncategorized" };
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

/** Upsert a learned merchant→category rule (lower priority than manual rules). */
export async function learnRuleFromEdit(merchant: string, categoryId: string) {
  const database = requireDb();
  const norm = normalizeMerchant(merchant);
  if (!norm) return { ok: true as const };
  const existing = await database
    .select()
    .from(s.categorizationRules)
    .where(and(eq(s.categorizationRules.field, "merchant"), eq(s.categorizationRules.matchValue, norm)));
  if (existing.length) {
    await database.update(s.categorizationRules).set({ categoryId }).where(eq(s.categorizationRules.id, existing[0].id));
  } else {
    await database.insert(s.categorizationRules).values({
      matchType: "contains",
      matchValue: norm,
      field: "merchant",
      categoryId,
      priority: 200, // learned rules lose to manual (default 100)
      source: "learned",
    });
  }
  return { ok: true as const };
}

/** Re-run rules over existing transactions (optionally only uncategorized). */
export async function applyRulesToPast(opts?: { onlyUncategorized?: boolean }) {
  const database = requireDb();
  const rules = (await database.select().from(s.categorizationRules)) as unknown as RuleLike[];
  const cats = await catMap();
  const rows = await database.select().from(s.transactions);
  let updated = 0;
  for (const t of rows) {
    if (opts?.onlyUncategorized && t.categoryId && t.categoryId !== UNCATEGORIZED_ID) continue;
    const m = matchRules({ merchant: t.merchant, amount: Number(t.amount), accountId: t.accountId }, rules);
    if (m?.categoryId && m.categoryId !== t.categoryId) {
      const c = cats.get(m.categoryId);
      await database
        .update(s.transactions)
        .set({ categoryId: m.categoryId, category: c?.name ?? null, color: c?.color ?? null })
        .where(eq(s.transactions.id, t.id));
      updated++;
    }
  }
  return { ok: true as const, updated };
}

export async function previewCategorize(
  rows: { merchant: string; amount: number; accountId?: string | null }[]
) {
  const rules = (await requireDb().select().from(s.categorizationRules)) as unknown as RuleLike[];
  return rows.map((r) => matchRules(r, rules));
}
