/**
 * Categorization-accuracy eval (pure, no I/O).
 *
 * This is the measurement half of an autoresearch-style loop: `categorize.ts`
 * is the thing under test (the "train.py" you edit), and this module is the
 * fixed evaluator (the "prepare.py" you don't). You feed it a labeled gold set
 * — transactions a human deliberately categorized (`reviewed && manual`) — run
 * the engine over them, and get one headline number (accuracy) plus the
 * breakdowns you need to decide what to fix next: which sources are weak, which
 * categories get confused, and whether wrong answers at least surface for review.
 *
 * The point is a tight edit→measure→keep loop: change a dictionary entry or a
 * keyword, re-run `pnpm eval:cat`, and see whether accuracy went up or down
 * instead of guessing.
 *
 * Default eval is "cold" — no learned memory, no user rules — so it measures the
 * built-in dictionary/keyword/sign generalization (the part you actually tune),
 * with zero risk of leaking labels that memory was itself built from. Pass
 * `memory`/`rules` via `opts` to measure the warmer, production-like number.
 */

import {
  scoreCategory,
  REVIEW_THRESHOLD,
  type ScoreOpts,
  type Suggestion,
  type TxnLike,
} from "./categorize";
import { DEFAULT_CATEGORIES } from "./seedCategories";

/** One labeled example. `merchant` is the raw bank text the engine sees (the
 *  same noisy string `scoreCategory` consumes at import time), `expected` is the
 *  human-confirmed leaf categoryId. */
export interface EvalCase {
  merchant: string;
  amount: number;
  type?: string | null;
  expected: string;
  note?: string; // optional human label for readable reports, e.g. "Harmons"
}

export interface CaseResult {
  case: EvalCase;
  predicted: string;
  confidence: number;
  source: Suggestion["source"];
  correct: boolean;
  confident: boolean; // confidence >= REVIEW_THRESHOLD (would auto-apply)
}

export interface Bucket {
  n: number;
  correct: number;
  accuracy: number;
}

export interface EvalReport {
  total: number;
  correct: number;
  /** Headline metric — the number you're optimizing. correct / total. */
  accuracy: number;
  /** Share of predictions that cleared the review threshold (would auto-apply). */
  coverage: number;
  /** Accuracy among confident predictions — the real cost of auto-applying. */
  confidentAccuracy: number;
  /** Of the WRONG answers, the share that were low-confidence (correctly surfaced
   *  for review instead of confidently mislabeling). Higher = safer failures. */
  reviewSurfaceRate: number;
  bySource: Record<string, Bucket>;
  byExpected: Record<string, Bucket>;
  /** Most common expected→predicted mistakes, worst first — your fix list. */
  confusions: { expected: string; predicted: string; count: number }[];
  misses: CaseResult[];
  results: CaseResult[];
}

/** kind map (income/expense/transfer) from the real taxonomy. Drives the engine's
 *  sign guard, so the eval scores the engine the way production runs it. */
export function defaultCatKind(): Map<string, string> {
  return new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.kind]));
}

function bucket(): Bucket {
  return { n: 0, correct: 0, accuracy: 0 };
}
function tally(map: Record<string, Bucket>, key: string, correct: boolean) {
  const b = (map[key] ??= bucket());
  b.n++;
  if (correct) b.correct++;
  b.accuracy = b.correct / b.n;
}

/** Run the engine over a gold set and aggregate the metrics. */
export function runEval(cases: EvalCase[], opts: ScoreOpts = {}): EvalReport {
  const catKind = opts.catKind ?? defaultCatKind();

  const results: CaseResult[] = cases.map((c) => {
    const txn: TxnLike = { merchant: c.merchant, amount: c.amount, type: c.type ?? null };
    const s = scoreCategory(txn, { ...opts, catKind });
    return {
      case: c,
      predicted: s.categoryId,
      confidence: s.confidence,
      source: s.source,
      correct: s.categoryId === c.expected,
      confident: s.confidence >= REVIEW_THRESHOLD,
    };
  });

  const bySource: Record<string, Bucket> = {};
  const byExpected: Record<string, Bucket> = {};
  const confusionCounts = new Map<string, number>();
  let correct = 0;
  let confidentN = 0;
  let confidentCorrect = 0;
  let wrong = 0;
  let wrongSurfaced = 0;

  for (const r of results) {
    if (r.correct) correct++;
    if (r.confident) {
      confidentN++;
      if (r.correct) confidentCorrect++;
    }
    if (!r.correct) {
      wrong++;
      if (!r.confident) wrongSurfaced++;
      const k = `${r.case.expected}→${r.predicted}`;
      confusionCounts.set(k, (confusionCounts.get(k) ?? 0) + 1);
    }
    tally(bySource, r.source, r.correct);
    tally(byExpected, r.case.expected, r.correct);
  }

  const total = results.length || 1;
  const confusions = [...confusionCounts.entries()]
    .map(([k, count]) => {
      const [expected, predicted] = k.split("→");
      return { expected, predicted, count };
    })
    .sort((a, b) => b.count - a.count);

  return {
    total: results.length,
    correct,
    accuracy: correct / total,
    coverage: confidentN / total,
    confidentAccuracy: confidentN ? confidentCorrect / confidentN : 0,
    reviewSurfaceRate: wrong ? wrongSurfaced / wrong : 1,
    bySource,
    byExpected,
    confusions,
    misses: results.filter((r) => !r.correct),
    results,
  };
}

// ---------------------------------------------------------------------------
// Text report (dependency-free, for the CLI runner)
// ---------------------------------------------------------------------------

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
function bar(x: number, width = 24): string {
  const filled = Math.round(Math.max(0, Math.min(1, x)) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function formatReport(report: EvalReport, meta: { source?: string } = {}): string {
  const L: string[] = [];
  L.push("─".repeat(60));
  L.push("  CATEGORIZATION ACCURACY EVAL");
  if (meta.source) L.push(`  gold set: ${meta.source}`);
  L.push("─".repeat(60));
  L.push(`  Accuracy        ${bar(report.accuracy)}  ${pct(report.accuracy)}  (${report.correct}/${report.total})`);
  L.push(`  Coverage        ${bar(report.coverage)}  ${pct(report.coverage)}  cleared review threshold`);
  L.push(`  Confident acc.  ${bar(report.confidentAccuracy)}  ${pct(report.confidentAccuracy)}  when it auto-applies`);
  L.push(`  Safe failures   ${bar(report.reviewSurfaceRate)}  ${pct(report.reviewSurfaceRate)}  of misses surfaced for review`);
  L.push("");

  L.push("  By source");
  for (const [src, b] of Object.entries(report.bySource).sort((a, b) => b[1].n - a[1].n)) {
    L.push(`    ${src.padEnd(10)} ${String(b.correct).padStart(3)}/${String(b.n).padStart(3)}  ${pct(b.accuracy)}`);
  }
  L.push("");

  if (report.confusions.length) {
    L.push("  Top mistakes (expected → predicted)");
    for (const c of report.confusions.slice(0, 8)) {
      L.push(`    ${String(c.count).padStart(2)}×  ${c.expected}  →  ${c.predicted}`);
    }
    L.push("");
  }

  if (report.misses.length) {
    L.push(`  Misses (${report.misses.length})`);
    for (const m of report.misses) {
      const label = m.case.note || m.case.merchant.slice(0, 36);
      L.push(`    ✗ ${label.padEnd(38)} want ${m.case.expected.padEnd(22)} got ${m.predicted} [${m.source} ${pct(m.confidence)}]`);
    }
    L.push("");
  }

  L.push("─".repeat(60));
  return L.join("\n");
}
