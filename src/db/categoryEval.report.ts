/**
 * Categorization-accuracy eval — CLI readout.
 *
 *   pnpm eval:cat            Score the engine against the gold set and print a report.
 *   pnpm eval:cat --gen      Rebuild the gold set from YOUR database (reviewed +
 *                            manually-categorized transactions) into a gitignored
 *                            `category-eval.local.jsonl`, then score against it.
 *
 * The runner prefers `category-eval.local.jsonl` (your real data, never committed)
 * and falls back to the committed synthetic seed so it always runs. Set
 * EVAL_MIN_ACCURACY=0.85 to make it exit non-zero below that bar — that turns the
 * eval into a keep/discard gate you can wire into CI or a pre-push hook.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runEval, formatReport, type EvalCase } from "./categoryEval";

const DIR = join(process.cwd(), "src/db/fixtures");
const SEED = join(DIR, "category-eval.jsonl");
const LOCAL = join(DIR, "category-eval.local.jsonl");

function loadCases(path: string): EvalCase[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as EvalCase);
}

/**
 * Load the connection vars from `.env.local` into process.env. tsx doesn't inject
 * .env files, and the Vercel-style vars are often present-but-blank in the shell,
 * so we read the file ourselves and override — same approach as run-sql.ts.
 */
function loadEnvLocal(): void {
  const file = process.env.EVAL_ENV_FILE || ".env.local";
  let text = "";
  try {
    text = readFileSync(join(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) process.env[key] = val;
  }
}

/**
 * Export a gold set from real history. Ground truth = transactions a human
 * deliberately categorized (`reviewed && categorySource = 'manual'`). Transfers
 * are excluded (the engine handles them structurally, not by category guesswork).
 * The engine sees the raw `description` when present (what it gets at import),
 * falling back to the cleaned `merchant`.
 */
async function genFromDb(): Promise<void> {
  loadEnvLocal();
  const { db } = await import("./index");
  if (!db) {
    console.error("✗ --gen needs a database connection (POSTGRES_URL / DATABASE_URL in .env.local). None found.");
    process.exit(1);
  }
  const { transactions } = await import("./schema");
  const { and, eq, isNotNull } = await import("drizzle-orm");

  const rows = await db
    .select({
      description: transactions.description,
      merchant: transactions.merchant,
      amount: transactions.amount,
      type: transactions.category, // legacy label kept only as a human note
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.reviewed, true),
        eq(transactions.categorySource, "manual"),
        eq(transactions.isTransfer, false),
        isNotNull(transactions.categoryId),
      ),
    );

  const cases: EvalCase[] = rows
    .filter((r) => r.categoryId && r.categoryId !== "uncategorized")
    .map((r) => ({
      merchant: r.description || r.merchant,
      amount: Number(r.amount),
      expected: r.categoryId as string,
      note: r.merchant,
    }));

  if (!cases.length) {
    console.error("✗ No manually-categorized transactions found yet — categorize a few in the app, then re-run. Falling back to the synthetic seed.");
    return;
  }

  const out = cases.map((c) => JSON.stringify(c)).join("\n") + "\n";
  writeFileSync(LOCAL, out);
  console.log(`✓ Wrote ${cases.length} labeled cases to ${LOCAL}\n`);
}

async function main() {
  if (process.argv.includes("--gen")) await genFromDb();

  const path = existsSync(LOCAL) ? LOCAL : SEED;
  const cases = loadCases(path);
  const report = runEval(cases);
  console.log(formatReport(report, { source: path.replace(process.cwd() + "/", "") }));

  const min = Number(process.env.EVAL_MIN_ACCURACY ?? 0);
  if (min && report.accuracy < min) {
    console.error(`✗ Accuracy ${(report.accuracy * 100).toFixed(1)}% is below EVAL_MIN_ACCURACY ${(min * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

// Force exit: the --gen path opens a Postgres pool that would otherwise keep the
// event loop alive after the report prints.
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
