/**
 * Dashboard money-flow math (pure). One classification for the stats cards,
 * the donut, the per-member spend, and the 6-month trend:
 *
 *   transfer (flag or category kind)  → neither income nor spending
 *   income                            → income, SIGNED (a negative income txn,
 *                                       e.g. a payroll reversal in an import,
 *                                       reduces income — it must never inflate
 *                                       it the way Math.abs did)
 *   everything else                   → net spend: a charge (amt<0) adds; a
 *                                       refund (amt>0) subtracts ONLY when it's
 *                                       tagged to an EXPENSE category — so a
 *                                       return nets DOWN its category, but a
 *                                       stray positive deposit can't.
 *
 * REGISTRY-AWARE income: Plaid marks EVERY positive deposit `income` (the flag
 * is literally amount>0), so the raw flag counts card refunds, credit-card
 * payments and transfers-in as income. When the household has curated its
 * income registry (`registryActive`), only deposits from REGISTERED payers
 * count as income. When the registry is empty the raw flag is kept — a family
 * that hasn't marked payers keeps today's behavior.
 *
 * NOT-A-REFUND guard: a leftover positive deposit only nets spending down when
 * it's tagged to an EXPENSE category (a genuine return). Uncategorized or
 * income-kind positives — credit-card payments, untagged inter-account
 * transfers, unregistered income, windfalls — are NEITHER income nor spending.
 * Without this they were folded in as negative spend and could drag a whole
 * month's spending below zero (observed: a real −$10k "spending" total).
 */

export interface FlowTxn {
  amount: number;
  income: boolean;
  isTransfer: boolean;
  /** Resolved category kind; 'transfer' excludes the txn from both sides. */
  catKind: string | null;
  categoryId: string | null;
  memberId: string | null;
  /** Whether the txn's payer (merchant key) is an active registered income source. */
  registeredPayer?: boolean;
  /** Split rows when the txn is split (per-category attribution); else null. */
  splits: { categoryId: string | null; amount: number }[] | null;
}

export interface FlowOpts {
  /** True when at least one income source is registered (registry curated). */
  registryActive?: boolean;
}

/** A txn's contribution to the dashboard: income dollars + net spend dollars. */
export function flowOf(
  t: Pick<FlowTxn, "amount" | "income" | "isTransfer" | "catKind" | "registeredPayer">,
  opts?: FlowOpts
): { income: number; spendNet: number } {
  if (t.isTransfer || t.catKind === "transfer") return { income: 0, spendNet: 0 };
  const isIncome = opts?.registryActive ? t.income && !!t.registeredPayer : t.income;
  if (isIncome) return { income: t.amount, spendNet: 0 };
  const spendNet = -t.amount;
  // Not-a-refund guard: a positive deposit (spendNet < 0) only nets spending
  // down when it's a genuine refund — i.e. tagged to an EXPENSE category. The
  // leftovers here are credit-card payments, untagged transfers, unregistered
  // income and windfalls (Plaid flags every positive amount `income`); folding
  // those in as negative spend dragged the month's total below zero.
  if (spendNet < 0 && t.catKind !== "expense") return { income: 0, spendNet: 0 };
  return { income: 0, spendNet };
}

export interface MonthStats {
  income: number;
  spending: number;
  /** Net spend per category id ('uncategorized' bucket for untagged), splits-aware. */
  catTotals: Map<string, number>;
  /** Net spend per attributed member id. */
  memberTotals: Map<string, number>;
}

/** Whether a txn classifies as income under the active semantics. */
function flowIsIncome(
  t: Pick<FlowTxn, "income" | "registeredPayer">,
  opts?: FlowOpts
): boolean {
  return opts?.registryActive ? t.income && !!t.registeredPayer : t.income;
}

/** Fold one month's transactions into the dashboard aggregates. */
export function foldMonthStats(txns: FlowTxn[], opts?: FlowOpts): MonthStats {
  const catTotals = new Map<string, number>();
  const memberTotals = new Map<string, number>();
  let income = 0;
  let spending = 0;
  for (const t of txns) {
    if (t.isTransfer || t.catKind === "transfer") continue;
    if (flowIsIncome(t, opts)) {
      income += t.amount; // signed — a reversal reduces income
      continue;
    }
    // Net spend: a charge adds, a refund subtracts — attributed to its category.
    const net = -t.amount;
    // Not-a-refund guard (mirrors flowOf): a positive deposit only nets spending
    // down when it's a genuine refund on an EXPENSE category. Uncategorized or
    // income-kind positives (CC payments, untagged transfers, unregistered
    // income, windfalls — all flagged `income` by Plaid's amount>0 rule) are
    // neither income nor spending; folding them in dragged the total negative.
    if (net < 0 && t.catKind !== "expense") continue;
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
