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
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { MOCK_FINANCE_DATA } from "@/finance/data/mockData";

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
  d.upcoming = [];
  d.past = [];
  d.notifications = [];
  d.notifRules = [];
  d.receiptItems = [];
  d.categories = [];
  d.allCategories = [];
  d.categoryGroups = [];
  d.members = [];
  d.catRules = [];
  d.stats = { totalCash: "$0", spending: "$0", income: "$0", transfers: "$0" };
  d.trend = { income: [0, 0, 0, 0, 0, 0], spending: [0, 0, 0, 0, 0, 0], labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] };
  d.member = null;
  d.ask = { prompts: ["How much did we spend on dining?", "Where can we cut $300/month?"], messages: [] };
  d.permissions = null;
  return d;
}

// On a deployed environment, never show the curated mock — show empty instead.
const fallbackData = (): FinanceData => (process.env.VERCEL ? emptyData() : MOCK_FINANCE_DATA);

export async function getFinanceData(): Promise<FinanceData> {
  if (!isDbConfigured || !db) return fallbackData();

  try {
    // --- sequential reads (pooler-safe) ---
    const accountRows = await db.select().from(s.accounts).orderBy(asc(s.accounts.sortOrder));
    const memberRows = await db.select().from(s.familyMembers).orderBy(asc(s.familyMembers.name));
    const groupRows = await db.select().from(s.categoryGroups).orderBy(asc(s.categoryGroups.sortOrder));
    const catRows = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder));
    const catRuleRows = await db.select().from(s.categorizationRules).orderBy(asc(s.categorizationRules.priority));
    const txnRows = await db.select().from(s.transactions).orderBy(asc(s.transactions.id));
    const splitRows = await db.select().from(s.transactionSplits).orderBy(asc(s.transactionSplits.sortOrder));
    const budgetRows = await db.select().from(s.budgets).orderBy(asc(s.budgets.sortOrder));
    const ruleRows = await db.select().from(s.allocationRules).orderBy(asc(s.allocationRules.sortOrder));
    const incomeRows = await db.select().from(s.incomeStreams).orderBy(asc(s.incomeStreams.sortOrder));
    const billRows = await db.select().from(s.bills).orderBy(asc(s.bills.sortOrder));
    const goalRows = await db.select().from(s.savingsGoals).orderBy(asc(s.savingsGoals.sortOrder));
    const transferRows = await db.select().from(s.transfers).orderBy(asc(s.transfers.sortOrder));
    const notifRows = await db.select().from(s.notifications).orderBy(asc(s.notifications.sortOrder));
    const notifRuleRows = await db.select().from(s.notificationRules).orderBy(asc(s.notificationRules.sortOrder));
    const receiptRows = await db.select().from(s.receiptItems).orderBy(asc(s.receiptItems.sortOrder));

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
    data.accountsFlat = accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      mask: a.mask,
      label: accountLabel(a),
    }));

    // --- accounts (grouped) ---
    const byType = (t: string) =>
      accountRows
        .filter((a) => a.type === t)
        .map((a) => ({
          id: a.id,
          name: a.name,
          inst: a.institution,
          mask: a.mask,
          balance: n(a.balance),
          who: a.who,
          synced: a.syncedLabel,
          status: a.status,
          trend: a.trend ?? [],
          dest: a.destLabel,
        }));
    data.accounts = { checking: byType("checking"), savings: byType("savings"), credit: byType("credit") };

    // --- transactions (resolve labels from FKs, fall back to legacy cols) ---
    data.txns = txnRows.map((t) => {
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

    // --- budgets / rules / income / bills / goals / transfers / notifs ---
    data.budgets = budgetRows.map((b) => ({
      name: b.name,
      who: b.who,
      icon: b.icon ?? undefined,
      spent: n(b.spent),
      limit: n(b.limitAmount),
    }));
    data.rules = ruleRows.map((r) => ({
      id: r.id,
      name: r.name,
      method: r.method,
      value: r.value == null ? null : n(r.value),
      dest: r.dest,
      icon: r.icon,
    }));
    data.incomeStreams = incomeRows.map((i) => ({
      id: i.id,
      name: i.name,
      sub: i.sub,
      monthly: n(i.monthly),
      cadence: i.cadence,
      last: i.lastLabel,
      next: i.nextLabel,
      status: i.status,
      spark: i.spark ?? [],
    }));
    data.bills = billRows.map((b) => ({
      id: b.id,
      name: b.name,
      cat: b.category,
      color: b.color,
      amount: n(b.amount),
      freq: b.freq,
      next: b.nextLabel,
      account: b.accountLabel,
      ...(b.badge ? { badge: b.badge } : {}),
      ...(b.delta ? { delta: b.delta } : {}),
    }));
    data.goals = goalRows.map((g) => ({
      id: g.id,
      name: g.name,
      saved: n(g.saved),
      target: n(g.target),
      date: g.dateLabel,
      account: g.accountLabel,
      contrib: n(g.contrib),
    }));
    const mapTransfer = (row: (typeof transferRows)[number]) => ({
      to: row.toLabel,
      from: row.fromLabel,
      amount: money2(n(row.amount)),
      due: row.dueLabel,
      state: row.state,
      icon: row.icon,
    });
    data.upcoming = transferRows.filter((t) => t.kind === "upcoming").map(mapTransfer);
    data.past = transferRows.filter((t) => t.kind === "past").map(mapTransfer);
    data.notifications = notifRows.map((notif) => ({
      id: notif.id,
      type: notif.type,
      icon: notif.icon,
      tone: notif.tone,
      title: notif.title,
      body: notif.body,
      time: notif.timeLabel,
      unread: notif.unread,
    }));
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
    const curKey = monthKey(now);
    const isExpenseTxn = (t: (typeof txnRows)[number]) =>
      !t.isTransfer && (t.categoryId ? catById.get(t.categoryId)?.kind !== "transfer" : true);

    // Spending breakdown by category (current month, splits-aware)
    const catTotals = new Map<string, number>();
    let monthSpending = 0;
    let monthIncome = 0;
    for (const t of txnRows) {
      const dt = parseDate(t.date as string | null);
      if (!dt || monthKey(dt) !== curKey) continue;
      if (t.isTransfer) continue;
      const amt = n(t.amount);
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.kind === "transfer") continue;
      if (t.income || amt > 0) {
        monthIncome += Math.abs(amt);
      } else {
        const spend = Math.abs(amt);
        monthSpending += spend;
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

    // Total cash = checking + savings balances
    const totalCash = accountRows
      .filter((a) => a.type === "checking" || a.type === "savings")
      .reduce((sum, a) => sum + n(a.balance), 0);
    const upcomingTotal = transferRows
      .filter((t) => t.kind === "upcoming")
      .reduce((sum, t) => sum + n(t.amount), 0);

    data.stats = {
      totalCash: money0(totalCash),
      spending: money0(monthSpending),
      income: money0(monthIncome),
      transfers: money0(upcomingTotal),
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

    return data;
  } catch (err) {
    // Most likely cause: the live DB is behind the code's schema (run the
    // latest migration SQL). Show EMPTY states rather than the demo mock.
    console.error("[getFinanceData] DB read failed — showing empty data. Run supabase-sync.sql?", err);
    return isDbConfigured ? emptyData() : fallbackData();
  }
}
