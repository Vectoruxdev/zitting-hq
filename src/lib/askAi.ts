/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Ask AI — the money coach. Answers questions about the household's finances
 * with Claude, grounded in a compact snapshot of the live finance data (same
 * ANTHROPIC_API_KEY as receipt scanning). Plain fetch against the Messages
 * API — no SDK dependency. Server-only. Never throws: returns null when the
 * key is missing or the call fails, and the caller shows a friendly error.
 */

export const isAskConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export interface CoachTurn {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM_PROMPT = `You are the private money coach inside Zitting HQ, a family finance app. You are talking to the household's owner about THEIR OWN money — the snapshot below is their real data, which they can already see in the app, so answer freely and specifically.

Rules:
- Ground every answer in the snapshot. Use real dollar figures, merchant names, and dates from it. If the snapshot can't answer the question, say what's missing — never invent numbers.
- Transactions: negative amounts are spending, positive are income. Rows marked transfer are money moving between their own accounts — not spending or income.
- Be a warm, plain-spoken coach. Short answers: 2-6 sentences for most questions. No filler, no disclaimers about being an AI.
- Output PLAIN TEXT only — no markdown headers, bullets, bold, or tables (the chat UI renders raw text). A short list can be written as lines separated by newlines.
- When asked for advice (where to cut, how to hit a goal), give one or two concrete moves with the math, drawn from their actual categories and merchants.`;

/** Distill the full finance payload into a compact JSON snapshot the model
 *  can ground on. Display labels are preferred over raw numbers where they
 *  exist — they're already rounded and formatted. */
export function buildCoachContext(d: any): string {
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  const acctList = d.accounts
    ? [...arr(d.accounts.checking), ...arr(d.accounts.savings), ...arr(d.accounts.credit)]
    : [];
  const snapshot = {
    today: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    stats: d.stats ?? null, // total cash / net worth / month spending / income / transfers
    cashFlowThisMonth: d.cashFlow ?? null,
    sixMonthTrend: d.trend ?? null,
    spendingByCategoryThisMonth: arr(d.categories).map((c: any) => ({ category: c.label, spent: c.display })),
    accounts: acctList.map((a: any) => ({
      name: a.name,
      type: arr(d.accounts?.credit).includes(a) ? "credit" : a.type,
      balance: Math.round((a.balance ?? 0) * 100) / 100,
      who: a.who ?? undefined,
    })),
    budgets: arr(d.budgets).map((b: any) => ({ name: b.name, who: b.who ?? undefined, spent: b.spent, limit: b.limit })),
    savingsGoals: arr(d.goals)
      .filter((g: any) => !g.archived)
      .map((g: any) => ({ name: g.name, saved: g.saved, target: g.target, targetDate: g.date ?? undefined, requiredPerMonth: g.requiredPerMonth ?? undefined, status: g.status })),
    recurringBills: arr(d.bills).slice(0, 40).map((b: any) => ({ name: b.name, amount: b.amount, freq: b.freq, next: b.next ?? undefined, changed: b.delta ?? undefined })),
    incomeSources: d.income
      ? arr(d.income.sources).map((s: any) => ({ name: s.name, monthly: s.monthly, cadence: s.cadence ?? undefined, person: s.memberName ?? undefined }))
      : [],
    expectedMonthlyIncomeTotal: d.income?.totalMonthlyLabel ?? null,
    upcomingTransfers: arr(d.upcoming).map((t: any) => ({ to: t.to, from: t.from, amount: t.amount, due: t.due, state: t.state })),
    family: arr(d.members).map((mm: any) => ({ name: mm.name, role: mm.role, monthlyAllowance: mm.allowance || undefined })),
    // Newest-last in the source; send the most recent slice, newest first.
    recentTransactions: arr(d.txns)
      .slice(-150)
      .reverse()
      .map((t: any) => ({
        date: t.date,
        merchant: t.merchant,
        amount: t.amt,
        category: t.cat,
        who: t.who,
        account: t.account,
        ...(t.isTransfer ? { transfer: true } : {}),
        ...(t.pending ? { pending: true } : {}),
      })),
  };
  return JSON.stringify(snapshot);
}

/** Ask the coach. `turns` is the chat so far (oldest first, ending with the
 *  user's new question). Returns the assistant's reply text, or null. */
export async function askMoneyCoach(context: string, turns: CoachTurn[]): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !turns.length) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1500,
        thinking: { type: "adaptive" },
        system: `${SYSTEM_PROMPT}\n\nHousehold snapshot (live data):\n${context}`,
        messages: turns.map((t) => ({ role: t.role, content: t.text })),
      }),
    });
    if (!res.ok) {
      console.error("[askAi] API error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const msg = (await res.json()) as {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    };
    if (msg.stop_reason === "refusal") return null;
    const text = (msg.content || [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || null;
  } catch (err) {
    console.error("[askAi] failed", err);
    return null;
  }
}
