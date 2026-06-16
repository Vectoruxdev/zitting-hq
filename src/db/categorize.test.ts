import { describe, it, expect } from "vitest";
import {
  extractMerchant,
  exactMerchantKey,
  canonicalizeBrand,
  cleanDescription,
  scoreCategory,
  sourceLabel,
  looksLikeTransfer,
  dedupeKey,
  markDuplicates,
  REVIEW_THRESHOLD,
  shouldAutoApprove,
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
  it("strips a bare Debit/Credit prefix (formats without 'card purch'/'comment')", () => {
    expect(extractMerchant("Debit Costco Whse #0456 UT")).toContain("costco");
    expect(extractMerchant("Debit Costco Whse #0456 UT")).not.toContain("debit");
    expect(extractMerchant("Debit Klarna")).toBe("klarna");
    expect(extractMerchant("Debit Card Withdrawal Spotify")).toContain("spotify");
    expect(extractMerchant("POS Debit Walmart UT")).toBe("walmart"); // two prefixes stripped
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

describe("shouldAutoApprove", () => {
  it("auto-approves only human-set categories and transfers", () => {
    expect(shouldAutoApprove("manual", false)).toBe(true);
    expect(shouldAutoApprove("transfer", false)).toBe(true);
    expect(shouldAutoApprove(null, true)).toBe(true); // isTransfer flag, even without a transfer source
  });
  it("leaves every engine-guessed category PENDING approval (confidence no longer auto-approves)", () => {
    // High-confidence guesses used to auto-approve at >= REVIEW_THRESHOLD; now they don't.
    expect(shouldAutoApprove("merchant", false)).toBe(false);
    expect(shouldAutoApprove("learned", false)).toBe(false);
    expect(shouldAutoApprove("rule", false)).toBe(false);
    expect(shouldAutoApprove("keyword", false)).toBe(false);
    expect(shouldAutoApprove("income", false)).toBe(false);
    expect(shouldAutoApprove("none", false)).toBe(false);
    expect(shouldAutoApprove(undefined, false)).toBe(false);
  });
});

describe("scoreCategory — built-in dictionary", () => {
  const opts = {};
  it("maps common merchants confidently", () => {
    expect(scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, opts).categoryId).toBe("te-entertainment-local");
    expect(scoreCategory({ merchant: MACU.harmons, amount: -84.21 }, opts).categoryId).toBe("groc-other");
    expect(scoreCategory({ merchant: MACU.chickfila, amount: -18.75 }, opts).categoryId).toBe("te-entertainment-local");
    expect(scoreCategory({ merchant: MACU.costco, amount: -60 }, opts).categoryId).toBe("groc-costco-walmart");
    expect(scoreCategory({ merchant: MACU.adp, amount: 3265.48 }, opts).categoryId).toBe("income-paycheck");
  });
  it("dictionary hits clear the review threshold", () => {
    expect(scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, opts).confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
});

describe("scoreCategory — keyword heuristics", () => {
  it("catches utilities by keyword", () => {
    const s = scoreCategory({ merchant: MACU.power, amount: -142.66 }, {});
    expect(s.categoryId).toBe("util-electricity");
  });
});

describe("scoreCategory — transfers and income", () => {
  it("flags transfers", () => {
    expect(scoreCategory({ merchant: MACU.transferTo, amount: -846 }, {}).categoryId).toBe("transfer");
    expect(scoreCategory({ merchant: MACU.fromShare, amount: 500 }, {}).source).toBe("transfer");
  });
  it("treats unknown positive amounts as income", () => {
    const s = scoreCategory({ merchant: "RANDOM DEPOSIT XYZ", amount: 1000 }, {});
    expect(s.categoryId).toBe("income-other");
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
    const memory: MemoryMap = new Map([[key, [{ categoryId: "misc-other", count: 4 }]]]);
    const s = scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, { memory });
    expect(s.source).toBe("learned");
    expect(s.categoryId).toBe("misc-other"); // overrides the dictionary's entertainment mapping
    expect(s.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
  it("confidence reflects consistency", () => {
    const key = extractMerchant(MACU.harmons);
    const mixed: MemoryMap = new Map([[key, [{ categoryId: "groc-other", count: 3 }, { categoryId: "misc-other", count: 3 }]]]);
    const consistent: MemoryMap = new Map([[key, [{ categoryId: "groc-other", count: 6 }]]]);
    const a = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory: mixed });
    const b = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory: consistent });
    expect(b.confidence).toBeGreaterThan(a.confidence);
  });
});

describe("scoreCategory — explicit rules win", () => {
  it("rule overrides everything with full confidence", () => {
    const rules = [{ matchType: "contains", matchValue: "netflix", field: "merchant", categoryId: "misc-other", member: null, priority: 10, enabled: true }];
    const s = scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, { rules });
    expect(s.source).toBe("rule");
    expect(s.categoryId).toBe("misc-other");
    expect(s.confidence).toBe(1);
  });
});

describe("canonicalizeBrand + keys", () => {
  it("merges messy brand spellings to one key", () => {
    expect(canonicalizeBrand("amzn mktp us")).toContain("amazon");
    expect(canonicalizeBrand("amazon mktp")).toBe("amazon");
    expect(canonicalizeBrand("wal mart")).toBe("walmart");
    expect(canonicalizeBrand("wm supercenter")).toBe("walmart");
  });
  it("strips payment-processor prefixes so the real merchant is learned", () => {
    expect(canonicalizeBrand("sq coffee bar")).toBe("coffee bar");
    expect(canonicalizeBrand("tst the pizza place")).toContain("pizza");
    expect(canonicalizeBrand("paypal etsy seller")).toContain("etsy");
  });
  it("learns the same key across amzn / amazon variants", () => {
    expect(extractMerchant("Debit Card purch COMMENT: AMZN Mktp US*2A3B4")).toBe(extractMerchant("Debit Card purch COMMENT: Amazon.com"));
  });
  it("exact key is namespaced and distinct from the token key", () => {
    const ex = exactMerchantKey(MACU.netflix);
    expect(ex.startsWith("x:")).toBe(true);
    expect(ex).not.toBe(extractMerchant(MACU.netflix));
  });
});

describe("scoreCategory — two-tier memory (exact beats token)", () => {
  it("prefers the exact-merchant memory over the broad token memory", () => {
    const tokenKey = extractMerchant("Debit Card purch COMMENT: APPLE BILL CA");
    const exactKey = exactMerchantKey("Debit Card purch COMMENT: APPLE BILL CA");
    const memory: MemoryMap = new Map([
      [tokenKey, [{ categoryId: "misc-other", count: 5 }]],
      [exactKey, [{ categoryId: "te-entertainment-local", count: 2 }]],
    ]);
    const s = scoreCategory({ merchant: "Debit Card purch COMMENT: APPLE BILL CA", amount: -9.99 }, { memory });
    expect(s.source).toBe("learned");
    expect(s.categoryId).toBe("te-entertainment-local"); // exact wins
  });
});

describe("scoreCategory — evidence-calibrated confidence", () => {
  it("a single correction is less confident than many consistent ones", () => {
    const key = extractMerchant(MACU.harmons);
    const one: MemoryMap = new Map([[key, [{ categoryId: "groc-other", count: 1 }]]]);
    const many: MemoryMap = new Map([[key, [{ categoryId: "groc-other", count: 8 }]]]);
    const a = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory: one });
    const b = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory: many });
    expect(b.confidence).toBeGreaterThan(a.confidence);
    expect(b.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
});

