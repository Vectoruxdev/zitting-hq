/**
 * Receipt → transaction auto-match (pure).
 *
 * A scanned receipt knows its total and (usually) its date. The match is a
 * spend transaction with the SAME amount within a few days. Amount equality
 * is the hard requirement — without a scanned total there is no auto-match
 * (the member picks by hand). Among amount matches:
 *   - exactly one candidate  → HIGH confidence (attach automatically)
 *   - several               → best-scored one is a MEDIUM suggestion only
 * Scoring prefers the uploader's own accounts, then the closest date.
 */

export interface MatchTxn {
  id: number;
  amount: number; // signed; spend is negative
  dateISO: string | null;
  accountId: string | null;
  isTransfer: boolean;
  hasReceipt: boolean;
}

export interface MatchResult {
  txnId: number;
  confidence: "high" | "medium";
}

const DAY_MS = 86400000;
const dayDiff = (a: string, b: string) =>
  Math.abs(new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / DAY_MS;

export function findReceiptMatch(
  receipt: { total: number | null; dateISO: string | null; uploadDateISO: string },
  txns: MatchTxn[],
  opts: { preferredAccountIds?: ReadonlySet<string>; dayWindow?: number } = {}
): MatchResult | null {
  const total = receipt.total;
  if (total == null || total <= 0) return null;
  const window = opts.dayWindow ?? 4;
  const anchor = receipt.dateISO ?? receipt.uploadDateISO;

  const candidates = txns.filter((t) => {
    if (t.isTransfer || t.hasReceipt) return false;
    if (t.amount >= 0) return false; // receipts match spending
    // compare in integer cents — float subtraction turns 0.01 into 0.01000…5
    if (Math.abs(Math.round(Math.abs(t.amount) * 100) - Math.round(total * 100)) > 1) return false;
    if (!t.dateISO) return false;
    return dayDiff(t.dateISO, anchor) <= window;
  });

  if (!candidates.length) return null;
  if (candidates.length === 1) return { txnId: candidates[0].id, confidence: "high" };

  // Several txns share the amount (e.g. twice at the same store) — suggest the
  // best one, never auto-attach.
  const score = (t: MatchTxn) => {
    const preferred = opts.preferredAccountIds && t.accountId && opts.preferredAccountIds.has(t.accountId) ? 0 : 1;
    return preferred * 100 + dayDiff(t.dateISO!, anchor);
  };
  const best = [...candidates].sort((a, b) => score(a) - score(b) || a.id - b.id)[0];
  return { txnId: best.id, confidence: "medium" };
}
