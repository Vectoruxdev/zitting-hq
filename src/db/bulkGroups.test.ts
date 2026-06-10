import { describe, it, expect } from "vitest";
import { buildMerchantGroups, dominantCategory, type BulkTxn } from "./bulkGroups";

const txn = (id: number, merchant: string, p: Partial<BulkTxn> = {}): BulkTxn => ({
  id, merchant, categoryId: null, reviewed: false, amount: -10, accountId: "a1", date: "2026-05-01", ...p,
});

describe("buildMerchantGroups", () => {
  it("clusters by merchant key and aggregates", () => {
    const groups = buildMerchantGroups([
      txn(1, "Debit Card purch COMMENT: AMZN Mktp US*111", { amount: -20 }),
      txn(2, "Debit Card purch COMMENT: Amazon.com", { amount: -30 }),
      txn(3, "Debit Card purch COMMENT: COSTCO WHSE #1", { amount: -60 }),
    ]);
    const amazon = groups.find((g) => g.key === "amazon")!;
    expect(amazon.count).toBe(2);
    expect(amazon.ids.sort()).toEqual([1, 2]);
    expect(amazon.totalSpend).toBe(50);
    expect(groups.find((g) => g.key.startsWith("costco"))!.count).toBe(1);
  });

  it("counts unreviewed + uncategorized per group", () => {
    const [g] = buildMerchantGroups([
      txn(1, "Netflix", { reviewed: true, categoryId: "te-entertainment-local" }),
      txn(2, "Netflix", { reviewed: false, categoryId: null }),
    ]);
    expect(g.count).toBe(2);
    expect(g.unreviewed).toBe(1);
    expect(g.uncategorized).toBe(1);
  });

  it("onlyNeedsReview drops fully-clean groups", () => {
    const all = buildMerchantGroups([
      txn(1, "Netflix", { reviewed: true, categoryId: "te-entertainment-local" }),
      txn(2, "Costco", { reviewed: false, categoryId: null }),
    ]);
    const needs = buildMerchantGroups([
      txn(1, "Netflix", { reviewed: true, categoryId: "te-entertainment-local" }),
      txn(2, "Costco", { reviewed: false, categoryId: null }),
    ], { onlyNeedsReview: true });
    expect(all.length).toBe(2);
    expect(needs.length).toBe(1);
    expect(needs[0].key.startsWith("costco")).toBe(true);
  });

  it("sorts the biggest cleanup first", () => {
    const groups = buildMerchantGroups([
      txn(1, "Netflix", { reviewed: true, categoryId: "x" }),
      txn(2, "Costco", { reviewed: false }),
      txn(3, "Costco", { reviewed: false }),
    ]);
    expect(groups[0].key.startsWith("costco")).toBe(true); // 2 unreviewed > 0
  });

  it("tracks date range and accounts", () => {
    const [g] = buildMerchantGroups([
      txn(1, "Shell", { date: "2026-05-10", accountId: "a1" }),
      txn(2, "Shell", { date: "2026-05-02", accountId: "a2" }),
    ]);
    expect(g.minDate).toBe("2026-05-02");
    expect(g.maxDate).toBe("2026-05-10");
    expect(g.accountIds.sort()).toEqual(["a1", "a2"]);
  });
});

describe("dominantCategory", () => {
  it("returns the most common real category, ignoring uncategorized", () => {
    expect(dominantCategory({ "groc-other": 3, "misc-other": 1, "": 5, uncategorized: 2 })).toBe("groc-other");
  });
  it("returns null when nothing is categorized", () => {
    expect(dominantCategory({ "": 4, uncategorized: 1 })).toBeNull();
  });
});
