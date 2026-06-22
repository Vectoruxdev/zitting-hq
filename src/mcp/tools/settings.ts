/** Finance-settings, digest, and notification write tools. */
import { z } from "zod";
import * as m from "@/db/mutations";
import { tool, writeResult, idStr, type McpServer } from "../helpers";

export function registerSettingsWrites(server: McpServer) {
  server.registerTool(
    "update_finance_settings",
    { description: "Update the cash-runway low-balance warning: cushion amount and on/off.", inputSchema: { cashRunwayBuffer: z.number().optional(), cashRunwayEnabled: z.boolean().optional() } },
    tool(async (patch: { cashRunwayBuffer?: number; cashRunwayEnabled?: boolean }) => writeResult(await m.updateFinanceSettings(patch)))
  );

  server.registerTool(
    "update_digest_settings",
    { description: "Update the email digest: cadence (weekly|biweekly|monthly), enabled, owner/members opt-in.", inputSchema: { cadence: z.string().optional(), enabled: z.boolean().optional(), ownerEnabled: z.boolean().optional(), membersEnabled: z.boolean().optional() } },
    tool(async (patch: { cadence?: string; enabled?: boolean; ownerEnabled?: boolean; membersEnabled?: boolean }) => writeResult(await m.updateDigestSettings(patch)))
  );

  server.registerTool(
    "set_member_digest_optin",
    { description: "Toggle a member's email-digest opt-in.", inputSchema: { memberId: idStr, on: z.boolean() } },
    tool(async ({ memberId, on }: { memberId: string; on: boolean }) => writeResult(await m.setMemberDigestOptIn(memberId, on)))
  );

  server.registerTool(
    "mark_notifications_read",
    { description: "Mark notifications read (owner scope). Omit ids to mark ALL owner-visible notifications read.", inputSchema: { ids: z.array(z.number().int()).optional() } },
    tool(async ({ ids }: { ids?: number[] }) => writeResult(await m.markNotificationsRead({ memberId: null, role: "owner" }, ids)))
  );

  server.registerTool(
    "set_notification_pref",
    { description: "Set per-event notification preferences (enable + in-app/push channels).", inputSchema: { event: idStr, enabled: z.boolean().optional(), inApp: z.boolean().optional(), push: z.boolean().optional() } },
    tool(async ({ event, ...patch }: { event: string; enabled?: boolean; inApp?: boolean; push?: boolean }) => writeResult(await m.setNotificationPref(event, patch)))
  );

  server.registerTool(
    "create_notification",
    {
      description: "Post a custom notification (in-app + push to its audience). audience owners|member|all (default owners); memberId required when audience='member'. tone info|accent|warning|negative.",
      inputSchema: { type: idStr, title: idStr, tone: z.string().optional(), body: z.string().nullable().optional(), icon: z.string().nullable().optional(), audience: z.enum(["owners", "member", "all"]).optional(), memberId: z.string().nullable().optional(), linkTo: z.string().nullable().optional(), dedupeKey: z.string().nullable().optional() },
    },
    tool(async (a: { type: string; title: string; tone?: string; body?: string | null; icon?: string | null; audience?: "owners" | "member" | "all"; memberId?: string | null; linkTo?: string | null; dedupeKey?: string | null }) => writeResult(await m.createNotification(a)))
  );
}
