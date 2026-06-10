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
  tag?: string | null; // collapse key so repeats replace, not stack
}

export async function sendPushToAudience(t: PushTarget): Promise<void> {
  if (!ensureVapid() || !db) return;
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
    if (!rows.length) return;

    const payload = JSON.stringify({
      title: t.title,
      body: t.body ?? "",
      url: "/finance",
      linkTo: t.linkTo ?? null,
      tag: t.tag ?? undefined,
    });

    await Promise.allSettled(
      rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          // 404 Not Found / 410 Gone → the subscription is dead; prune it.
          if (code === 404 || code === 410) {
            await db!.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.endpoint, sub.endpoint)).catch(() => {});
          }
        }
      })
    );
  } catch {
    /* best-effort */
  }
}
