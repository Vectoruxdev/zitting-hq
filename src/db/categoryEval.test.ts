import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runEval, defaultCatKind, type EvalCase } from "./categoryEval";

const SEED = join(process.cwd(), "src/db/fixtures/category-eval.jsonl");
function loadSeed(): EvalCase[] {
  return readFileSync(SEED, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as EvalCase);
}

describe("runEval — metric math", () => {
  // netflix is a confident dictionary hit (te-entertainment-local); the QWERTY
  // string is a confident-less abstention (uncategorized). Pinning expected to
  // the WRONG category lets us assert the aggregation without depending on the
  // engine being right.
  const netflix = "Debit Card purch COMMENT: NETFLIX.COM ***-***3700 CA";

  it("computes accuracy, totals, and misses", () => {
    const r = runEval([
      { merchant: netflix, amount: -22.99, expected: "te-entertainment-local" }, // correct
      { merchant: netflix, amount: -22.99, expected: "groc-other" }, // wrong
    ]);
    expect(r.total).toBe(2);
    expect(r.correct).toBe(1);
    expect(r.accuracy).toBe(0.5);
    expect(r.misses).toHaveLength(1);
    expect(r.confusions[0]).toEqual({ expected: "groc-other", predicted: "te-entertainment-local", count: 1 });
  });

  it("reviewSurfaceRate counts only LOW-confidence misses as safe failures", () => {
    const r = runEval([
      { merchant: netflix, amount: -22.99, expected: "groc-other" }, // confident + wrong → unsafe
      { merchant: "QWERTY ZXCV 9999", amount: -12.34, expected: "groc-other" }, // abstains + wrong → safe
    ]);
    expect(r.reviewSurfaceRate).toBe(0.5);
    expect(r.coverage).toBe(0.5); // only the netflix hit cleared the threshold
  });

  it("buckets accuracy by source", () => {
    const r = runEval([{ merchant: netflix, amount: -22.99, expected: "te-entertainment-local" }]);
    expect(r.bySource.merchant).toEqual({ n: 1, correct: 1, accuracy: 1 });
  });

  it("derives the sign-guard kind map from the real taxonomy", () => {
    const k = defaultCatKind();
    expect(k.get("income-paycheck")).toBe("income");
    expect(k.get("groc-other")).toBe("expense");
    expect(k.get("transfer")).toBe("transfer");
  });
});

describe("categorization engine — regression gate against the gold set", () => {
  const report = runEval(loadSeed());

  // The synthetic seed is fully solved (36/36 = 100%) after clearing the
  // dictionary gaps the eval surfaced. The floor sits a touch below that — tight
  // enough that an engine change which re-breaks a solved case fails CI, with
  // just enough headroom to add a hard backlog case without an immediate bump.
  // When real --gen data pushes this up, ratchet the floor with it.
  it("holds overall accuracy at or above the baseline", () => {
    expect(report.accuracy).toBeGreaterThanOrEqual(0.94);
  });

  // The safety-critical one: when the engine is confident enough to auto-apply,
  // it must almost never be wrong. Cheap, silent mislabels are the real cost.
  it("stays highly accurate when it auto-applies", () => {
    expect(report.confidentAccuracy).toBeGreaterThanOrEqual(0.95);
  });

  it("surfaces most of its mistakes for review rather than mislabeling", () => {
    expect(report.reviewSurfaceRate).toBeGreaterThanOrEqual(0.8);
  });
});
