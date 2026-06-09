import { describe, it, expect } from "vitest";
import {
  extractMerchant,
  cleanDescription,
  scoreCategory,
  looksLikeTransfer,
  dedupeKey,
  REVIEW_THRESHOLD,
  type MemoryMap,
} from "./categorize";

// Real Mountain America CU description formats.
const MACU = {
  netflix: "Debit Card purch COMMENT: Netflix.com ***-***3700 CA",
  harmons: "Debit Card purch COMMENT: HARMONS GROCERY ***1234 UT",
  chickfila: "Debit Card purch COMMENT: CHICK-FIL-A #123 UT",
  power: "ACH Withdrawal COMMENT: ROCKY MTN POWER UTILITY",
  costco: "Debit Card purch COMMENT: COSTCO WHSE #0456 UT",
  chase: "ACH Withdrawal COMMENT: TYPE: CHASE ACH CO: JPMORGAN CHASE - JPMORGAN CHASE",
  adp: "Deposit ACH ADP  TYPE: PAYROLL CO: ADP TECH SVC RKH    Entry Class Code: PPD    ACH Trace Number: 6",
  transferTo: "Withdrawal Transfer to COMMENT: To DOCKSTADER,KATEL ******4876 Share 58",
  fromShare: "From Share 07",
};

describe("extractMerchant", () => {
  it("pulls a clean brand key from card purchases", () => {
    expect(extractMerchant(MACU.netflix)).toBe("netflix");
    expect(extractMerchant(MACU.harmons)).toContain("harmons");
    expect(extractMerchant(MACU.chickfila)).toContain("chick");
  });
  it("uses the ACH company name", () => {
    expect(extractMerchant(MACU.chase)).toContain("jpmorgan");
    expect(extractMerchant(MACU.adp)).toContain("adp");
  });
  it("is stable across reference-number variation", () => {
    const a = extractMerchant("Debit Card purch COMMENT: Netflix.com ***-***3700 CA");
    const b = extractMerchant("Debit Card purch COMMENT: Netflix.com ***-***9999 CA");
    expect(a).toBe(b);
  });
});

describe("cleanDescription", () => {
  it("strips masks, store numbers, and state codes", () => {
    expect(cleanDescription(MACU.costco)).toContain("costco");
    expect(cleanDescription(MACU.costco)).not.toMatch(/\d/);
  });
});

describe("looksLikeTransfer", () => {
  it("detects internal transfers", () => {
    expect(looksLikeTransfer(MACU.transferTo)).toBe(true);
    expect(looksLikeTransfer(MACU.fromShare)).toBe(true);
    expect(looksLikeTransfer(MACU.netflix)).toBe(false);
  });
});

describe("scoreCategory — built-in dictionary", () => {
  const opts = {};
  it("maps common merchants confidently", () => {
    expect(scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, opts).categoryId).toBe("subscriptions");
    expect(scoreCategory({ merchant: MACU.harmons, amount: -84.21 }, opts).categoryId).toBe("groceries");
    expect(scoreCategory({ merchant: MACU.chickfila, amount: -18.75 }, opts).categoryId).toBe("dining");
    expect(scoreCategory({ merchant: MACU.costco, amount: -60 }, opts).categoryId).toBe("groceries");
    expect(scoreCategory({ merchant: MACU.adp, amount: 3265.48 }, opts).categoryId).toBe("paycheck");
  });
  it("dictionary hits clear the review threshold", () => {
    expect(scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, opts).confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
});

describe("scoreCategory — keyword heuristics", () => {
  it("catches utilities by keyword", () => {
    const s = scoreCategory({ merchant: MACU.power, amount: -142.66 }, {});
    expect(s.categoryId).toBe("utilities");
  });
});

describe("scoreCategory — transfers and income", () => {
  it("flags transfers", () => {
    expect(scoreCategory({ merchant: MACU.transferTo, amount: -846 }, {}).categoryId).toBe("transfer");
    expect(scoreCategory({ merchant: MACU.fromShare, amount: 500 }, {}).source).toBe("transfer");
  });
  it("treats unknown positive amounts as income", () => {
    const s = scoreCategory({ merchant: "RANDOM DEPOSIT XYZ", amount: 1000 }, {});
    expect(s.categoryId).toBe("other-income");
    expect(s.source).toBe("income");
  });
  it("returns uncategorized + low confidence when nothing matches", () => {
    const s = scoreCategory({ merchant: "QWERTY ZXCV 9999", amount: -12.34 }, {});
    expect(s.categoryId).toBe("uncategorized");
    expect(s.confidence).toBeLessThan(REVIEW_THRESHOLD);
  });
});

describe("scoreCategory — learned memory beats the dictionary", () => {
  it("uses learned category for a known merchant", () => {
    const key = extractMerchant(MACU.netflix); // "netflix"
    const memory: MemoryMap = new Map([[key, [{ categoryId: "entertainment", count: 4 }]]]);
    const s = scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, { memory });
    expect(s.source).toBe("learned");
    expect(s.categoryId).toBe("entertainment"); // overrides dictionary's "subscriptions"
    expect(s.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
  it("confidence reflects consistency", () => {
    const key = extractMerchant(MACU.harmons);
    const mixed: MemoryMap = new Map([[key, [{ categoryId: "groceries", count: 3 }, { categoryId: "shopping", count: 3 }]]]);
    const consistent: MemoryMap = new Map([[key, [{ categoryId: "groceries", count: 6 }]]]);
    const a = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory: mixed });
    const b = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory: consistent });
    expect(b.confidence).toBeGreaterThan(a.confidence);
  });
});

describe("scoreCategory — explicit rules win", () => {
  it("rule overrides everything with full confidence", () => {
    const rules = [{ matchType: "contains", matchValue: "netflix", field: "merchant", categoryId: "shopping", member: null, priority: 10, enabled: true }];
    const s = scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, { rules });
    expect(s.source).toBe("rule");
    expect(s.categoryId).toBe("shopping");
    expect(s.confidence).toBe(1);
  });
});

describe("dedupeKey", () => {
  it("prefers the bank transaction id", () => {
    const k = dedupeKey({ externalId: "20260527 5902792 2,171", date: "2026-05-27", amount: -21.71, merchant: MACU.netflix, accountId: "acc1" });
    expect(k.startsWith("ext:acc1:")).toBe(true);
  });
  it("falls back to a content hash", () => {
    const k = dedupeKey({ date: "2026-05-27", amount: -21.71, merchant: MACU.netflix, accountId: "acc1" });
    expect(k).toContain("2026-05-27");
    expect(k).toContain("-21.71");
  });
});
