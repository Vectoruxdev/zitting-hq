import { describe, it, expect } from "vitest";
import { pickSnapshot } from "./snapshot";

const DATA: Record<string, unknown> = {
  statsMonth: "June",
  stats: { netWorth: "$1", spending: "$2" },
  cashFlow: { net: 3 },
  transferReadiness: { coveredNow: true },
  savingsStats: { totalSaved: 100 },
  transfersPending: 2,
  transfersPendingTotal: "$50",
  income: { totalMonthly: 4000 },
  budgets: [{ id: 1 }],
  goals: [{ id: "g1" }, { id: "g2" }],
  accountsFlat: [{ id: "a1" }, { id: "a2" }, { id: "a3" }],
  members: [{ id: "m1" }],
  // unbounded
  txns: [{ id: 1 }, { id: 2 }],
  receipts: [{ id: "r1" }],
  notifications: [{ id: 1 }],
  accountTransfers: [{ id: 9 }],
  incomeHistory: { adp: [] },
};

describe("pickSnapshot", () => {
  it("default (no sections) returns a compact summary with counts and no raw txns", () => {
    const r = pickSnapshot(DATA);
    expect(r.statsMonth).toBe("June");
    expect(r.incomeMonthly).toBe(4000);
    expect(r.counts).toEqual({ accounts: 3, transactions: 2, budgets: 1, goals: 2 });
    expect(r).not.toHaveProperty("txns");
    expect(r).not.toHaveProperty("receipts");
  });

  it("['all'] returns bounded sections but EXCLUDES the unbounded arrays", () => {
    const r = pickSnapshot(DATA, ["all"]);
    expect(r.stats).toBeDefined();
    expect(r.budgets).toBeDefined();
    expect(r.members).toBeDefined();
    // unbounded excluded by default
    expect(r).not.toHaveProperty("txns");
    expect(r).not.toHaveProperty("receipts");
    expect(r).not.toHaveProperty("notifications");
    expect(r).not.toHaveProperty("accountTransfers");
    expect(r).not.toHaveProperty("incomeHistory");
  });

  it("['all'] + includeTxns adds transactions (but still not other unbounded arrays)", () => {
    const r = pickSnapshot(DATA, ["all"], true);
    expect(r.txns).toEqual([{ id: 1 }, { id: 2 }]);
    expect(r).not.toHaveProperty("receipts");
    expect(r).not.toHaveProperty("notifications");
  });

  it("explicit sections return exactly those keys (even unbounded ones)", () => {
    const r = pickSnapshot(DATA, ["stats", "txns"]);
    expect(Object.keys(r).sort()).toEqual(["stats", "txns"]);
    expect(r.txns).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
