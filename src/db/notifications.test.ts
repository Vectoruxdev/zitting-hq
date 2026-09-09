import { describe, expect, it } from "vitest";
import { hrefFor, visibleTo } from "./notifications";

const rows = [
  { id: 1, audience: "owners", memberId: null },
  { id: 2, audience: "all", memberId: null },
  { id: 3, audience: "member", memberId: "jaelynn" },
  { id: 4, audience: "member", memberId: "katelynn" },
  { id: 5, audience: null, memberId: null },
];

describe("visibleTo", () => {
  it("owner and partner see household + all, never another member's", () => {
    expect(visibleTo(rows, { memberId: "jared", role: "owner" }).map((r) => r.id)).toEqual([1, 2, 5]);
    expect(visibleTo(rows, { memberId: null, role: "partner" }).map((r) => r.id)).toEqual([1, 2, 5]);
  });
  it("a member sees only their own + all", () => {
    expect(visibleTo(rows, { memberId: "jaelynn", role: "member" }).map((r) => r.id)).toEqual([2, 3]);
  });
  it("a member without a roster id sees only household-wide alerts", () => {
    expect(visibleTo(rows, { memberId: null, role: "member" }).map((r) => r.id)).toEqual([2]);
  });
});

describe("hrefFor", () => {
  it("finance alerts deep-link into the finance app's detail overlay", () => {
    expect(hrefFor({ id: 7, module: "finance", linkTo: "transactions", entityType: "transaction", entityRef: "x" })).toBe("/finance?notif=7");
    expect(hrefFor({ id: 7, module: null, linkTo: null, entityType: null, entityRef: null })).toBe("/finance?notif=7");
  });
  it("family modules use an absolute linkTo or their module root", () => {
    expect(hrefFor({ id: 1, module: "meals", linkTo: "/meals?swap=3", entityType: null, entityRef: null })).toBe("/meals?swap=3");
    expect(hrefFor({ id: 1, module: "quotes", linkTo: null, entityType: null, entityRef: null })).toBe("/quotes");
    expect(hrefFor({ id: 1, module: "unknown", linkTo: null, entityType: null, entityRef: null })).toBe("/notifications");
  });
});
