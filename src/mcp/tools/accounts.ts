/** Account + family-member write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { getFinanceData } from "@/db/queries";
import { ok, tool, writeResult, requireConfirm, confirmField, idStr, type McpServer } from "../helpers";

export function registerAccountWrites(server: McpServer) {
  server.registerTool(
    "create_account",
    { description: "Create an account. type is checking|savings|credit. mask is the last 4 digits.", inputSchema: { name: idStr, type: z.enum(["checking", "savings", "credit"]), institution: z.string().optional(), mask: z.string().optional(), who: z.string().optional() } },
    tool(async (a: { name: string; type: string; institution?: string; mask?: string; who?: string }) => writeResult(await m.createAccount(a)))
  );

  server.registerTool(
    "update_account",
    { description: "Edit an account. balance sets the OPENING balance (the rest is derived from transactions).", inputSchema: { id: idStr, name: z.string().optional(), institution: z.string().optional(), type: z.string().optional(), mask: z.string().nullable().optional(), who: z.string().optional(), balance: z.number().optional() } },
    tool(async ({ id, ...patch }: { id: string; name?: string; institution?: string; type?: string; mask?: string | null; who?: string; balance?: number }) => writeResult(await m.updateAccount(id, patch)))
  );

  server.registerTool(
    "delete_account",
    { description: "Delete an account — CASCADES: its transactions, transfers, rules, income sources, savings links, splits, and imports are all removed. Irreversible. Use dryRun:true to see how many transactions it holds first.", inputSchema: { id: idStr, dryRun: z.boolean().optional(), ...confirmField } },
    tool(async ({ id, dryRun, confirm }: { id: string; dryRun?: boolean; confirm?: boolean }) => {
      if (dryRun) {
        const d = await getFinanceData();
        const txns = ((d.txns || []) as Record<string, unknown>[]).filter((t) => t.accountId === id).length;
        const acct = ((d.accountsFlat || []) as Record<string, unknown>[]).find((a) => a.id === id);
        return ok({ dryRun: true, accountId: id, name: acct?.name ?? null, transactionsThatWouldBeDeleted: txns });
      }
      const denied = requireConfirm(confirm, `delete account ${id} and ALL its transactions/transfers/rules`);
      if (denied) return denied;
      return writeResult(await m.deleteAccount(id));
    })
  );

  server.registerTool(
    "set_account_members",
    { description: "Set which members (≤2) manage an account.", inputSchema: { accountId: idStr, memberIds: z.array(idStr) } },
    tool(async ({ accountId, memberIds }: { accountId: string; memberIds: string[] }) => writeResult(await m.setAccountMembers(accountId, memberIds)))
  );

  server.registerTool(
    "set_account_space",
    { description: "Move an account between 'household' and 'business' space.", inputSchema: { id: idStr, space: z.enum(["household", "business"]) } },
    tool(async ({ id, space }: { id: string; space: "household" | "business" }) => writeResult(await m.setAccountSpace(id, space)))
  );

  server.registerTool(
    "set_account_visibility",
    { description: "Set an account's visibility: shown | grouped | hidden.", inputSchema: { id: idStr, mode: z.enum(["shown", "grouped", "hidden"]) } },
    tool(async ({ id, mode }: { id: string; mode: "shown" | "grouped" | "hidden" }) => writeResult(await m.setAccountVisibility(id, mode)))
  );

  server.registerTool(
    "reorder_accounts",
    { description: "Reorder accounts; pass the full list of account ids in the desired order.", inputSchema: { idsInOrder: z.array(idStr) } },
    tool(async ({ idsInOrder }: { idsInOrder: string[] }) => writeResult(await m.reorderAccounts(idsInOrder)))
  );

  // ---- members ----
  server.registerTool(
    "create_member",
    { description: "Add a family member. role e.g. member|partner|owner (default member).", inputSchema: { name: idStr, role: z.string().optional(), email: z.string().nullable().optional(), color: z.string().nullable().optional(), status: z.string().optional() } },
    tool(async (a: { name: string; role?: string; email?: string | null; color?: string | null; status?: string }) => writeResult(await m.createMember(a)))
  );

  server.registerTool(
    "update_member",
    { description: "Edit a family member (renames sync onto their transactions).", inputSchema: { id: idStr, name: z.string().optional(), role: z.string().optional(), email: z.string().nullable().optional(), color: z.string().nullable().optional(), status: z.string().optional(), celebrationStyle: z.string().optional() } },
    tool(async ({ id, ...patch }: { id: string; name?: string; role?: string; email?: string | null; color?: string | null; status?: string; celebrationStyle?: string }) => writeResult(await m.updateMember(id, patch)))
  );

  server.registerTool(
    "remove_member",
    { description: "Remove a family member: their transactions are detached to Household, then the member is deleted. NOTE: this does NOT delete their login (auth user) — that returned authId must be cleaned up separately. Irreversible.", inputSchema: { id: idStr, ...confirmField } },
    tool(async ({ id, confirm }: { id: string; confirm?: boolean }) => {
      const denied = requireConfirm(confirm, `remove member ${id} (detaches their transactions)`);
      if (denied) return denied;
      const res = await m.removeMember(id);
      return ok({ ...res, note: res.authId ? "Login (auth user) was NOT deleted by this call; clean up separately." : undefined });
    })
  );

  server.registerTool(
    "set_member_allowance",
    { description: "Set a member's base monthly allowance amount (pass null to clear).", inputSchema: { memberId: idStr, amount: z.number().nullable() } },
    tool(async ({ memberId, amount }: { memberId: string; amount: number | null }) => writeResult(await m.setMemberAllowance(memberId, amount)))
  );
}
