import { describe, it, expect } from "vitest";
import { resolveNotifEntity } from "./notifEntity";

const data = {
  txns: [
    { id: 1, merchant: "Harmons", accountId: "amex", reviewed: true },
    { id: 2, merchant: "Target", accountId: "amex", reviewed: false },
    { id: 3, merchant: "Costco", accountId: "main", reviewed: false },
  ],
  upcoming: [{ id: 57, to: "Tithing", amount: "$600" }],
  scheduledTransfers: [],
  past: [],
  memberHome: {
    activity: [
      { id: 101, merchant: "Cash App", accountId: "sarah-wallet", reviewed: false },
      { id: 102, merchant: "Chick-fil-A", accountId: "sarah-wallet", reviewed: true },
    ],
  },
};

describe("resolveNotifEntity", () => {
  it("resolves a single transaction by id", () => {
    const r = resolveNotifEntity({ entityType: "transaction", entityId: "2" }, data);
    expect(r.kind).toBe("transaction");
    expect(r.txn?.merchant).toBe("Target");
  });

  it("resolves a transaction group by joined ids", () => {
    const r = resolveNotifEntity({ entityType: "transaction-group", entityId: "2,3" }, data);
    expect(r.kind).toBe("transaction-group");
    expect(r.txns?.map((t) => t.id)).toEqual([2, 3]);
  });

  it("resolves a transfer by instance id", () => {
    const r = resolveNotifEntity({ entityType: "transfer", entityId: "57" }, data);
    expect(r.kind).toBe("transfer");
    expect(r.transfer?.to).toBe("Tithing");
  });

  it("returns the member id for a member entity", () => {
    const r = resolveNotifEntity({ entityType: "member", entityId: "sarah" }, data);
    expect(r).toEqual({ kind: "member", memberId: "sarah" });
  });

  it("passes a route entity through", () => {
    expect(resolveNotifEntity({ entityType: "route", entityId: "transfers" }, data)).toEqual({ kind: "route", route: "transfers" });
  });

  it("falls back to linkTo route when entityType is missing", () => {
    expect(resolveNotifEntity({ linkTo: "transactions" }, data)).toEqual({ kind: "route", route: "transactions" });
  });

  it("degrades to route when the referenced txn is gone (deleted)", () => {
    const r = resolveNotifEntity({ entityType: "transaction", entityId: "999", linkTo: "transactions" }, data);
    expect(r).toEqual({ kind: "route", route: "transactions" });
  });

  it("returns none when nothing is resolvable", () => {
    expect(resolveNotifEntity({ entityType: "transaction", entityId: "999" }, data)).toEqual({ kind: "none" });
  });

  it("member: resolves a transaction from memberHome.activity, not data.txns", () => {
    const r = resolveNotifEntity({ entityType: "transaction", entityId: "101" }, data, { isMember: true });
    expect(r.kind).toBe("transaction");
    expect(r.txn?.merchant).toBe("Cash App");
    // a household txn id is NOT resolvable for a member
    expect(resolveNotifEntity({ entityType: "transaction", entityId: "1", linkTo: "x" }, data, { isMember: true }).kind).toBe("route");
  });

  it("account: resolves a member's unreviewed rows on that account", () => {
    const r = resolveNotifEntity({ entityType: "account", entityId: "sarah-wallet" }, data, { isMember: true });
    expect(r.kind).toBe("transaction-group");
    expect(r.txns?.map((t) => t.id)).toEqual([101]); // only the unreviewed one
  });
});
