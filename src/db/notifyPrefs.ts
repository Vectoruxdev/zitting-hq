/**
 * Notification preference catalog + pure helpers (no DB).
 *
 * The owner controls which events notify and on which channel. This module is
 * the single source of truth for the event list, the notification-type → event
 * mapping (used to gate createNotification), and merging stored overrides over
 * the defaults (everything on). Pure + testable.
 */

export interface NotifEvent {
  event: string;
  label: string;
  detail: string;
  audience: "owners" | "members";
}

/** The events a household can tune. Order = display order. */
export const NOTIFICATION_EVENTS: NotifEvent[] = [
  { event: "new_transactions", label: "New transactions", detail: "When new bank activity syncs in from Plaid", audience: "owners" },
  { event: "large_charges", label: "Large charges", detail: "Purchases of about $200 or more", audience: "owners" },
  { event: "transfers_due", label: "Transfer due", detail: "A scheduled transfer reaches its date", audience: "owners" },
  { event: "member_complete", label: "Member finished categorizing", detail: "When someone finishes reviewing their month", audience: "owners" },
  { event: "member_nudges", label: "Categorize reminders", detail: "Tell a member when they have new transactions to review", audience: "members" },
];

export interface StoredPref {
  event: string;
  enabled: boolean;
  inApp: boolean;
  push: boolean;
}
export type MergedPref = NotifEvent & { enabled: boolean; inApp: boolean; push: boolean };

/** Merge stored overrides over the catalog. Missing rows → fully on. */
export function mergePrefs(rows: StoredPref[]): MergedPref[] {
  const by = new Map(rows.map((r) => [r.event, r]));
  return NOTIFICATION_EVENTS.map((e) => {
    const r = by.get(e.event);
    return { ...e, enabled: r?.enabled ?? true, inApp: r?.inApp ?? true, push: r?.push ?? true };
  });
}

/** Map a createNotification `type` to its preference event key. Unknown types
 *  (e.g. derived "transfers") return null → always allowed. */
export function prefKeyForType(type: string): string | null {
  switch (type) {
    case "new-transaction":
    case "new-transactions":
      return "new_transactions";
    case "large-charge":
      return "large_charges";
    case "transfer-due":
      return "transfers_due";
    case "member-complete":
      return "member_complete";
    case "categorize-nudge":
      return "member_nudges";
    default:
      return null;
  }
}

/** Resolve channel gating for a notification type from stored prefs. */
export function channelsFor(type: string, rows: StoredPref[]): { enabled: boolean; inApp: boolean; push: boolean } {
  const key = prefKeyForType(type);
  if (!key) return { enabled: true, inApp: true, push: true }; // not a tunable event
  const merged = mergePrefs(rows).find((m) => m.event === key)!;
  return { enabled: merged.enabled, inApp: merged.inApp, push: merged.push };
}
