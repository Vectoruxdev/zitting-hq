/**
 * Web Push fan-out (server-side only).
 *
 * VAPID keys come from env (the repo is public — never hard-code them):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https URL).
 * `sendPushToAudience` mirrors the notification audience model: 'owners' →
 * every owner/partner device, 'member' → that member's devices, 'all' →
 * everyone. Expired endpoints (404/410) are pruned. Best-effort: callers should
 * never let a push failure break the underlying write.
 */
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import * as s from "@/db/schema";

export const isPushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let vapidReady = false;
function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:jared@vectorux.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidReady = true;
  }
  return true;
}

export interface PushTarget {
  audience: "owners" | "member" | "all";
  memberId?: string | null;
  title: string;
  body?: string | null;
  linkTo?: string | null; // internal finance route id (for deep-link focus)
  notifId?: number | null; // notification id → deep-link to its detail on click
  tag?: string | null; // collapse key so repeats replace, not stack
}

export interface PushStats {
  devices: number; // subscriptions targeted
  sent: number; // delivered ok
  failed: number; // gave up after retry
  pruned: number; // dead endpoints removed
}

const ZERO: PushStats = { devices: 0, sent: 0, failed: 0, pruned: 0 };

/** Send a web push to an audience. Best-effort (never throws), but returns
 *  delivery stats so callers can log/surface "0 devices" and failures instead
 *  of failing silently. Transient (5xx / network) errors get one retry; dead
 *  endpoints (404/410) are pruned. */
export async function sendPushToAudience(t: PushTarget): Promise<PushStats> {
  if (!ensureVapid() || !db) return ZERO;
  try {
    let rows;
    if (t.audience === "all") {
      rows = await db.select().from(s.pushSubscriptions);
    } else if (t.audience === "member" && t.memberId) {
      rows = await db.select().from(s.pushSubscriptions).where(eq(s.pushSubscriptions.memberId, t.memberId));
    } else {
      // owners (+partners)
      rows = await db.select().from(s.pushSubscriptions).where(inArray(s.pushSubscriptions.role, ["owner", "partner"]));
    }
    if (!rows.length) return ZERO;

    const payload = JSON.stringify({
      title: t.title,
      body: t.body ?? "",
      url: t.notifId != null ? `/finance?notif=${t.notifId}` : "/finance",
      linkTo: t.linkTo ?? null,
      notifId: t.notifId ?? null,
      tag: t.tag ?? undefined,
    });

    const stats: PushStats = { devices: rows.length, sent: 0, failed: 0, pruned: 0 };
    const send = (sub: (typeof rows)[number]) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);

    await Promise.allSettled(
      rows.map(async (sub) => {
        try {
          await send(sub);
          stats.sent++;
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            // Dead subscription — prune it.
            await db!.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.endpoint, sub.endpoint)).catch(() => {});
            stats.pruned++;
            return;
          }
          // Transient (5xx) or network blip → retry once before giving up.
          if (code == null || code >= 500) {
            try {
              await send(sub);
              stats.sent++;
              return;
            } catch {
              /* fall through to failed */
            }
          }
          stats.failed++;
        }
      })
    );
    return stats;
  } catch (err) {
    console.error("[push] send failed", err);
    return ZERO;
  }
}
