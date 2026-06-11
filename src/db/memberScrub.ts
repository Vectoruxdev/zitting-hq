/**
 * Member-view privacy scrub (pure).
 *
 * A member's browser receives the whole ZHQ_DATA object, and "the member UI
 * only renders Spendable" is not a privacy boundary — anything in the payload
 * is visible in devtools. Member-private filtering must happen SERVER-SIDE in
 * getFinanceData; this is the final pass that blanks every household-wide
 * section a member has no business receiving: household stats/net worth,
 * other members' budgets and allowances, the income registry, transfer
 * checklists and cash-coverage positions, the roster (emails/allowances), etc.
 *
 * KEPT (the Spendable view's actual inputs, all already viewer-scoped
 * upstream): memberHome, goals (canViewGoal), txns / accounts / accountsFlat /
 * incomeHistory / bulkGroups (canSeeAccount), notifications (audience-scoped),
 * allCategories / categoryGroups (taxonomy, needed to categorize), nav, ask.
 */

/** Sections a member viewer must NOT receive, with their blank values. */
const SCRUB: Record<string, () => unknown> = {
  stats: () => ({ totalCash: "$0", netWorth: "$0", spending: "$0", income: "$0", transfers: "$0" }),
  statsMonth: () => "",
  trend: () => ({ income: [0, 0, 0, 0, 0, 0], spending: [0, 0, 0, 0, 0, 0], labels: [] }),
  categories: () => [],
  cashFlow: () => ({
    month: "",
    inFlow: 0, inFlowDisplay: "$0",
    outFlow: 0, outFlowDisplay: "$0",
    transfersOut: 0, transfersOutDisplay: "$0", transfersDirection: "out",
    net: 0, netDisplay: "$0",
  }),
  accountTransfers: () => [],
  upcoming: () => [],
  scheduledTransfers: () => [],
  scheduledCount: () => 0,
  past: () => [],
  transfersPending: () => 0,
  transfersPendingTotal: () => "$0",
  transferReadiness: () => null,
  income: () => ({ sources: [], candidates: [], totalMonthly: 0, totalMonthlyLabel: "$0" }),
  incomeStreams: () => [],
  bills: () => [],
  budgets: () => [],
  members: () => [],
  allowanceRules: () => [],
  rules: () => [],
  catRules: () => [],
  importBatches: () => [],
  excludedAccounts: () => [],
  notifRules: () => [],
  receiptItems: () => [],
  receipts: () => [],
};

export const MEMBER_SCRUBBED_KEYS = Object.keys(SCRUB);

/** Blank household-wide sections in place; returns the same object. */
export function scrubForMemberView<T extends Record<string, unknown>>(data: T): T {
  const d = data as Record<string, unknown>;
  for (const key of MEMBER_SCRUBBED_KEYS) d[key] = SCRUB[key]();
  return data;
}
