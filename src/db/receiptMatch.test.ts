import { describe, it, expect } from "vitest";
import { findReceiptMatch, type MatchTxn } from "./receiptMatch";

const txn = (over: Partial<MatchTxn> & { id: number }): MatchTxn => ({
  amount: -84.21,
  dateISO: "2026-06-10",
  accountId: "amex",
  isTransfer: false,
  hasReceipt: false,
  ...over,
});

describe("findReceiptMatch", () => {
  it("attaches with HIGH confidence on a unique amount+date match", () => {
    const r = findReceiptMatch(
      { total: 84.21, dateISO: "2026-06-10", uploadDateISO: "2026-06-11" },
      [txn({ id: 1 }), txn({ id: 2, amount: -20 })]
    );
    expect(r).toEqual({ txnId: 1, confidence: "high" });
  });

  it("never auto-matches without a scanned total", () => {
    expect(findReceiptMatch({ total: null, dateISO: "2026-06-10", uploadDateISO: "2026-06-10" }, [txn({ id: 1 })])).toBeNull();
  });

  it("falls back to the upload date when the receipt date is unreadable", () => {
    const r = findReceiptMatch(
      { total: 84.21, dateISO: null, uploadDateISO: "2026-06-11" },
      [txn({ id: 1, dateISO: "2026-06-09" })]
    );
    expect(r).toEqual({ txnId: 1, confidence: "high" });
  });

  it("ignores transfers, income, already-receipted, and out-of-window txns", () => {
    const r = findReceiptMatch(
      { total: 84.21, dateISO: "2026-06-10", uploadDateISO: "2026-06-10" },
      [
        txn({ id: 1, isTransfer: true }),
        txn({ id: 2, amount: 84.21 }), // income/deposit
        txn({ id: 3, hasReceipt: true }),
        txn({ id: 4, dateISO: "2026-05-20" }), // too old
      ]
    );
    expect(r).toBeNull();
  });

  it("two same-amount candidates → MEDIUM suggestion, preferring the uploader's account then the closer date", () => {
    const r = findReceiptMatch(
      { total: 84.21, dateISO: "2026-06-10", uploadDateISO: "2026-06-10" },
      [
        txn({ id: 1, accountId: "main", dateISO: "2026-06-10" }),
        txn({ id: 2, accountId: "kid-card", dateISO: "2026-06-09" }),
      ],
      { preferredAccountIds: new Set(["kid-card"]) }
    );
    expect(r).toEqual({ txnId: 2, confidence: "medium" });

    const r2 = findReceiptMatch(
      { total: 84.21, dateISO: "2026-06-10", uploadDateISO: "2026-06-10" },
      [txn({ id: 1, dateISO: "2026-06-08" }), txn({ id: 2, dateISO: "2026-06-10" })]
    );
    expect(r2).toEqual({ txnId: 2, confidence: "medium" });
  });

  it("respects a custom day window and amount tolerance of one cent", () => {
    const wide = findReceiptMatch(
      { total: 84.21, dateISO: "2026-06-01", uploadDateISO: "2026-06-01" },
      [txn({ id: 1, dateISO: "2026-06-08" })],
      { dayWindow: 7 }
    );
    expect(wide).toEqual({ txnId: 1, confidence: "high" });

    const cent = findReceiptMatch(
      { total: 84.22, dateISO: "2026-06-10", uploadDateISO: "2026-06-10" },
      [txn({ id: 1, amount: -84.21 })]
    );
    expect(cent).toEqual({ txnId: 1, confidence: "high" });

    const off = findReceiptMatch(
      { total: 84.5, dateISO: "2026-06-10", uploadDateISO: "2026-06-10" },
      [txn({ id: 1, amount: -84.21 })]
    );
    expect(off).toBeNull();
  });
});
