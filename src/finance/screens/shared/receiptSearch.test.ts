import { describe, it, expect } from "vitest";
import { stemWords, lineMatchesQuery, searchLineItems, topItems } from "./receiptSearch";

const receipts = [
  {
    id: "r1", merchant: "Harmons", dateISO: "2026-06-04",
    lines: [
      { name: "Apples, Honeycrisp", qty: 6, price: 8.12 },
      { name: "Whole milk 2%", qty: 2, price: 7.98 },
      { name: "Member savings", qty: null, price: -3.5 },
    ],
  },
  {
    id: "r2", merchant: "Smith's", dateISO: "2026-02-14",
    lines: [
      { name: "Apples, Gala", qty: 5, price: 6.45 },
      { name: "Bananas", qty: null, price: 2.1 },
    ],
  },
  {
    id: "r3", merchant: "Costco", dateISO: "2025-11-02",
    lines: [{ name: "Organic apple, 4lb", qty: 4, price: 9.49 }],
  },
];

describe("stemWords", () => {
  it("lowercases and drops a trailing s", () => {
    expect(stemWords("Apples, Honeycrisp")).toEqual(["apple", "honeycrisp"]);
  });
});

describe("lineMatchesQuery", () => {
  it("matches apples → apple regardless of plural", () => {
    expect(lineMatchesQuery("Apples, Gala", stemWords("apple"))).toBe(true);
    expect(lineMatchesQuery("Apple, Gala", stemWords("apples"))).toBe(true);
  });
  it("does not match unrelated items", () => {
    expect(lineMatchesQuery("Bananas", stemWords("apple"))).toBe(false);
  });
  it("empty query matches nothing", () => {
    expect(lineMatchesQuery("Apples", [])).toBe(false);
  });
});

describe("searchLineItems", () => {
  it("counts quantity and spend across receipts, qty null counts as 1", () => {
    const r = searchLineItems(receipts, "apples");
    expect(r.qty).toBe(15); // 6 + 5 + 4
    expect(r.receipts).toBe(3);
    expect(Math.round(r.spend * 100) / 100).toBe(24.06);
    expect(r.occ[0].dateISO).toBe("2026-06-04"); // newest first
  });
  it("scopes when receipts are pre-filtered by period (caller's job)", () => {
    const thisYear = receipts.filter((x) => x.dateISO >= "2026-01-01");
    expect(searchLineItems(thisYear, "apples").qty).toBe(11);
  });
  it("returns empty for a blank query", () => {
    expect(searchLineItems(receipts, "  ").qty).toBe(0);
  });
});

describe("topItems", () => {
  it("ranks distinct items by quantity and skips discounts", () => {
    // groups by full item name (Honeycrisp ≠ Gala), so the top is the single
    // highest-qty line, not the apple total — that aggregation is search's job
    const t = topItems(receipts, 5);
    expect(t[0].label).toBe("Apples, Honeycrisp");
    expect(t[0].qty).toBe(6);
    expect(t.some((x) => x.label === "Member savings")).toBe(false);
  });
});
