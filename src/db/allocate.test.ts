import { describe, it, expect } from "vitest";
import { generateInstances, reconcileInstances, type AllocRule, type PendingInstance, type ResolvedPair } from "./allocate";

const rule = (over: Partial<AllocRule> & Pick<AllocRule, "id" | "method">): AllocRule => ({
  value: null,
  fromAccountId: "checking",
  toAccountId: "savings",
  memberId: null,
  sortOrder: 0,
  ...over,
});

describe("generateInstances (waterfall)", () => {
  it("applies %, Fixed, then Remainder in sortOrder", () => {
    const rules = [
      rule({ id: "tithe", method: "%", value: 10, sortOrder: 0 }),
      rule({ id: "bills", method: "Fixed", value: 1200, sortOrder: 1 }),
      rule({ id: "savings", method: "Remainder", sortOrder: 2 }),
    ];
    const { instances, remaining } = generateInstances(4000, rules);
    expect(instances.map((i) => [i.ruleId, i.amount])).toEqual([
      ["tithe", 400],
      ["bills", 1200],
      ["savings", 2400],
    ]);
    expect(remaining).toBe(0);
  });

  it("percent is of gross income, not the running remainder", () => {
    const rules = [
      rule({ id: "a", method: "Fixed", value: 1000, sortOrder: 0 }),
      rule({ id: "b", method: "%", value: 50, sortOrder: 1 }),
    ];
    const { instances } = generateInstances(2000, rules);
    // b = 50% of 2000 = 1000, not 50% of the 1000 remaining
    expect(instances.find((i) => i.ruleId === "b")!.amount).toBe(1000);
  });

  it("clamps to the remaining and never overdraws", () => {
    const rules = [
      rule({ id: "a", method: "Fixed", value: 800, sortOrder: 0 }),
      rule({ id: "b", method: "Fixed", value: 800, sortOrder: 1 }),
    ];
    const { instances, remaining } = generateInstances(1000, rules);
    expect(instances.map((i) => i.amount)).toEqual([800, 200]); // b clamped 800 -> 200
    expect(remaining).toBe(0);
  });

  it("Remainder is 0 (dropped) when already over-allocated", () => {
    const rules = [
      rule({ id: "a", method: "Fixed", value: 1000, sortOrder: 0 }),
      rule({ id: "rem", method: "Remainder", sortOrder: 1 }),
    ];
    const { instances, remaining } = generateInstances(1000, rules);
    expect(instances.map((i) => i.ruleId)).toEqual(["a"]); // remainder=0 -> not emitted
    expect(remaining).toBe(0);
  });

  it("rounds to cents and is order-independent of input array", () => {
    const rules = [
      rule({ id: "b", method: "%", value: 33.33, sortOrder: 1 }),
      rule({ id: "a", method: "%", value: 10, sortOrder: 0 }),
    ];
    const { instances } = generateInstances(123.45, rules);
    expect(instances.map((i) => i.ruleId)).toEqual(["a", "b"]); // sorted by sortOrder
    expect(instances[0].amount).toBe(12.35); // round2(12.345)
    expect(instances[1].amount).toBe(41.15); // round2(123.45 * .3333)
  });
});

describe("reconcileInstances (auto-complete)", () => {
  const pair = (over: Partial<ResolvedPair> & Pick<ResolvedPair, "outId" | "inId">): ResolvedPair => ({
    outAccountId: "checking",
    inAccountId: "savings",
    amount: 500,
    inDate: "2026-06-02",
    ...over,
  });
  const inst = (over: Partial<PendingInstance> & Pick<PendingInstance, "id">): PendingInstance => ({
    fromAccountId: "checking",
    toAccountId: "savings",
    amount: 500,
    plannedDate: "2026-06-01",
    ...over,
  });

  it("matches by accounts + amount + date within tolerance", () => {
    const res = reconcileInstances([inst({ id: 1 })], [pair({ outId: 10, inId: 11 })]);
    expect(res).toEqual([{ instanceId: 1, completedTxnId: 11 }]);
  });

  it("does not match when destination account differs", () => {
    const res = reconcileInstances([inst({ id: 1, toAccountId: "credit" })], [pair({ outId: 10, inId: 11 })]);
    expect(res).toEqual([]);
  });

  it("does not match when amount is outside tolerance", () => {
    const res = reconcileInstances([inst({ id: 1, amount: 500 })], [pair({ outId: 10, inId: 11, amount: 540 })]);
    expect(res).toEqual([]);
  });

  it("matches manual instances (planned within the date window)", () => {
    const res = reconcileInstances(
      [inst({ id: 7, plannedDate: "2026-05-28" })],
      [pair({ outId: 10, inId: 11, inDate: "2026-06-02" })] // 5 days, within default 7
    );
    expect(res).toEqual([{ instanceId: 7, completedTxnId: 11 }]);
  });

  it("rejects matches outside the date window", () => {
    const res = reconcileInstances(
      [inst({ id: 7, plannedDate: "2026-05-01" })],
      [pair({ outId: 10, inId: 11, inDate: "2026-06-02" })] // >7 days
    );
    expect(res).toEqual([]);
  });

  it("uses each pair and instance at most once; deterministic", () => {
    const res = reconcileInstances(
      [inst({ id: 1 }), inst({ id: 2 })],
      [pair({ outId: 10, inId: 11 })]
    );
    expect(res).toEqual([{ instanceId: 1, completedTxnId: 11 }]); // lowest id wins, one match
  });

  it("is idempotent when there is nothing new to match", () => {
    const res = reconcileInstances([], [pair({ outId: 10, inId: 11 })]);
    expect(res).toEqual([]);
  });
});
