/**
 * Allocation waterfall + transfer reconciliation (pure, deterministic).
 *
 * `generateInstances` splits an income amount across ordered rules — percent of
 * income, fixed dollars, then "Remainder" sweeps whatever is left — clamping so
 * the total never exceeds the income. `reconcileInstances` matches pending
 * transfers against detected transfer pairs (from `matchTransfers`) so an
 * imported real transaction can auto-complete the right pending item.
 *
 * Both are pure (no Date.now, no DB, no mutation) so they're unit-testable and
 * keep the import pipeline idempotent.
 */

const DAY = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const epochOf = (iso: string) => new Date(iso + "T00:00:00").getTime();

// ---- Generation -----------------------------------------------------------

export interface AllocRule {
  id: string;
  method: string; // "%" | "Fixed" | "Remainder"
  value: number | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  memberId: string | null;
  sortOrder?: number;
}

export interface GeneratedInstance {
  ruleId: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  memberId: string | null;
  amount: number; // rounded to cents, > 0
  method: string;
}

/**
 * Run the waterfall over `income` using `rules` (assumed already filtered to the
 * enabled, on-income, income-matching set). Rules apply in `sortOrder`.
 * `%` is a percentage of the gross income; `Fixed` is a flat amount; `Remainder`
 * takes whatever is left. Every payout is clamped to the running remainder, so
 * the sum of instances never overdraws the income.
 */
export function generateInstances(
  income: number,
  rules: AllocRule[]
): { instances: GeneratedInstance[]; remaining: number } {
  const gross = round2(Math.max(0, income));
  let remaining = gross;
  const out: GeneratedInstance[] = [];
  const ordered = [...rules].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const r of ordered) {
    let amt: number;
    if (r.method === "%") amt = round2(gross * ((r.value ?? 0) / 100));
    else if (r.method === "Fixed") amt = round2(r.value ?? 0);
    else amt = remaining; // Remainder
    amt = round2(Math.min(Math.max(0, amt), remaining));
    if (amt > 0) {
      out.push({
        ruleId: r.id,
        fromAccountId: r.fromAccountId,
        toAccountId: r.toAccountId,
        memberId: r.memberId,
        amount: amt,
        method: r.method,
      });
    }
    remaining = round2(remaining - amt);
  }
  return { instances: out, remaining };
}

// ---- Reconciliation -------------------------------------------------------

export interface PendingInstance {
  id: number;
  fromAccountId: string | null;
  toAccountId: string | null;
  amount: number; // positive
  plannedDate: string | null; // ISO YYYY-MM-DD
}

/** A detected transfer pair, resolved to its accounts/amount/date. */
export interface ResolvedPair {
  outId: number;
  outAccountId: string | null;
  inId: number;
  inAccountId: string | null;
  amount: number; // absolute movement amount
  inDate: string | null; // ISO of the inflow leg
}

export interface Reconciliation {
  instanceId: number;
  completedTxnId: number; // the inflow leg that fulfilled it
}

/**
 * Match pending transfer instances to detected transfer pairs. A pending item
 * matches a pair when the source/destination accounts line up, the amount is
 * within tolerance (max of $absTol or pctTol of the planned amount), and the
 * dates are within `dayWindow`. Each pair and each instance is used at most
 * once; deterministic by lowest id.
 */
export function reconcileInstances(
  pending: PendingInstance[],
  pairs: ResolvedPair[],
  opts: { absTol?: number; pctTol?: number; dayWindow?: number } = {}
): Reconciliation[] {
  const absTol = opts.absTol ?? 1; // $1
  const pctTol = opts.pctTol ?? 0.01; // 1%
  const dayWindow = (opts.dayWindow ?? 7) * DAY;

  const consumed = new Set<number>();
  const out: Reconciliation[] = [];
  const sortedPairs = [...pairs].sort((a, b) => a.inId - b.inId);

  for (const p of sortedPairs) {
    let best: PendingInstance | null = null;
    for (const inst of pending) {
      if (consumed.has(inst.id)) continue;
      if (inst.fromAccountId == null || inst.toAccountId == null) continue;
      if (inst.fromAccountId !== p.outAccountId) continue;
      if (inst.toAccountId !== p.inAccountId) continue;
      const tol = Math.max(absTol, inst.amount * pctTol);
      if (Math.abs(p.amount - inst.amount) > tol) continue;
      if (inst.plannedDate && p.inDate) {
        if (Math.abs(epochOf(p.inDate) - epochOf(inst.plannedDate)) > dayWindow) continue;
      }
      if (!best || inst.id < best.id) best = inst;
    }
    if (best) {
      consumed.add(best.id);
      out.push({ instanceId: best.id, completedTxnId: p.inId });
    }
  }
  return out;
}
