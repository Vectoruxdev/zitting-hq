import { describe, it, expect } from "vitest";
import { scrubForMemberView, MEMBER_SCRUBBED_KEYS } from "./memberScrub";
import { MOCK_FINANCE_DATA } from "../finance/data/mockData";

describe("scrubForMemberView", () => {
  const household = () => ({
    // household-wide sections that must be blanked
    stats: { totalCash: "$84,920", netWorth: "$84,920", spending: "$6,420", income: "$9,250", transfers: "$4,000" },
    trend: { income: [1, 2], spending: [3, 4], labels: ["May", "Jun"] },
    categories: [{ label: "Housing", value: 1900 }],
    cashFlow: { inFlow: 9000 },
    accountTransfers: [{ fromAccount: "Main Checking", amount: "$600.00" }],
    upcoming: [{ to: "Bills account", amount: "$1,200.00" }],
    scheduledTransfers: [{ to: "Savings" }],
    scheduledCount: 2,
    past: [{ to: "Savings" }],
    transfersPending: 3,
    transfersPendingTotal: "$2,200.00",
    transferReadiness: { cashOnHand: 5000, bySource: [{ accountId: "a1" }] },
    income: { sources: [{ name: "ADP Payroll", monthly: 8000 }], candidates: [], totalMonthly: 8000, totalMonthlyLabel: "$8,000" },
    incomeStreams: [{ name: "ADP Payroll" }],
    bills: [{ name: "Rocky Mtn Power" }],
    budgets: [{ name: "Sarah's allowance", limit: 400 }],
    members: [{ name: "Sarah", email: "s@x.com", allowance: 400 }],
    allowanceRules: [{ name: "Jae rule", status: { income: 4000 } }],
    rules: [{ name: "Tithing" }],
    catRules: [{ matchValue: "netflix" }],
    importBatches: [{ filename: "chase.csv" }],
    excludedAccounts: [{ name: "Business Checking" }],
    notifRules: [{ name: "Large charge" }],
    receiptItems: [{ item: "Milk" }],
    // member-scoped sections that must be KEPT (already filtered upstream)
    memberHome: { memberId: "m1", name: "Sarah" },
    goals: [{ id: "g1", name: "Bike" }],
    txns: [{ id: 1, merchant: "Harmons" }],
    accounts: { checking: [{ id: "a9" }], savings: [], credit: [] },
    accountsFlat: [{ id: "a9" }],
    incomeHistory: { adp: { key: "adp", name: "ADP", points: [] } },
    bulkGroups: [{ key: "harmons" }],
    notifications: [{ id: 5, title: "for you" }],
    allCategories: [{ id: "groceries" }],
    categoryGroups: [{ id: "essentials" }],
    nav: [{ id: "overview" }],
  });

  it("blanks every household-wide section", () => {
    const d = scrubForMemberView(household() as unknown as Record<string, unknown>) as ReturnType<typeof household>;
    expect(d.stats.totalCash).toBe("$0");
    expect(d.stats.netWorth).toBe("$0");
    expect(d.trend.income.every((v: number) => v === 0)).toBe(true);
    expect(d.categories).toEqual([]);
    expect(d.accountTransfers).toEqual([]);
    expect(d.upcoming).toEqual([]);
    expect(d.scheduledTransfers).toEqual([]);
    expect(d.scheduledCount).toBe(0);
    expect(d.past).toEqual([]);
    expect(d.transfersPending).toBe(0);
    expect(d.transferReadiness).toBeNull();
    expect(d.income.sources).toEqual([]);
    // Per-person income analytics are owners-only — blanked for members.
    expect((d.income as Record<string, unknown>).byMember).toEqual([]);
    expect((d.income as Record<string, unknown>).series).toEqual([]);
    expect((d.income as Record<string, unknown>).upcoming).toEqual([]);
    expect(((d.income as Record<string, unknown>).runway as { dipsBelowBuffer: boolean }).dipsBelowBuffer).toBe(false);
    expect(d.incomeStreams).toEqual([]);
    expect(d.bills).toEqual([]);
    expect(d.budgets).toEqual([]);
    expect(d.members).toEqual([]);
    expect(d.allowanceRules).toEqual([]);
    expect(d.rules).toEqual([]);
    expect(d.catRules).toEqual([]);
    expect(d.importBatches).toEqual([]);
    expect(d.excludedAccounts).toEqual([]);
    expect(d.notifRules).toEqual([]);
    expect(d.receiptItems).toEqual([]);
  });

  it("keeps the member-scoped sections untouched", () => {
    const before = household();
    const d = scrubForMemberView(household() as unknown as Record<string, unknown>) as ReturnType<typeof household>;
    expect(d.memberHome).toEqual(before.memberHome);
    expect(d.goals).toEqual(before.goals);
    expect(d.txns).toEqual(before.txns);
    expect(d.accounts).toEqual(before.accounts);
    expect(d.accountsFlat).toEqual(before.accountsFlat);
    expect(d.incomeHistory).toEqual(before.incomeHistory);
    expect(d.bulkGroups).toEqual(before.bulkGroups);
    expect(d.notifications).toEqual(before.notifications);
    expect(d.allCategories).toEqual(before.allCategories);
    expect(d.categoryGroups).toEqual(before.categoryGroups);
    expect(d.nav).toEqual(before.nav);
  });

  it("every scrubbed key exists in the canonical data shape (catches drift)", () => {
    // Derived-only keys are added by getFinanceData rather than the mock.
    const derivedOnly = new Set(["statsMonth", "cashFlow", "accountTransfers", "transferReadiness",
      "income", "members", "catRules", "importBatches", "allowanceRules", "scheduledCount", "accountsFlat", "incomeHistory",
      "moneyFlow"]);
    for (const key of MEMBER_SCRUBBED_KEYS) {
      if (derivedOnly.has(key)) continue;
      expect(MOCK_FINANCE_DATA, `mock is missing scrubbed key "${key}"`).toHaveProperty(key);
    }
  });
});
