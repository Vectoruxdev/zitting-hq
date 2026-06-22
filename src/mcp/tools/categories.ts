/** Category, category-group, categorization-rule, and learned-memory write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { getFinanceData } from "@/db/queries";
import { ok, tool, writeResult, requireConfirm, confirmField, idStr, idInt, type McpServer } from "../helpers";

export function registerCategoryWrites(server: McpServer) {
  server.registerTool(
    "create_category",
    {
      description: "Create a subcategory. id is a stable slug (e.g. 'groc-other'); kind is income|expense|transfer (default expense).",
      inputSchema: {
        id: idStr, name: idStr, groupId: z.string().nullable().optional(), color: z.string().optional(),
        icon: z.string().nullable().optional(), kind: z.string().optional(), excludeFromBudget: z.boolean().optional(), sortOrder: z.number().int().optional(),
      },
    },
    tool(async (a: { id: string; name: string; groupId?: string | null; color?: string; icon?: string | null; kind?: string; excludeFromBudget?: boolean; sortOrder?: number }) => writeResult(await m.createCategory(a)))
  );

  server.registerTool(
    "update_category",
    {
      description: "Edit a category (renames/recolors sync onto its transactions).",
      inputSchema: {
        id: idStr, name: z.string().optional(), color: z.string().optional(), icon: z.string().nullable().optional(),
        groupId: z.string().nullable().optional(), kind: z.string().optional(), excludeFromBudget: z.boolean().optional(), sortOrder: z.number().int().optional(),
      },
    },
    tool(async ({ id, ...patch }: { id: string; name?: string; color?: string; icon?: string | null; groupId?: string | null; kind?: string; excludeFromBudget?: boolean; sortOrder?: number }) => writeResult(await m.updateCategory(id, patch)))
  );

  server.registerTool(
    "delete_category",
    {
      description: "Delete a category — its transactions are reassigned to Uncategorized and rules using it are disabled. Irreversible. Use dryRun:true to see how many transactions would move.",
      inputSchema: { id: idStr, dryRun: z.boolean().optional(), ...confirmField },
    },
    tool(async ({ id, dryRun, confirm }: { id: string; dryRun?: boolean; confirm?: boolean }) => {
      if (dryRun) {
        const txns = ((await getFinanceData()).txns || []) as Record<string, unknown>[];
        const affected = txns.filter((t) => t.categoryId === id).length;
        return ok({ dryRun: true, categoryId: id, transactionsThatWouldMoveToUncategorized: affected });
      }
      const denied = requireConfirm(confirm, `delete category ${id} and reassign its transactions to Uncategorized`);
      if (denied) return denied;
      return writeResult(await m.deleteCategory(id));
    })
  );

  server.registerTool(
    "create_category_group",
    { description: "Create a parent category group. id is a stable slug.", inputSchema: { id: idStr, name: idStr, sortOrder: z.number().int().optional() } },
    tool(async (a: { id: string; name: string; sortOrder?: number }) => writeResult(await m.createCategoryGroup(a)))
  );

  server.registerTool(
    "update_category_group",
    { description: "Rename/reorder a category group.", inputSchema: { id: idStr, name: z.string().optional(), sortOrder: z.number().int().optional() } },
    tool(async ({ id, ...patch }: { id: string; name?: string; sortOrder?: number }) => writeResult(await m.updateCategoryGroup(id, patch)))
  );

  server.registerTool(
    "delete_category_group",
    { description: "Delete a parent group; its subcategories move to 'Other'. Irreversible.", inputSchema: { id: idStr, ...confirmField } },
    tool(async ({ id, confirm }: { id: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `delete group ${id} (its categories move to Other)`);
      if (denied) return denied;
      return writeResult(await m.deleteCategoryGroup(id));
    })
  );

  server.registerTool(
    "create_category_rule",
    {
      description: "Create an auto-categorization rule: when a transaction matches, set this category. matchType contains|exact|regex (default contains); field merchant|amount|account (default merchant).",
      inputSchema: { matchValue: idStr, categoryId: idStr, matchType: z.string().optional(), field: z.string().optional(), member: z.string().nullable().optional(), priority: z.number().int().optional() },
    },
    tool(async (a: { matchValue: string; categoryId: string; matchType?: string; field?: string; member?: string | null; priority?: number }) => writeResult(await m.createRule(a)))
  );

  server.registerTool(
    "update_category_rule",
    {
      description: "Edit a categorization rule (including enable/disable).",
      inputSchema: { id: idInt, matchValue: z.string().optional(), categoryId: z.string().optional(), matchType: z.string().optional(), field: z.string().optional(), member: z.string().nullable().optional(), priority: z.number().int().optional(), enabled: z.boolean().optional() },
    },
    tool(async ({ id, ...patch }: { id: number; matchValue?: string; categoryId?: string; matchType?: string; field?: string; member?: string | null; priority?: number; enabled?: boolean }) => writeResult(await m.updateRule(id, patch)))
  );

  server.registerTool(
    "delete_category_rule",
    { description: "Delete a categorization rule (easily recreated).", inputSchema: { id: idInt } },
    tool(async ({ id }: { id: number }) => writeResult(await m.deleteRule(id)))
  );

  server.registerTool(
    "recategorize_all",
    { description: "Re-run the auto-categorize engine over transactions. Defaults to unreviewed only; onlyUnreviewed:false also re-scores manually-reviewed rows and REQUIRES confirm:true.", inputSchema: { onlyUnreviewed: z.boolean().optional(), ...confirmField } },
    tool(async ({ onlyUnreviewed, confirm }: { onlyUnreviewed?: boolean; confirm?: boolean }) => {
      if (onlyUnreviewed === false) {
        const denied = requireConfirm(confirm, "re-score ALL transactions, overwriting manual categories");
        if (denied) return denied;
      }
      return writeResult(await m.recategorizeAll({ onlyUnreviewed: onlyUnreviewed ?? true }));
    })
  );

  server.registerTool(
    "forget_merchant",
    { description: "Drop a learned merchant→category memory entry (tokenKey from list_learned_merchants).", inputSchema: { tokenKey: idStr } },
    tool(async ({ tokenKey }: { tokenKey: string }) => writeResult(await m.forgetMerchant(tokenKey)))
  );

  server.registerTool(
    "set_merchant_category",
    { description: "Pin a merchant (tokenKey) to a category in the learn engine so future deposits/charges auto-apply it.", inputSchema: { tokenKey: idStr, categoryId: idStr, member: z.string().nullable().optional() } },
    tool(async ({ tokenKey, categoryId, member }: { tokenKey: string; categoryId: string; member?: string | null }) => writeResult(await m.setMerchantCategory(tokenKey, categoryId, member)))
  );

  server.registerTool(
    "rebuild_merchant_memory",
    { description: "Wipe the learned merchant memory and rebuild it from all reviewed+categorized history. Irreversible (the prior memory is lost).", inputSchema: { ...confirmField } },
    tool(async ({ confirm }: { confirm?: boolean }) => {
      const denied = requireConfirm(confirm, "wipe and rebuild the entire learn-engine memory");
      if (denied) return denied;
      return writeResult(await m.rebuildMemoryFromHistory());
    })
  );
}
