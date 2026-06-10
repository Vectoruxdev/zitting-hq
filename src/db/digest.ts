/**
 * Email-digest aggregation (pure). Turns raw transactions into a household
 * overview (for the owner) and a per-member spending summary, over an arbitrary
 * date window (week / 2 weeks / month). No `Date.now()` — the window is injected
 * — so it's deterministic and unit-testable, like savings.ts / detect.ts.
 *
 * Aggregation rules mirror getFinanceData exactly: amounts are signed (negative =
 * spending), `isTransfer` and `kind === "transfer"` are excluded, splits are
 * attributed per `transaction_splits` row, and a txn is in-window when
 * start ≤ date < end (ISO YYYY-MM-DD string compare).
 */

export type DigestCadence = "weekly" | "biweekly" | "monthly";

export interface DigestWindow {
  start: string; // inclusive ISO
  end: string; // exclusive ISO (the run date)
  label: string; // e.g. "Jun 2 – Jun 8"
  prevStart: string;
  prevEnd: string;
}

export interface DigestTxn {
  id: number;
  date: string | null;
  amount: number; // signed; negative = spend
  income: boolean;
  isTransfer: boolean;
  memberId: string | null;
  categoryId: string | null;
  merchant: string;
  hasSplit: boolean;
}
export interface DigestSplit { transactionId: number; categoryId: string | null; amount: number; }
export interface DigestCategory { name: string; color: string; kind: string; }
export interface DigestMember { name: string; allowance: number; }
export interface DigestBudget { name: string; categoryId: string | null; memberId: string | null; limit: number; }
export interface DigestGoal { name: string; saved: number; target: number; }
export interface DigestUpcoming { label: string; amount: number; due: string | null; }

export interface DigestInput {
  txns: DigestTxn[];
  splits: DigestSplit[];
  categories: Map<string, DigestCategory>;
  members: Map<string, DigestMember>;
  budgets: DigestBudget[];
  goals: DigestGoal[];
  upcoming: DigestUpcoming[];
  window: DigestWindow;
  /** Unreviewed-txn counts per member (computed by the caller). */
  toCategorizeByMember?: Map<string, number>;
}

export interface CatSlice { id: string; name: string; amount: number; percent: number; color: string; }
export interface BiggestTxn { merchant: string; amount: number; date: string | null; member: string | null; }

export interface OwnerDigest {
  periodLabel: string;
  totalSpent: number;
  totalIncome: number;
  net: number;
  topCategories: CatSlice[];
  perMember: { id: string; name: string; spent: number; topCategory: string | null; txnCount: number }[];
  biggest: BiggestTxn[];
  topMerchants: { merchant: string; amount: number }[];
  budgets: { name: string; spent: number; limit: number; over: boolean }[];
  goals: { name: string; saved: number; target: number; pct: number }[];
  upcoming: DigestUpcoming[];
  vsPrev: { spentDelta: number; spentPct: number | null; incomeDelta: number };
  txnCount: number;
}

export interface MemberDigest {
  id: string;
  name: string;
  periodLabel: string;
  totalSpent: number;
  txnCount: number;
  topCategories: CatSlice[];
  biggest: BiggestTxn[];
  allowance: { spent: number; limit: number; left: number } | null;
  vsPrev: { spentDelta: number; spentPct: number | null };
  toCategorizeCount: number;
}

const PALETTE = ["var(--green-500)", "var(--indigo-500)", "var(--amber-500)", "var(--green-600)", "var(--gray-500)"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_DAY = 86400000;
const toUTC = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z");
const fmtISO = (d: Date) => d.toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) => fmtISO(new Date(toUTC(iso).getTime() + days * MS_DAY));
function addMonthsISO(iso: string, months: number): string {
  const d = toUTC(iso);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return fmtISO(new Date(Date.UTC(y, m, day)));
}
function rangeLabel(startISO: string, endExclusiveISO: string): string {
  const a = toUTC(startISO);
  const b = toUTC(addDaysISO(endExclusiveISO, -1)); // inclusive last day
  const aL = `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()}`;
  const bL = `${MONTHS[b.getUTCMonth()]} ${b.getUTCDate()}`;
  return aL === bL ? aL : `${aL} – ${bL}`;
}

