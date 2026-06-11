/**
 * Batched learning for bulk categorization (pure, no DB).
 *
 * The per-row learning loop hits merchant_memory twice per transaction (token
 * key + exact key), and a merchant group repeats the same token key for every
 * row. Tallying first collapses that to one delta per (key, category) pair —
 * learnMerchant/penalizeMerchant already take a `delta`, so applying the
 * summed counts is equivalent to the sequential per-row loop.
 */
import { extractMerchant, exactMerchantKey } from "./categorize";
import { UNCATEGORIZED_ID } from "./seedCategories";

export interface LearnRowInput {
  merchant: string | null;
  /** The row's category BEFORE the update (for negative learning). */
  oldCategoryId: string | null;
  memberId: string | null;
}

export interface LearningTally {
  learns: { merchantKey: string; categoryId: string; member: string | null; delta: number }[];
  penalties: { merchantKey: string; categoryId: string; delta: number }[];
}

export function emptyTally(): LearningTally {
  return { learns: [], penalties: [] };
}

export function mergeTallies(into: LearningTally, from: LearningTally): LearningTally {
  into.learns.push(...from.learns);
  into.penalties.push(...from.penalties);
  return into;
}

/** Tally what categorizing `rows` to `categoryId` should teach the engine. */
export function tallyLearning(rows: LearnRowInput[], categoryId: string): LearningTally {
  const learns = new Map<string, LearningTally["learns"][number]>();
  const penalties = new Map<string, LearningTally["penalties"][number]>();
  const bump = (merchantKey: string, member: string | null) => {
    if (!merchantKey || !categoryId || categoryId === UNCATEGORIZED_ID) return;
    const k = `${merchantKey}\u0000${categoryId}`;
    const e = learns.get(k);
    if (e) {
      e.delta += 1;
      // learnMerchant keeps the existing member unless given one, so the last
      // non-null member in row order wins — same as the sequential loop.
      if (member) e.member = member;
    } else {
      learns.set(k, { merchantKey, categoryId, member, delta: 1 });
    }
  };
  const fade = (merchantKey: string, oldCategoryId: string) => {
    if (!merchantKey || !oldCategoryId) return;
    const k = `${merchantKey}\u0000${oldCategoryId}`;
    const e = penalties.get(k);
    if (e) e.delta += 1;
    else penalties.set(k, { merchantKey, categoryId: oldCategoryId, delta: 1 });
  };
  for (const r of rows) {
    if (!r.merchant) continue;
    const member = r.memberId ?? null;
    const oldCat = r.oldCategoryId;
    // Mirror bulkUpdateTransactions' learn loop: fade the replaced category
    // (when it was a real, different one), reinforce the new one — on both
    // the broad token key and the precise exact key.
    if (oldCat && oldCat !== categoryId && oldCat !== UNCATEGORIZED_ID) {
      fade(extractMerchant(r.merchant), oldCat);
      fade(exactMerchantKey(r.merchant), oldCat);
    }
    bump(extractMerchant(r.merchant), member);
    bump(exactMerchantKey(r.merchant), member);
  }
  return { learns: [...learns.values()], penalties: [...penalties.values()] };
}
