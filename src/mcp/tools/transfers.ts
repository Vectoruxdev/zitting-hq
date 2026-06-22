/** Allocation-rule + transfer-instance write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { ok, tool, writeResult, requireConfirm, confirmField, idStr, idInt, dateISO, type McpServer } from "../helpers";

type Cadence = Parameters<typeof m.convertInstanceToRule>[1];

export function registerTransferWrites(server: McpServer) {
  // ---- allocation / waterfall rules ----
  server.registerTool(
    "create_allocation_rule",
    {
      description: "Create an allocation rule. trigger 'on_income' (default) runs a %/Fixed/Remainder split when income lands; trigger 'scheduled' (Fixed only) needs cadence + anchorDate.",
      inputSchema: {
        name: idStr, method: z.enum(["%", "Fixed", "Remainder"]), toAccountId: idStr, value: z.number().nullable().optional(),
        fromAccountId: z.string().nullable().optional(), memberId: z.string().nullable().optional(), trigger: z.enum(["on_income", "scheduled"]).optional(),
        enabled: z.boolean().optional(), incomeMatch: z.string().nullable().optional(), cadence: z.string().nullable().optional(), anchorDate: z.string().nullable().optional(), icon: z.string().nullable().optional(),
      },
    },
    tool(async (a: { name: string; method: string; toAccountId: string; value?: number | null; fromAccountId?: string | null; memberId?: string | null; trigger?: string; enabled?: boolean; incomeMatch?: string | null; cadence?: string | null; anchorDate?: string | null; icon?: string | null }) => writeResult(await m.createAllocationRule(a)))
  );

  server.registerTool(
    "update_allocation_rule",
    {
      description: "Edit an allocation rule (including enable/disable).",
      inputSchema: {
        id: idStr, name: z.string().optional(), method: z.string().optional(), value: z.number().nullable().optional(), fromAccountId: z.string().nullable().optional(),
        toAccountId: z.string().optional(), memberId: z.string().nullable().optional(), trigger: z.string().optional(), enabled: z.boolean().optional(),
        incomeMatch: z.string().nullable().optional(), cadence: z.string().nullable().optional(), anchorDate: z.string().nullable().optional(), icon: z.string().nullable().optional(),
      },
    },
    tool(async ({ id, ...patch }: { id: string } & Record<string, unknown>) => writeResult(await m.updateAllocationRule(id, patch)))
  );

  server.registerTool(
    "delete_allocation_rule",
    { description: "Delete an allocation rule (generated transfers are detached, history kept). Irreversible.", inputSchema: { id: idStr, ...confirmField } },
    tool(async ({ id, confirm }: { id: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete allocation rule ${id}`);
      if (denied) return denied;
      return writeResult(await m.deleteAllocationRule(id));
    })
  );

  // ---- transfer instances (the pending checklist + history) ----
  server.registerTool(
    "create_manual_transfer",
    {
      description: "Add a one-off transfer to the pending checklist (the app reminds; the bank moves the money). plannedDate is YYYY-MM-DD.",
      inputSchema: { fromAccountId: idStr, toAccountId: idStr, amount: z.number().positive(), memberId: z.string().optional(), plannedDate: z.string().optional(), note: z.string().optional() },
    },
    tool(async (a: { fromAccountId: string; toAccountId: string; amount: number; memberId?: string; plannedDate?: string; note?: string }) => writeResult(await m.createManualTransfer(a)))
  );

  server.registerTool(
    "mark_transfer_done",
    { description: "Mark a pending transfer (instance id from list_transfers) done, or undone with done:false.", inputSchema: { transferId: idInt, done: z.boolean().optional() } },
    tool(async ({ transferId, done }: { transferId: number; done?: boolean }) => {
      await m.markTransferInstance(transferId, done ?? true);
      return ok({ ok: true, transferId, done: done ?? true });
    })
  );

  server.registerTool(
    "skip_transfer",
    { description: "Skip a pending transfer (drops it from the to-do list; history kept).", inputSchema: { transferId: idInt } },
    tool(async ({ transferId }: { transferId: number }) => writeResult(await m.skipTransferInstance(transferId)))
  );

  server.registerTool(
    "delete_transfer",
    { description: "Delete a transfer instance. Irreversible (can be recreated manually).", inputSchema: { transferId: idInt, ...confirmField } },
    tool(async ({ transferId, confirm }: { transferId: number; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete transfer instance ${transferId}`);
      if (denied) return denied;
      return writeResult(await m.deleteTransferInstance(transferId));
    })
  );

  server.registerTool(
    "generate_transfers_for_income",
    { description: "Fire the on-income allocation waterfall for one income transaction (idempotent per txn). incomeTxnId from list_transactions.", inputSchema: { incomeTxnId: idInt } },
    tool(async ({ incomeTxnId }: { incomeTxnId: number }) => writeResult(await m.generateTransfersForIncome(incomeTxnId)))
  );

  server.registerTool(
    "reconcile_pending_transfers",
    { description: "Auto-complete pending transfers whose matching real transactions have landed.", inputSchema: {} },
    tool(async () => writeResult(await m.reconcilePendingTransfers()))
  );

  server.registerTool(
    "run_scheduled_transfers",
    { description: "Generate due scheduled-rule transfers and advance their next run date (the cron, on demand). today is YYYY-MM-DD (defaults to today).", inputSchema: { today: dateISO.optional() } },
    tool(async ({ today }: { today?: string }) => writeResult(await m.runScheduledTransfers(today)))
  );

  server.registerTool(
    "convert_transfer_to_rule",
    { description: "Convert a one-off pending transfer into a recurring scheduled rule. instanceId from list_transfers; cadence defaults to monthly.", inputSchema: { instanceId: idInt, cadence: z.string().optional() } },
    tool(async ({ instanceId, cadence }: { instanceId: number; cadence?: string }) => writeResult(await m.convertInstanceToRule(instanceId, (cadence ?? "monthly") as Cadence)))
  );
}
