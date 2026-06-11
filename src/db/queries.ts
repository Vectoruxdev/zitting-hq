/**
 * Assembles the `ZHQ_DATA` object the finance screens consume.
 *
 * The DB stores normalized IDs/FKs; this is the single translation layer that
 * emits the label-based shape the (unchanged) screens expect. Entity sections
 * come straight from the DB (empty arrays when empty — the screens show empty
 * states). The dashboard (stats / donut categories / 6-mo trend) is DERIVED
 * from the real transactions. `member`, `ask`, `permissions`, `nav` stay mock.
 *
 * Reads are SEQUENTIAL (never Promise.all) — Supabase's transaction pooler
 * scrambles pipelined queries from one postgres.js client. On any DB error or
 * when no DB is configured, we fall back to the full curated mock so the app
 * (and pre-migration deploys) never break.
 */
import { asc, eq } from "drizzle-orm";
import { isEmailConfigured } from "@/lib/email";
import { detectRecurring, detectIncomeStreams } from "./detect";
import { computeMemberProgress } from "./allowance";
import { computePerfAllowance, sumPaycheckIncome } from "./perfAllowance";
import { forecastIncome, computeCoverage, type IncomeSourceInput } from "./forecast";
import { extractMerchant } from "./categorize";
import { mergePrefs } from "./notifyPrefs";
import { buildMerchantGroups, dominantCategory } from "./bulkGroups";
import { scoreCategory, type MemoryMap, type RuleLike } from "./categorize";
import { projectGoal, canViewGoal } from "./savings";
import { scrubForMemberView } from "./memberScrub";
import { budgetSpent } from "./budgetMath";
import { flowOf, foldMonthStats, type FlowTxn } from "./monthStats";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { MOCK_FINANCE_DATA } from "@/finance/data/mockData";

