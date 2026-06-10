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
import { asc } from "drizzle-orm";
import { detectRecurring, detectIncomeStreams } from "./detect";
import { computeMemberProgress } from "./allowance";
import { projectGoal, canViewGoal } from "./savings";
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
  d.txns = [];
  d.budgets = [];
  d.rules = [];
  d.incomeStreams = [];
  d.bills = [];
  d.goals = [];
  d.savingsStats = { totalSaved: 0, totalSavedDisplay: "$0", monthlyContrib: 0, monthlyContribDisplay: "$0", activeCount: 0, onTrackCount: 0 };
  d.upcoming = [];
  d.past = [];
  d.notifications = [];
  d.notifRules = [];
  d.learned = [];
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
    const accountRows = await db.select().from(s.accounts).orderBy(asc(s.accounts.sortOrder));
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
    const txnRows = await db.select().from(s.transactions).orderBy(asc(s.transactions.id));
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
    // Which of our accounts are linked to a Plaid (auto-syncing) bank.
    const plaidAcctRows = await db.select({ accountId: s.plaidAccounts.accountId }).from(s.plaidAccounts).catch(() => [] as { accountId: string | null }[]);
    const plaidLinkedIds = new Set(plaidAcctRows.map((r) => r.accountId).filter(Boolean) as string[]);
    const allowanceRows = await db
      .select({ id: s.familyMembers.id, allowance: s.familyMembers.allowance })
      .from(s.familyMembers)
      .catch(() => [] as { id: string; allowance: string | null }[]);

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
    data.members = memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      email: m.email,
      status: m.status,
      color: m.color,
      allowance: allowanceById.get(m.id) ?? 0,
    }));
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
          who: a.who,
          managers: managersByAccount.get(a.id) ?? [],
          plaidLinked: plaidLinkedIds.has(a.id),
          synced: a.syncedLabel,
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
    data.txns = txnRows.filter((t) => canSeeAccount(t.accountId)).map((t) => {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      const member = t.memberId ? memberById.get(t.memberId) : undefined;
      const acct = t.accountId ? acctById.get(t.accountId) : undefined;
      const dt = parseDate(t.date as string | null);
      return {
        id: t.id,
        date: dt ? dayLabel(dt) : t.dateLabel ?? "",
        merchant: t.merchant,
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
      };
    });

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
        icon: r.method === "manual" ? "transfers" : "repeat",
        member: mem,
        status: r.status,
        fromAccountId: r.fromAccountId,
        toAccountId: r.toAccountId,
        memberId: r.memberId,
        completedTxnId: r.completedTxnId,
        _t: completed || (dt ? dt.getTime() : 0),
      };
    };

    const pendingInstances = instanceRows.filter((r) => r.status === "pending");
    data.upcoming = pendingInstances.map(mapInstance);

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

    // Pending banner (derived — count + total $ to move).
    const pendingTotal = pendingInstances.reduce((sum, r) => sum + n(r.amount), 0);
    data.transfersPending = pendingInstances.length;
    data.transfersPendingTotal = money2(pendingTotal);
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
    // spend (for personal-allowance budgets).
    const catTotals = new Map<string, number>();
    const memberTotals = new Map<string, number>();
    let monthSpending = 0;
    let monthIncome = 0;
    for (const t of txnRows) {
      const dt = parseDate(t.date as string | null);
      if (!dt || monthKey(dt) !== targetKey) continue;
      if (t.isTransfer) continue;
      const amt = n(t.amount);
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.kind === "transfer") continue;
      if (t.income || amt > 0) {
        monthIncome += Math.abs(amt);
      } else {
        const spend = Math.abs(amt);
        monthSpending += spend;
        if (t.memberId) memberTotals.set(t.memberId, (memberTotals.get(t.memberId) || 0) + spend);
        const splits = splitsByTxn.get(t.id);
        if (t.hasSplit && splits?.length) {
          for (const sp of splits) {
            const key = sp.categoryId || "uncategorized";
            catTotals.set(key, (catTotals.get(key) || 0) + Math.abs(n(sp.amount)));
          }
        } else {
          const key = t.categoryId || "uncategorized";
          catTotals.set(key, (catTotals.get(key) || 0) + spend);
        }
      }
    }

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
      let spent = n(b.spent);
      if (b.categoryId) spent = catTotals.get(b.categoryId) || 0;
      else if (b.memberId) spent = memberTotals.get(b.memberId) || 0;
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
      if (!b || t.isTransfer) continue;
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.kind === "transfer") continue;
      const amt = n(t.amount);
      if (t.income || amt > 0) b.inc += Math.abs(amt);
      else b.sp += Math.abs(amt);
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
      const myBudgets = budgetRows
        .filter((b) => b.memberId === mid)
        .map((b) => {
          const bSpent = memberTotals.get(mid) || 0;
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
      return {
        memberId: mid,
        name: memberById.get(mid)?.name ?? "there",
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

    return data;
  } catch (err) {
    // Most likely cause: the live DB is behind the code's schema (run the
    // latest migration SQL). Show EMPTY states rather than the demo mock.
    console.error("[getFinanceData] DB read failed — showing empty data. Run supabase-sync.sql?", err);
    return isDbConfigured ? emptyData() : fallbackData();
  }
}