/** The window a digest covers, plus the equal window immediately before it. */
export function windowFor(cadence: DigestCadence, runISO: string): DigestWindow {
  const end = runISO.slice(0, 10);
  let start: string;
  let prevStart: string;
  if (cadence === "monthly") {
    start = addMonthsISO(end, -1);
    prevStart = addMonthsISO(start, -1);
  } else {
    const days = cadence === "biweekly" ? 14 : 7;
    start = addDaysISO(end, -days);
    prevStart = addDaysISO(start, -days);
  }
  return { start, end, prevStart, prevEnd: start, label: rangeLabel(start, end) };
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const inWindow = (date: string | null, start: string, end: string) =>
  date != null && date.slice(0, 10) >= start && date.slice(0, 10) < end;

interface Agg {
  spend: number;
  income: number;
  catTotals: Map<string, number>;
  memberSpend: Map<string, number>;
  memberCat: Map<string, Map<string, number>>;
  memberCount: Map<string, number>;
  merchantTotals: Map<string, number>;
  spendTxns: { merchant: string; amount: number; date: string | null; memberId: string | null }[];
  txnCount: number;
}

/** Single pass over the txns that fall in [start, end). */
function aggregate(input: DigestInput, start: string, end: string): Agg {
  const splitsByTxn = new Map<number, DigestSplit[]>();
  for (const sp of input.splits) {
    const arr = splitsByTxn.get(sp.transactionId) || [];
    arr.push(sp);
    splitsByTxn.set(sp.transactionId, arr);
  }
  const a: Agg = {
    spend: 0, income: 0, catTotals: new Map(), memberSpend: new Map(), memberCat: new Map(),
    memberCount: new Map(), merchantTotals: new Map(), spendTxns: [], txnCount: 0,
  };
  for (const t of input.txns) {
    if (!inWindow(t.date, start, end)) continue;
    if (t.isTransfer) continue;
    const cat = t.categoryId ? input.categories.get(t.categoryId) : undefined;
    if (cat?.kind === "transfer") continue;
    const amt = n(t.amount);
    if (t.income || amt > 0) {
      a.income += Math.abs(amt);
      continue;
    }
    const spend = Math.abs(amt);
    a.spend += spend;
    a.txnCount += 1;
    a.spendTxns.push({ merchant: t.merchant, amount: spend, date: t.date, memberId: t.memberId });
    const merchant = (t.merchant || "—").trim();
    a.merchantTotals.set(merchant, (a.merchantTotals.get(merchant) || 0) + spend);
    // Category attribution (splits-aware).
    const slices = t.hasSplit && splitsByTxn.get(t.id)?.length
      ? splitsByTxn.get(t.id)!.map((sp) => ({ catId: sp.categoryId || "uncategorized", amt: Math.abs(n(sp.amount)) }))
      : [{ catId: t.categoryId || "uncategorized", amt: spend }];
    for (const sl of slices) a.catTotals.set(sl.catId, (a.catTotals.get(sl.catId) || 0) + sl.amt);
    // Per-member.
    if (t.memberId) {
      a.memberSpend.set(t.memberId, (a.memberSpend.get(t.memberId) || 0) + spend);
      a.memberCount.set(t.memberId, (a.memberCount.get(t.memberId) || 0) + 1);
      const mc = a.memberCat.get(t.memberId) || new Map<string, number>();
      for (const sl of slices) mc.set(sl.catId, (mc.get(sl.catId) || 0) + sl.amt);
      a.memberCat.set(t.memberId, mc);
    }
  }
  return a;
}

function topCats(totals: Map<string, number>, categories: Map<string, DigestCategory>, limit = 5): CatSlice[] {
  const total = [...totals.values()].reduce((s, v) => s + v, 0) || 1;
  const sorted = [...totals.entries()].sort((x, y) => y[1] - x[1]);
  const out: CatSlice[] = sorted.slice(0, limit).map(([id, amount], i) => ({
    id,
    name: categories.get(id)?.name ?? "Uncategorized",
    amount,
    percent: Math.round((amount / total) * 100),
    color: categories.get(id)?.color ?? PALETTE[i % PALETTE.length],
  }));
  const rest = sorted.slice(limit).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) out.push({ id: "other", name: "Other", amount: rest, percent: Math.round((rest / total) * 100), color: "var(--gray-500)" });
  return out;
}

