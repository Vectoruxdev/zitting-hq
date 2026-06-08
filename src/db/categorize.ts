/**
 * Pure helpers for categorization + dedupe. Server-side, no DB access here.
 */

export interface RuleLike {
  id?: number;
  matchType: string; // contains | exact | regex
  matchValue: string;
  field: string; // merchant | amount | account
  categoryId: string | null;
  member: string | null;
  priority: number;
  enabled: boolean;
}

export interface TxnLike {
  merchant: string;
  amount: number;
  accountId?: string | null;
}

/** Normalize a merchant/description for matching + dedupe. */
export function normalizeMerchant(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/comment:.*/g, " ") // strip MACU "COMMENT:" tails
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic dedupe key. Prefer the bank's transaction id when present. */
export function dedupeKey(args: {
  externalId?: string | null;
  date: string;
  amount: number;
  merchant: string;
  accountId?: string | null;
}): string {
  if (args.externalId && args.externalId.trim()) {
    return `ext:${args.accountId ?? ""}:${args.externalId.trim()}`;
  }
  return [
    args.accountId ?? "",
    args.date,
    args.amount.toFixed(2),
    normalizeMerchant(args.merchant),
  ].join("|");
}

/** First matching rule wins (sorted by priority asc, then id). Returns null if none. */
export function matchRules(
  txn: TxnLike,
  rules: RuleLike[]
): { categoryId: string | null; member: string | null } | null {
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || (a.id ?? 0) - (b.id ?? 0));
  const merch = normalizeMerchant(txn.merchant);
  for (const r of sorted) {
    let hay = "";
    if (r.field === "merchant") hay = merch;
    else if (r.field === "account") hay = (txn.accountId ?? "").toLowerCase();
    else if (r.field === "amount") hay = String(txn.amount);
    const needle = (r.matchValue || "").toLowerCase();
    let hit = false;
    if (r.matchType === "exact") hit = hay === needle;
    else if (r.matchType === "regex") {
      try {
        hit = new RegExp(r.matchValue, "i").test(r.field === "merchant" ? txn.merchant : hay);
      } catch {
        hit = false;
      }
    } else hit = needle.length > 0 && hay.includes(needle); // contains
    if (hit) return { categoryId: r.categoryId, member: r.member };
  }
  return null;
}

/** Heuristic: is this row an internal transfer (MACU patterns)? */
export function looksLikeTransfer(merchant: string, type?: string): boolean {
  if (type && /transfer/i.test(type)) return true;
  return /\b(transfer to|transfer from|to share|from share|webxfr)\b/i.test(merchant || "");
}