describe("scoreCategory — recency weighting", () => {
  it("weights a recent correction over a stale one", () => {
    const key = extractMerchant(MACU.harmons);
    const now = Date.UTC(2026, 5, 1);
    const yearAgo = Date.UTC(2025, 5, 1);
    const memory: MemoryMap = new Map([[key, [
      { categoryId: "misc-other", count: 3, lastSeen: yearAgo },   // stale
      { categoryId: "groc-other", count: 2, lastSeen: now },        // fresh
    ]]]);
    const s = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory, now });
    expect(s.categoryId).toBe("groc-other"); // recent wins despite lower raw count
  });
});

describe("scoreCategory — sign/kind guard", () => {
  const catKind = new Map([
    ["income-paycheck", "income"],
    ["groc-other", "expense"],
  ]);
  it("won't suggest an income category for a charge", () => {
    const key = extractMerchant(MACU.harmons);
    const memory: MemoryMap = new Map([[key, [{ categoryId: "income-paycheck", count: 9 }]]]);
    const s = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory, catKind });
    expect(s.source).not.toBe("learned"); // income candidate dropped → falls through
    expect(s.categoryId).not.toBe("income-paycheck");
  });
  it("still learns an expense category for a charge", () => {
    const key = extractMerchant(MACU.harmons);
    const memory: MemoryMap = new Map([[key, [{ categoryId: "groc-other", count: 9 }]]]);
    const s = scoreCategory({ merchant: MACU.harmons, amount: -50 }, { memory, catKind });
    expect(s.categoryId).toBe("groc-other");
  });
  it("treats a refund (positive amount at a known expense merchant) as that expense category, not income", () => {
    // A $211 Amazon return should land back in misc-other so it nets against the
    // original spend — NOT get bucketed as income just because the amount is positive.
    const s = scoreCategory({ merchant: "AMAZON MKTPLACE PMTS return", amount: 211.72 }, {});
    expect(s.categoryId).toBe("misc-other");
    expect(s.source).toBe("merchant");
  });
  it("a positive deposit with no merchant signal still falls through to income", () => {
    const s = scoreCategory({ merchant: "RANDOM DEPOSIT XYZ", amount: 1000 }, {});
    expect(s.categoryId).toBe("income-other");
    expect(s.source).toBe("income");
  });
});