const pctDelta = (cur: number, prev: number): number | null =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;

export function generateDigests(input: DigestInput): { household: OwnerDigest; byMember: Map<string, MemberDigest> } {
  const w = input.window;
  const cur = aggregate(input, w.start, w.end);
  const prev = aggregate(input, w.prevStart, w.prevEnd);

  // ---- Owner / household ----
  const perMember = [...cur.memberSpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, spent]) => {
      const mc = cur.memberCat.get(id);
      const topCat = mc ? [...mc.entries()].sort((a, b) => b[1] - a[1])[0] : null;
      return {
        id,
        name: input.members.get(id)?.name ?? "Member",
        spent,
        topCategory: topCat ? input.categories.get(topCat[0])?.name ?? "Uncategorized" : null,
        txnCount: cur.memberCount.get(id) || 0,
      };
    });

  const biggest = (txns: Agg["spendTxns"]): BiggestTxn[] =>
    [...txns].sort((a, b) => b.amount - a.amount).slice(0, 5).map((t) => ({
      merchant: t.merchant, amount: t.amount, date: t.date,
      member: t.memberId ? input.members.get(t.memberId)?.name ?? null : null,
    }));

  const topMerchants = [...cur.merchantTotals.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([merchant, amount]) => ({ merchant, amount }));

  const budgets = input.budgets.map((b) => {
    const spent = b.categoryId ? cur.catTotals.get(b.categoryId) || 0
      : b.memberId ? cur.memberSpend.get(b.memberId) || 0 : 0;
    return { name: b.name, spent, limit: b.limit, over: b.limit > 0 && spent > b.limit };
  });

  const goals = input.goals
    .map((g) => ({ name: g.name, saved: g.saved, target: g.target, pct: g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0 }))
    .sort((a, b) => b.pct - a.pct).slice(0, 5);

  const household: OwnerDigest = {
    periodLabel: w.label,
    totalSpent: Math.round(cur.spend),
    totalIncome: Math.round(cur.income),
    net: Math.round(cur.income - cur.spend),
    topCategories: topCats(cur.catTotals, input.categories),
    perMember,
    biggest: biggest(cur.spendTxns),
    topMerchants,
    budgets,
    goals,
    upcoming: input.upcoming.slice(0, 5),
    vsPrev: { spentDelta: Math.round(cur.spend - prev.spend), spentPct: pctDelta(cur.spend, prev.spend), incomeDelta: Math.round(cur.income - prev.income) },
    txnCount: cur.txnCount,
  };

  // ---- Per member ----
  const byMember = new Map<string, MemberDigest>();
  for (const [id, m] of input.members) {
    const spent = cur.memberSpend.get(id) || 0;
    const prevSpent = prev.memberSpend.get(id) || 0;
    const theirTxns = cur.spendTxns.filter((t) => t.memberId === id);
    const allowance = m.allowance > 0 ? { spent: Math.round(spent), limit: m.allowance, left: Math.round(m.allowance - spent) } : null;
    byMember.set(id, {
      id,
      name: m.name,
      periodLabel: w.label,
      totalSpent: Math.round(spent),
      txnCount: cur.memberCount.get(id) || 0,
      topCategories: topCats(cur.memberCat.get(id) || new Map(), input.categories, 4),
      biggest: biggest(theirTxns),
      allowance,
      vsPrev: { spentDelta: Math.round(spent - prevSpent), spentPct: pctDelta(spent, prevSpent) },
      toCategorizeCount: input.toCategorizeByMember?.get(id) || 0,
    });
  }

  return { household, byMember };
}
