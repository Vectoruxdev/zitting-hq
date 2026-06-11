/**
 * Budget `spent` resolution (pure). One precedence rule for BOTH the owner
 * Budgets screen and the member home: a budget targeting a category tracks
 * that category's current-month spend; an allowance budget targeting a member
 * tracks that member's spend; an untargeted row falls back to its stored
 * column. Previously the member home always used the member total, so a
 * budget with BOTH set showed different numbers to the owner and the member.
 */
export function budgetSpent(
  b: { categoryId: string | null; memberId: string | null; storedSpent: number },
  catTotals: ReadonlyMap<string, number>,
  memberTotals: ReadonlyMap<string, number>
): number {
  if (b.categoryId) return catTotals.get(b.categoryId) || 0;
  if (b.memberId) return memberTotals.get(b.memberId) || 0;
  return b.storedSpent;
}
