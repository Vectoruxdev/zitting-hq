/**
 * Member-home trend math (pure). Series for the Spendable view: how spending
 * moved month to month, and how each managed account's balance moved — the
 * "see your money over time" layer of the member experience. Same flow
 * classification as the household dashboard (monthStats.flowOf), so a refund
 * nets spending down here too.
 */
import { flowOf, type FlowOpts } from "./monthStats";

export interface SeriesTxn {
  dateISO: string | null;
  amount: number;
  income: boolean;
  isTransfer: boolean;
  catKind: string | null;
  registeredPayer?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKeyOf(iso: string): string | null {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${dt.getMonth()}`;
}

/** Net spend per month for the last `months` calendar months (oldest first). */
export function monthlySpendSeries(
  txns: SeriesTxn[],
  now: Date,
  months = 6,
  opts?: FlowOpts
): { labels: string[]; values: number[] } {
  const labels: string[] = [];
  const keys: string[] = [];
  const bucket = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    labels.push(MONTHS[d.getMonth()]);
    keys.push(key);
    bucket.set(key, 0);
  }
  for (const t of txns) {
    if (!t.dateISO) continue;
    const key = monthKeyOf(t.dateISO);
    if (key == null || !bucket.has(key)) continue;
    bucket.set(key, bucket.get(key)! + flowOf(t, opts).spendNet);
  }
  return { labels, values: keys.map((k) => Math.round(bucket.get(k)! * 100) / 100) };
}

/**
 * Income per month for the last `months` calendar months (oldest first), using
 * the same registry-aware classification as the dashboard (flowOf().income —
 * signed, so a reversal nets down). Owners-only data; members are scrubbed
 * upstream. Mirrors `monthlySpendSeries`.
 */
export function monthlyIncomeSeries(
  txns: SeriesTxn[],
  now: Date,
  months = 6,
  opts?: FlowOpts
): { labels: string[]; values: number[] } {
  const labels: string[] = [];
  const keys: string[] = [];
  const bucket = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    labels.push(MONTHS[d.getMonth()]);
    keys.push(key);
    bucket.set(key, 0);
  }
  for (const t of txns) {
    if (!t.dateISO) continue;
    const key = monthKeyOf(t.dateISO);
    if (key == null || !bucket.has(key)) continue;
    bucket.set(key, bucket.get(key)! + flowOf(t, opts).income);
  }
  return { labels, values: keys.map((k) => Math.round(bucket.get(k)! * 100) / 100) };
}

/**
 * Month-end balances for the last `months` calendar months (oldest first),
 * ending at the CURRENT live balance. balance(m) = opening + Σ all txn amounts
 * dated on or before the end of month m; the final point is the live balance.
 */
export function balanceSeries(
  opening: number,
  txns: { dateISO: string | null; amount: number }[],
  now: Date,
  months = 6
): number[] {
  // Net per month key + net for everything BEFORE the window.
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const perMonth = new Map<string, number>(keys.map((k) => [k, 0]));
  let before = 0;
  for (const t of txns) {
    if (!t.dateISO) continue;
    const dt = new Date(t.dateISO + "T00:00:00");
    if (isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (perMonth.has(key)) perMonth.set(key, perMonth.get(key)! + t.amount);
    else if (dt < windowStart) before += t.amount;
    // future-dated rows (pending) are ignored — they haven't happened yet
  }
  const out: number[] = [];
  let running = opening + before;
  for (const k of keys) {
    running += perMonth.get(k)!;
    out.push(Math.round(running * 100) / 100);
  }
  return out;
}

/**
 * Top categories of net spend (descending) with an "everything else" rollup —
 * for the member's "where it went" card. Returns [] when nothing was spent.
 */
export function topSpendCategories(
  txns: (SeriesTxn & { categoryId: string | null })[],
  opts?: FlowOpts,
  top = 4
): { categoryId: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const t of txns) {
    const net = flowOf(t, opts).spendNet;
    if (net === 0) continue;
    const key = t.categoryId || "uncategorized";
    totals.set(key, (totals.get(key) || 0) + net);
  }
  const sorted = [...totals.entries()]
    .map(([categoryId, value]) => ({ categoryId, value: Math.round(value * 100) / 100 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= top) return sorted;
  const rest = sorted.slice(top).reduce((s, x) => s + x.value, 0);
  return [...sorted.slice(0, top), { categoryId: "__other__", value: Math.round(rest * 100) / 100 }];
}
