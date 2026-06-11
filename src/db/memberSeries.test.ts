import { describe, it, expect } from "vitest";
import { monthlySpendSeries, balanceSeries, topSpendCategories } from "./memberSeries";

const NOW = new Date(2026, 5, 10); // Jun 10, 2026

const txn = (dateISO: string, amount: number, over: Record<string, unknown> = {}) => ({
  dateISO,
  amount,
  income: false,
  isTransfer: false,
  catKind: null as string | null,
  categoryId: null as string | null,
  ...over,
});

describe("monthlySpendSeries", () => {
  it("buckets net spend into the last 6 calendar months, oldest first", () => {
    const r = monthlySpendSeries(
      [
        txn("2026-01-15", -100),
        txn("2026-03-02", -50),
        txn("2026-06-04", -84.21),
        txn("2025-12-31", -999), // before the window — ignored
      ],
      NOW
    );
    expect(r.labels).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
    expect(r.values).toEqual([100, 0, 50, 0, 0, 84.21]);
  });

  it("refunds net the month down; income and transfers are excluded", () => {
    const r = monthlySpendSeries(
      [
        txn("2026-06-01", -100),
        txn("2026-06-03", 30), // refund
        txn("2026-06-03", 4000, { income: true }),
        txn("2026-06-05", -600, { isTransfer: true }),
      ],
      NOW
    );
    expect(r.values[5]).toBe(70);
  });
});

describe("balanceSeries", () => {
  it("walks month-end balances from opening + history to the live balance", () => {
    const r = balanceSeries(
      1000,
      [
        { dateISO: "2025-11-10", amount: 500 }, // before window → folded into the start
        { dateISO: "2026-01-20", amount: -200 },
        { dateISO: "2026-04-05", amount: 300 },
        { dateISO: "2026-06-02", amount: -100 },
      ],
      NOW
    );
    expect(r).toEqual([1300, 1300, 1300, 1600, 1600, 1500]);
    // last point = opening + every txn = the live balance
    expect(r[r.length - 1]).toBe(1000 + 500 - 200 + 300 - 100);
  });

  it("ignores future-dated rows", () => {
    const r = balanceSeries(100, [{ dateISO: "2026-07-09", amount: -50 }], NOW);
    expect(r[r.length - 1]).toBe(100);
  });
});

describe("topSpendCategories", () => {
  it("ranks categories by net spend with an 'other' rollup", () => {
    const txns = [
      txn("2026-06-01", -50, { categoryId: "a" }),
      txn("2026-06-01", -40, { categoryId: "b" }),
      txn("2026-06-01", -30, { categoryId: "c" }),
      txn("2026-06-01", -20, { categoryId: "d" }),
      txn("2026-06-01", -10, { categoryId: "e" }),
      txn("2026-06-01", -5, { categoryId: "f" }),
    ];
    const r = topSpendCategories(txns, undefined, 4);
    expect(r.map((x) => x.categoryId)).toEqual(["a", "b", "c", "d", "__other__"]);
    expect(r[4].value).toBe(15);
  });

  it("drops categories whose refunds outweigh spend, and untagged goes to 'uncategorized'", () => {
    const r = topSpendCategories([
      txn("2026-06-01", -20, { categoryId: "a" }),
      txn("2026-06-02", 30, { categoryId: "a" }), // net negative → dropped
      txn("2026-06-03", -15),
    ]);
    expect(r).toEqual([{ categoryId: "uncategorized", value: 15 }]);
  });
});
