/**
 * Shared helpers for the Zitting HQ MCP tools (see src/app/api/[transport]/route.ts).
 * Reads run with owner scope (getFinanceData, no viewer); writes call mutations
 * directly — the MCP token is the only auth boundary. Destructive tools gate on
 * `confirm: true` via requireConfirm().
 */
import type { createMcpHandler } from "mcp-handler";
import { z } from "zod";

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
/** The server instance mcp-handler hands to its registration callback (full registerTool inference, no SDK import). */
export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0];
export type Tier = "full" | "readonly";

export const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
export const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  isError: true,
});

/** Wrap a tool body with uniform error reporting (args passed through). */
export function tool<A>(fn: (args: A) => Promise<ToolResult> | ToolResult) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  };
}

/** Map a mutation's `{ ok:false, error }` into an MCP error; else return ok(res). */
export function writeResult(res: unknown): ToolResult {
  if (res && typeof res === "object" && "ok" in res && (res as { ok: unknown }).ok === false) {
    return fail((res as { error?: string }).error || "Operation failed.");
  }
  return ok(res);
}

/** Destructive-op gate: returns a refusal ToolResult unless confirm===true (else null = proceed). */
export function requireConfirm(confirm: boolean | undefined, what: string): ToolResult | null {
  if (confirm === true) return null;
  return fail(`Refused — this is irreversible (${what}). Re-call with confirm:true to proceed.`);
}

export const confirmField = {
  confirm: z.boolean().optional().describe("Set true to actually perform this irreversible action; omit and it is refused."),
};

// ---- shared zod shapes (id types differ: UUID strings vs serial ints) ----
/** UUID string ids: accounts, categories, members, savings goals, income sources, allocation rules. */
export const idStr = z.string().min(1);
/** Serial int ids: transactions, budgets, transfer instances, categorization rules, contributions, notifications. */
export const idInt = z.number().int();
export const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD");
export const monthStr = z.string().regex(/^\d{4}-\d{2}$/).describe("YYYY-MM");
