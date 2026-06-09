/**
 * Finance write layer (Drizzle). All multi-statement writes run inside
 * db.transaction (serialized, pooler-safe). Every write that changes a FK
 * backfills the legacy label columns so the label-based UI keeps rendering.
 *
 * These are plain async functions; the "use server" boundary + auth checks
 * live in src/app/finance/actions.ts.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { dedupeKey, extractMerchant, scoreCategory, REVIEW_THRESHOLD, type MemoryMap, type RuleLike } from "./categorize";
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
    arr.push({ categoryId: r.categoryId, count: r.count, member: r.member });
    map.set(r.merchantKey, arr);
  }
  return map;
}

/** Increment the learned memory for a merchant→category (the learning loop). */
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

/** Suggest categories for a batch of rows (used by the import preview). */
export async function suggestCategories(
  rows: { merchant: string; amount: number; accountId?: string | null; type?: string | null; isTransfer?: boolean }[]
) {
  const rules = await loadRules();
  const memory = await loadMemory();
  return rows.map((r) => scoreCategory(r, { rules, memory }));
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
  categorySource?: string | null; // engine source, or "manual" if user overrode
  categoryConfidence?: number | null;
}

export async function commitImport(args: {
  accountId: string;
  filename?: string | null;
  createdBy?: string | null;
  accountBalance?: number | null; // latest running balance from the CSV
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
  const learnQueue: { key: string; categoryId: string; member: string | null }[] = [];
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
    const conf = r.categoryConfidence ?? null;
    const reviewed = r.categorySource === "manual" ? true : (conf ?? 0) >= REVIEW_THRESHOLD;
    if (r.categorySource === "manual" && r.categoryId && r.categoryId !== UNCATEGORIZED_ID) {
      learnQueue.push({ key: extractMerchant(r.merchant), categoryId: r.categoryId, member: mem?.id ?? r.memberId ?? null });
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
      createdBy: args.createdBy ?? null,
    });
    if (inserts.length) await tx.insert(s.transactions).values(inserts);
  });

  // Learn from rows the user explicitly categorized during import.
  for (const l of learnQueue) await learnMerchant(l.key, l.categoryId, l.member);

  // Update the account's balance from the CSV's latest running balance.
  if (args.accountBalance != null && Number.isFinite(args.accountBalance)) {
    await database.update(s.accounts).set({ balance: String(args.accountBalance) }).where(eq(s.accounts.id, args.accountId));
  }

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
  reviewed?: boolean;
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
    // A manual category set counts as reviewed + a confident, user-sourced choice.
    values.categorySource = "manual";
    values.categoryConfidence = "1.000";
    values.reviewed = true;
  }
  if (patch.memberId !== undefined) {
    values.memberId = patch.memberId;
    const members = await memberMap();
    values.who = patch.memberId ? members.get(patch.memberId)?.name ?? null : null;
  }
  if (patch.isTransfer !== undefined) values.isTransfer = patch.isTransfer;
  if (patch.flagged !== undefined) values.flagged = patch.flagged;
  if (patch.reviewed !== undefined) values.reviewed = patch.reviewed;
  if (patch.notes !== undefined) values.notes = patch.notes;
  return values;
}

export async function updateTransaction(id: number, patch: TxnPatch, opts?: { learn?: boolean }) {
  const database = requireDb();
  const values = await buildPatchValues(patch);
  if (Object.keys(values).length) {
    await database.update(s.transactions).set(values).where(eq(s.transactions.id, id));
  }
  // Learn merchant→category from a manual recategorization (the learning loop).
  if (opts?.learn && patch.categoryId) {
    const [row] = await database.select().from(s.transactions).where(eq(s.transactions.id, id));
    if (row?.merchant) await learnMerchant(extractMerchant(row.merchant), patch.categoryId, patch.memberId ?? row.memberId ?? null);
  }
  return { ok: true as const };
}

export async function bulkUpdateTransactions(ids: number[], patch: TxnPatch, opts?: { learn?: boolean }) {
  if (!ids.length) return { ok: true as const };
  const database = requireDb();
  const values = await buildPatchValues(patch);
  if (Object.keys(values).length) {
    await database.update(s.transactions).set(values).where(inArray(s.transactions.id, ids));
  }
  if (opts?.learn && patch.categoryId) {
    const rows = await database.select().from(s.transactions).where(inArray(s.transactions.id, ids));
    for (const row of rows) {
      if (row.merchant) await learnMerchant(extractMerchant(row.merchant), patch.categoryId, row.memberId ?? null);
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
      await learnMerchant(extractMerchant(row.merchant), row.categoryId, row.memberId ?? null);
    }
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
  const rows = await database.select().from(s.transactions);
  let updated = 0;
  for (const t of rows) {
    if (onlyUnreviewed && t.reviewed) continue;
    const sug = scoreCategory(
      { merchant: t.merchant, amount: Number(t.amount), accountId: t.accountId, isTransfer: t.isTransfer },
      { rules, memory }
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
      await learnMerchant(extractMerchant(t.merchant), t.categoryId, t.memberId ?? null);
      learned++;
    }
  }
  return { ok: true as const, learned };
}
