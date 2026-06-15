/* Resolve a notification to the live entity it's about, from data already in
   the client payload (no new fetch). Server (queries.ts) has already resolved
   stable refs to client-usable ids: `entityType` + `entityId` (a serial txn id,
   a transfer-instance id, an account/member id, comma-joined txn ids for a
   group, or a route id). This just looks them up so the detail view can render
   the real thing. Member viewers resolve from their own scrubbed slices. */

type Txn = { id: number | string; [k: string]: unknown };
type Transfer = { id: number | string; [k: string]: unknown };

interface NotifLike {
  entityType?: string | null;
  entityId?: string | null;
  linkTo?: string | null;
  type?: string;
}
interface DataLike {
  txns?: Txn[];
  upcoming?: Transfer[];
  past?: Transfer[];
  scheduledTransfers?: Transfer[];
  memberHome?: { activity?: Txn[] } | null;
}
export interface ResolvedEntity {
  kind: "transaction" | "transaction-group" | "transfer" | "member" | "route" | "none";
  txn?: Txn;
  txns?: Txn[];
  transfer?: Transfer;
  memberId?: string;
  route?: string;
}

const sameId = (a: unknown, b: unknown) => String(a) === String(b);

/** Resolve `notif` against `data`. `isMember` switches the transaction source to
 *  the member's own activity (their scrubbed, account-scoped slice). Falls back
 *  to a route (linkTo / entityId) when nothing resolves — never throws. */
export function resolveNotifEntity(
  notif: NotifLike,
  data: DataLike,
  opts: { isMember?: boolean } = {}
): ResolvedEntity {
  const type = notif.entityType ?? null;
  const ref = notif.entityId ?? null;
  const txnPool: Txn[] = (opts.isMember ? data.memberHome?.activity : data.txns) ?? [];
  const routeFallback = (): ResolvedEntity => {
    const route = notif.linkTo || (type === "route" ? ref : null);
    return route ? { kind: "route", route } : { kind: "none" };
  };

  if (type === "transaction" && ref) {
    const txn = txnPool.find((t) => sameId(t.id, ref));
    return txn ? { kind: "transaction", txn } : routeFallback();
  }
  if (type === "transaction-group" && ref) {
    const ids = ref.split(",").filter(Boolean);
    const txns = txnPool.filter((t) => ids.some((id) => sameId(t.id, id)));
    return txns.length ? { kind: "transaction-group", txns } : routeFallback();
  }
  if (type === "transfer" && ref) {
    const pool = [...(data.upcoming ?? []), ...(data.scheduledTransfers ?? []), ...(data.past ?? [])];
    const transfer = pool.find((t) => sameId(t.id, ref));
    return transfer ? { kind: "transfer", transfer } : routeFallback();
  }
  if (type === "account" && ref) {
    // An account-scoped nudge → for a member, the account's unreviewed activity.
    const txns = txnPool.filter((t) => sameId((t as { accountId?: unknown }).accountId, ref) && (t as { reviewed?: boolean }).reviewed === false);
    return txns.length ? { kind: "transaction-group", txns } : routeFallback();
  }
  if (type === "member" && ref) {
    return { kind: "member", memberId: ref };
  }
  if (type === "route" && ref) {
    return { kind: "route", route: ref };
  }
  return routeFallback();
}
