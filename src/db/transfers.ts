/**
 * Cross-account transfer matching (pure). Finds pairs of transactions that are
 * two legs of the same internal money movement — e.g. −$500 out of checking and
 * +$500 into savings — so both can be flagged as transfers (and never counted
 * as spending/income) and linked for display.
 *
 * Match rule (the standard YNAB/Mint-style guard): exact opposite amount,
 * DIFFERENT accounts, posted within 3 days, neither already paired. A purchase
 * and its refund sit on the SAME account, so they never pair. Greedy by nearest
 * date; each transaction is used at most once. Pure + deterministic (no Date,
 * no mutation) so it's testable and `autoLinkTransfers` stays idempotent.
 */

const DAY = 86400000;
export const TRANSFER_MATCH_DAYS = 3;

export interface MatchTxn {
  id: number;
  accountId: string | null;
  amount: number; // signed
  date: string | null; // ISO YYYY-MM-DD
  isTransfer?: boolean;
  transferPairId?: number | null;
  /** Optional hint that the description already looks like a transfer. Not
   *  required for a match by default; available for future tuning. */
  transferHint?: boolean;
}

export interface TransferPair {
  outId: number; // the negative (outflow) leg
  inId: number; // the positive (inflow) leg
}

const cents = (n: number) => Math.round(n * 100);
const epochOf = (iso: string) => new Date(iso + "T00:00:00").getTime();

/**
 * Pair up the two legs of internal transfers.
 *
 * @param txns           transactions to consider
 * @param windowDays     max day gap between legs (default 3)
 * @param requireHint    when true, only pair if at least one leg has transferHint
 */
export function matchTransfers(
  txns: MatchTxn[],
  windowDays: number = TRANSFER_MATCH_DAYS,
  requireHint = false
): TransferPair[] {
  const windowMs = windowDays * DAY;

  // Eligible, not-yet-paired legs with a real account, date and nonzero amount.
  const eligible = txns.filter(
    (t) => t.accountId != null && t.date != null && cents(t.amount) !== 0 && t.transferPairId == null
  );

  // Index inflows (positive) by their cents value; buckets sorted by (epoch, id).
  const inflowsByCents = new Map<number, MatchTxn[]>();
  for (const t of eligible) {
    const c = cents(t.amount);
    if (c <= 0) continue;
    const arr = inflowsByCents.get(c) || [];
    arr.push(t);
    inflowsByCents.set(c, arr);
  }
  for (const arr of inflowsByCents.values()) {
    arr.sort((a, b) => epochOf(a.date!) - epochOf(b.date!) || a.id - b.id);
  }

  const consumed = new Set<number>();
  const pairs: TransferPair[] = [];

  // Walk outflows (negative) deterministically; greedily take the nearest-dated
  // eligible inflow of the exact opposite amount in a different account.
  const outflows = eligible
    .filter((t) => cents(t.amount) < 0)
    .sort((a, b) => epochOf(a.date!) - epochOf(b.date!) || a.id - b.id);

  for (const out of outflows) {
    if (consumed.has(out.id)) continue;
    const candidates = inflowsByCents.get(-cents(out.amount));
    if (!candidates) continue;
    const outEpoch = epochOf(out.date!);

    let best: MatchTxn | null = null;
    let bestDiff = Infinity;
    for (const cand of candidates) {
      if (consumed.has(cand.id)) continue;
      if (cand.accountId === out.accountId) continue;
      const diff = Math.abs(epochOf(cand.date!) - outEpoch);
      if (diff > windowMs) continue;
      if (requireHint && !out.transferHint && !cand.transferHint) continue;
      if (diff < bestDiff || (diff === bestDiff && best && cand.id < best.id)) {
        best = cand;
        bestDiff = diff;
      }
    }

    if (best) {
      consumed.add(out.id);
      consumed.add(best.id);
      pairs.push({ outId: out.id, inId: best.id });
    }
  }

  return pairs;
}
