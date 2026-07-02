import { describe, it, expect } from "vitest";
import { tallyLearning, mergeTallies, emptyTally, type LearnRowInput } from "./learnBatch";
import { extractMerchant, exactMerchantKey } from "./categorize";

const row = (merchant: string, p: Partial<LearnRowInput> = {}): LearnRowInput => ({
  merchant, oldCategoryId: null, memberId: null, ...p,
});

const find = <T extends { merchantKey: string; categoryId: string }>(list: T[], key: string, cat: string) =>
  list.find((e) => e.merchantKey === key && e.categoryId === cat);

describe("tallyLearning", () => {
  it("sums deltas per key tier for repeated merchants (same counts as the per-row loop)", () => {
    const t = tallyLearning([row("CASH APP *JOHN"), row("CASH APP *JOHN"), row("CASH APP *JOHN")], "kids");
    const token = extractMerchant("CASH APP *JOHN");
    const exact = exactMerchantKey("CASH APP *JOHN");
    expect(find(t.learns, token, "kids")?.delta).toBe(3);
    expect(find(t.learns, exact, "kids")?.delta).toBe(3);
    expect(t.learns).toHaveLength(2);
    expect(t.penalties).toHaveLength(0);
  });

  it("keeps distinct exact keys separate while the shared token key accumulates", () => {
    const t = tallyLearning([row("HOME DEPOT GARDEN CENTER"), row("HOME DEPOT TOOL RENTAL")], "groceries");
    const token = extractMerchant("HOME DEPOT GARDEN CENTER");
    expect(extractMerchant("HOME DEPOT TOOL RENTAL")).toBe(token); // shared broad key
    expect(find(t.learns, token, "groceries")?.delta).toBe(2);
    const exactA = exactMerchantKey("HOME DEPOT GARDEN CENTER");
    const exactB = exactMerchantKey("HOME DEPOT TOOL RENTAL");
    expect(exactA).not.toBe(exactB);
    expect(find(t.learns, exactA, "groceries")?.delta).toBe(1);
    expect(find(t.learns, exactB, "groceries")?.delta).toBe(1);
  });

  it("keys Cash App rows by counterparty so different people never share a key", () => {
    const t = tallyLearning([row("CASH APP *JOHN SMITH"), row("CASH APP *MARI PIANO")], "kids");
    const tokenA = extractMerchant("CASH APP *JOHN SMITH");
    const tokenB = extractMerchant("CASH APP *MARI PIANO");
    expect(tokenA).not.toBe(tokenB);
    expect(find(t.learns, tokenA, "kids")?.delta).toBe(1);
    expect(find(t.learns, tokenB, "kids")?.delta).toBe(1);
  });

  it("penalizes the replaced category only when it was a real, different one", () => {
    const token = extractMerchant("Netflix");
    // old === new → no penalty
    expect(tallyLearning([row("Netflix", { oldCategoryId: "fun" })], "fun").penalties).toHaveLength(0);
    // old uncategorized → no penalty
    expect(tallyLearning([row("Netflix", { oldCategoryId: "uncategorized" })], "fun").penalties).toHaveLength(0);
    // old null → no penalty
    expect(tallyLearning([row("Netflix")], "fun").penalties).toHaveLength(0);
    // real correction → fade both key tiers
    const t = tallyLearning([row("Netflix", { oldCategoryId: "dining" })], "fun");
    expect(find(t.penalties, token, "dining")?.delta).toBe(1);
    expect(find(t.penalties, exactMerchantKey("Netflix"), "dining")?.delta).toBe(1);
  });

  it("does not learn into uncategorized and skips rows without a merchant", () => {
    expect(tallyLearning([row("Netflix")], "uncategorized").learns).toHaveLength(0);
    expect(tallyLearning([row("", { merchant: null as unknown as string })], "fun").learns).toHaveLength(0);
  });

  it("attributes the last non-null member, like the sequential learn loop", () => {
    const t = tallyLearning(
      [row("Netflix", { memberId: "sarah" }), row("Netflix"), row("Netflix", { memberId: "caleb" })],
      "fun"
    );
    expect(find(t.learns, extractMerchant("Netflix"), "fun")?.member).toBe("caleb");
  });

  it("merges tallies across groups", () => {
    const all = mergeTallies(emptyTally(), tallyLearning([row("Netflix")], "fun"));
    mergeTallies(all, tallyLearning([row("Costco")], "groceries"));
    expect(all.learns).toHaveLength(4); // two key tiers per merchant
  });
});
