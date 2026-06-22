/** Pure section-selection for the financial_snapshot tool (unit-tested). */
export const SNAPSHOT_SECTIONS = [
  "stats", "statsMonth", "cashFlow", "trend", "categories", "transferReadiness", "savingsStats",
  "income", "incomeStreams", "bills", "budgets", "goals", "rules", "catRules", "allowanceRules",
  "members", "accounts", "accountsFlat", "excludedAccounts", "upcoming", "scheduledTransfers", "past",
  "transfersPending", "transfersPendingTotal", "notifPrefs", "notifRules", "digest", "learned",
  "bulkGroups", "importBatches", "incomeHistory", "accountTransfers", "txns", "receipts", "notifications",
] as const;

/** Big arrays excluded from ['all'] to protect the context window (use list_* tools). */
export const UNBOUNDED = new Set<string>(["txns", "accountTransfers", "receipts", "notifications", "incomeHistory"]);

export type SnapshotSection = (typeof SNAPSHOT_SECTIONS)[number];

/** Select which financial_snapshot sections to return. Omit `sections` → compact
 *  summary; ['all'] → everything bounded (+txns if includeTxns); else the listed keys. */
export function pickSnapshot(
  data: Record<string, unknown>,
  sections?: string[],
  includeTxns?: boolean
): Record<string, unknown> {
  if (sections && sections.length) {
    if (sections.includes("all")) {
      const out: Record<string, unknown> = {};
      for (const k of SNAPSHOT_SECTIONS) {
        if (UNBOUNDED.has(k) && !(includeTxns && k === "txns")) continue;
        out[k] = data[k];
      }
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const k of sections) out[k] = data[k];
    return out;
  }
  const income = data.income as { totalMonthly?: number } | undefined;
  return {
    statsMonth: data.statsMonth, stats: data.stats, cashFlow: data.cashFlow,
    transferReadiness: data.transferReadiness, savingsStats: data.savingsStats,
    transfersPending: data.transfersPending, transfersPendingTotal: data.transfersPendingTotal,
    incomeMonthly: income?.totalMonthly,
    counts: {
      accounts: ((data.accountsFlat as unknown[]) || []).length,
      transactions: ((data.txns as unknown[]) || []).length,
      budgets: ((data.budgets as unknown[]) || []).length,
      goals: ((data.goals as unknown[]) || []).length,
    },
  };
}
