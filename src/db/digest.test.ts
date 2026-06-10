import { describe, it, expect } from "vitest";
import { windowFor, generateDigests, type DigestInput, type DigestTxn } from "./digest";

const categories = new Map([
  ["groceries", { name: "Groceries", color: "var(--green-500)", kind: "expense" }],
  ["dining", { name: "Dining", color: "var(--amber-500)", kind: "expense" }],
  ["xfer", { name: "Transfer", color: "var(--gray-500)", kind: "transfer" }],
]);
const members = new Map([
  ["sarah", { name: "Sarah", allowance: 400 }],
  ["jared", { name: "Jared", allowance: 0 }],
]);

let seq = 1;
const tx = (date: string, amount: number, extra: Partial<DigestTxn> = {}): DigestTxn => ({
  id: seq++,
  date,
  amount,
  income: false,
  isTransfer: false,
  memberId: null,
  categoryId: null,
  merchant: "Store",
  hasSplit: false,
  ...extra,
});

describe("windowFor", () => {
  it("weekly = trailing 7 days with the equal prior window", () => {
    const w = windowFor("weekly", "2026-06-09");
    expect(w).toMatchObject({ start: "2026-06-02", end: "2026-06-09", prevStart: "2026-05-26", prevEnd: "2026-06-02" });
  });
  it("biweekly = trailing 14 days", () => {
    expect(windowFor("biweekly", "2026-06-09")).toMatchObject({ start: "2026-05-26", prevStart: "2026-05-12" });
  });
  it("monthly = trailing calendar month", () => {
    expect(windowFor("monthly", "2026-06-09")).toMatchObject({ start: "2026-05-09", prevStart: "2026-04-09" });
  });
});

describe("generateDigests", () => {
  const base = (): DigestInput => ({
    txns: [
      tx("2026-06-03", -100, { categoryId: "groceries", memberId: "sarah", merchant: "Harmons" }),
      tx("2026-06-04", -40, { categoryId: "dining", memberId: "sarah", merchant: "Cafe" }),
      tx("2026-06-05", -200, { categoryId: "groceries", memberId: "jared", merchant: "Costco" }),
      tx("2026-06-06", 5000, { income: true, merchant: "Payroll" }),
      tx("2026-06-07", -500, { isTransfer: true, merchant: "Move to savings" }),
      tx("2026-06-08", -60, { categoryId: "xfer", merchant: "Card payment" }),
      // previous window
      tx("2026-05-28", -80, { categoryId: "groceries", memberId: "sarah", merchant: "Harmons" }),
    ],
    splits: [],
    categories,
    members,
    budgets: [{ name: "Groceries", categoryId: "groceries", memberId: null, limit: 250 }],
    goals: [{ name: "Emergency", saved: 5000, target: 10000 }],
    upcoming: [],
    window: windowFor("weekly", "2026-06-09"),
  });

  it("totals exclude transfers + transfer-kind, and split income from spend", () => {
    const { household } = generateDigests(base());
    expect(household.totalSpent).toBe(340); // 100 + 40 + 200
    expect(household.totalIncome).toBe(5000);
    expect(household.net).toBe(4660);
    expect(household.txnCount).toBe(3);
  });

  it("top categories are splits-unaware here and ranked", () => {
    const { household } = generateDigests(base());
    expect(household.topCategories[0]).toMatchObject({ name: "Groceries", amount: 300 });
    expect(household.topCategories[1]).toMatchObject({ name: "Dining", amount: 40 });
  });

  it("per-member breakdown ranks by spend with each one's top category", () => {
    const { household } = generateDigests(base());
    expect(household.perMember[0]).toMatchObject({ name: "Jared", spent: 200, topCategory: "Groceries" });
    expect(household.perMember[1]).toMatchObject({ name: "Sarah", spent: 140, topCategory: "Groceries", txnCount: 2 });
  });

  it("biggest + top merchants", () => {
    const { household } = generateDigests(base());
    expect(household.biggest[0]).toMatchObject({ merchant: "Costco", amount: 200, member: "Jared" });
    expect(household.topMerchants[0]).toMatchObject({ merchant: "Costco", amount: 200 });
  });

  it("budget over/under for the window", () => {
    const { household } = generateDigests(base());
    expect(household.budgets[0]).toMatchObject({ name: "Groceries", spent: 300, limit: 250, over: true });
  });

  it("vs previous window", () => {
    const { household } = generateDigests(base());
    expect(household.vsPrev.spentDelta).toBe(260); // 340 - 80
    expect(household.vsPrev.spentPct).toBe(325);
  });

  it("member digest: spend, allowance, vs-prev", () => {
    const { byMember } = generateDigests(base());
    const sarah = byMember.get("sarah")!;
    expect(sarah.totalSpent).toBe(140);
    expect(sarah.allowance).toEqual({ spent: 140, limit: 400, left: 260 });
    expect(sarah.vsPrev.spentDelta).toBe(60); // 140 - 80
    expect(sarah.topCategories.map((c) => c.name)).toEqual(["Groceries", "Dining"]);
  });

  it("member with no allowance gets null allowance", () => {
    const { byMember } = generateDigests(base());
    expect(byMember.get("jared")!.allowance).toBeNull();
  });

  it("respects splits for category attribution", () => {
    const input = base();
    input.txns = [tx("2026-06-03", -100, { categoryId: "groceries", memberId: "sarah", hasSplit: true, merchant: "Target" })];
    input.splits = [
      { transactionId: input.txns[0].id, categoryId: "groceries", amount: -70 },
      { transactionId: input.txns[0].id, categoryId: "dining", amount: -30 },
    ];
    const { household } = generateDigests(input);
    const g = household.topCategories.find((c) => c.name === "Groceries");
    const d = household.topCategories.find((c) => c.name === "Dining");
    expect(g?.amount).toBe(70);
    expect(d?.amount).toBe(30);
  });
});
