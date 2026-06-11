import { describe, it, expect } from "vitest";
import { flowOf, foldMonthStats, type FlowTxn } from "./monthStats";

const txn = (over: Partial<FlowTxn> = {}): FlowTxn => ({
  amount: -100,
  income: false,
  isTransfer: false,
  catKind: null,
  categoryId: "groceries",
  memberId: null,
  splits: null,
  ...over,
});

describe("flowOf", () => {
  it("a charge is net spend", () => {
    expect(flowOf(txn({ amount: -84.21 }))).toEqual({ income: 0, spendNet: 84.21 });
  });

  it("a refund (positive, not income) nets spending DOWN, never counts as income", () => {
    expect(flowOf(txn({ amount: 36.4 }))).toEqual({ income: 0, spendNet: -36.4 });
  });

  it("income is summed SIGNED — a payroll reversal reduces income instead of inflating it", () => {
    expect(flowOf(txn({ amount: 4000, income: true }))).toEqual({ income: 4000, spendNet: 0 });
    expect(flowOf(txn({ amount: -4000, income: true }))).toEqual({ income: -4000, spendNet: 0 });
  });

  it("transfers (flag or category kind) are neither income nor spending", () => {
    expect(flowOf(txn({ amount: -600, isTransfer: true }))).toEqual({ income: 0, spendNet: 0 });
    expect(flowOf(txn({ amount: -600, catKind: "transfer" }))).toEqual({ income: 0, spendNet: 0 });
    expect(flowOf(txn({ amount: 600, income: true, isTransfer: true }))).toEqual({ income: 0, spendNet: 0 });
  });
});

describe("foldMonthStats", () => {
  it("aggregates income, spending, category and member totals", () => {
    const r = foldMonthStats([
      txn({ amount: -84.21, categoryId: "groceries", memberId: "sarah" }),
      txn({ amount: -18.75, categoryId: "dining", memberId: "rebecca" }),
      txn({ amount: 4000, income: true, categoryId: "income" }),
      txn({ amount: -600, isTransfer: true, categoryId: null }),
    ]);
    expect(r.income).toBe(4000);
    expect(r.spending).toBeCloseTo(102.96);
    expect(r.catTotals.get("groceries")).toBeCloseTo(84.21);
    expect(r.catTotals.get("dining")).toBeCloseTo(18.75);
    expect(r.catTotals.has("income")).toBe(false); // income isn't spend
    expect(r.memberTotals.get("sarah")).toBeCloseTo(84.21);
    expect(r.memberTotals.get("rebecca")).toBeCloseTo(18.75);
  });

  it("a refund reduces the category, member, and overall spend", () => {
    const r = foldMonthStats([
      txn({ amount: -100, categoryId: "shopping", memberId: "sarah" }),
      txn({ amount: 40, categoryId: "shopping", memberId: "sarah" }), // return
    ]);
    expect(r.spending).toBe(60);
    expect(r.catTotals.get("shopping")).toBe(60);
    expect(r.memberTotals.get("sarah")).toBe(60);
  });

  it("splits attribute spend per split category (sign follows the txn direction)", () => {
    const r = foldMonthStats([
      txn({
        amount: -90,
        categoryId: null,
        splits: [
          { categoryId: "groceries", amount: 60 },
          { categoryId: "household", amount: 30 },
        ],
      }),
    ]);
    expect(r.spending).toBe(90);
    expect(r.catTotals.get("groceries")).toBe(60);
    expect(r.catTotals.get("household")).toBe(30);
    expect(r.catTotals.has("uncategorized")).toBe(false);
  });

  it("untagged spend lands in the 'uncategorized' bucket", () => {
    const r = foldMonthStats([txn({ amount: -25, categoryId: null })]);
    expect(r.catTotals.get("uncategorized")).toBe(25);
  });

  it("mixed signed income: reversal nets against the paycheck", () => {
    const r = foldMonthStats([
      txn({ amount: 4000, income: true }),
      txn({ amount: -4000, income: true }), // reversed paycheck
      txn({ amount: 1250, income: true }),
    ]);
    expect(r.income).toBe(1250);
    expect(r.spending).toBe(0);
  });
});

describe("registry-aware income (registryActive)", () => {
  const opts = { registryActive: true };

  it("registered payers count as income", () => {
    expect(flowOf(txn({ amount: 4000, income: true, registeredPayer: true }), opts)).toEqual({ income: 4000, spendNet: 0 });
  });

  it("an unregistered positive deposit is a refund — nets spending down, never income", () => {
    expect(flowOf(txn({ amount: 75, income: true, registeredPayer: false }), opts)).toEqual({ income: 0, spendNet: -75 });
  });

  it("with the registry EMPTY, the raw income flag keeps today's behavior", () => {
    expect(flowOf(txn({ amount: 75, income: true, registeredPayer: false }), { registryActive: false })).toEqual({ income: 75, spendNet: 0 });
    expect(flowOf(txn({ amount: 75, income: true, registeredPayer: false }))).toEqual({ income: 75, spendNet: 0 });
  });

  it("foldMonthStats: refund-from-unregistered-payer reduces its category's spend", () => {
    const r = foldMonthStats(
      [
        txn({ amount: -100, categoryId: "shopping" }),
        // Plaid-flagged "income" that's actually a card refund
        txn({ amount: 40, income: true, registeredPayer: false, categoryId: "shopping" }),
        txn({ amount: 4000, income: true, registeredPayer: true, categoryId: "income" }),
      ],
      opts
    );
    expect(r.income).toBe(4000);
    expect(r.spending).toBe(60);
    expect(r.catTotals.get("shopping")).toBe(60);
  });

  it("transfers stay excluded regardless of registry state", () => {
    expect(flowOf(txn({ amount: 600, income: true, registeredPayer: true, isTransfer: true }), opts)).toEqual({ income: 0, spendNet: 0 });
  });
});
