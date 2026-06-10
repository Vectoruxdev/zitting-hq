import { describe, it, expect } from "vitest";
import { computePerfAllowance, type PerfAllowanceInput } from "./perfAllowance";

const base = (over: Partial<PerfAllowanceInput> = {}): PerfAllowanceInput => ({
  income: 0,
  goal: 3000,
  min: 100,
  bonusType: "percent",
  bonusBasis: "overage",
  bonusValue: 20,
  splits: [],
  earnerMemberId: "jaelynn",
  earnerToAccountId: "jaelynn-acct",
  fromAccountId: "bills",
  ...over,
});

describe("computePerfAllowance", () => {
  it("under goal → earner gets the minimum only, no bonus", () => {
    const r = computePerfAllowance(base({ income: 2800 }));
    expect(r.over).toBe(false);
    expect(r.bonusPool).toBe(0);
    expect(r.payouts).toHaveLength(1);
    expect(r.payouts[0]).toMatchObject({ memberId: "jaelynn", amount: 100, kind: "earner" });
  });

  it("income exactly at goal is NOT over (strict >)", () => {
    const r = computePerfAllowance(base({ income: 3000 }));
    expect(r.over).toBe(false);
    expect(r.payouts).toEqual([
      expect.objectContaining({ memberId: "jaelynn", amount: 100 }),
    ]);
  });

  it("over goal, % of overage, split 50/50 with Katelynn", () => {
    const r = computePerfAllowance(
      base({ income: 3500, splits: [{ memberId: "katelynn", pct: 50, toAccountId: "k-acct" }] })
    );
    // overage 500 * 20% = 100 bonus pool; split 50/50 → 50 each
    expect(r.overage).toBe(500);
    expect(r.bonusPool).toBe(100);
    expect(r.earnerBonus).toBe(50);
    const jae = r.payouts.find((p) => p.memberId === "jaelynn")!;
    const kate = r.payouts.find((p) => p.memberId === "katelynn")!;
    expect(jae.amount).toBe(150); // 100 min + 50 bonus
    expect(kate.amount).toBe(50);
    expect(kate.kind).toBe("split");
  });

  it("% of whole income (gross basis)", () => {
    const r = computePerfAllowance(base({ income: 3500, bonusBasis: "gross", bonusValue: 10 }));
    // 10% of 3500 = 350 pool, no splits → earner keeps all
    expect(r.bonusPool).toBe(350);
    expect(r.payouts[0].amount).toBe(450); // 100 + 350
  });

  it("fixed bonus ignores basis and is not clamped to income", () => {
    const r = computePerfAllowance(base({ income: 3001, bonusType: "fixed", bonusValue: 250 }));
    expect(r.bonusPool).toBe(250);
    expect(r.payouts[0].amount).toBe(350);
  });

  it("penny reconciliation: split shares + earner bonus sum to the pool", () => {
    const r = computePerfAllowance(
      base({
        income: 3000 + 100.01, // overage 100.01
        bonusValue: 100, // 100% of overage → pool 100.01
        splits: [
          { memberId: "a", pct: 33.33, toAccountId: "a" },
          { memberId: "b", pct: 33.33, toAccountId: "b" },
          { memberId: "c", pct: 33.33, toAccountId: "c" },
        ],
        min: 0,
      })
    );
    const sum = round2(r.payouts.reduce((s, p) => s + p.amount, 0));
    expect(r.bonusPool).toBe(100.01);
    expect(sum).toBe(100.01); // earner absorbs the residual cent
  });

  it("splits summing > 100% → warning + earner clamped to 0 bonus", () => {
    const r = computePerfAllowance(
      base({
        income: 4000,
        min: 0,
        splits: [
          { memberId: "a", pct: 60, toAccountId: "a" },
          { memberId: "b", pct: 60, toAccountId: "b" },
        ],
      })
    );
    expect(r.warnings).toContain("splits_exceed_100");
    expect(r.payouts.find((p) => p.memberId === "jaelynn")).toBeUndefined(); // 0 → suppressed
  });

  it("zero income, zero min → no payouts", () => {
    const r = computePerfAllowance(base({ income: 0, min: 0 }));
    expect(r.payouts).toHaveLength(0);
  });

  it("zero income but min set → just the min floor", () => {
    const r = computePerfAllowance(base({ income: 0, min: 100 }));
    expect(r.payouts).toHaveLength(1);
    expect(r.payouts[0].amount).toBe(100);
  });
});

const round2 = (n: number) => Math.round(n * 100) / 100;
