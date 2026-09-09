/**
 * Notification hub read layer (app-level, all modules). Mirrors the audience
 * rules getFinanceData applies: `all` → everyone; `member` → that member only;
 * `owners` → owner/partner. Sequential, defensive reads.
 */
import { desc } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import * as s from "./schema";
import { cached } from "@/lib/cache";

export interface HubViewer { memberId: string | null; role: "owner" | "partner" | "member" }

export interface HubNotification {
  id: number;
  type: string;
  module: string;
  tone: string;
  icon: string | null;
  title: string;
  body: string | null;
  unread: boolean;
  createdAt: string | null;
  /** Where a tap goes. */
  href: string;
}

/** Pure: which rows a viewer may see. */
export function visibleTo<T extends { audience: string | null; memberId: string | null }>(rows: T[], viewer: HubViewer): T[] {
  const privileged = viewer.role === "owner" || viewer.role === "partner";
  return rows.filter((n) => {
    const aud = n.audience || "owners";
    if (aud === "all") return true;
    if (privileged) return aud === "owners";
    return aud === "member" && !!viewer.memberId && n.memberId === viewer.memberId;
  });
}

/** Pure: deep link for a notification. Finance alerts open in the finance app with the detail overlay. */
export function hrefFor(n: { id: number; module: string | null; linkTo: string | null; entityType: string | null; entityRef: string | null }): string {
  const mod = n.module || "finance";
  if (mod === "finance") return `/finance?notif=${n.id}`;
  if (n.linkTo && n.linkTo.startsWith("/")) return n.linkTo;
  const base: Record<string, string> = { meals: "/meals", groceries: "/groceries", calendar: "/calendar", photos: "/photos", quotes: "/quotes", goals: "/goals", trips: "/trips", chores: "/chores", family: "/" };
  return base[mod] || "/notifications";
}

async function listNotifications__live(viewer: HubViewer, limit = 100): Promise<HubNotification[]> {
  if (!isDbConfigured || !db) return [];
  const rows = await db
    .select()
    .from(s.notifications)
    .orderBy(desc(s.notifications.createdAt), desc(s.notifications.sortOrder))
    .limit(limit * 2)
    .catch(() => [] as (typeof s.notifications.$inferSelect)[]);
  return visibleTo(rows, viewer)
    .slice(0, limit)
    .map((n) => ({
      id: n.id, type: n.type, module: (n as { module?: string }).module || "finance", tone: n.tone, icon: n.icon, title: n.title, body: n.body, unread: n.unread,
      createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : null,
      href: hrefFor({ id: n.id, module: (n as { module?: string }).module || "finance", linkTo: n.linkTo, entityType: n.entityType, entityRef: n.entityRef }),
    }));
}

async function unreadCount__live(viewer: HubViewer): Promise<number> {
  if (!isDbConfigured || !db) return 0;
  const rows = await db
    .select({ id: s.notifications.id, audience: s.notifications.audience, memberId: s.notifications.memberId, unread: s.notifications.unread })
    .from(s.notifications)
    .catch(() => [] as { id: number; audience: string; memberId: string | null; unread: boolean }[]);
  return visibleTo(rows, viewer).filter((n) => n.unread).length;
}

// ---- cached readers (see src/lib/cache.ts) ----
export const listNotifications = cached("notifications:listNotifications", ["notifications"], listNotifications__live);
export const unreadCount = cached("notifications:unreadCount", ["notifications"], unreadCount__live);
