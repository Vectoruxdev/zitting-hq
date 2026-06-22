/** Income-registry + expected-income write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { tool, writeResult, requireConfirm, confirmField, idStr, dateISO, type McpServer } from "../helpers";

export function registerIncomeWrites(server: McpServer) {
  server.registerTool(
    "mark_income_source",
    {
      description: "Register a payer (matchKey, from list_learned_merchants / a transaction's source key) as income for a person. This RELABELS all past matching deposits to the income category and seeds future ones — irreversible relabel, so requires confirm:true.",
      inputSchema: { matchKey: idStr, name: idStr, memberId: z.string().nullable().optional(), accountId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), ...confirmField },
    },
    tool(async ({ confirm, ...args }: { matchKey: string; name: string; memberId?: string | null; accountId?: string | null; categoryId?: string | null; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `mark '${args.matchKey}' as income and relabel its past deposits`);
      if (denied) return denied;
      return writeResult(await m.markIncomeSource(args));
    })
  );

  server.registerTool(
    "update_income_source",
    { description: "Edit a registered income source (name/owner/account; active:false stops it counting as income).", inputSchema: { id: idStr, name: z.string().optional(), memberId: z.string().nullable().optional(), accountId: z.string().nullable().optional(), active: z.boolean().optional() } },
    tool(async ({ id, ...patch }: { id: string; name?: string; memberId?: string | null; accountId?: string | null; active?: boolean }) => writeResult(await m.updateIncomeSource(id, patch)))
  );

  server.registerTool(
    "delete_income_source",
    { description: "Unregister an income source. Past transaction categories are left as-is; future deposits stop auto-counting as income. Requires confirm:true.", inputSchema: { id: idStr, ...confirmField } },
    tool(async ({ id, confirm }: { id: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `unregister income source ${id}`);
      if (denied) return denied;
      return writeResult(await m.deleteIncomeSource(id));
    })
  );

  server.registerTool(
    "add_expected_income",
    { description: "Add an expected/one-off deposit for the transfer-coverage forecast. expectedDate is YYYY-MM-DD.", inputSchema: { label: idStr, amount: z.number(), expectedDate: dateISO, sourceKey: z.string().nullable().optional(), accountId: z.string().nullable().optional() } },
    tool(async (a: { label: string; amount: number; expectedDate: string; sourceKey?: string | null; accountId?: string | null }) => writeResult(await m.addExpectedIncome(a)))
  );

  server.registerTool(
    "delete_expected_income",
    { description: "Remove an expected-income entry.", inputSchema: { id: idStr } },
    tool(async ({ id }: { id: string }) => writeResult(await m.deleteExpectedIncome(id)))
  );
}
