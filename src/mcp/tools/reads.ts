/** Read tools — all from getFinanceData() at owner scope (full household). */
import { z } from "zod";
import { getFinanceData } from "@/db/queries";
import { ok, tool, type McpServer } from "../helpers";
import { SNAPSHOT_SECTIONS, pickSnapshot } from "../snapshot";

export function registerReads(server: McpServer) {
  server.registerTool(
    "financial_snapshot",
    {
      description:
        "The whole household financial dataset (owner view). Omit `sections` for a compact summary (stats, cash flow, transfer-coverage, savings, income total, counts). Pass specific `sections` to fetch exactly those, or sections:['all'] for everything EXCEPT large arrays (transactions, receipts, notifications, account-transfers, income history) — use the dedicated list_* tools for those, or set includeTxns:true to add transactions.",
      inputSchema: {
        sections: z.array(z.enum([...SNAPSHOT_SECTIONS, "all"])).optional()
          .describe("Which sections to return. Omit for the summary; ['all'] for the full (bounded) dataset."),
        includeTxns: z.boolean().optional().describe("Include the full transactions array in ['all'] (large)."),
      },
    },
    tool(async ({ sections, includeTxns }: { sections?: string[]; includeTxns?: boolean }) => {
      const d = (await getFinanceData()) as unknown as Record<string, unknown>;
      return ok(pickSnapshot(d, sections, includeTxns));
    })
  );

  server.registerTool(
    "get_overview",
    { description: "Top-level snapshot: net worth, total cash, this-month spending & income, pending transfers, top categories.", inputSchema: {} },
    tool(async () => {
      const d = await getFinanceData();
      return ok({
        month: d.statsMonth, stats: d.stats, cashFlow: d.cashFlow,
        transfersPending: d.transfersPending, transfersPendingTotal: d.transfersPendingTotal,
        topCategories: d.categories,
        counts: { accounts: (d.accountsFlat || []).length, transactions: (d.txns || []).length, budgets: (d.budgets || []).length },
      });
    })
  );

  server.registerTool(
    "list_accounts",
    { description: "All accounts with current balances (checking, savings, credit).", inputSchema: {} },
    tool(async () => {
      const a = (await getFinanceData()).accounts || { checking: [], savings: [], credit: [] };
      const flat = [
        ...(a.checking || []).map((x: Record<string, unknown>) => ({ ...x, type: "checking" })),
        ...(a.savings || []).map((x: Record<string, unknown>) => ({ ...x, type: "savings" })),
        ...(a.credit || []).map((x: Record<string, unknown>) => ({ ...x, type: "credit" })),
      ].map((x: Record<string, unknown>) => ({ id: x.id, name: x.name, type: x.type, balance: x.balance, who: x.who, institution: x.inst }));
      return ok(flat);
    })
  );

  server.registerTool(
    "list_transactions",
    {
      description:
        "List/search transactions, newest first. Filter by accountId, categoryId, memberId, free-text merchant search, and/or month (YYYY-MM). Paginated via limit/offset.",
      inputSchema: {
        accountId: z.string().optional(),
        categoryId: z.string().optional(),
        memberId: z.string().optional(),
        search: z.string().optional().describe("case-insensitive merchant substring"),
        month: z.string().optional().describe("YYYY-MM"),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional().describe("skip this many (newest-first)"),
      },
    },
    tool(async ({ accountId, categoryId, memberId, search, month, limit, offset }: {
      accountId?: string; categoryId?: string; memberId?: string; search?: string; month?: string; limit?: number; offset?: number;
    }) => {
      const d = await getFinanceData();
      const q = (search || "").toLowerCase();
      const rows = ((d.txns || []) as Record<string, unknown>[]).filter((t) => {
        if (accountId && t.accountId !== accountId) return false;
        if (categoryId && t.categoryId !== categoryId) return false;
        if (memberId && t.memberId !== memberId) return false;
        if (q && !String(t.merchant || "").toLowerCase().includes(q)) return false;
        if (month && !String(t.isoDate || t.date || "").startsWith(month)) return false;
        return true;
      });
      const start = offset ?? 0;
      const out = rows.slice().reverse().slice(start, start + (limit ?? 50)).map((t) => ({
        id: t.id, date: t.date, isoDate: t.isoDate, merchant: t.merchant, amount: t.amt, category: t.cat,
        categoryId: t.categoryId, who: t.who, memberId: t.memberId, account: t.account, accountId: t.accountId,
        income: t.income, isTransfer: t.isTransfer, reviewed: t.reviewed,
      }));
      return ok({ count: out.length, total: rows.length, transactions: out });
    })
  );

  server.registerTool(
    "spending_by_category",
    { description: "This-month spending broken down by category (the dashboard donut).", inputSchema: {} },
    tool(async () => {
      const d = await getFinanceData();
      return ok({ month: d.statsMonth, totalSpending: d.stats?.spending, categories: d.categories });
    })
  );

  // ---- simple single-key readers ----
  const simple: [string, string, (d: Awaited<ReturnType<typeof getFinanceData>>) => unknown][] = [
    ["list_budgets", "Budgets with spent vs limit (per-person allowances and per-category budgets).", (d) => d.budgets || []],
    ["list_bills", "Detected recurring bills / subscriptions with amounts and next due dates.", (d) => d.bills || []],
    ["list_income", "Detected recurring income streams (paychecks, etc.).", (d) => d.incomeStreams || []],
    ["list_savings_goals", "Savings goals with saved/target amounts and progress.", (d) => d.goals || []],
    ["list_members", "Family members (with ids), for attributing transactions/budgets/transfers.", (d) => d.members || []],
    ["get_transfer_readiness", "Transfer-coverage cockpit: cash on hand vs due-soon transfers + paycheck-forecast verdict.", (d) => d.transferReadiness || null],
    ["get_cash_flow", "This-month cash reconciliation: money in, spent, transfers out, net change (checking+savings).", (d) => d.cashFlow || null],
    ["get_trend", "6-month income vs spending series (oldest first).", (d) => d.trend || null],
    ["get_savings_stats", "Savings aggregate: total saved, monthly contribution, active/on-track counts.", (d) => d.savingsStats || null],
    ["get_income_history", "Per-payer income-over-time history (drives the income trend charts).", (d) => d.incomeHistory || {}],
    ["get_digest_settings", "Email digest config: cadence, enabled, owner/members opt-in, next run.", (d) => d.digest || null],
    ["get_notification_settings", "Notification preferences + alert rule definitions.", (d) => ({ prefs: d.notifPrefs || [], rules: d.notifRules || [] })],
    ["list_receipts", "Uploaded receipts (newest first) with parsed line items + match status.", (d) => d.receipts || []],
    ["list_learned_merchants", "Auto-categorize memory: merchant → winning category, confidence, competitors.", (d) => d.learned || []],
    ["list_bulk_groups", "Uncategorized merchant clusters for bulk categorization (ids + suggestion).", (d) => d.bulkGroups || []],
    ["list_imports", "Import batches (CSV/Plaid) with rows imported/skipped and date range.", (d) => d.importBatches || []],
    ["list_account_transfers", "Detected internal account-to-account transfers (linked pairs).", (d) => d.accountTransfers || []],
    ["list_allocation_rules", "Allocation/waterfall rules (on-income + scheduled transfers).", (d) => d.rules || []],
    ["list_category_rules", "Categorization rules (merchant/amount match → category).", (d) => d.catRules || []],
    ["list_excluded_accounts", "Business-space / excluded accounts (kept out of the household view).", (d) => d.excludedAccounts || []],
  ];
  for (const [name, description, pick] of simple) {
    server.registerTool(name, { description, inputSchema: {} }, tool(async () => ok(pick(await getFinanceData()))));
  }

  server.registerTool(
    "list_notifications",
    { description: "The notification feed (newest first).", inputSchema: { unreadOnly: z.boolean().optional() } },
    tool(async ({ unreadOnly }: { unreadOnly?: boolean }) => {
      const all = ((await getFinanceData()).notifications || []) as Record<string, unknown>[];
      return ok(unreadOnly ? all.filter((n) => n.unread) : all);
    })
  );

  server.registerTool(
    "income_by_member",
    { description: "Income attributed to each person (curated registry): this-month + all-time totals, 6-month series, upcoming deposits.", inputSchema: {} },
    tool(async () => {
      const d = await getFinanceData();
      const income = d.income as { byMember?: unknown[]; upcoming?: unknown[] } | undefined;
      return ok({ month: d.statsMonth, byMember: income?.byMember || [], upcoming: income?.upcoming || [] });
    })
  );

  server.registerTool(
    "list_allowance_rules",
    { description: "Performance-allowance rules (goal/min/bonus + splits) with a live current-month payout preview, plus the curated income registry.", inputSchema: {} },
    tool(async () => {
      const d = await getFinanceData();
      const income = d.income as { sources?: unknown[] } | undefined;
      return ok({ rules: d.allowanceRules || [], incomeRegistry: income?.sources || [] });
    })
  );

  server.registerTool(
    "list_transfers",
    { description: "Pending transfers to make (the checklist) plus transfer history.", inputSchema: {} },
    tool(async () => {
      const d = await getFinanceData();
      return ok({ pendingCount: d.transfersPending, pendingTotal: d.transfersPendingTotal, upcoming: d.upcoming, past: d.past });
    })
  );

  server.registerTool(
    "list_categories",
    { description: "The category taxonomy: parent groups and their subcategories (with ids, for write tools).", inputSchema: {} },
    tool(async () => {
      const d = await getFinanceData();
      return ok({ groups: d.categoryGroups, categories: d.allCategories });
    })
  );
}
