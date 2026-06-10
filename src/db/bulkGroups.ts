/**
 * Merchant grouping for bulk categorization (pure, no DB).
 *
 * Clusters transactions by their stable merchant key so the user can categorize
 * a whole merchant at once ("all 12 Amazon charges → Shopping"). Aggregates the
 * counts, spend, date range, accounts, and the current category distribution per
 * group. Scoring/labels are layered on in getFinanceData. Pure + testable.
 */
import { extractMerchant } from "./categorize";

export interface BulkTxn {
  id: number;
  merchant: string;
  categoryId: string | null;
  reviewed: boolean;
  amount: number;
  accountId: string | null;
  date: string | null;
}

export interface MerchantGroup {
  key: string; // extractMerchant key
  sampleMerchant: string; // a raw description (for display + scoring)
  ids: number[];
  count: number;
  totalSpend: number; // sum of outflow magnitudes (amount < 0)
  net: number; // signed sum
  unreviewed: number;
  uncategorized: number;
  accountIds: string[];
  minDate: string | null;
  maxDate: string | null;
  // categoryId (or "" for none) -> count, so callers can find the dominant one.
  catCounts: Record<string, number>;
}

const UNCATEGORIZED = "uncategorized";

export function buildMerchantGroups(
  rows: BulkTxn[],
  opts: { onlyNeedsReview?: boolean } = {}
): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const t of rows) {
    const key = extractMerchant(t.merchant) || "(unknown)";
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        sampleMerchant: t.merchant,
        ids: [],
        count: 0,
        totalSpend: 0,
        net: 0,
        unreviewed: 0,
        uncategorized: 0,
        accountIds: [],
        minDate: null,
        maxDate: null,
        catCounts: {},
      };
      groups.set(key, g);
    }
    g.ids.push(t.id);
    g.count += 1;
    g.net += t.amount;
    if (t.amount < 0) g.totalSpend += Math.abs(t.amount);
    if (!t.reviewed) g.unreviewed += 1;
    const isUncat = !t.categoryId || t.categoryId === UNCATEGORIZED;
    if (isUncat) g.uncategorized += 1;
    const ck = t.categoryId || "";
    g.catCounts[ck] = (g.catCounts[ck] || 0) + 1;
    if (t.accountId && !g.accountIds.includes(t.accountId)) g.accountIds.push(t.accountId);
    if (t.date) {
      if (!g.minDate || t.date < g.minDate) g.minDate = t.date;
      if (!g.maxDate || t.date > g.maxDate) g.maxDate = t.date;
    }
  }
  let list = [...groups.values()];
  if (opts.onlyNeedsReview) list = list.filter((g) => g.unreviewed > 0 || g.uncategorized > 0);
  // Biggest cleanup wins first: most unreviewed, then most uncategorized, then size.
  list.sort((a, b) => b.unreviewed - a.unreviewed || b.uncategorized - a.uncategorized || b.count - a.count || a.key.localeCompare(b.key));
  return list;
}

/** The dominant (most common) non-empty category id in a group, or null. */
export function dominantCategory(catCounts: Record<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of Object.entries(catCounts)) {
    if (!k || k === UNCATEGORIZED) continue;
    if (n > bestN) { bestN = n; best = k; }
  }
  return best;
}
