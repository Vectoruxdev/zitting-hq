/**
 * Giving/tithing engine (pure).
 *
 * The household's real-world flow, encoded:
 *   OWED     — 10% tithing + 5% United Order, computed on PRE-TAX GROSS.
 *              Plaid only ever sees net deposits, so gross is derived per
 *              income source: an explicit per-paycheck gross (from a paystub)
 *              beats a per-source gross ratio, which beats the household
 *              default ratio (observed ≈ 2.0202: the recurring $990 set-aside
 *              is exactly 15% of an implied ~$6,600 gross on a $3,265.49 net
 *              ADP check → net/gross ≈ 0.495).
 *   ACCRUED  — transfers INTO the charity money-market account (the family
 *              sets giving aside per paycheck, then settles later).
 *   SETTLED  — external payments in the charitable-* categories (Tithe.ly
 *              pulls, donations), from any account.
 * The charity account's balance is therefore an accrued UNPAID OBLIGATION,
 * not savings — the ledger surfaces it that way.
 */

export interface GivingSourceCfg {
  matchKey: string;
  name: string;
  titheEnabled: boolean;
  grossPerPeriod: number | null; // paystub gross per deposit (preferred)
  grossRatio: number | null; // gross = net × ratio (fallback)
}

export interface GivingTxn {
  dateISO: string;
  amount: number; // signed, our convention (+in / −out)
  matchKey?: string | null; // extractMerchant key (income rows)
  isTransfer?: boolean;
  categoryId?: string | null;
  accountId?: string | null;
}

export interface GivingConfig {
  tithingRate: number; // 0.10
  charityRate: number; // 0.05
  defaultGrossRatio: number; // 2.0202 (≈ 1 / 0.495)
  charityAccountId: string | null;
  charitableCategoryIds: Set<string>;
}

export interface GivingMonth {
  month: string; // YYYY-MM
  netIncome: number;
  grossIncome: number;
  owed: number;
  accrued: number;
  settled: number;
}

export interface GivingLedger {
  months: GivingMonth[]; // oldest → newest
  totals: { owed: number; accrued: number; settled: number };
  /** owed − settled over the whole window (what's still due to external causes) */
  outstanding: number;
  /** accrued − settled: what should be sitting in the charity account */
  expectedCharityBalance: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function grossFor(net: number, src: GivingSourceCfg | undefined, cfg: GivingConfig): number {
  if (!src) return net * cfg.defaultGrossRatio;
  if (!src.titheEnabled) return 0;
  if (src.grossPerPeriod != null && src.grossPerPeriod > 0) return src.grossPerPeriod;
  const ratio = src.grossRatio != null && src.grossRatio > 0 ? src.grossRatio : cfg.defaultGrossRatio;
  return net * ratio;
}

export function computeGivingLedger(args: {
  incomeTxns: GivingTxn[]; // registered income deposits only (registry-gated upstream)
  allTxns: GivingTxn[]; // household transactions (for accrual + settlement scan)
  sources: GivingSourceCfg[];
  cfg: GivingConfig;
  monthsBack?: number; // how many calendar months to include (default 6)
  nowISO: string;
}): GivingLedger {
  const { incomeTxns, allTxns, sources, cfg, nowISO } = args;
  const monthsBack = args.monthsBack ?? 6;
  const srcByKey = new Map(sources.map((s) => [s.matchKey, s]));

  const monthOf = (iso: string) => iso.slice(0, 7);
  const months: string[] = [];
  {
    const [y, m] = nowISO.slice(0, 7).split("-").map(Number);
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
  }
  const bucket = new Map<string, GivingMonth>(
    months.map((mo) => [mo, { month: mo, netIncome: 0, grossIncome: 0, owed: 0, accrued: 0, settled: 0 }])
  );

  // OWED — per registered income deposit.
  for (const t of incomeTxns) {
    if (!t.dateISO || t.amount <= 0) continue;
    const mo = monthOf(t.dateISO);
    const b = bucket.get(mo);
    if (!b) continue;
    const src = t.matchKey ? srcByKey.get(t.matchKey) : undefined;
    if (src && !src.titheEnabled) continue;
    const gross = grossFor(t.amount, src, cfg);
    b.netIncome = r2(b.netIncome + t.amount);
    b.grossIncome = r2(b.grossIncome + gross);
    b.owed = r2(b.owed + gross * (cfg.tithingRate + cfg.charityRate));
  }

  // ACCRUED — deposits into the charity account (transfers in).
  // SETTLED — charitable-category outflows anywhere in the household.
  for (const t of allTxns) {
    if (!t.dateISO) continue;
    const b = bucket.get(monthOf(t.dateISO));
    if (!b) continue;
    if (cfg.charityAccountId && t.accountId === cfg.charityAccountId && t.amount > 0 && t.isTransfer) {
      b.accrued = r2(b.accrued + t.amount);
    }
    if (t.amount < 0 && t.categoryId && cfg.charitableCategoryIds.has(t.categoryId)) {
      b.settled = r2(b.settled + -t.amount);
    }
  }

  const monthsOut = months.map((mo) => bucket.get(mo)!);
  const totals = monthsOut.reduce(
    (acc, b) => ({ owed: r2(acc.owed + b.owed), accrued: r2(acc.accrued + b.accrued), settled: r2(acc.settled + b.settled) }),
    { owed: 0, accrued: 0, settled: 0 }
  );
  return {
    months: monthsOut,
    totals,
    outstanding: r2(totals.owed - totals.settled),
    expectedCharityBalance: r2(totals.accrued - totals.settled),
  };
}
