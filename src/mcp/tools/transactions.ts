/** Transaction write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { ok, fail, tool, writeResult, idInt, idStr, type McpServer } from "../helpers";

export function registerTransactionWrites(server: McpServer) {
  server.registerTool(
    "update_transaction",
    {
      description:
        "Edit one transaction. Provide any of: categoryId, memberId, isTransfer, flagged, reviewed, notes. Setting a category learns the merchant→category mapping (set learn:false to skip).",
      inputSchema: {
        transactionId: idInt,
        categoryId: z.string().nullable().optional(),
        memberId: z.string().nullable().optional(),
        isTransfer: z.boolean().optional(),
        flagged: z.boolean().optional(),
        reviewed: z.boolean().optional(),
        notes: z.string().nullable().optional(),
        learn: z.boolean().optional(),
      },
    },
    tool(async ({ transactionId, learn, ...patch }: {
      transactionId: number; categoryId?: string | null; memberId?: string | null;
      isTransfer?: boolean; flagged?: boolean; reviewed?: boolean; notes?: string | null; learn?: boolean;
    }) => {
      if (Object.values(patch).every((v) => v === undefined)) return fail("Provide at least one field to change.");
      return writeResult(await m.updateTransaction(transactionId, patch, { learn: learn ?? patch.categoryId !== undefined }));
    })
  );

  // Common-path bulk categorize (kept from the original tool set).
  server.registerTool(
    "categorize_transactions",
    {
      description: "Set the category and/or person on one or more transactions (by id). At least one of categoryId/memberId required. Learns the mapping.",
      inputSchema: { transactionIds: z.array(idInt).min(1), categoryId: z.string().optional(), memberId: z.string().optional() },
    },
    tool(async ({ transactionIds, categoryId, memberId }: { transactionIds: number[]; categoryId?: string; memberId?: string }) => {
      if (!categoryId && !memberId) return fail("Provide categoryId and/or memberId.");
      await m.bulkUpdateTransactions(transactionIds, { categoryId, memberId }, { learn: !!categoryId });
      return ok({ ok: true, updated: transactionIds.length });
    })
  );

  server.registerTool(
    "confirm_transactions",
    { description: "Mark transactions reviewed/approved (reinforces learning; no category change).", inputSchema: { transactionIds: z.array(idInt).min(1) } },
    tool(async ({ transactionIds }: { transactionIds: number[] }) => writeResult(await m.confirmTransactions(transactionIds)))
  );

  server.registerTool(
    "apply_bulk_categories",
    {
      description: "Categorize many merchant groups at once. groups = [{ ids:[txnId...], categoryId }].",
      inputSchema: { groups: z.array(z.object({ ids: z.array(idInt).min(1), categoryId: idStr })).min(1) },
    },
    tool(async ({ groups }: { groups: { ids: number[]; categoryId: string }[] }) => {
      const res = await m.applyBulkCategories(groups);
      if (res.learn) await m.applyLearning(res.learn);
      return ok({ ok: true, updated: res.updated, undo: res.undo });
    })
  );

  server.registerTool(
    "restore_transaction_categories",
    {
      description: "Undo a bulk categorize: restore each transaction's prior category + reviewed state. pairs = [{ id, categoryId, reviewed }].",
      inputSchema: { pairs: z.array(z.object({ id: idInt, categoryId: z.string().nullable(), reviewed: z.boolean() })).min(1) },
    },
    tool(async ({ pairs }: { pairs: { id: number; categoryId: string | null; reviewed: boolean }[] }) => writeResult(await m.restoreTransactionCategories(pairs)))
  );

  server.registerTool(
    "set_transfer_flag",
    { description: "Flag/unflag a transaction as an internal transfer (excludes it from spending/income).", inputSchema: { transactionId: idInt, isTransfer: z.boolean() } },
    tool(async ({ transactionId, isTransfer }: { transactionId: number; isTransfer: boolean }) => writeResult(await m.markTransfer(transactionId, isTransfer)))
  );

  server.registerTool(
    "unlink_transfer",
    { description: "Break a detected transfer pair (both legs return to Uncategorized).", inputSchema: { transactionId: idInt } },
    tool(async ({ transactionId }: { transactionId: number }) => writeResult(await m.unlinkTransfer(transactionId)))
  );

  server.registerTool(
    "auto_link_transfers",
    { description: "Re-detect and link opposite-amount transfer legs across accounts (idempotent). Returns how many pairs were linked.", inputSchema: {} },
    tool(async () => writeResult(await m.autoLinkTransfers()))
  );

  server.registerTool(
    "split_transaction",
    {
      description: "Split one transaction across categories (replaces any existing splits). splits = [{ categoryId, amount }].",
      inputSchema: { transactionId: idInt, splits: z.array(z.object({ categoryId: idStr, amount: z.number() })).min(1) },
    },
    tool(async ({ transactionId, splits }: { transactionId: number; splits: { categoryId: string; amount: number }[] }) => writeResult(await m.splitTransaction(transactionId, splits)))
  );

  server.registerTool(
    "unsplit_transaction",
    { description: "Remove all splits from a transaction.", inputSchema: { transactionId: idInt } },
    tool(async ({ transactionId }: { transactionId: number }) => writeResult(await m.unsplitTransaction(transactionId)))
  );
}