describe("scoreCategory — explainable reasons", () => {
  it("every suggestion carries a human reason", () => {
    expect(scoreCategory({ merchant: MACU.netflix, amount: -22.99 }, {}).reason).toBeTruthy();
    expect(scoreCategory({ merchant: "QWERTY 9999", amount: -1 }, {}).reason).toMatch(/categorize/i);
    expect(sourceLabel("learned")).toBe("Learned");
  });
});

describe("scoreCategory — rule amount operators", () => {
  const rule = (matchType: string, matchValue: string) => [{
    matchType, matchValue, field: "amount", categoryId: "misc-other", member: null, priority: 10, enabled: true,
  }];
  it("matches amounts over a threshold (abs)", () => {
    const s = scoreCategory({ merchant: "BIG STORE", amount: -250 }, { rules: rule("gt", "200") });
    expect(s.source).toBe("rule");
    expect(s.categoryId).toBe("misc-other");
  });
  it("does not match when under the threshold", () => {
    const s = scoreCategory({ merchant: "BIG STORE", amount: -50 }, { rules: rule("gt", "200") });
    expect(s.source).not.toBe("rule");
  });
  it("matches a between range", () => {
    expect(scoreCategory({ merchant: "X", amount: -150 }, { rules: rule("between", "100:300") }).source).toBe("rule");
    expect(scoreCategory({ merchant: "X", amount: -400 }, { rules: rule("between", "100:300") }).source).not.toBe("rule");
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

describe("markDuplicates (multiset-aware import dedup)", () => {
  const rows = (keys: string[]) => keys.map((dedupeKey) => ({ dedupeKey }));
  const flags = (r: ReturnType<typeof markDuplicates>) => r.map((x) => (x.duplicate ? x.reason : "new"));

  it("imports everything into an empty account", () => {
    const r = markDuplicates(rows(["a", "b", "c"]), {});
    expect(flags(r)).toEqual(["new", "new", "new"]);
  });

  it("skips rows already in the system, keeping existing (re-import of same file)", () => {
    const r = markDuplicates(rows(["a", "b", "c"]), { a: 1, b: 1, c: 1 });
    expect(flags(r)).toEqual(["exists", "exists", "exists"]);
  });

  it("imports only the new rows when date ranges overlap", () => {
    // account already has Jan–Mar (a,b); new file is Feb–Apr (b,c,d)
    const r = markDuplicates(rows(["b", "c", "d"]), { a: 1, b: 1 });
    expect(flags(r)).toEqual(["exists", "new", "new"]);
  });

  it("flags an exact repeat within the same file", () => {
    const r = markDuplicates(rows(["a", "a", "b"]), {});
    expect(flags(r)).toEqual(["new", "file", "new"]);
  });

  it("consumes existing records one-for-one (3 identical, 2 already stored)", () => {
    const r = markDuplicates(rows(["x", "x", "x"]), { x: 2 });
    expect(flags(r)).toEqual(["exists", "exists", "new"]);
  });

  it("treats unique bank transaction ids as never-duplicate across distinct ids", () => {
    const r = markDuplicates(rows(["ext:acc:1", "ext:acc:2", "ext:acc:3"]), { "ext:acc:2": 1 });
    expect(flags(r)).toEqual(["new", "exists", "new"]);
  });

  it("accepts a Map for existing counts too", () => {
    const r = markDuplicates(rows(["a", "b"]), new Map([["a", 1]]));
    expect(flags(r)).toEqual(["exists", "new"]);
  });
});

describe("markDuplicates content fallback (re-linked Plaid item)", () => {
  const flags = (r: ReturnType<typeof markDuplicates>) => r.map((x) => (x.duplicate ? x.reason : "new"));

  it("skips a re-linked backfill: new ext ids, content already stored", () => {
    // Account history was imported under item A; re-link created item B which
    // re-sends the same transactions with brand-new transaction_ids.
    const incoming = [
      { dedupeKey: "ext:acc:B1", contentKey: "acc|2026-06-03|3265.49|adp payroll" },
      { dedupeKey: "ext:acc:B2", contentKey: "acc|2026-06-04|-544.00|dockstader katel" },
      { dedupeKey: "ext:acc:B3", contentKey: "acc|2026-06-10|-19.54|netflix" }, // genuinely new
    ];
    const r = markDuplicates(
      incoming,
      { "ext:acc:A1": 1, "ext:acc:A2": 1 },
      { "acc|2026-06-03|3265.49|adp payroll": 1, "acc|2026-06-04|-544.00|dockstader katel": 1 }
    );
    expect(flags(r)).toEqual(["exists", "exists", "new"]);
  });

  it("consumes content twins one-for-one (1 stored, 2 incoming → second imports)", () => {
    const incoming = [
      { dedupeKey: "ext:acc:B1", contentKey: "acc|2026-06-05|-5.00|coffee" },
      { dedupeKey: "ext:acc:B2", contentKey: "acc|2026-06-05|-5.00|coffee" },
    ];
    const r = markDuplicates(incoming, {}, { "acc|2026-06-05|-5.00|coffee": 1 });
    expect(flags(r)).toEqual(["exists", "new"]);
  });

  it("never content-dedupes within the same file (two real same-day purchases)", () => {
    const incoming = [
      { dedupeKey: "ext:acc:B1", contentKey: "acc|2026-06-05|-5.00|coffee" },
      { dedupeKey: "ext:acc:B2", contentKey: "acc|2026-06-05|-5.00|coffee" },
    ];
    const r = markDuplicates(incoming, {}, {});
    expect(flags(r)).toEqual(["new", "new"]);
  });

  it("prefers the id key: same ext id stays 'exists' regardless of content", () => {
    const incoming = [{ dedupeKey: "ext:acc:A1", contentKey: "acc|2026-06-05|-5.00|coffee" }];
    const r = markDuplicates(incoming, { "ext:acc:A1": 1 }, {});
    expect(flags(r)).toEqual(["exists"]);
  });

  it("rows without a contentKey keep the original behavior", () => {
    const r = markDuplicates(
      [{ dedupeKey: "ext:acc:B9" }],
      {},
      { "acc|2026-06-05|-5.00|coffee": 1 }
    );
    expect(flags(r)).toEqual(["new"]);
  });
});
