/**
 * Exact-duplicate transaction detection (pure, no DB).
 *
 * Two stored transactions are TRUE duplicates only when they share the same
 * account AND the same dedupe key (`dedupeHash`) — i.e. the ingestion dedup
 * should have collapsed them but didn't (e.g. two syncs racing on the same
 * Plaid transaction_id). We keep the earliest row (lowest id) and flag the rest
 * for removal.
 *
 * This deliberately keys on `dedupeHash`, NOT on content — so two legitimately
 * identical-looking purchases (same merchant/amount/day, different bank ids)
 * are NEVER removed. Safe to run anytime.
 */

export interface DedupeRow {
  id: number;
  accountId: string | null;
  dedupeHash: string | null;
}

export function findExactDuplicates(rows: DedupeRow[]): { removeIds: number[]; groups: number } {
  const byKey = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.dedupeHash) continue; // no key → not comparable (legacy/mock rows)
    const key = `${r.accountId ?? ""}::${r.dedupeHash}`;
    const arr = byKey.get(key) || [];
    arr.push(r.id);
    byKey.set(key, arr);
  }
  const removeIds: number[] = [];
  let groups = 0;
  for (const ids of byKey.values()) {
    if (ids.length <= 1) continue;
    groups++;
    ids.sort((a, b) => a - b); // keep the earliest
    removeIds.push(...ids.slice(1));
  }
  return { removeIds, groups };
}
