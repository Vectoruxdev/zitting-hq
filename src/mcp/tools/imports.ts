/** Import-maintenance + bank-sync write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { syncAllItems, listPlaidItems } from "@/db/plaid";
import { ok, tool, writeResult, requireConfirm, confirmField, idStr, type McpServer } from "../helpers";

export function registerImportWrites(server: McpServer) {
  server.registerTool(
    "sync_now",
    { description: "Trigger a Plaid sync for every connected bank (the UI's 'Sync now'). Idempotent. Returns per-bank results + each item's status/lastSyncedAt.", inputSchema: {} },
    tool(async () => {
      const res = await syncAllItems();
      const items = await listPlaidItems();
      return ok({ ...res, banks: items });
    })
  );

  server.registerTool(
    "dedupe_transactions",
    { description: "Find exact-duplicate transactions. Default (apply:false) is a DRY RUN — returns the duplicate groups without changing anything. apply:true DELETES the duplicates (irreversible).", inputSchema: { apply: z.boolean().optional() } },
    tool(async ({ apply }: { apply?: boolean }) => writeResult(await m.dedupeTransactions({ apply: apply ?? false })))
  );

  server.registerTool(
    "delete_import",
    { description: "Delete an entire import batch AND all transactions it added (batchId from list_imports). Irreversible.", inputSchema: { batchId: idStr, ...confirmField } },
    tool(async ({ batchId, confirm }: { batchId: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete import batch ${batchId} and all its transactions`);
      if (denied) return denied;
      return writeResult(await m.deleteImport(batchId));
    })
  );
}
