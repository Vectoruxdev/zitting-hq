import { describe, it, expect } from "vitest";
import { detectRecurring, type DetectTxn } from "./detect";

const NOW = new Date("2026-06-09T00:00:00");
const tx = (merchant: string, amount: number, date: string, extra: Partial<DetectTxn> = {}): DetectTxn => ({
  merchant,
  amount,
  date,
  categoryName: "Subscriptions",
  color: "var(--amber-500)",
  accountLabel: "Amex ••3008",
  isTransfer: false,
  income: false,
  ...extra,
});

describe("detectRecurring", () => {
  it("detects a monthly subscription", () => {
    const bills = detectRecurring([
      tx("NETFLIX.COM ***3700 CA", -22.99, "2026-03-06"),
      tx("NETFLIX.COM ***3700 CA", -22.99, "2026-04-06"),
      tx("NETFLIX.COM ***3700 CA", -22.99, "2026-05-06"),
    ], NOW);
    expect(bills.length).toBe(1);
    expect(bills[0].name.toLowerCase()).toContain("netflix");
    expect(bills[0].freq).toBe("Monthly");
    expect(bills[0].amount).toBeCloseTo(22.99);
    expect(bills[0].next).toMatch(/Jun/);
  });

  it("flags a changed amount with a delta", () => {
    const bills = detectRecurring([
      tx("ROCKY MOUNTAIN POWER", -120, "2026-03-18", { categoryName: "Utilities" }),
      tx("ROCKY MOUNTAIN POWER", -120, "2026-04-18", { categoryName: "Utilities" }),
      tx("ROCKY MOUNTAIN POWER", -142, "2026-05-18", { categoryName: "Utilities" }),
    ], NOW);
    expect(bills.length).toBe(1);
    expect(bills[0].badge).toBe("changed");
    expect(bills[0].delta).toBe("+$22");
  });

  it("ignores one-off purchases", () => {
    const bills = detectRecurring([tx("TARGET #1899 UT", -36.4, "2026-05-02")], NOW);
    expect(bills.length).toBe(0);
  });

  it("ignores irregular (non-periodic) merchants", () => {
    const bills = detectRecurring([
      tx("HARMONS GROCERY", -40, "2026-05-01", { categoryName: "Groceries" }),
      tx("HARMONS GROCERY", -85, "2026-05-04", { categoryName: "Groceries" }),
      tx("HARMONS GROCERY", -60, "2026-05-19", { categoryName: "Groceries" }),
    ], NOW);
    expect(bills.length).toBe(0);
  });

  it("excludes transfers and income", () => {
    const bills = detectRecurring([
      tx("ADP PAYROLL", 3000, "2026-03-01", { income: true }),
      tx("ADP PAYROLL", 3000, "2026-04-01", { income: true }),
      tx("To Share 07", -500, "2026-03-05", { isTransfer: true }),
      tx("To Share 07", -500, "2026-04-05", { isTransfer: true }),
    ], NOW);
    expect(bills.length).toBe(0);
  });

  it("flags due-soon when the next date is within a week", () => {
    // monthly on the 12th; from NOW (Jun 9) next is Jun ~12 → due soon
    const bills = detectRecurring([
      tx("SPOTIFY", -16.99, "2026-04-12"),
      tx("SPOTIFY", -16.99, "2026-05-12"),
    ], NOW);
    expect(bills.length).toBe(1);
    expect(bills[0].badge).toBe("due soon");
  });
});
