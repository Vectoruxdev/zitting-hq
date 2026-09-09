import { describe, expect, it } from "vitest";
import { audienceFor, canView } from "./access";

const owner = { memberId: "jared", role: "owner" as const };
const jaelynn = { memberId: "jaelynn", role: "member" as const };
const katelynn = { memberId: "katelynn", role: "member" as const };
const anon = { memberId: null, role: "member" as const };

describe("canView", () => {
  it("owner sees everything, including private items of others", () => {
    expect(canView({ visibility: "private", ownerId: "jaelynn" }, owner)).toBe(true);
    expect(canView({ visibility: "custom", ownerId: "jaelynn", sharedWith: [] }, owner)).toBe(true);
  });
  it("family items are visible to every member", () => {
    expect(canView({ visibility: "family" }, jaelynn)).toBe(true);
    expect(canView({ visibility: "family" }, anon)).toBe(true);
  });
  it("private items are visible only to their maker", () => {
    const q = { visibility: "private", ownerId: "jaelynn" };
    expect(canView(q, jaelynn)).toBe(true);
    expect(canView(q, katelynn)).toBe(false);
    expect(canView(q, anon)).toBe(false);
  });
  it("custom items need a share row (or authorship)", () => {
    const p = { visibility: "custom", ownerId: "jaelynn", sharedWith: ["katelynn"] };
    expect(canView(p, katelynn)).toBe(true);
    expect(canView(p, jaelynn)).toBe(true);
    expect(canView(p, { memberId: "emerick", role: "member" })).toBe(false);
    expect(canView({ visibility: "custom", sharedWith: null }, katelynn)).toBe(false);
  });
  it("unknown visibility values are hidden, not shown", () => {
    expect(canView({ visibility: "everyone-ish" }, jaelynn)).toBe(false);
  });
});

describe("audienceFor", () => {
  const roster = [{ id: "jared", role: "owner" as const }, { id: "jaelynn", role: "member" as const }, { id: "katelynn", role: "member" as const }];
  it("lists exactly who can see the item", () => {
    expect(audienceFor({ visibility: "custom", ownerId: "jaelynn", sharedWith: ["katelynn"] }, roster)).toEqual(["jared", "jaelynn", "katelynn"]);
    expect(audienceFor({ visibility: "private", ownerId: "katelynn" }, roster)).toEqual(["jared", "katelynn"]);
    expect(audienceFor({ visibility: "family" }, roster)).toEqual(["jared", "jaelynn", "katelynn"]);
  });
});
