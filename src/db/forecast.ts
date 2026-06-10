/**
 * Paycheck forecasting + transfer-coverage math (pure, deterministic).
 *
 * `forecastIncome` projects when each recurring income source will next pay and
 * roughly how much, from its history (cadence detection + the schedule.ts next-date
 * helpers). `computeCoverage` answers "can we make the transfers we've queued?" —
 * cash in the source accounts vs. what's due in the window, and whether forecasted
 * (or manually-entered) income closes any gap before the soonest due date.
 *
 * Pure: callers inject `todayISO` (no Date.now / DB). ISO `YYYY-MM-DD` string math
 * throughout, matching schedule.ts. Cadence bands mirror detect.ts (kept local so
 * the working detection path stays untouched).
 */
import { type Cadence, nextOccurrence } from "./schedule";

const MS_DAY = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const toUTC = (iso: string): Date => new Date(iso.slice(0, 10) + "T00:00:00Z");
const fmt = (d: Date): string => d.toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number): string => fmt(new Date(toUTC(iso).getTime() + days * MS_DAY));
const dayDiff = (aISO: string, bISO: string): number => Math.round((toUTC(bISO).getTime() - toUTC(aISO).getTime()) / MS_DAY);
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Median gap (days) → cadence. Mirrors detect.ts bands.
function cadenceFromGap(gap: number): Cadence {
  if (gap <= 10) return "weekly";
  if (gap <= 18) return "biweekly";
  if (gap <= 45) return "monthly";
  if (gap <= 100) return "quarterly";
  return "yearly";
}

export type Confidence = "low" | "medium" | "high";

export interface IncomeSourceInput {
  key: string;
  name: string;
  accountId: string | null; // where this income historically deposits
  points: { dateISO: string; amount: number }[];
}

export interface IncomeForecast {
  key: string;
  name: string;
  accountId: string | null;
  dateISO: string;
  amount: number;
  cadence: Cadence;
  confidence: Confidence;
  samples: number;
  varianceDays: number;
  source: "auto";
}

/**
 * Project each source's next deposits within `[today, today+horizonDays]`.
 * Needs ≥2 dated points to infer a cadence; sources with fewer are skipped.
 */
export function forecastIncome(sources: IncomeSourceInput[], todayISO: string, horizonDays = 45): IncomeForecast[] {
  const horizonEnd = addDaysISO(todayISO, horizonDays);
  const out: IncomeForecast[] = [];
  for (const src of sources) {
    const points = [...src.points].filter((p) => p.dateISO).sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
    if (points.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < points.length; i++) gaps.push(dayDiff(points[i - 1].dateISO, points[i].dateISO));
    const med = median(gaps);
    if (med <= 0) continue;
    const cadence = cadenceFromGap(med);
    const regular = gaps.filter((g) => Math.abs(g - med) <= med * 0.5).length / gaps.length;
    const samples = points.length;
    const confidence: Confidence = samples >= 6 && regular >= 0.8 ? "high" : samples >= 3 ? "medium" : "low";
    const varianceDays = Math.round(gaps.reduce((s, g) => s + Math.abs(g - med), 0) / gaps.length);
    const recent = points.slice(-3);
    const amount = round2(recent.reduce((s, p) => s + p.amount, 0) / recent.length);
    const anchor = points[points.length - 1].dateISO;

    let occ = nextOccurrence(cadence, anchor, todayISO); // strictly after today
    let guard = 0;
    while (occ <= horizonEnd && guard++ < 12) {
      out.push({ key: src.key, name: src.name, accountId: src.accountId, dateISO: occ, amount, cadence, confidence, samples, varianceDays, source: "auto" });
      occ = nextOccurrence(cadence, anchor, occ);
    }
  }
  return out.sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
}

// ---- Coverage ----------------------------------------------------------------

export interface CoverageTransfer {
  amount: number;
  fromAccountId: string | null;
  dueISO: string | null; // null = due now
}
export interface CoverageIncome {
  dateISO: string;
  amount: number;
  accountId?: string | null;
  name?: string | null;
}
export interface CoverageSource {
  accountId: string;
  needed: number;
  have: number;
  short: number;
}
export type Verdict = "covered" | "covered_by_paycheck" | "short";
export interface CoverageResult {
  upcomingTotal: number;
  cashOnHand: number;
  gap: number; // sum of per-source shortfalls
  coveredNow: boolean;
  bySource: CoverageSource[];
  coverByDateISO: string | null; // soonest due among short sources
  incomeBeforeDue: number; // forecast/manual income landing on/before coverByDate
  coverDateISO: string | null; // earliest forecast date that closes the gap
  coveredByForecast: boolean;
  shortAfterForecast: number;
  verdict: Verdict;
}

/**
 * Per-source shortfall is exact (a surplus in one account can't mask a short
 * source). The forecast verdict treats income as fungible against the total gap
 * (matches "a paycheck hits before then, so we're good"); the per-source list
 * still shows where the shortfall physically sits.
 */
export function computeCoverage(args: {
  transfers: CoverageTransfer[];
  cashBySource: Record<string, number>;
  income: CoverageIncome[];
  todayISO: string;
  horizonDays?: number;
}): CoverageResult {
  const horizonEnd = addDaysISO(args.todayISO, args.horizonDays ?? 30);
  const inScope = args.transfers.filter((t) => !t.dueISO || t.dueISO <= horizonEnd);

  const bySrcMap = new Map<string, { needed: number; soonestDue: string }>();
  let upcomingTotal = 0;
  for (const t of inScope) {
    const src = t.fromAccountId ?? "__none__";
    const due = t.dueISO || args.todayISO;
    upcomingTotal = round2(upcomingTotal + t.amount);
    const e = bySrcMap.get(src) || { needed: 0, soonestDue: due };
    e.needed = round2(e.needed + t.amount);
    if (due < e.soonestDue) e.soonestDue = due;
    bySrcMap.set(src, e);
  }

  const bySource: CoverageSource[] = [];
  let cashOnHand = 0;
  let gap = 0;
  let coverByDateISO: string | null = null;
  for (const [src, e] of bySrcMap) {
    const have = round2(args.cashBySource[src] ?? 0);
    const short = round2(Math.max(0, e.needed - have));
    cashOnHand = round2(cashOnHand + have);
    gap = round2(gap + short);
    bySource.push({ accountId: src, needed: e.needed, have, short });
    if (short > 0 && (!coverByDateISO || e.soonestDue < coverByDateISO)) coverByDateISO = e.soonestDue;
  }

  // Forecast/manual income landing on/before the soonest short due date.
  const limit = coverByDateISO || horizonEnd;
  const incoming = args.income
    .filter((f) => f.dateISO > args.todayISO && f.dateISO <= limit)
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
  let acc = 0;
  let coverDateISO: string | null = null;
  for (const f of incoming) {
    acc = round2(acc + f.amount);
    if (gap > 0 && acc >= gap && !coverDateISO) coverDateISO = f.dateISO;
  }
  const incomeBeforeDue = acc;
  const coveredByForecast = gap > 0 && incomeBeforeDue >= gap;
  const shortAfterForecast = round2(Math.max(0, gap - incomeBeforeDue));
  const verdict: Verdict = gap === 0 ? "covered" : coveredByForecast ? "covered_by_paycheck" : "short";

  return {
    upcomingTotal,
    cashOnHand,
    gap,
    coveredNow: gap === 0,
    bySource,
    coverByDateISO,
    incomeBeforeDue,
    coverDateISO,
    coveredByForecast,
    shortAfterForecast,
    verdict,
  };
}
