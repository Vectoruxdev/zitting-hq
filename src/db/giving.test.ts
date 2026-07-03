import { describe, it, expect } from "vitest";
import { computeGivingLedger, grossFor, type GivingConfig, type GivingSourceCfg } from "./giving";

const CFG: GivingConfig = {
  tithingRate: 0.1,
  charityRate: 0.05,
  defaultGrossRatio: 2.0202,
  charityAccountId: "charity",
  charitableCategoryIds: new Set(["charitable-tithing", "charitable-united-order"]),
};

const adp: GivingSourceCfg = {
  matchKey: "adp tech",
  name: "ADP",
  titheEnabled: true,
  grossPerPeriod: 6600,
  grossRatio: null,
};

describe("grossFor", () => {
  it("prefers explicit per-paycheck gross", () => {
    expect(grossFor(3265.49, adp, CFG)).toBe(6600);
  });
  it("falls back to the source ratio, then the household default", () => {
    expect(grossFor(1000, { ...adp, grossPerPeriod: null, grossRatio: 2 }, CFG)).toBe(2000);
    expect(grossFor(1000, { ...adp, grossPerPeriod: null }, CFG)).toBeCloseTo(2020.2);
    expect(grossFor(1000, undefined, CFG)).toBeCloseTo(2020.2);
  });
  it("excludes sources with tithing disabled", () => {
    expect(grossFor(1000, { ...adp, titheEnabled: false }, CFG)).toBe(0);
  });
});

describe("computeGivingLedger", () => {
  it("reproduces the household pattern: $990 per ADP check = 15% of gross", () => {
    const ledger = computeGivingLedger({
      incomeTxns: [
        { dateISO: "2026-06-03", amount: 3265.49, matchKey: "adp tech" },
        { dateISO: "2026-06-16", amount: 3265.5, matchKey: "adp tech" },
      ],
      allTxns: [
        { dateISO: "2026-06-04", amount: 990, accountId: "charity", isTransfer: true },
        { dateISO: "2026-06-18", amount: 990, accountId: "charity", isTransfer: true },
      ],
      sources: [adp],
      cfg: CFG,
      nowISO: "2026-06-30",
      monthsBack: 1,
    });
    const june = ledger.months[0];
    expect(june.grossIncome).toBe(13200);
    expect(june.owed).toBeCloseTo(1980); // 15% of 13,200 — exactly 2 × $990
    expect(june.accrued).toBe(1980);
    expect(june.settled).toBe(0);
    expect(ledger.expectedCharityBalance).toBe(1980);
  });

  it("counts charitable-category outflows anywhere as settled", () => {
    const ledger = computeGivingLedger({
      incomeTxns: [],
      allTxns: [
        { dateISO: "2026-04-02", amount: -4895.25, categoryId: "charitable-tithing", accountId: "katelynn" },
        { dateISO: "2026-04-02", amount: -2448.79, categoryId: "charitable-tithing", accountId: "katelynn" },
        // an ordinary spend must not count
        { dateISO: "2026-04-05", amount: -50, categoryId: "groc-bees", accountId: "budget" },
      ],
      sources: [],
      cfg: CFG,
      nowISO: "2026-04-30",
      monthsBack: 1,
    });
    expect(ledger.months[0].settled).toBeCloseTo(7344.04);
  });

  it("only counts transfers INTO the charity account as accrued", () => {
    const ledger = computeGivingLedger({
      incomeTxns: [],
      allTxns: [
        { dateISO: "2026-05-07", amount: 990, accountId: "charity", isTransfer: true },
        { dateISO: "2026-05-08", amount: -250, accountId: "charity", isTransfer: true }, // outflow ≠ accrual
        { dateISO: "2026-05-09", amount: 6.16, accountId: "charity", isTransfer: false }, // dividend ≠ accrual
      ],
      sources: [],
      cfg: CFG,
      nowISO: "2026-05-31",
      monthsBack: 1,
    });
    expect(ledger.months[0].accrued).toBe(990);
  });

  it("buckets by calendar month across the window", () => {
    const ledger = computeGivingLedger({
      incomeTxns: [
        { dateISO: "2026-05-06", amount: 1000, matchKey: "x" },
        { dateISO: "2026-06-06", amount: 1000, matchKey: "x" },
      ],
      allTxns: [],
      sources: [],
      cfg: CFG,
      nowISO: "2026-06-30",
      monthsBack: 2,
    });
    expect(ledger.months.map((m) => m.month)).toEqual(["2026-05", "2026-06"]);
    expect(ledger.months[0].owed).toBeCloseTo(1000 * 2.0202 * 0.15);
    expect(ledger.totals.owed).toBeCloseTo(2 * 1000 * 2.0202 * 0.15);
  });
});
