/**
 * The one visibility predicate for shareable family items (photos, albums,
 * quotes, goals, events, trips). Used by every read layer AND by notification
 * fan-out, so nobody is told about something they can't open.
 *
 * Rules (Jared's, 2026-09): the owner sees everything. Otherwise an item is
 * visible when it's `family`, when you made it, or when it's `custom` and
 * you're in its share list. `private` = only the person who made it.
 */
export type Visibility = "family" | "private" | "custom";

export interface Shareable {
  visibility: Visibility | string;
  /** member id of whoever created/owns the item */
  ownerId?: string | null;
  /** member ids the item is shared with (visibility = custom) */
  sharedWith?: readonly string[] | null;
}

export interface Viewer {
  memberId: string | null;
  role: "owner" | "partner" | "member";
}

export function canView(item: Shareable, viewer: Viewer): boolean {
  if (viewer.role === "owner") return true;
  if (item.ownerId && viewer.memberId && item.ownerId === viewer.memberId) return true;
  switch (item.visibility) {
    case "family":
      return true;
    case "private":
      return false;
    case "custom":
      return !!viewer.memberId && !!item.sharedWith && item.sharedWith.includes(viewer.memberId);
    default:
      return false;
  }
}

/** Members who can see an item — for notification fan-out. `roster` = all member ids with their finance role. */
export function audienceFor(item: Shareable, roster: { id: string; role: Viewer["role"] }[]): string[] {
  return roster.filter((m) => canView(item, { memberId: m.id, role: m.role })).map((m) => m.id);
}
