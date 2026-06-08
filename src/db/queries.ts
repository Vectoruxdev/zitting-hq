/**
 * Assembles the `ZHQ_DATA` object the finance screens consume.
 *
 * Strategy: start from the curated defaults (MOCK_FINANCE_DATA), then override
 * each *entity* section with live DB rows when present. Purely-presentational
 * sections (stats, trend, categories, member, ask, permissions, nav) stay as
 * defaults for now. Any DB error or missing config falls back to full mock, so
 * the app never breaks.
 */
import { asc } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { MOCK_FINANCE_DATA } from "@/finance/data/mockData";

const n = (v: unknown) => (v == null ? 0 : Number(v));
const fmt = (v: unknown) =>
  "$" + n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type FinanceData = typeof MOCK_FINANCE_DATA;

export async function getFinanceData(): Promise<FinanceData> {
  if (!isDbConfigured || !db) {
    console.log("[getFinanceData] source=mock (no database configured)");
    return MOCK_FINANCE_DATA;
  }

  try {
    const [
      accountRows,
      txnRows,
      budgetRows,
      ruleRows,
      incomeRows,
      billRows,
      goalRows,
      transferRows,
      notifRows,
      notifRuleRows,
      receiptRows,
    ] = await Promise.all([
      db.select().from(s.accounts).orderBy(asc(s.accounts.sortOrder)),
      db.select().from(s.transactions).orderBy(asc(s.transactions.sortOrder)),
      db.select().from(s.budgets).orderBy(asc(s.budgets.sortOrder)),
      db.select().from(s.allocationRules).orderBy(asc(s.allocationRules.sortOrder)),
      db.select().from(s.incomeStreams).orderBy(asc(s.incomeStreams.sortOrder)),
      db.select().from(s.bills).orderBy(asc(s.bills.sortOrder)),
      db.select().from(s.savingsGoals).orderBy(asc(s.savingsGoals.sortOrder)),
      db.select().from(s.transfers).orderBy(asc(s.transfers.sortOrder)),
      db.select().from(s.notifications).orderBy(asc(s.notifications.sortOrder)),
      db.select().from(s.notificationRules).orderBy(asc(s.notificationRules.sortOrder)),
      db.select().from(s.receiptItems).orderBy(asc(s.receiptItems.sortOrder)),
    ]);

    // Deep clone the defaults so we never mutate the shared mock object.
    const data: FinanceData = JSON.parse(JSON.stringify(MOCK_FINANCE_DATA));

    if (accountRows.length) {
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
    }

    if (txnRows.length) {
      data.txns = txnRows.map((t) => ({
        id: t.id,
        date: t.dateLabel,
        merchant: t.merchant,
        cat: t.category,
        color: t.color,
        who: t.who,
        account: t.accountLabel,
        amt: n(t.amount),
        income: t.income,
        pending: t.pending,
        flagged: t.flagged,
      }));
    }

    if (budgetRows.length) {
      data.budgets = budgetRows.map((b) => ({
        name: b.name,
        who: b.who,
        icon: b.icon ?? undefined,
        spent: n(b.spent),
        limit: n(b.limitAmount),
      }));
    }

    if (ruleRows.length) {
      data.rules = ruleRows.map((r) => ({
        id: r.id,
        name: r.name,
        method: r.method,
        value: r.value == null ? null : n(r.value),
        dest: r.dest,
        icon: r.icon,
      }));
    }

    if (incomeRows.length) {
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
    }

    if (billRows.length) {
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
    }

    if (goalRows.length) {
      data.goals = goalRows.map((g) => ({
        id: g.id,
        name: g.name,
        saved: n(g.saved),
        target: n(g.target),
        date: g.dateLabel,
        account: g.accountLabel,
        contrib: n(g.contrib),
      }));
    }

    if (transferRows.length) {
      const map = (row: (typeof transferRows)[number]) => ({
        to: row.toLabel,
        from: row.fromLabel,
        amount: fmt(row.amount),
        due: row.dueLabel,
        state: row.state,
        icon: row.icon,
      });
      data.upcoming = transferRows.filter((t) => t.kind === "upcoming").map(map);
      data.past = transferRows.filter((t) => t.kind === "past").map(map);
    }

    if (notifRows.length) {
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
    }

    if (notifRuleRows.length) {
      data.notifRules = notifRuleRows.map((r) => ({
        id: r.id,
        name: r.name,
        detail: r.detail,
        channels: r.channels,
        on: r.enabled,
      }));
    }

    if (receiptRows.length) {
      data.receiptItems = receiptRows.map((r) => ({
        item: r.item,
        qty: n(r.qty),
        unit: n(r.unit),
        total: n(r.total),
      }));
    }

    console.log(
      `[getFinanceData] source=supabase accounts=${accountRows.length} txns=${txnRows.length} budgets=${budgetRows.length} bills=${billRows.length} goals=${goalRows.length}`
    );
    return data;
  } catch (err) {
    console.error("[getFinanceData] DB read failed, using mock data:", err);
    return MOCK_FINANCE_DATA;
  }
}
