/**
 * Zitting HQ — remote MCP server (Streamable HTTP) for connecting the finance
 * data to Claude. Served at `/api/mcp` (the `[transport]` segment resolves to
 * "mcp"). Reuses the app's own DB layer: reads via getFinanceData(), writes via
 * the owner-authority mutations in src/db/mutations.ts.
 *
 * Auth: a shared secret in `MCP_TOKEN`. Accepted either as `Authorization:
 * Bearer <token>` (Claude Code / Desktop) or `?key=<token>` on the URL (clients
 * that only take a connector URL). If MCP_TOKEN is unset the endpoint is closed.
 */
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getFinanceData } from "@/db/queries";
import * as m from "@/db/mutations";
import { syncAllItems, listPlaidItems } from "@/db/plaid";

export const dynamic = "force-dynamic";
// 300s so the sync_now tool (slow bank pulls) fits; reads return in well under 60.
export const maxDuration = 300;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string): ToolResult => ({ content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true });
/** Run a tool body with uniform error reporting. */
const guard = (fn: () => Promise<ToolResult>) => async (): Promise<ToolResult> => {
  try { return await fn(); } catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
};

const baseHandler = createMcpHandler(
  (server) => {
    // ============================ READ ============================
    server.registerTool(
      "get_overview",
      {
        description:
          "Top-level financial snapshot: net worth, total cash, this-month spending & income, pending transfers, and the month's top spending categories.",
        inputSchema: {},
      },
      guard(async () => {
        const d = await getFinanceData();
        return ok({
          month: d.statsMonth,
          stats: d.stats,
          cashFlow: d.cashFlow,
          transfersPending: d.transfersPending,
          transfersPendingTotal: d.transfersPendingTotal,
          topCategories: d.categories,
          counts: { accounts: (d.accountsFlat || []).length, transactions: (d.txns || []).length, budgets: (d.budgets || []).length },
        });
      })
    );

    server.registerTool(
      "list_accounts",
      { description: "All accounts with current balances (checking, savings, credit).", inputSchema: {} },
      guard(async () => {
        const d = await getFinanceData();
        const a = d.accounts || { checking: [], savings: [], credit: [] };
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
          "List/search transactions, newest first. Filter by accountId, categoryId, memberId, a free-text merchant search, and/or a month (YYYY-MM). Use list_accounts / list_categories / list_members to resolve ids.",
        inputSchema: {
          accountId: z.string().optional(),
          categoryId: z.string().optional(),
          memberId: z.string().optional(),
          search: z.string().optional().describe("case-insensitive merchant substring"),
          month: z.string().optional().describe("YYYY-MM"),
          limit: z.number().int().min(1).max(500).optional(),
          offset: z.number().int().min(0).optional().describe("skip this many (newest-first) for pagination"),
        },
      },
      async ({ accountId, categoryId, memberId, search, month, limit, offset }) => {
        try {
          const d = await getFinanceData();
          const q = (search || "").toLowerCase();
          let rows = (d.txns || []) as Record<string, unknown>[];
          rows = rows.filter((t) => {
            if (accountId && t.accountId !== accountId) return false;
            if (categoryId && t.categoryId !== categoryId) return false;
            if (memberId && t.memberId !== memberId) return false;
            if (q && !String(t.merchant || "").toLowerCase().includes(q)) return false;
            if (month && !String(t.isoDate || t.date || "").startsWith(month)) return false;
            return true;
          });
          const start = offset ?? 0;
          const out = rows
            .slice()
            .reverse()
            .slice(start, start + (limit ?? 50))
            .map((t) => ({
              id: t.id, date: t.date, isoDate: t.isoDate, merchant: t.merchant, amount: t.amt, category: t.cat,
              categoryId: t.categoryId, who: t.who, memberId: t.memberId, account: t.account,
              accountId: t.accountId, income: t.income, isTransfer: t.isTransfer, reviewed: t.reviewed,
            }));
          return ok({ count: out.length, total: rows.length, transactions: out });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );

    server.registerTool(
      "spending_by_category",
      { description: "This-month spending broken down by category (the dashboard donut).", inputSchema: {} },
      guard(async () => {
        const d = await getFinanceData();
        return ok({ month: d.statsMonth, totalSpending: d.stats?.spending, categories: d.categories });
      })
    );

    server.registerTool(
      "list_budgets",
      { description: "Budgets with spent vs limit (per-person allowances and per-category budgets).", inputSchema: {} },
      guard(async () => ok((await getFinanceData()).budgets || []))
    );
    server.registerTool(
      "list_bills",
      { description: "Detected recurring bills / subscriptions with amounts and next due dates.", inputSchema: {} },
      guard(async () => ok((await getFinanceData()).bills || []))
    );
    server.registerTool(
      "list_income",
      { description: "Detected recurring income streams (paychecks, etc.).", inputSchema: {} },
      guard(async () => ok((await getFinanceData()).incomeStreams || []))
    );
    server.registerTool(
      "income_by_member",
      {
        description:
          "Income attributed to each person over time, from the curated income registry (owners-only data). Returns per-member this-month + all-time totals with a 6-month series and that person's marked sources, plus upcoming predicted deposits. Use to answer 'how much income did <person> bring in'.",
        inputSchema: {},
      },
      guard(async () => {
        const d = await getFinanceData();
        const income = d.income as { byMember?: unknown[]; upcoming?: unknown[] } | undefined;
        return ok({ month: d.statsMonth, byMember: income?.byMember || [], upcoming: income?.upcoming || [] });
      })
    );
    server.registerTool(
      "list_allowance_rules",
      {
        description:
          "Performance-allowance rules (income goal, base/min, bonus type, bonus splits between members) with a live current-month preview of computed payouts, plus the curated income registry (which payers count as whose income). Use this to verify allowance + bonus config is set up and firing.",
        inputSchema: {},
      },
      guard(async () => {
        const d = await getFinanceData();
        const income = d.income as { sources?: unknown[] } | undefined;
        return ok({ rules: d.allowanceRules || [], incomeRegistry: income?.sources || [] });
      })
    );
    server.registerTool(
      "list_transfers",
      { description: "Pending transfers to make (the checklist) plus transfer history.", inputSchema: {} },
      guard(async () => {
        const d = await getFinanceData();
        return ok({ pendingCount: d.transfersPending, pendingTotal: d.transfersPendingTotal, upcoming: d.upcoming, past: d.past });
      })
    );
    server.registerTool(
      "list_savings_goals",
      { description: "Savings goals with saved/target amounts and progress.", inputSchema: {} },
      guard(async () => ok((await getFinanceData()).goals || []))
    );
    server.registerTool(
      "list_categories",
      { description: "The category taxonomy: parent groups and their subcategories (with ids, for use in write tools).", inputSchema: {} },
      guard(async () => {
        const d = await getFinanceData();
        return ok({ groups: d.categoryGroups, categories: d.allCategories });
      })
    );
    server.registerTool(
      "list_members",
      { description: "Family members (with ids), for attributing transactions/budgets/transfers.", inputSchema: {} },
      guard(async () => ok((await getFinanceData()).members || []))
    );

    // ============================ WRITE ============================
    server.registerTool(
      "categorize_transactions",
      {
        description:
          "Set the category and/or person on one or more transactions (by id). At least one of categoryId/memberId is required. Learns the merchant→category mapping.",
        inputSchema: {
          transactionIds: z.array(z.number().int()).min(1),
          categoryId: z.string().optional(),
          memberId: z.string().optional(),
        },
      },
      async ({ transactionIds, categoryId, memberId }) => {
        if (!categoryId && !memberId) return fail("Provide categoryId and/or memberId.");
        try {
          await m.bulkUpdateTransactions(transactionIds, { categoryId, memberId }, { learn: !!categoryId });
          return ok({ ok: true, updated: transactionIds.length });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );

    server.registerTool(
      "create_budget",
      {
        description:
          "Create a budget. kind 'allowance' needs memberId; kind 'category' needs categoryId. limit is the monthly dollar amount.",
        inputSchema: {
          kind: z.enum(["allowance", "category"]),
          limit: z.number().positive(),
          memberId: z.string().optional(),
          categoryId: z.string().optional(),
          name: z.string().optional(),
        },
      },
      async ({ kind, limit, memberId, categoryId, name }) => {
        try {
          const res = await m.createBudget({ kind, limit, memberId, categoryId, name });
          return ok(res);
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );

    server.registerTool(
      "create_manual_transfer",
      {
        description:
          "Add a one-off transfer to the pending checklist (the app reminds; the bank moves the money). plannedDate is YYYY-MM-DD.",
        inputSchema: {
          fromAccountId: z.string(),
          toAccountId: z.string(),
          amount: z.number().positive(),
          memberId: z.string().optional(),
          plannedDate: z.string().optional(),
          note: z.string().optional(),
        },
      },
      async ({ fromAccountId, toAccountId, amount, memberId, plannedDate, note }) => {
        try {
          const res = await m.createManualTransfer({ fromAccountId, toAccountId, amount, memberId, plannedDate, note });
          return ok(res);
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );

    server.registerTool(
      "mark_transfer_done",
      {
        description: "Mark a pending transfer (by its instance id from list_transfers) done, or undone with done=false.",
        inputSchema: { transferId: z.number().int(), done: z.boolean().optional() },
      },
      async ({ transferId, done }) => {
        try {
          await m.markTransferInstance(transferId, done ?? true);
          return ok({ ok: true, transferId, done: done ?? true });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );

    server.registerTool(
      "sync_now",
      {
        description:
          "Trigger a Plaid sync for every connected bank (same as the UI's Sync now button). Idempotent. Returns per-bank results plus each item's status and lastSyncedAt so a stuck sync is visible.",
        inputSchema: {},
      },
      guard(async () => {
        const res = await syncAllItems();
        const items = await listPlaidItems();
        return ok({ ...res, banks: items });
      })
    );

    server.registerTool(
      "add_savings_contribution",
      {
        description: "Record a contribution toward a savings goal (goalId from list_savings_goals). date is YYYY-MM-DD.",
        inputSchema: {
          goalId: z.string(),
          amount: z.number().positive(),
          date: z.string().optional(),
          note: z.string().optional(),
        },
      },
      async ({ goalId, amount, date, note }) => {
        try {
          const res = await m.addContribution(goalId, { amount, date, note });
          return ok(res);
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );

    server.registerTool(
      "create_account",
      {
        description: "Create a new account. type is checking | savings | credit. mask is the last 4 digits.",
        inputSchema: {
          name: z.string(),
          type: z.enum(["checking", "savings", "credit"]),
          institution: z.string().optional(),
          mask: z.string().optional(),
          who: z.string().optional(),
        },
      },
      async ({ name, type, institution, mask, who }) => {
        try {
          const res = await m.createAccount({ name, type, institution, mask, who });
          return ok(res);
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      }
    );
  },
  {},
  { basePath: "/api", maxDuration: 300 }
);

/** Shared-secret gate. Returns a Response to short-circuit, or null to proceed. */
function authorize(req: Request): Response | null {
  const token = process.env.MCP_TOKEN;
  if (!token) return Response.json({ error: "MCP server not configured: set MCP_TOKEN." }, { status: 503 });
  const url = new URL(req.url);
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() ||
    url.searchParams.get("key") ||
    "";
  if (provided !== token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

async function handler(req: Request): Promise<Response> {
  const denied = authorize(req);
  if (denied) return denied;
  return baseHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
