import { describe, it, expect } from "vitest";
import { budgetSpent } from "./budgetMath";

describe("budgetSpent", () => {
  const catTotals = new Map([
    ["groceries", 312],
    ["dining", 360],
  ]);
  const memberTotals = new Map([
    ["sarah", 215],
    ["rebecca", 380],
  ]);

  it("category budgets track the category's spend", () => {
    expect(budgetSpent({ categoryId: "groceries", memberId: null, storedSpent: 999 }, catTotals, memberTotals)).toBe(312);
  });

  it("allowance budgets track the member's spend", () => {
    expect(budgetSpent({ categoryId: null, memberId: "sarah", storedSpent: 999 }, catTotals, memberTotals)).toBe(215);
  });

  it("category wins over member when BOTH are set (owner/member views agree)", () => {
    expect(budgetSpent({ categoryId: "dining", memberId: "sarah", storedSpent: 999 }, catTotals, memberTotals)).toBe(360);
  });

  it("untargeted budgets fall back to the stored column", () => {
    expect(budgetSpent({ categoryId: null, memberId: null, storedSpent: 42 }, catTotals, memberTotals)).toBe(42);
  });

  it("a targeted budget with no spend this month reads 0, not the stale stored value", () => {
    expect(budgetSpent({ categoryId: "kids", memberId: null, storedSpent: 520 }, catTotals, memberTotals)).toBe(0);
    expect(budgetSpent({ categoryId: null, memberId: "jae", storedSpent: 520 }, catTotals, memberTotals)).toBe(0);
  });
});
