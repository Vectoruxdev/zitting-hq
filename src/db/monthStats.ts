/**
 * Dashboard money-flow math (pure). One classification for the stats cards,
 * the donut, the per-member spend, and the 6-month trend:
 *
 *   transfer (flag or category kind)  → neither income nor spending
 *   income-flagged                    → income, SIGNED (a negative income txn,
 *                                       e.g. a payroll reversal in an import,
 *                                       reduces income — it must never inflate
 *                                       it the way Math.abs did)
 *   everything else                   → net spend: a charge (amt<0) adds,
 *                                       a refund (amt>0, not income) subtracts —
 *                                       so a return nets DOWN spending instead
 *                                       of inflating income.
 */

export interface FlowTxn {
  amount: number;
  income: boolean;
  isTransfer: boolean;
  /** Resolved category kind; 'transfer' excludes the txn from both sides. */
  catKind: string | null;
  categoryId: string | null;
  memberId: string | null;
  /** Split rows when the txn is split (per-category attribution); else null. */
  splits: { categoryId: string | null; amount: number }[] | null;
}

/** A txn's contribution to the dashboard: income dollars + net spend dollars. */
export function flowOf(t: Pick<FlowTxn, "amount" | "income" | "isTransfer" | "catKind">): {
  income: number;
  spendNet: number;
} {
  if (t.isTransfer || t.catKind === "transfer") return { income: 0, spendNet: 0 };
  if (t.income) return { income: t.amount, spendNet: 0 };
  return { income: 0, spendNet: -t.amount };
}

export interface MonthStats {
  income: number;
  spending: number;
  /** Net spend per category id ('uncategorized' bucket for untagged), splits-aware. */
  catTotals: Map<string, number>;
  /** Net spend per attributed member id. */
  memberTotals: Map<string, number>;
}

/** Fold one month's transactions into the dashboard aggregates. */
export function foldMonthStats(txns: FlowTxn[]): MonthStats {
  const catTotals = new Map<string, number>();
  const memberTotals = new Map<string, number>();
  let income = 0;
  let spending = 0;
  for (const t of txns) {
    const flow = flowOf(t);
    income += flow.income;
    if (t.isTransfer || t.catKind === "transfer" || t.income) continue;
    const net = flow.spendNet;
    spending += net;
    if (t.memberId) memberTotals.set(t.memberId, (memberTotals.get(t.memberId) || 0) + net);
    if (t.splits && t.splits.length) {
      // Attribute the txn's direction to each split's magnitude.
      const sign = net >= 0 ? 1 : -1;
      for (const sp of t.splits) {
        const key = sp.categoryId || "uncategorized";
        catTotals.set(key, (catTotals.get(key) || 0) + Math.abs(sp.amount) * sign);
      }
    } else {
      const key = t.categoryId || "uncategorized";
      catTotals.set(key, (catTotals.get(key) || 0) + net);
    }
  }
  return { income, spending, catTotals, memberTotals };
}