export interface Viewer {
  memberId: string | null;
  role: "owner" | "partner" | "member";
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const money0 = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const money2 = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? null : dt;
}
function dayLabel(dt: Date): string {
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}
function monthKey(dt: Date): string {
  return `${dt.getFullYear()}-${dt.getMonth()}`;
}
/** Human "2m ago" / "3h ago" / "Jun 4" style label for a notification time. */
function relTime(dt: Date, now: Date): string {
  const secs = Math.max(0, Math.round((now.getTime() - dt.getTime()) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return dayLabel(dt);
}

export type FinanceData = typeof MOCK_FINANCE_DATA;

/** A valid-but-empty dataset (no demo data). Used on any deployed environment
 *  when the DB is unconfigured or a read fails — so the curated mock never
 *  leaks into production. Full mock is only used in pure local dev. */
function emptyData(): FinanceData {
  const d: FinanceData = JSON.parse(JSON.stringify(MOCK_FINANCE_DATA));
  d.accounts = { checking: [], savings: [], credit: [] };
  d.accountsFlat = [];
  d.excludedAccounts = [];
  d.txns = [];
  d.budgets = [];
  d.rules = [];
  d.incomeStreams = [];
  d.income = { sources: [], candidates: [], totalMonthly: 0, totalMonthlyLabel: "$0" };
  d.bills = [];
  d.goals = [];
  d.savingsStats = { totalSaved: 0, totalSavedDisplay: "$0", monthlyContrib: 0, monthlyContribDisplay: "$0", activeCount: 0, onTrackCount: 0 };
  d.digest = { cadence: "monthly", enabled: true, ownerEnabled: true, membersEnabled: true, nextRunLabel: null, emailConfigured: false };
  d.upcoming = [];
  d.scheduledTransfers = [];
  d.past = [];
  d.notifications = [];
  d.notifRules = [];
  d.learned = [];
  d.notifPrefs = [];
  d.bulkGroups = [];
  d.receiptItems = [];
  d.categories = [];
  d.allCategories = [];
  d.categoryGroups = [];
  d.members = [];
  d.catRules = [];
  d.stats = { totalCash: "$0", netWorth: "$0", spending: "$0", income: "$0", transfers: "$0" };
  d.accountTransfers = [];
  d.cashFlow = { month: "", inFlow: 0, inFlowDisplay: "$0", outFlow: 0, outFlowDisplay: "$0", transfersOut: 0, transfersOutDisplay: "$0", transfersDirection: "out", net: 0, netDisplay: "$0" };
  d.trend = { income: [0, 0, 0, 0, 0, 0], spending: [0, 0, 0, 0, 0, 0], labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] };
  d.member = null;
  d.memberHome = null;
  d.allowanceRules = [];
  d.incomeHistory = {};
  d.transferReadiness = null;
  d.ask = { prompts: ["How much did we spend on dining?", "Where can we cut $300/month?"], messages: [] };
  d.permissions = null;
  return d;
}

// On a deployed environment, never show the curated mock — show empty instead.
const fallbackData = (): FinanceData => (process.env.VERCEL ? emptyData() : MOCK_FINANCE_DATA);

export async function getFinanceData(viewer?: Viewer): Promise<FinanceData> {
  if (!isDbConfigured || !db) return fallbackData();

  try {
    // --- sequential reads (pooler-safe) ---
    // Column-explicit (no `space`) so a not-yet-migrated `space` column can't
    // break this CORE read; `space` is read separately + defensively below.
    const accountColRows = await db
      .select({
        id: s.accounts.id,
        name: s.accounts.name,
        institution: s.accounts.institution,
        mask: s.accounts.mask,
        type: s.accounts.type,
        balance: s.accounts.balance,
        who: s.accounts.who,
        syncedLabel: s.accounts.syncedLabel,
        status: s.accounts.status,
        destLabel: s.accounts.destLabel,
        trend: s.accounts.trend,
        sortOrder: s.accounts.sortOrder,
      })
      .from(s.accounts)
      .orderBy(asc(s.accounts.sortOrder));
    const spaceRows = await db
      .select({ id: s.accounts.id, space: s.accounts.space })
      .from(s.accounts)
      .catch(() => [] as { id: string; space: string }[]);
    const spaceById = new Map(spaceRows.map((r) => [r.id, r.space]));
    // Available balance read separately + defensively so a not-yet-migrated
    // `available_balance` column degrades to "no available figure" instead of
    // breaking this CORE accounts read.
    const availRows = await db
      .select({ id: s.accounts.id, available: s.accounts.availableBalance })
      .from(s.accounts)
      .catch(() => [] as { id: string; available: string | null }[]);
    const availById = new Map(availRows.map((r) => [r.id, r.available]));
    // Declutter flag — read defensively (pre-migration → all expanded).
    const collapsedRows = await db
      .select({ id: s.accounts.id, collapsed: s.accounts.collapsed })
      .from(s.accounts)
      .catch(() => [] as { id: string; collapsed: boolean }[]);
    const collapsedById = new Map(collapsedRows.map((r) => [r.id, r.collapsed]));
    const allAccountRows = accountColRows.map((a) => ({
      ...a,
      space: spaceById.get(a.id) ?? "household",
      availableBalance: availById.get(a.id) ?? null,
      collapsed: collapsedById.get(a.id) ?? false,
    }));
    // Column-explicit (no `allowance`) so a not-yet-migrated allowance column
    // can't break this CORE read; allowance is read separately + defensively.
    const memberRows = await db
      .select({
        id: s.familyMembers.id,
        name: s.familyMembers.name,
        role: s.familyMembers.role,
        email: s.familyMembers.email,
        authId: s.familyMembers.authId,
        status: s.familyMembers.status,
        color: s.familyMembers.color,
      })
      .from(s.familyMembers)
      .orderBy(asc(s.familyMembers.name));
    const groupRows = await db.select().from(s.categoryGroups).orderBy(asc(s.categoryGroups.sortOrder));
    const catRows = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder));
    const catRuleRows = await db.select().from(s.categorizationRules).orderBy(asc(s.categorizationRules.priority));
    const allTxnRows = await db.select().from(s.transactions).orderBy(asc(s.transactions.id));
    // Business-space accounts (and their transactions) are filtered OUT of the
    // entire household view here — every derivation below inherits it. They're
    // surfaced separately as data.excludedAccounts so the UI can manage them.
    const businessIds = new Set(
      allAccountRows.filter((a) => ((a as { space?: string }).space ?? "household") !== "household").map((a) => a.id)
    );
    const accountRows = allAccountRows.filter((a) => !businessIds.has(a.id));
    const txnRows = allTxnRows.filter((t) => !t.accountId || !businessIds.has(t.accountId));
    // Feature/auxiliary tables are read DEFENSIVELY (`.catch(() => [])`): a schema
    // drift on one of them (a column the live DB doesn't have yet) degrades that
    // ONE section to empty instead of throwing and wiping the entire dashboard.
    // Core tables (accounts/members/categories/transactions) are left to hard-fail.
    const splitRows = await db.select().from(s.transactionSplits).orderBy(asc(s.transactionSplits.sortOrder)).catch(() => []);
    const budgetRows = await db.select().from(s.budgets).orderBy(asc(s.budgets.sortOrder)).catch(() => []);
    const ruleRows = await db.select().from(s.allocationRules).orderBy(asc(s.allocationRules.sortOrder)).catch(() => []);
    const goalRows = await db.select().from(s.savingsGoals).orderBy(asc(s.savingsGoals.sortOrder)).catch(() => []);
    const goalMemberRows = await db.select().from(s.savingsGoalMembers).catch(() => [] as { goalId: string; memberId: string }[]);
    const contribRows = await db.select().from(s.savingsContributions).orderBy(asc(s.savingsContributions.id)).catch(() => []);
    // The old display-only `transfers` table is deprecated; upcoming/past now
    // come from transfer_instances (real, account-linked).
    const instanceRows = await db.select().from(s.transferInstances).orderBy(asc(s.transferInstances.id)).catch(() => []);
    const batchRows = await db.select().from(s.importBatches).orderBy(asc(s.importBatches.createdAt)).catch(() => []);
    const notifRows = await db.select().from(s.notifications).orderBy(asc(s.notifications.sortOrder)).catch(() => []);
    const notifRuleRows = await db.select().from(s.notificationRules).orderBy(asc(s.notificationRules.sortOrder)).catch(() => []);
    const receiptRows = await db.select().from(s.receiptItems).orderBy(asc(s.receiptItems.sortOrder)).catch(() => []);
    // Member-managed accounts + per-member allowance (migration 0005) — defensive
    // so a pre-migration DB degrades to "no managers / no allowance" not a wipe.
    const acctMemberRows = await db.select().from(s.accountMembers).catch(() => [] as { accountId: string; memberId: string }[]);
    // Learned merchant→category memory (for the owner "What it's learned" view).
    const memoryRows = await db.select().from(s.merchantMemory).catch(() => []);
    // Owner notification preferences (defensive — empty before the migration).
    const notifPrefRows = await db.select().from(s.notificationPrefs).catch(() => [] as { event: string; enabled: boolean; inApp: boolean; push: boolean }[]);
    // Which of our accounts are linked to a Plaid (auto-syncing) bank + when
    // that bank last synced (real time, not the static "Synced just now" label).
    const plaidAcctRows = await db.select({ accountId: s.plaidAccounts.accountId, itemId: s.plaidAccounts.itemId }).from(s.plaidAccounts).catch(() => [] as { accountId: string | null; itemId: string }[]);
    const plaidLinkedIds = new Set(plaidAcctRows.map((r) => r.accountId).filter(Boolean) as string[]);
    const plaidItemRows = await db.select({ itemId: s.plaidItems.itemId, lastSyncedAt: s.plaidItems.lastSyncedAt }).from(s.plaidItems).catch(() => [] as { itemId: string; lastSyncedAt: Date | null }[]);
    const lastSyncByItem = new Map(plaidItemRows.map((r) => [r.itemId, r.lastSyncedAt ? new Date(r.lastSyncedAt) : null]));
    const syncedLabelFor = (accountId: string, fallback: string | null): string | null => {
      if (!plaidLinkedIds.has(accountId)) return fallback; // manual account → keep its label
      const itemId = plaidAcctRows.find((p) => p.accountId === accountId)?.itemId;
      const last = itemId ? lastSyncByItem.get(itemId) : null;
      if (!last) return "Auto-sync";
      const rt = relTime(last, new Date());
      return `Synced ${rt === "Just now" ? "just now" : rt}`;
    };
    const allowanceRows = await db
      .select({ id: s.familyMembers.id, allowance: s.familyMembers.allowance })
      .from(s.familyMembers)
      .catch(() => [] as { id: string; allowance: string | null }[]);
    // Last-seen (new column, migration 0013) — separate defensive read so a
    // pre-migration DB degrades to "never seen" instead of breaking the member read.
    const lastSeenRows = await db
      .select({ id: s.familyMembers.id, lastSeenAt: s.familyMembers.lastSeenAt })
      .from(s.familyMembers)
      .catch(() => [] as { id: string; lastSeenAt: Date | null }[]);
    // Read digest opt-in separately (new column) so a pre-migration DB doesn't
    // break the core member read.
    const digestOptInRows = await db
      .select({ id: s.familyMembers.id, digestOptIn: s.familyMembers.digestOptIn })
      .from(s.familyMembers)
      .catch(() => [] as { id: string; digestOptIn: boolean }[]);
    const [digestRow] = await db.select().from(s.digestSettings).where(eq(s.digestSettings.id, "household")).catch(() => []);
    // Performance-allowance rules + splits (migration 0007) — defensive so a
    // pre-migration DB degrades to "no allowance rules" not a wipe.
    const allowanceRuleRows = await db.select().from(s.allowanceRules).catch(() => [] as (typeof s.allowanceRules.$inferSelect)[]);
    const allowanceSplitRows = await db.select().from(s.allowanceSplits).catch(() => [] as (typeof s.allowanceSplits.$inferSelect)[]);
    // Manually-entered / adjusted expected income for the transfer-coverage forecast
    // (migration 0008) — defensive so a pre-migration DB just uses auto-forecasts.
    const expectedIncomeRows = await db.select().from(s.expectedIncome).catch(() => [] as (typeof s.expectedIncome.$inferSelect)[]);
    // Curated income registry (migration 0009) — the source of truth for "what
    // counts as income." Only marked payers drive forecasting + allowances.
    const incomeSourceRows = await db.select().from(s.incomeSources).catch(() => [] as (typeof s.incomeSources.$inferSelect)[]);

    // Start from mock so still-mock sections (member/ask/permissions/nav) exist.
    const data: FinanceData = JSON.parse(JSON.stringify(MOCK_FINANCE_DATA));

    // --- lookup maps ---
    const catById = new Map(catRows.map((c) => [c.id, c]));
    const memberById = new Map(memberRows.map((m) => [m.id, m]));
    const acctById = new Map(accountRows.map((a) => [a.id, a]));
    const splitsByTxn = new Map<number, typeof splitRows>();
    for (const sp of splitRows) {
      const arr = splitsByTxn.get(sp.transactionId) || [];
      arr.push(sp);
      splitsByTxn.set(sp.transactionId, arr);
    }
    const accountLabel = (a: (typeof accountRows)[number] | undefined, fallback?: string | null) =>
      a ? (a.mask ? `${a.name} ••${a.mask}` : a.name) : fallback ?? "—";

    // --- account ↔ member assignment (who's "in charge of" each account) ---
    const allowanceById = new Map(allowanceRows.map((r) => [r.id, n(r.allowance)]));
    const lastSeenById = new Map(lastSeenRows.map((r) => [r.id, r.lastSeenAt ? new Date(r.lastSeenAt) : null]));
    const digestOptInById = new Map(digestOptInRows.map((r) => [r.id, r.digestOptIn]));
    const managersByAccount = new Map<string, { id: string; name: string; color: string | null }[]>();
    const accountsByMember = new Map<string, Set<string>>();
    for (const am of acctMemberRows) {
      const mem = memberById.get(am.memberId);
      const arr = managersByAccount.get(am.accountId) || [];
      arr.push({ id: am.memberId, name: mem?.name ?? "Member", color: mem?.color ?? null });
      managersByAccount.set(am.accountId, arr);
      const set = accountsByMember.get(am.memberId) || new Set<string>();
      set.add(am.accountId);
      accountsByMember.set(am.memberId, set);
    }
    const isMemberView = viewer?.role === "member" && !!viewer.memberId;
    const visibleAcctIds = isMemberView ? accountsByMember.get(viewer!.memberId!) ?? new Set<string>() : null;
    const canSeeAccount = (id: string | null | undefined) => !visibleAcctIds || (id != null && visibleAcctIds.has(id));

    // --- taxonomy + roster (for Import / Categories / pickers) ---
    data.categoryGroups = groupRows.map((g) => ({ id: g.id, name: g.name, sortOrder: g.sortOrder }));
    data.allCategories = catRows.map((c) => ({
      id: c.id,
      name: c.name,
      groupId: c.groupId,
      color: c.color,
      icon: c.icon,
      kind: c.kind,
      excludeFromBudget: c.excludeFromBudget,
      sortOrder: c.sortOrder,
    }));
    const seenNow = new Date();
    // "Household" is the reserved shared-bucket label (the static option in the
    // owner/who pickers), not a person. A roster row literally named "Household"
    // is an artifact and would show up twice in those dropdowns — drop it from the
    // member list. (memberById above keeps the row for any name resolution.)
    data.members = memberRows
      .filter((m) => (m.name ?? "").trim().toLowerCase() !== "household")
      .map((m) => {
      const seen = lastSeenById.get(m.id) ?? null;
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        email: m.email,
        status: m.status,
        color: m.color,
        allowance: allowanceById.get(m.id) ?? 0,
        digestOptIn: digestOptInById.get(m.id) ?? true,
        // Presence of a last-seen stamp means they've signed in at least once.
        active: !!seen,
        lastSeen: seen ? relTime(seen, seenNow) : null,
      };
    });

    // --- email digest settings (for the Notifications settings card) ---
    {
      const cadence = digestRow?.cadence ?? "monthly";
      const nrd = digestRow?.nextRunDate as string | null;
      const nrDt = nrd ? parseDate(nrd) : null;
      data.digest = {
        cadence,
        enabled: digestRow?.enabled ?? true,
        ownerEnabled: digestRow?.ownerEnabled ?? true,
        membersEnabled: digestRow?.membersEnabled ?? true,
        nextRunLabel: nrDt ? `Next · ${dayLabel(nrDt)}` : null,
        emailConfigured: isEmailConfigured,
      };
    }
    data.catRules = catRuleRows.map((r) => ({
      id: r.id,
      matchType: r.matchType,
      matchValue: r.matchValue,
      field: r.field,
      categoryId: r.categoryId,
      categoryName: r.categoryId ? catById.get(r.categoryId)?.name ?? null : null,
      member: r.member,
      priority: r.priority,
      enabled: r.enabled,
      source: r.source,
    }));
    data.accountsFlat = accountRows
      .filter((a) => canSeeAccount(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        mask: a.mask,
        label: accountLabel(a),
        managers: managersByAccount.get(a.id) ?? [],
        plaidLinked: plaidLinkedIds.has(a.id),
      }));

    // Accounts moved out of the household (e.g. business) — surfaced so the
    // Accounts screen can list + manage them even though they're filtered from
    // every personal view above.
    data.excludedAccounts = allAccountRows
      .filter((a) => businessIds.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        mask: a.mask,
        type: a.type,
        space: (a as { space?: string }).space ?? "business",
        label: accountLabel(a),
        plaidLinked: plaidLinkedIds.has(a.id),
      }));

    // --- account balances ---
    // `accounts.balance` is the OPENING balance; the live balance is that plus
    // the net of every transaction in the account. So Total Cash always
    // reconciles with the income/spending derived from the same transactions
    // (rather than sitting at $0 when no opening balance was ever set).
    const acctNet = new Map<string, number>();
    for (const t of txnRows) {
      if (!t.accountId) continue;
      acctNet.set(t.accountId, (acctNet.get(t.accountId) || 0) + n(t.amount));
    }
    const liveBalance = (a: (typeof accountRows)[number]) => n(a.balance) + (acctNet.get(a.id) || 0);
    const cashAcctIds = new Set(
      accountRows.filter((a) => a.type === "checking" || a.type === "savings").map((a) => a.id)
    );

    // --- accounts (grouped) ---
    const byType = (t: string) =>
      accountRows
        .filter((a) => a.type === t && canSeeAccount(a.id))
        .map((a) => ({
          id: a.id,
          name: a.name,
          inst: a.institution,
          mask: a.mask,
          balance: liveBalance(a),
          openingBalance: n(a.balance),
          // Bank's available balance (spendable after holds), if reported. Shown
          // as a secondary line; null when the bank doesn't provide it.
          available:
            (a as { availableBalance?: string | null }).availableBalance != null
              ? n((a as { availableBalance?: string | null }).availableBalance)
              : null,
          who: a.who,
          managers: managersByAccount.get(a.id) ?? [],
          plaidLinked: plaidLinkedIds.has(a.id),
          // Declutter only — still counted everywhere; the Accounts screen tucks
          // these into one "Other accounts" card.
          collapsed: !!(a as { collapsed?: boolean }).collapsed,
          synced: syncedLabelFor(a.id, a.syncedLabel),
          status: a.status,
          trend: a.trend ?? [],
          dest: a.destLabel,
        }));
    data.accounts = { checking: byType("checking"), savings: byType("savings"), credit: byType("credit") };

    // --- transactions (resolve labels from FKs, fall back to legacy cols) ---
    const txnById = new Map(txnRows.map((t) => [t.id, t]));
    // Label for a transaction's linked transfer counterpart, e.g. "→ Savings ••12".
    const transferWithLabel = (t: (typeof txnRows)[number]): string | null => {
      if (!t.transferPairId) return null;
      const partner = txnById.get(t.transferPairId);
      if (!partner) return null;
      const partnerLabel = partner.accountId ? accountLabel(acctById.get(partner.accountId)) : partner.accountLabel ?? "—";
      return (n(t.amount) < 0 ? "→ " : "← ") + partnerLabel;
    };
    const txnNow = new Date();
    data.txns = txnRows.filter((t) => canSeeAccount(t.accountId)).map((t) => {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      const member = t.memberId ? memberById.get(t.memberId) : undefined;
      const acct = t.accountId ? acctById.get(t.accountId) : undefined;
      const dt = parseDate(t.date as string | null);
      const catBy = t.categorizedBy ? memberById.get(t.categorizedBy) : undefined;
      return {
        id: t.id,
        date: dt ? dayLabel(dt) : t.dateLabel ?? "",
        merchant: t.merchant,
        // Full raw bank text when richer than the cleaned merchant name.
        description: t.description ?? null,
        // Who manually set the category (+ when), for the "categorized by" tag.
        categorizedBy: catBy?.name ?? null,
        categorizedAt: t.categorizedAt ? relTime(new Date(t.categorizedAt), txnNow) : null,
        cat: t.hasSplit ? "Split" : cat?.name ?? t.category ?? "Uncategorized",
        color: cat?.color ?? t.color ?? "var(--gray-500)",
        who: member?.name ?? t.who ?? "Household",
        account: acct ? accountLabel(acct) : t.accountLabel ?? "—",
        amt: n(t.amount),
        income: t.income,
        pending: t.pending,
        flagged: t.flagged,
        isTransfer: t.isTransfer,
        transferPairId: t.transferPairId,
        transferWith: transferWithLabel(t),
        hasSplit: t.hasSplit,
        reviewed: t.reviewed,
        source: t.categorySource,
        confidence: t.categoryConfidence == null ? null : Number(t.categoryConfidence),
        // ids for inline editing
        categoryId: t.categoryId,
        memberId: t.memberId,
        accountId: t.accountId,
        // Merchant key — lets the drawer look up this source's income history.
        sourceKey: extractMerchant(t.merchant),
      };
    });

    // Income-over-time history per source (merchant key) — drives the income
    // trend chart in the transaction drawer. Raw dated points (real ISO dates);
    // the client buckets them weekly/monthly/yearly/3y/5y and averages.
    const incomeHistory: Record<string, { key: string; name: string; points: { date: string; amount: number }[] }> = {};
    for (const t of txnRows) {
      if (!t.income || t.isTransfer || !canSeeAccount(t.accountId)) continue;
      const iso = t.date as string | null;
      if (!iso) continue;
      const key = extractMerchant(t.merchant);
      const entry = (incomeHistory[key] ||= { key, name: t.merchant, points: [] });
      entry.points.push({ date: iso, amount: n(t.amount) });
    }
    data.incomeHistory = incomeHistory;

    // Detected internal transfers between accounts (one row per linked pair,
    // keyed on the outflow/negative leg), newest first — for the Overview
    // "money moved between accounts" panel.
    data.accountTransfers = txnRows
      .filter((t) => t.transferPairId && n(t.amount) < 0)
      .map((t) => {
        const partner = txnById.get(t.transferPairId!);
        const fromAcct = t.accountId ? acctById.get(t.accountId) : undefined;
        const toAcct = partner?.accountId ? acctById.get(partner.accountId) : undefined;
        const dt = parseDate(t.date as string | null);
        return {
          id: t.id,
          inflowId: partner?.id ?? null, // the +leg; used to dedupe vs transfer_instances
          fromAccount: fromAcct ? accountLabel(fromAcct) : t.accountLabel ?? "—",
          toAccount: toAcct ? accountLabel(toAcct) : partner?.accountLabel ?? "—",
          amount: money2(Math.abs(n(t.amount))),
          date: dt ? dayLabel(dt) : t.dateLabel ?? "",
          dateTime: dt ? dt.getTime() : 0,
        };
      })
      .sort((a, b) => b.dateTime - a.dateTime);

    // --- rules / income / bills / goals / transfers / notifs ---
    // (budgets are mapped later, after per-category/per-member spend is derived)
    data.rules = ruleRows.map((r) => ({
      id: r.id,
      name: r.name,
      method: r.method,
      value: r.value == null ? null : n(r.value),
      dest: r.dest,
      from: r.fromAccountId ? accountLabel(acctById.get(r.fromAccountId)) : null,
      fromAccountId: r.fromAccountId ?? null,
      toAccountId: r.toAccountId ?? null,
      memberId: r.memberId ?? null,
      member: r.memberId ? memberById.get(r.memberId)?.name ?? null : null,
      trigger: r.trigger ?? "on_income",
      enabled: r.enabled ?? true,
      incomeMatch: r.incomeMatch ?? null,
      cadence: r.cadence ?? null,
      anchorDate: (r.anchorDate as string | null) ?? null,
      nextRunDate: (r.nextRunDate as string | null) ?? null,
      nextRunLabel: r.nextRunDate ? `Next · ${(() => { const d = parseDate(r.nextRunDate as string); return d ? dayLabel(d) : (r.nextRunDate as string); })()}` : null,
      icon: r.icon,
    }));
    // incomeStreams are derived from transactions (below, in the derived section).

    // --- savings goals ---
    // `saved` is DERIVED from the contributions ledger (sum per goal), falling
    // back to the legacy stored column for goals with no ledger rows. Goals are
    // visibility-filtered HERE (server-side) via canViewGoal, so a private goal
    // never reaches a browser that isn't allowed to see it.
    const savedByGoal = new Map<string, number>();
    const contributionsByGoal = new Map<string, { id: number; amount: number; date: string | null; kind: string; member: string | null; note: string | null }[]>();
    for (const c of contribRows) {
      savedByGoal.set(c.goalId, (savedByGoal.get(c.goalId) || 0) + n(c.amount));
      const arr = contributionsByGoal.get(c.goalId) || [];
      const dt = parseDate(c.date as string | null);
      arr.push({
        id: c.id,
        amount: n(c.amount),
        date: dt ? dayLabel(dt) : (c.date as string | null),
        kind: c.kind,
        member: c.memberId ? memberById.get(c.memberId)?.name ?? null : null,
        note: c.note,
      });
      contributionsByGoal.set(c.goalId, arr);
    }
    const goalMemberIds = new Map<string, string[]>();
    const goalMembersDisplay = new Map<string, { id: string; name: string; color: string | null }[]>();
    for (const gm of goalMemberRows) {
      const ids = goalMemberIds.get(gm.goalId) || [];
      ids.push(gm.memberId);
      goalMemberIds.set(gm.goalId, ids);
      const mem = memberById.get(gm.memberId);
      const arr = goalMembersDisplay.get(gm.goalId) || [];
      arr.push({ id: gm.memberId, name: mem?.name ?? "Member", color: mem?.color ?? null });
      goalMembersDisplay.set(gm.goalId, arr);
    }
    const goalNow = new Date();
    const targetMonthLabel = (iso: string | null) => {
      if (!iso) return null;
      const d = new Date(iso + "T00:00:00");
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    };
    data.goals = goalRows
      .filter((g) =>
        canViewGoal({ visibility: g.visibility, memberIds: goalMemberIds.get(g.id) ?? [] }, viewer)
      )
      .map((g) => {
        const saved = savedByGoal.has(g.id) ? savedByGoal.get(g.id)! : n(g.saved);
        const target = n(g.target);
        const autoContrib = n(g.autoContrib);
        const proj = projectGoal({ saved, target, targetDate: g.targetDate, autoContrib }, goalNow);
        const acct = g.accountId ? acctById.get(g.accountId) : undefined;
        return {
          id: g.id,
          name: g.name,
          saved,
          target,
          pct: proj.pct,
          remaining: proj.remaining,
          date: g.targetDate ? targetMonthLabel(g.targetDate) : g.dateLabel,
          targetDate: g.targetDate,
          account: acct ? accountLabel(acct) : g.accountLabel,
          accountId: g.accountId,
          contrib: autoContrib,
          autoContrib,
          icon: g.icon,
          color: g.color ?? "var(--accent)",
          goalType: g.goalType,
          visibility: g.visibility,
          members: goalMembersDisplay.get(g.id) ?? [],
          contributions: (contributionsByGoal.get(g.id) ?? []).slice().reverse(), // newest first
          monthsLeft: proj.monthsLeft,
          requiredPerMonth: proj.requiredPerMonth,
          status: proj.status,
          archived: !!g.archivedAt,
        };
      });
    // Savings summary (active goals only) for the tab header.
    {
      const active = data.goals.filter((g: any) => !g.archived);
      const totalSaved = active.reduce((sum: number, g: any) => sum + g.saved, 0);
      const monthlyContrib = active.reduce((sum: number, g: any) => sum + g.autoContrib, 0);
      data.savingsStats = {
        totalSaved,
        totalSavedDisplay: money0(totalSaved),
        monthlyContrib,
        monthlyContribDisplay: money0(monthlyContrib),
        activeCount: active.length,
        onTrackCount: active.filter((g: any) => g.status === "on-track" || g.status === "ahead" || g.status === "complete").length,
      };
    }
    // --- transfers (real instances: pending checklist + history) ---
    const acctLabelById = (id: string | null | undefined) => {
      const a = id ? acctById.get(id) : undefined;
      return a ? accountLabel(a) : "—";
    };
    const mapInstance = (r: (typeof instanceRows)[number]) => {
      const dt = parseDate(r.plannedDate as string | null);
      const mem = r.memberId ? memberById.get(r.memberId)?.name ?? null : null;
      const toLabel = acctLabelById(r.toAccountId);
      const state = r.status === "auto" ? "auto" : r.status === "done" ? "done" : "todo";
      const completed = r.completedAt ? new Date(r.completedAt).getTime() : 0;
      return {
        id: r.id,
        to: mem ? `${toLabel} · ${mem}` : toLabel,
        from: acctLabelById(r.fromAccountId),
        amount: money2(n(r.amount)),
        due: dt ? (r.status === "pending" ? `Due ${dayLabel(dt)}` : dayLabel(dt)) : r.status === "pending" ? "Pending" : "",
        state,
        icon: r.method === "allowance" ? "wallet" : r.method === "manual" ? "transfers" : "repeat",
        note: r.note ?? null,
        member: mem,
        status: r.status,
        fromAccountId: r.fromAccountId,
        toAccountId: r.toAccountId,
        memberId: r.memberId,
        completedTxnId: r.completedTxnId,
        _t: completed || (dt ? dt.getTime() : 0),
      };
    };

    // A pending transfer is "due" when it has no planned date or its date has
    // arrived; future-dated ones are "scheduled" and stay off the active
    // checklist (and out of the banner count) until their day.
    const todayISO = new Date().toISOString().slice(0, 10);
    const isDue = (r: (typeof instanceRows)[number]) => {
      const pd = r.plannedDate as string | null;
      return !pd || pd.slice(0, 10) <= todayISO;
    };
    const pendingInstances = instanceRows.filter((r) => r.status === "pending");
    const duePending = pendingInstances.filter(isDue);
    const scheduledPending = pendingInstances.filter((r) => !isDue(r));
    data.upcoming = duePending.map(mapInstance);
    data.scheduledTransfers = scheduledPending.map(mapInstance).sort((a, b) => a._t - b._t);
    data.scheduledCount = scheduledPending.length;

    // History = completed/auto instances + detected transfer pairs not already
    // represented by an instance (deduped by the inflow leg id), newest first.
    const claimedInflowIds = new Set(
      instanceRows.map((r) => r.completedTxnId).filter((x): x is number => x != null)
    );
    const historyFromInstances = instanceRows
      .filter((r) => r.status === "done" || r.status === "auto")
      .map(mapInstance);
    type DetectedTransfer = {
      id: number;
      inflowId: number | null;
      fromAccount: string;
      toAccount: string;
      amount: string;
      date: string;
      dateTime: number;
    };
    const historyFromDetected = (data.accountTransfers as DetectedTransfer[])
      .filter((d) => d.inflowId == null || !claimedInflowIds.has(d.inflowId))
      .map((d) => ({
        id: `t${d.id}`,
        to: d.toAccount,
        from: d.fromAccount,
        amount: d.amount,
        due: d.date,
        state: "done",
        icon: "transfers",
        member: null,
        status: "detected",
        detected: true,
        _t: d.dateTime,
      }));
    data.past = [...historyFromInstances, ...historyFromDetected].sort((a, b) => b._t - a._t);

    // Pending banner (derived — count + total $ to move). Due items only;
    // scheduled (future-dated) transfers wait until their date.
    const pendingTotal = duePending.reduce((sum, r) => sum + n(r.amount), 0);
    data.transfersPending = duePending.length;
    data.transfersPendingTotal = money2(pendingTotal);

    // --- transfer coverage cockpit (cash vs. due-soon transfers + paycheck forecast) ---
    {
      const HORIZON = 30;
      const todayISO = new Date().toISOString().slice(0, 10);
      const labelFor = (iso: string | null) => { const d = parseDate(iso); return d ? dayLabel(d) : null; };

      // Only CURATED income sources count (not every positive deposit). Build the
      // payer registry set; forecasting falls back to cash-only when nothing is marked.
      const incomeRegistry = new Map(incomeSourceRows.filter((r) => r.active).map((r) => [r.matchKey, r]));
      const sourceMap = new Map<string, IncomeSourceInput>();
      for (const t of txnRows) {
        if (!t.income || t.isTransfer) continue;
        const iso = t.date as string | null;
        if (!iso) continue;
        const key = extractMerchant(t.merchant);
        if (!incomeRegistry.has(key)) continue; // unmarked payer → not income
        const reg = incomeRegistry.get(key)!;
        const e = sourceMap.get(key) || { key, name: reg.name, accountId: reg.accountId ?? t.accountId, points: [] };
        e.points.push({ dateISO: iso, amount: n(t.amount) });
        e.accountId = t.accountId ?? e.accountId; // most-recent deposit account
        sourceMap.set(key, e);
      }
      const autoForecasts = forecastIncome([...sourceMap.values()], todayISO, 45);
      // Manual rows override a source's auto-forecast (by key); one-offs add on top.
      const overriddenKeys = new Set(expectedIncomeRows.filter((r) => r.sourceKey && r.status === "pending").map((r) => r.sourceKey));
      const forecastDisplay = [
        ...autoForecasts
          .filter((f) => !overriddenKeys.has(f.key))
          .map((f) => ({ id: null as string | null, key: f.key, name: f.name, accountId: f.accountId, dateISO: f.dateISO, dateLabel: labelFor(f.dateISO), amount: f.amount, amountLabel: money2(f.amount), confidence: f.confidence, samples: f.samples, source: "auto" as const })),
        ...expectedIncomeRows
          .filter((r) => r.status === "pending")
          .map((r) => ({ id: r.id, key: r.sourceKey ?? r.id, name: r.label, accountId: r.accountId, dateISO: r.expectedDate as string, dateLabel: labelFor(r.expectedDate as string), amount: n(r.amount), amountLabel: money2(n(r.amount)), confidence: "manual" as const, samples: 0, source: (r.sourceKey ? "override" : "manual") as "override" | "manual" })),
      ].sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));

      // Pending transfers → coverage transfers; cash = source accounts' available (or live) balance.
      const covTransfers = instanceRows
        .filter((r) => r.status === "pending")
        .map((r) => ({ amount: n(r.amount), fromAccountId: r.fromAccountId, dueISO: (r.plannedDate as string | null)?.slice(0, 10) ?? null }));
      const cashBySource: Record<string, number> = {};
      for (const t of covTransfers) {
        const id = t.fromAccountId;
        if (!id || id in cashBySource) continue;
        const a = acctById.get(id) as (typeof accountRows)[number] & { availableBalance?: string | null };
        cashBySource[id] = a ? (a.availableBalance != null ? n(a.availableBalance) : liveBalance(a)) : 0;
      }
      const cov = computeCoverage({
        transfers: covTransfers,
        cashBySource,
        income: forecastDisplay.map((f) => ({ dateISO: f.dateISO, amount: f.amount, accountId: f.accountId })),
        todayISO,
        horizonDays: HORIZON,
      });

      const bySource = cov.bySource
        .filter((b) => b.accountId !== "__none__")
        .map((b) => ({
          accountId: b.accountId,
          name: acctById.get(b.accountId) ? accountLabel(acctById.get(b.accountId)) : "Account",
          needed: b.needed,
          have: b.have,
          short: b.short,
          shortLabel: money2(b.short),
        }));

      const gapLabel = money2(cov.gap);
      const coverDateLabel = labelFor(cov.coverDateISO);
      const coverByDateLabel = labelFor(cov.coverByDateISO);
      let message: string;
      if (cov.verdict === "covered") {
        message = cov.upcomingTotal > 0
          ? `Covered — ${money2(cov.cashOnHand)} on hand covers ${money2(cov.upcomingTotal)} due in the next 30 days.`
          : "No transfers due in the next 30 days.";
      } else if (cov.verdict === "covered_by_paycheck") {
        message = `Short ${gapLabel} today — expected income${coverDateLabel ? ` by ${coverDateLabel}` : ""} covers it before it's due.`;
      } else {
        message = `Short ${money2(cov.shortAfterForecast)} — add it${coverByDateLabel ? ` before ${coverByDateLabel}` : ""}.`;
      }

      data.transferReadiness = {
        horizonDays: HORIZON,
        windowLabel: "next 30 days",
        upcomingTotal: cov.upcomingTotal,
        upcomingTotalLabel: money2(cov.upcomingTotal),
        cashOnHand: cov.cashOnHand,
        cashLabel: money2(cov.cashOnHand),
        gap: cov.gap,
        gapLabel,
        coveredNow: cov.coveredNow,
        verdict: cov.verdict,
        bySource,
        forecast: forecastDisplay,
        coverByDateISO: cov.coverByDateISO,
        coverByDateLabel,
        coverDateISO: cov.coverDateISO,
        coverDateLabel,
        coveredByForecast: cov.coveredByForecast,
        shortAfterForecast: cov.shortAfterForecast,
        shortAfterForecastLabel: money2(cov.shortAfterForecast),
        message,
      };
    }
    // Scope to the viewer: a member sees only their own + household-wide
    // alerts; owner/partner see owner + household-wide. Newest first (by real
    // createdAt, falling back to sortOrder for legacy rows).
    const visibleNotif = notifRows
      .filter((notif) => {
        const aud = (notif.audience as string) || "owners";
        if (aud === "all") return true;
        if (isMemberView) return aud === "member" && notif.memberId === viewer!.memberId;
        return aud === "owners";
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : a.sortOrder;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : b.sortOrder;
        return tb - ta;
      });
    const notifNow = new Date();
    data.notifications = visibleNotif.map((notif) => ({
      id: notif.id,
      type: notif.type,
      icon: notif.icon,
      tone: notif.tone,
      title: notif.title,
      body: notif.body,
      time: notif.createdAt ? relTime(new Date(notif.createdAt), notifNow) : notif.timeLabel,
      unread: notif.unread,
      linkTo: notif.linkTo ?? null,
    }));
    // Surface pending transfers as a derived (unstored) alert so the bell badges
    // and the feed shows what needs moving — without a stale stored row.
    // Owners/partners only — members don't manage household transfers.
    if (data.transfersPending > 0 && !isMemberView) {
      data.notifications = [
        {
          id: "transfers-pending",
          type: "transfers",
          icon: "transfers",
          tone: "warning",
          title: `${data.transfersPending} transfer${data.transfersPending === 1 ? "" : "s"} to make`,
          body: `${data.transfersPendingTotal} ready to move across your accounts.`,
          time: "Now",
          unread: true,
          linkTo: "transfers",
        },
        ...data.notifications,
      ];
    }
    // What the auto-categorizer has learned (owner/partner only). Aggregated by
    // the broad token key (the precise "x:" tier is internal); each merchant
    // shows its winning category, how strongly, when last reinforced, and any
    // competing categories — so the owner can watch it learn and spot-fix.
    if (!isMemberView) {
      const byKey = new Map<string, { total: number; lastSeen: number; cats: Map<string, { count: number; member: string | null }> }>();
      for (const r of memoryRows) {
        if (!r.categoryId || r.merchantKey.startsWith("x:")) continue; // token tier only
        const g = byKey.get(r.merchantKey) || { total: 0, lastSeen: 0, cats: new Map() };
        g.total += r.count;
        const seen = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        if (seen > g.lastSeen) g.lastSeen = seen;
        const c = g.cats.get(r.categoryId) || { count: 0, member: r.member };
        c.count += r.count;
        g.cats.set(r.categoryId, c);
        byKey.set(r.merchantKey, g);
      }
      data.learned = [...byKey.entries()]
        .map(([key, g]) => {
          const ranked = [...g.cats.entries()].sort((a, b) => b[1].count - a[1].count);
          const [topId, top] = ranked[0];
          const cat = catById.get(topId);
          return {
            key,
            categoryId: topId,
            category: cat?.name ?? topId,
            color: cat?.color ?? "var(--gray-500)",
            count: top.count,
            total: g.total,
            share: g.total > 0 ? Math.round((top.count / g.total) * 100) : 100,
            member: top.member ? memberById.get(top.member)?.name ?? null : null,
            lastSeen: g.lastSeen ? relTime(new Date(g.lastSeen), new Date()) : null,
            alts: ranked.slice(1).map(([id, v]) => ({ category: catById.get(id)?.name ?? id, count: v.count })),
          };
        })
        .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
    } else {
      data.learned = [];
    }
    // Notification preferences (owner/partner only — the panel is owner-facing).
    data.notifPrefs = isMemberView
      ? []
      : mergePrefs(notifPrefRows.map((r) => ({ event: r.event, enabled: r.enabled, inApp: r.inApp, push: r.push })));

    // --- bulk-categorize groups (merchant-clustered triage) ---
    // Reuse the engine to suggest a category per merchant cluster. Viewer-scoped
    // (members see only their accounts). Transfers are excluded (not categorized).
    {
      const memMap: MemoryMap = new Map();
      for (const r of memoryRows) {
        if (!r.categoryId) continue;
        const arr = memMap.get(r.merchantKey) || [];
        arr.push({ categoryId: r.categoryId, count: r.count, member: r.member, lastSeen: r.updatedAt ? new Date(r.updatedAt).getTime() : undefined });
        memMap.set(r.merchantKey, arr);
      }
      const rules = catRuleRows as unknown as RuleLike[];
      const catKind = new Map(catRows.map((c) => [c.id, c.kind]));
      const nowMs = Date.now();
      const bulkInput = txnRows
        .filter((t) => !t.isTransfer && canSeeAccount(t.accountId))
        .map((t) => ({ id: t.id, merchant: t.merchant, categoryId: t.categoryId, reviewed: t.reviewed, amount: n(t.amount), accountId: t.accountId, date: t.date as string | null }));
      const groups = buildMerchantGroups(bulkInput).slice(0, 250);
      const rangeLbl = (iso: string | null) => {
        const d = parseDate(iso);
        return d ? dayLabel(d) : "";
      };
      data.bulkGroups = groups.map((g) => {
        const sug = scoreCategory({ merchant: g.sampleMerchant, amount: g.net !== 0 ? g.net : -1 }, { rules, memory: memMap, catKind, now: nowMs });
        const curId = dominantCategory(g.catCounts);
        const curCat = curId ? catById.get(curId) : undefined;
        const sugCat = sug.categoryId && sug.categoryId !== "uncategorized" ? catById.get(sug.categoryId) : undefined;
        return {
          key: g.key,
          merchant: g.key.replace(/\b\w/g, (m) => m.toUpperCase()),
          ids: g.ids,
          count: g.count,
          unreviewed: g.unreviewed,
          uncategorized: g.uncategorized,
          spend: g.totalSpend,
          spendLabel: money2(g.totalSpend),
          currentCategoryId: curId,
          currentCategory: curCat?.name ?? null,
          currentColor: curCat?.color ?? null,
          mixed: Object.keys(g.catCounts).filter((k) => k && k !== "uncategorized").length > 1,
          suggestion: sugCat
            ? {
                categoryId: sug.categoryId,
                name: sugCat.name,
                color: sugCat.color,
                confidence: sug.confidence,
                confidencePct: Math.round(sug.confidence * 100),
                reason: sug.reason ?? null,
                source: sug.source,
              }
            : null,
          accounts: g.accountIds.map((id) => acctById.get(id)?.name ?? "—"),
          dateRange: g.minDate ? (g.minDate === g.maxDate ? rangeLbl(g.minDate) : `${rangeLbl(g.minDate)} – ${rangeLbl(g.maxDate)}`) : "",
        };
      });
    }
    data.notifRules = notifRuleRows.map((r) => ({
      id: r.id,
      name: r.name,
      detail: r.detail,
      channels: r.channels,
      on: r.enabled,
    }));
    data.receiptItems = receiptRows.map((r) => ({
      item: r.item,
      qty: n(r.qty),
      unit: n(r.unit),
      total: n(r.total),
    }));

    // ====================================================================
    // Derived dashboard (stats / donut categories / 6-month trend)
    // ====================================================================
    const now = new Date();

    // Shared detection input (recurring bills + income streams).
    const detectInput = txnRows.map((t) => ({
      merchant: t.merchant,
      amount: n(t.amount),
      date: t.date as string | null,
      categoryName: t.categoryId ? catById.get(t.categoryId)?.name ?? null : t.category ?? null,
      color: t.categoryId ? catById.get(t.categoryId)?.color ?? null : t.color ?? null,
      accountLabel: t.accountId ? accountLabel(acctById.get(t.accountId)) : t.accountLabel ?? null,
      isTransfer: t.isTransfer,
      income: t.income,
    }));
    data.bills = detectRecurring(detectInput, now);
    data.incomeStreams = detectIncomeStreams(detectInput, now);

    // --- curated income registry: marked sources (with detected stats) + unmarked candidates ---
    {
      const detectedByKey = new Map((data.incomeStreams as { id: string }[]).map((d) => [d.id, d as Record<string, unknown>]));
      const acctByKey = new Map<string, string>();
      for (const t of txnRows) {
        if (!t.income || t.isTransfer || !t.accountId) continue;
        acctByKey.set(extractMerchant(t.merchant), t.accountId); // most-recent deposit account
      }
      const registered = incomeSourceRows.filter((r) => r.active);
      const regKeys = new Set(registered.map((r) => r.matchKey));
      const sources = registered.map((r) => {
        const d = detectedByKey.get(r.matchKey) as { monthly?: number; cadence?: string; last?: string; next?: string; status?: string; spark?: number[] } | undefined;
        const acctId = r.accountId ?? acctByKey.get(r.matchKey) ?? null;
        const monthly = d?.monthly ?? 0;
        return {
          id: r.id,
          matchKey: r.matchKey,
          name: r.name,
          memberId: r.memberId,
          memberName: r.memberId ? memberById.get(r.memberId)?.name ?? null : null,
          accountId: acctId,
          accountLabel: acctId ? accountLabel(acctById.get(acctId)) : null,
          monthly,
          monthlyLabel: money0(monthly),
          cadence: d?.cadence ?? null,
          last: d?.last ?? null,
          next: d?.next ?? null,
          status: d?.status ?? "on-track",
          spark: d?.spark ?? [],
        };
      });
      const candidates = (data.incomeStreams as { id: string; name: string; sub: string | null; monthly: number; cadence: string; next: string | null }[])
        .filter((d) => !regKeys.has(d.id))
        .map((d) => ({ matchKey: d.id, name: d.name, sub: d.sub, monthly: d.monthly, monthlyLabel: money0(d.monthly), cadence: d.cadence, next: d.next, accountId: acctByKey.get(d.id) ?? null }));
      const totalMonthly = sources.reduce((sum, x) => sum + x.monthly, 0);
      data.income = { sources, candidates, totalMonthly, totalMonthlyLabel: money0(totalMonthly) };
    }

    // The "current" month for stats/donut: this calendar month if it has any
    // transactions, else the most recent month that does — so imported history
    // shows immediately instead of an empty "this month".
    let maxTime = 0;
    const monthsWithData = new Set<string>();
    for (const t of txnRows) {
      const dt = parseDate(t.date as string | null);
      if (!dt) continue;
      monthsWithData.add(monthKey(dt));
      if (dt.getTime() > maxTime) maxTime = dt.getTime();
    }
    const curKey = monthKey(now);
    const targetDate = monthsWithData.has(curKey) || !maxTime ? now : new Date(maxTime);
    const targetKey = monthKey(targetDate);
    data.statsMonth = targetDate.toLocaleString("en-US", { month: "long" });

    // Spending breakdown by category (current month, splits-aware) + per-member
    // spend (for personal-allowance budgets). Classification lives in
    // monthStats.ts (flowOf/foldMonthStats — pure, unit-tested): income is
    // summed SIGNED, refunds net spending down, transfers count as neither.
    // Registry-aware income semantics: once the household has curated income
    // sources, only registered payers count as income — other positive
    // deposits are refunds that net spending down (Plaid flags EVERY positive
    // amount `income`, which otherwise counts card refunds as income).
    const activeIncomeKeys = new Set(incomeSourceRows.filter((r) => r.active).map((r) => r.matchKey));
    const flowOpts = { registryActive: activeIncomeKeys.size > 0 };
    const toFlowTxn = (t: (typeof txnRows)[number]): FlowTxn => {
      const splits = t.hasSplit ? splitsByTxn.get(t.id) : undefined;
      return {
        amount: n(t.amount),
        income: t.income,
        isTransfer: t.isTransfer,
        catKind: t.categoryId ? catById.get(t.categoryId)?.kind ?? null : null,
        categoryId: t.categoryId,
        memberId: t.memberId,
        registeredPayer: activeIncomeKeys.has(extractMerchant(t.merchant)),
        splits: splits?.length ? splits.map((sp) => ({ categoryId: sp.categoryId, amount: n(sp.amount) })) : null,
      };
    };
    const monthTxns = txnRows.filter((t) => {
      const dt = parseDate(t.date as string | null);
      return !!dt && monthKey(dt) === targetKey;
    });
    const monthStats = foldMonthStats(monthTxns.map(toFlowTxn), flowOpts);
    const catTotals = monthStats.catTotals;
    const memberTotals = monthStats.memberTotals;
    const monthSpending = monthStats.spending;
    const monthIncome = monthStats.income;

    // Cash-flow reconciliation for the target month (checking + savings only),
    // so the dashboard's numbers visibly add up: every cash-account transaction
    // is exactly one of income (non-transfer in), spending (non-transfer out),
    // or a transfer. Net change = in − out − transfers out.
    let cashIn = 0;
    let cashOut = 0;
    let cashTransfersNet = 0; // signed: positive = net into cash accounts
    for (const t of txnRows) {
      const dt = parseDate(t.date as string | null);
      if (!dt || monthKey(dt) !== targetKey) continue;
      if (!t.accountId || !cashAcctIds.has(t.accountId)) continue;
      const amt = n(t.amount);
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.kind === "transfer") {
        cashTransfersNet += amt;
      } else if (amt > 0) {
        cashIn += amt;
      } else {
        cashOut += Math.abs(amt);
      }
    }
    const cashNet = cashIn - cashOut + cashTransfersNet;
    data.cashFlow = {
      month: data.statsMonth,
      inFlow: cashIn,
      inFlowDisplay: money0(cashIn),
      outFlow: cashOut,
      outFlowDisplay: money0(cashOut),
      transfersOut: -cashTransfersNet, // positive when money net-left cash accounts
      transfersOutDisplay: money0(Math.abs(cashTransfersNet)),
      transfersDirection: cashTransfersNet <= 0 ? "out" : "in",
      net: cashNet,
      netDisplay: (cashNet < 0 ? "−$" : "$") + Math.abs(Math.round(cashNet)).toLocaleString("en-US"),
    };

    // Budgets — `spent` is DERIVED from the current month's transactions:
    // category budgets pull from that category's spend, allowances from that
    // member's spend. Falls back to the stored column for untargeted rows.
    data.budgets = budgetRows.map((b) => {
      const spent = budgetSpent(
        { categoryId: b.categoryId, memberId: b.memberId, storedSpent: n(b.spent) },
        catTotals,
        memberTotals
      );
      return {
        id: b.id,
        name: b.name,
        who: b.who,
        icon: b.icon ?? undefined,
        categoryId: b.categoryId,
        memberId: b.memberId,
        spent,
        limit: n(b.limitAmount),
      };
    });

    const palette = ["var(--green-500)", "var(--indigo-500)", "var(--amber-500)", "var(--green-600)", "var(--gray-500)"];
    const sortedCats = [...catTotals.entries()].sort((a, b) => b[1] - a[1]);
    const topCats = sortedCats.slice(0, 5);
    const restTotal = sortedCats.slice(5).reduce((sum, [, v]) => sum + v, 0);
    data.categories = topCats.map(([id, value], i) => ({
      label: catById.get(id)?.name ?? "Uncategorized",
      value,
      display: money0(value),
      color: catById.get(id)?.color ?? palette[i % palette.length],
    }));
    if (restTotal > 0) {
      data.categories.push({ label: "Other", value: restTotal, display: money0(restTotal), color: "var(--gray-500)" });
    }

    // Total cash = live (opening + transaction net) checking + savings balances
    const totalCash = accountRows
      .filter((a) => a.type === "checking" || a.type === "savings")
      .reduce((sum, a) => sum + liveBalance(a), 0);
    // Net worth = ALL accounts (credit liveBalance is negative = debt), so this
    // is cash + savings − card debt.
    const netWorth = accountRows.reduce((sum, a) => sum + liveBalance(a), 0);
    const signedMoney = (v: number) => (v < 0 ? "−$" : "$") + Math.abs(Math.round(v)).toLocaleString("en-US");
    data.stats = {
      totalCash: money0(totalCash),
      netWorth: signedMoney(netWorth),
      spending: money0(monthSpending),
      income: money0(monthIncome),
      transfers: money0(pendingTotal), // total $ still pending to move
    };

    // 6-month trend (by real date)
    const labels: string[] = [];
    const incomeArr: number[] = [];
    const spendArr: number[] = [];
    const bucket = new Map<string, { inc: number; sp: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      labels.push(MONTHS[d.getMonth()]);
      bucket.set(key, { inc: 0, sp: 0 });
    }
    for (const t of txnRows) {
      const dt = parseDate(t.date as string | null);
      if (!dt) continue;
      const b = bucket.get(monthKey(dt));
      if (!b) continue;
      // Same classification as the stats cards (flowOf): registry-aware,
      // signed income; non-income positives are refunds that net down spending.
      const flow = flowOf(
        {
          amount: n(t.amount),
          income: t.income,
          isTransfer: t.isTransfer,
          catKind: t.categoryId ? catById.get(t.categoryId)?.kind ?? null : null,
          registeredPayer: activeIncomeKeys.has(extractMerchant(t.merchant)),
        },
        flowOpts
      );
      b.inc += flow.income;
      b.sp += flow.spendNet;
    }
    for (const v of bucket.values()) {
      incomeArr.push(Math.round(v.inc));
      spendArr.push(Math.round(v.sp));
    }
    data.trend = { income: incomeArr, spending: spendArr, labels };

    // Date range each import batch actually covers (from its transactions).
    const batchRange = new Map<string, { min: string; max: string }>();
    for (const t of txnRows) {
      if (!t.importBatchId || !t.date) continue;
      const iso = String(t.date).slice(0, 10);
      const cur = batchRange.get(t.importBatchId);
      if (!cur) batchRange.set(t.importBatchId, { min: iso, max: iso });
      else {
        if (iso < cur.min) cur.min = iso;
        if (iso > cur.max) cur.max = iso;
      }
    }
    const rangeLabel = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    // Import history (newest first).
    data.importBatches = [...batchRows].reverse().map((b) => {
      const acct = b.accountId ? acctById.get(b.accountId) : undefined;
      const created = b.createdAt ? new Date(b.createdAt) : null;
      const range = batchRange.get(b.id);
      return {
        id: b.id,
        filename: b.filename,
        account: acct ? acct.name : null,
        source: (b as { source?: string }).source ?? "csv",
        rowsImported: b.rowsImported,
        rowsSkipped: b.rowsSkipped,
        coversFrom: range ? rangeLabel(range.min) : null,
        coversTo: range ? rangeLabel(range.max) : null,
        createdAt: created ? created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
        createdAtTime: created ? created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null,
      };
    });

    // Neutralize the remaining presentational mock sections so no demo data
    // leaks into the member (Spendable) and Ask views.
    data.member = null;
    data.ask = {
      prompts: [
        "How much did we spend on dining?",
        "Where can we cut $300/month?",
        "What changed in our bills this month?",
      ],
      messages: [],
    };
    data.permissions = null;

    // --- performance allowances (rules + live current-month preview) ---
    const curMonthKey = monthKey(now);
    const allowanceSplitsByRule = new Map<string, typeof allowanceSplitRows>();
    for (const sp of allowanceSplitRows) {
      const arr = allowanceSplitsByRule.get(sp.ruleId) || [];
      arr.push(sp);
      allowanceSplitsByRule.set(sp.ruleId, arr);
    }
    // Earner's current calendar-month paycheck income for a rule (preview only).
    // REGISTRY semantics — paychecks are income txns whose payer is a registered
    // income source owned by the earner, matching the crediting engine
    // (mutations.ts sumPaychecks). NOT txn attribution: Plaid deposits arrive
    // unattributed, so attribution-based previews showed $0 while crons credited.
    const ownedKeysByMember = new Map<string, Set<string>>();
    for (const r of incomeSourceRows) {
      if (!r.active || !r.memberId) continue;
      const set = ownedKeysByMember.get(r.memberId) || new Set<string>();
      set.add(r.matchKey);
      ownedKeysByMember.set(r.memberId, set);
    }
    const paycheckTxnInput = txnRows.map((t) => ({
      merchantKey: extractMerchant(t.merchant),
      amount: n(t.amount),
      dateISO: t.date as string | null,
      income: t.income,
      isTransfer: t.isTransfer,
    }));
    const inCurrentMonth = (iso: string) => {
      const dt = parseDate(iso);
      return !!dt && monthKey(dt) === curMonthKey;
    };
    const allowanceIncomeFor = (rule: (typeof allowanceRuleRows)[number]): number =>
      sumPaycheckIncome({
        txns: paycheckTxnInput,
        ownedKeys: ownedKeysByMember.get(rule.memberId) ?? new Set<string>(),
        matchKeys: (rule.incomeMatchKeys as string[] | null) ?? null,
        inPeriod: inCurrentMonth,
      });
    const allowancePreviewFor = (rule: (typeof allowanceRuleRows)[number]) => {
      const splits = (allowanceSplitsByRule.get(rule.id) ?? []).map((sp) => ({
        memberId: sp.memberId,
        pct: n(sp.pct),
        toAccountId: sp.toAccountId,
      }));
      const income = allowanceIncomeFor(rule);
      const result = computePerfAllowance({
        income,
        goal: n(rule.goalAmount),
        min: n(rule.minAmount),
        bonusType: (rule.bonusType as "percent" | "fixed") ?? "percent",
        bonusBasis: (rule.bonusBasis as "overage" | "gross") ?? "overage",
        bonusValue: n(rule.bonusValue),
        splits,
        earnerMemberId: rule.memberId,
        earnerToAccountId: rule.toAccountId,
        fromAccountId: rule.fromAccountId,
      });
      return { income, result, splits };
    };

    data.allowanceRules = allowanceRuleRows.map((rule) => {
      const { income, result, splits } = allowancePreviewFor(rule);
      return {
        id: rule.id,
        name: rule.name,
        memberId: rule.memberId,
        memberName: memberById.get(rule.memberId)?.name ?? "Member",
        enabled: rule.enabled,
        period: rule.period,
        goal: n(rule.goalAmount),
        goalLabel: money0(n(rule.goalAmount)),
        min: n(rule.minAmount),
        minLabel: money0(n(rule.minAmount)),
        bonusType: rule.bonusType,
        bonusBasis: rule.bonusBasis,
        bonusValue: n(rule.bonusValue),
        incomeMatchKeys: (rule.incomeMatchKeys as string[] | null) ?? null,
        fromAccountId: rule.fromAccountId,
        fromAccountLabel: accountLabel(acctById.get(rule.fromAccountId)),
        toAccountId: rule.toAccountId,
        toAccountLabel: accountLabel(acctById.get(rule.toAccountId)),
        gateOnReview: rule.gateOnReview,
        splits: splits.map((sp) => ({
          memberId: sp.memberId,
          memberName: memberById.get(sp.memberId)?.name ?? "Member",
          pct: sp.pct,
          toAccountId: sp.toAccountId,
          toAccountLabel: accountLabel(acctById.get(sp.toAccountId)),
        })),
        status: {
          periodLabel: rule.period === "per_paycheck" ? "each paycheck" : "this month",
          income,
          incomeLabel: money0(income),
          over: result.over,
          overage: result.overage,
          bonusPool: result.bonusPool,
          bonusLabel: money0(result.bonusPool),
          warnings: result.warnings,
          payouts: result.payouts.map((p) => ({
            memberId: p.memberId,
            memberName: memberById.get(p.memberId)?.name ?? "Member",
            amount: p.amount,
            amountLabel: money2(p.amount),
            kind: p.kind,
          })),
        },
      };
    });

    // --- member home (categorize tasks + allowance gating) ---
    const buildMemberHome = (mid: string) => {
      const managedIds = [...(accountsByMember.get(mid) ?? [])];
      const prog = computeMemberProgress(
        txnRows.map((t) => ({ accountId: t.accountId, date: t.date as string | null, reviewed: t.reviewed })),
        managedIds,
        now
      );
      const managedSet = new Set(managedIds);
      const managedAccounts = managedIds.map((id) => {
        const a = acctById.get(id);
        const p = prog.perAccount.get(id) || { total: 0, reviewed: 0, remaining: 0, done: false };
        const bal = a ? liveBalance(a) : 0;
        return {
          id,
          name: a?.name ?? "Account",
          label: a ? accountLabel(a) : "—",
          type: a?.type ?? "checking",
          mask: a?.mask ?? null,
          balance: bal,
          balanceLabel: money2(bal),
          total: p.total,
          reviewed: p.reviewed,
          remaining: p.remaining,
          done: p.done,
        };
      });
      const allowance = allowanceById.get(mid) ?? 0;
      // What the member has spent this month (transactions attributed to them) —
      // this is the figure personal-allowance budgets track, so it stays
      // consistent with the owner-side Budgets screen.
      const spent = memberTotals.get(mid) || 0;
      const remaining = allowance > 0 ? Math.max(0, allowance - spent) : 0;
      // The member's personal budgets (owner sets these to a person on Budgets).
      // Same precedence as the owner Budgets screen (budgetSpent), so a budget
      // shows the SAME number to the owner and the member.
      const myBudgets = budgetRows
        .filter((b) => b.memberId === mid)
        .map((b) => {
          const bSpent = budgetSpent(
            { categoryId: b.categoryId, memberId: b.memberId, storedSpent: n(b.spent) },
            catTotals,
            memberTotals
          );
          const limit = n(b.limitAmount);
          return {
            id: b.id,
            name: b.name,
            icon: b.icon ?? undefined,
            spent: bSpent,
            spentLabel: money2(bSpent),
            limit,
            limitLabel: money2(limit),
            remaining: Math.max(0, limit - bSpent),
            remainingLabel: money2(Math.max(0, limit - bSpent)),
            pct: limit > 0 ? Math.min(100, Math.round((bSpent / limit) * 100)) : 0,
          };
        });
      // All transactions on the member's accounts (reviewed + not), newest
      // first — drives the browsable Activity tab. Same row shape as data.txns.
      const myTxns = (data.txns as { id: number; reviewed: boolean; accountId: string | null }[])
        .filter((t) => t.accountId != null && managedSet.has(t.accountId))
        .slice()
        .reverse();
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Performance allowance, if this member is an earner (or just a recipient).
      const myPendingAllowance = instanceRows
        .filter((i) => i.memberId === mid && i.status === "pending" && (i.triggeredBy ?? "").startsWith("allowance:"))
        .map((i) => ({ amount: n(i.amount), amountLabel: money2(n(i.amount)), note: i.note ?? null }));
      const earnerRule = allowanceRuleRows.find((r) => r.memberId === mid && r.enabled);
      let performance: Record<string, unknown> | null = null;
      if (earnerRule) {
        const { income, result } = allowancePreviewFor(earnerRule);
        const myPayout = result.payouts.find((p) => p.memberId === mid);
        const goal = n(earnerRule.goalAmount);
        performance = {
          ruleName: earnerRule.name,
          period: earnerRule.period,
          periodLabel: earnerRule.period === "per_paycheck" ? "per paycheck" : "this month",
          goal,
          goalLabel: money0(goal),
          income,
          incomeLabel: money0(income),
          over: result.over,
          pct: goal > 0 ? Math.min(100, Math.round((income / goal) * 100)) : 0,
          minLabel: money2(n(earnerRule.minAmount)),
          bonus: result.earnerBonus,
          bonusLabel: money2(result.earnerBonus),
          projected: myPayout?.amount ?? 0,
          projectedLabel: money2(myPayout?.amount ?? 0),
          pendingTransfers: myPendingAllowance,
        };
      } else if (myPendingAllowance.length) {
        performance = { recipientOnly: true, pendingTransfers: myPendingAllowance };
      }

      return {
        memberId: mid,
        name: memberById.get(mid)?.name ?? "there",
        performance,
        allowance,
        allowanceLabel: money0(allowance),
        spent,
        spentLabel: money2(spent),
        remaining,
        remainingLabel: money2(remaining),
        monthLabel: now.toLocaleString("en-US", { month: "long" }),
        prevMonthLabel: prevDate.toLocaleString("en-US", { month: "long" }),
        managedAccounts,
        budgets: myBudgets,
        totalRemaining: prog.totalRemaining,
        allCaughtUp: prog.allCaughtUp,
        prevMonthRemaining: prog.prevMonthRemaining,
        allowanceUnlocked: prog.allowanceUnlocked,
        // unreviewed txns (Categorize tab) and the full activity list (Activity tab).
        reviewQueue: myTxns.filter((t) => !t.reviewed),
        activity: myTxns,
      };
    };
    // Whose home to show: the viewer's own. For an OWNER previewing via
    // "View as member" (owners have no member identity of their own), fall back
    // to the first real member so the preview lands on an actual person instead
    // of hanging on "Loading…".
    let homeMemberId: string | null = viewer?.memberId ?? null;
    if (!homeMemberId && viewer?.role === "owner") {
      const preview = memberRows.find((m) => m.role === "member") || memberRows.find((m) => m.role !== "owner");
      homeMemberId = preview?.id ?? null;
    }
    data.memberHome = homeMemberId ? buildMemberHome(homeMemberId) : null;

    // Final privacy pass: a member's browser receives the whole object, so
    // household-wide sections (stats, budgets, transfers, income registry,
    // roster, …) are blanked server-side. Spendable's inputs are kept.
    if (isMemberView) scrubForMemberView(data);

    return data;
  } catch (err) {
    // Most likely cause: the live DB is behind the code's schema (run the
    // latest migration SQL). Show EMPTY states rather than the demo mock.
    console.error("[getFinanceData] DB read failed — showing empty data. Run supabase-sync.sql?", err);
    return isDbConfigured ? emptyData() : fallbackData();
  }
}
