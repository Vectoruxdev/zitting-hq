/**
 * Performance-allowance calculator (pure, deterministic).
 *
 * An "earner" has an income GOAL and a MINIMUM allowance floor. When their income
 * for a period beats the goal, a BONUS is computed — a fixed dollar amount, or a
 * percentage of the OVERAGE (income − goal) or of the WHOLE income. The bonus is
 * split across recipient members by percentage; the earner keeps the remainder
 * (100 − Σ split pct). Each payout becomes a suggested transfer elsewhere.
 *
 * Pure (no Date.now / DB / mutation) so it's unit-testable like matchTransfers /
 * generateInstances. The earner absorbs the rounding residue so the split shares
 * plus the earner's bonus always sum back to the bonus pool to the cent.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type BonusType = "percent" | "fixed";
export type BonusBasis = "overage" | "gross";

export interface AllowanceSplitInput {
  memberId: string;
  pct: number; // 0..100
  toAccountId: string | null;
}

export interface PerfAllowanceInput {
  income: number;
  goal: number;
  min: number;
  bonusType: BonusType;
  bonusBasis: BonusBasis; // ignored when bonusType === "fixed"
  bonusValue: number; // dollars (fixed) or percent (percent)
  splits: AllowanceSplitInput[];
  earnerMemberId: string;
  earnerToAccountId: string | null;
  fromAccountId: string | null;
}

export interface AllowancePayout {
  memberId: string;
  toAccountId: string | null;
  fromAccountId: string | null;
  amount: number; // > 0
  kind: "earner" | "split";
}

export type AllowanceWarning = "splits_exceed_100";

export interface PerfAllowanceResult {
  income: number;
  over: boolean;
  overage: number;
  bonusPool: number;
  earnerBonus: number;
  payouts: AllowancePayout[]; // amount > 0 only
  warnings: AllowanceWarning[];
}

export function computePerfAllowance(input: PerfAllowanceInput): PerfAllowanceResult {
  const income = round2(Math.max(0, input.income));
  const goal = round2(Math.max(0, input.goal));
  const min = round2(Math.max(0, input.min));
  const over = income > goal;
  const overage = round2(Math.max(0, income - goal));

  let bonusPool = 0;
  if (over) {
    if (input.bonusType === "fixed") {
      bonusPool = round2(Math.max(0, input.bonusValue));
    } else {
      const base = input.bonusBasis === "gross" ? income : overage;
      bonusPool = round2(Math.max(0, (input.bonusValue / 100) * base));
    }
  }

  const warnings: AllowanceWarning[] = [];
  const pctTotal = input.splits.reduce((s, sp) => s + (sp.pct || 0), 0);
  if (pctTotal > 100) warnings.push("splits_exceed_100");

  // Round each split first; the earner absorbs the residue so the parts sum to the pool.
  const splitPayouts = input.splits.map((sp) => ({
    memberId: sp.memberId,
    toAccountId: sp.toAccountId,
    amount: round2(bonusPool * (Math.max(0, sp.pct) / 100)),
  }));
  const splitTotal = round2(splitPayouts.reduce((s, p) => s + p.amount, 0));
  const earnerBonus = Math.max(0, round2(bonusPool - splitTotal));
  const earnerAmount = round2(min + earnerBonus);

  const payouts: AllowancePayout[] = [];
  if (earnerAmount > 0) {
    payouts.push({
      memberId: input.earnerMemberId,
      toAccountId: input.earnerToAccountId,
      fromAccountId: input.fromAccountId,
      amount: earnerAmount,
      kind: "earner",
    });
  }
  for (const sp of splitPayouts) {
    if (sp.amount > 0) {
      payouts.push({
        memberId: sp.memberId,
        toAccountId: sp.toAccountId,
        fromAccountId: input.fromAccountId,
        amount: sp.amount,
        kind: "split",
      });
    }
  }

  return { income, over, overage, bonusPool, earnerBonus, payouts, warnings };
}
