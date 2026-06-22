/** Performance-allowance write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { tool, writeResult, requireConfirm, confirmField, idStr, dateISO, type McpServer } from "../helpers";

export function registerAllowanceWrites(server: McpServer) {
  server.registerTool(
    "save_allowance_rule",
    {
      description: "Create (omit id) or update (pass id) a performance-allowance rule + its bonus splits. incomeMatchKeys = which payer keys count as this earner's income. splits = [{ memberId, pct, toAccountId }].",
      inputSchema: {
        id: z.string().nullable().optional(), name: idStr, memberId: idStr, enabled: z.boolean().optional(),
        period: z.enum(["monthly", "per_paycheck"]), goalAmount: z.number(), minAmount: z.number(),
        bonusType: z.enum(["percent", "fixed"]), bonusBasis: z.enum(["overage", "gross"]), bonusValue: z.number(),
        incomeMatchKeys: z.array(z.string()).nullable(), fromAccountId: idStr, toAccountId: idStr, gateOnReview: z.boolean().optional(),
        splits: z.array(z.object({ memberId: idStr, pct: z.number(), toAccountId: idStr })),
      },
    },
    tool(async (payload: {
      id?: string | null; name: string; memberId: string; enabled?: boolean; period: "monthly" | "per_paycheck";
      goalAmount: number; minAmount: number; bonusType: "percent" | "fixed"; bonusBasis: "overage" | "gross"; bonusValue: number;
      incomeMatchKeys: string[] | null; fromAccountId: string; toAccountId: string; gateOnReview?: boolean;
      splits: { memberId: string; pct: number; toAccountId: string }[];
    }) => writeResult(await m.saveAllowanceRule(payload)))
  );

  server.registerTool(
    "delete_allowance_rule",
    { description: "Delete an allowance rule (its pending payouts are skipped; history kept). Irreversible.", inputSchema: { ruleId: idStr, ...confirmField } },
    tool(async ({ ruleId, confirm }: { ruleId: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete allowance rule ${ruleId}`);
      if (denied) return denied;
      return writeResult(await m.deleteAllowanceRule(ruleId));
    })
  );

  server.registerTool(
    "run_monthly_allowances",
    { description: "Evaluate closed-month allowances and generate their payouts now (the monthly cron, on demand). asOf is YYYY-MM-DD (defaults to today).", inputSchema: { asOf: dateISO.optional() } },
    tool(async ({ asOf }: { asOf?: string }) => writeResult(await m.runMonthlyAllowances(asOf ? new Date(asOf + "T00:00:00") : new Date())))
  );
}
