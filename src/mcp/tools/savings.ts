/** Savings-goal + contribution write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { tool, writeResult, requireConfirm, confirmField, idStr, idInt, type McpServer } from "../helpers";

const goalFields = {
  targetDate: z.string().nullable().optional(), accountId: z.string().nullable().optional(),
  autoContrib: z.number().optional(), icon: z.string().nullable().optional(), color: z.string().nullable().optional(),
  goalType: z.string().optional(), visibility: z.string().optional(), memberIds: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
};

export function registerSavingsWrites(server: McpServer) {
  server.registerTool(
    "create_savings_goal",
    {
      description: "Create a savings goal. visibility household|private (private goals use memberIds). initialSaved records a starting-balance contribution.",
      inputSchema: { name: idStr, target: z.number(), ...goalFields, initialSaved: z.number().optional() },
    },
    tool(async (a: { name: string; target: number; initialSaved?: number } & Record<string, unknown>) => writeResult(await m.createSavingsGoal(a as Parameters<typeof m.createSavingsGoal>[0])))
  );

  server.registerTool(
    "update_savings_goal",
    { description: "Edit a savings goal (name/target/date/visibility/members/etc.).", inputSchema: { id: idStr, name: z.string().optional(), target: z.number().optional(), ...goalFields } },
    tool(async ({ id, ...patch }: { id: string } & Record<string, unknown>) => writeResult(await m.updateSavingsGoal(id, patch as Parameters<typeof m.updateSavingsGoal>[1])))
  );

  server.registerTool(
    "archive_savings_goal",
    { description: "Archive (archived:true) or unarchive a savings goal.", inputSchema: { id: idStr, archived: z.boolean() } },
    tool(async ({ id, archived }: { id: string; archived: boolean }) => writeResult(await m.archiveSavingsGoal(id, archived)))
  );

  server.registerTool(
    "delete_savings_goal",
    { description: "Delete a savings goal and its contributions + member assignments. Irreversible.", inputSchema: { id: idStr, ...confirmField } },
    tool(async ({ id, confirm }: { id: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete savings goal ${id} and all its contributions`);
      if (denied) return denied;
      return writeResult(await m.deleteSavingsGoal(id));
    })
  );

  server.registerTool(
    "add_savings_contribution",
    { description: "Record a contribution toward a savings goal (goalId from list_savings_goals). date is YYYY-MM-DD.", inputSchema: { goalId: idStr, amount: z.number().positive(), date: z.string().optional(), note: z.string().optional() } },
    tool(async ({ goalId, amount, date, note }: { goalId: string; amount: number; date?: string; note?: string }) => writeResult(await m.addContribution(goalId, { amount, date, note })))
  );

  server.registerTool(
    "delete_contribution",
    { description: "Remove one savings contribution. Irreversible.", inputSchema: { id: idInt, ...confirmField } },
    tool(async ({ id, confirm }: { id: number; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete contribution ${id}`);
      if (denied) return denied;
      return writeResult(await m.deleteContribution(id));
    })
  );
}
