/** Budget write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { tool, writeResult, requireConfirm, confirmField, idInt, type McpServer } from "../helpers";

export function registerBudgetWrites(server: McpServer) {
  server.registerTool(
    "create_budget",
    {
      description: "Create a budget. kind 'allowance' needs memberId; kind 'category' needs categoryId. limit is the monthly dollar amount.",
      inputSchema: { kind: z.enum(["allowance", "category"]), limit: z.number().positive(), memberId: z.string().optional(), categoryId: z.string().optional(), name: z.string().optional() },
    },
    tool(async (a: { kind: "allowance" | "category"; limit: number; memberId?: string; categoryId?: string; name?: string }) => writeResult(await m.createBudget(a)))
  );

  server.registerTool(
    "update_budget",
    {
      description: "Update a budget's monthly limit and/or re-target it (pass kind + memberId/categoryId to re-target).",
      inputSchema: { id: idInt, limit: z.number().positive().optional(), kind: z.enum(["allowance", "category"]).optional(), memberId: z.string().nullable().optional(), categoryId: z.string().nullable().optional() },
    },
    tool(async ({ id, ...patch }: { id: number; limit?: number; kind?: "allowance" | "category"; memberId?: string | null; categoryId?: string | null }) => writeResult(await m.updateBudget(id, patch)))
  );

  server.registerTool(
    "delete_budget",
    { description: "Delete a budget. Irreversible.", inputSchema: { id: idInt, ...confirmField } },
    tool(async ({ id, confirm }: { id: number; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete budget ${id}`);
      if (denied) return denied;
      return writeResult(await m.deleteBudget(id));
    })
  );
}
