import { describe, it, expect } from "vitest";
import { findExactDuplicates, type DedupeRow } from "./dedupe";

const r = (id: number, accountId: string | null, dedupeHash: string | null): DedupeRow => ({ id, accountId, dedupeHash });

describe("findExactDuplicates", () => {
  it("returns nothing for unique rows", () => {
    const res = findExactDuplicates([r(1, "a", "k1"), r(2, "a", "k2"), r(3, "b", "k1")]);
    expect(res.removeIds).toEqual([]);
    expect(res.groups).toBe(0);
  });

  it("keeps the earliest and removes later exact dups (same account + hash)", () => {
    const res = findExactDuplicates([r(5, "a", "k1"), r(2, "a", "k1"), r(9, "a", "k1")]);
    expect(res.groups).toBe(1);
    expect(res.removeIds.sort((x, y) => x - y)).toEqual([5, 9]); // keep id 2
  });

  it("treats the same key on different accounts as distinct", () => {
    const res = findExactDuplicates([r(1, "a", "k1"), r(2, "b", "k1")]);
    expect(res.removeIds).toEqual([]);
  });

  it("ignores rows without a dedupe hash (legacy/mock) — never removes them", () => {
    const res = findExactDuplicates([r(1, "a", null), r(2, "a", null), r(3, "a", "")]);
    expect(res.removeIds).toEqual([]);
    expect(res.groups).toBe(0);
  });

  it("handles multiple duplicate groups", () => {
    const res = findExactDuplicates([
      r(1, "a", "k1"), r(2, "a", "k1"),       // group 1 → remove 2
      r(3, "a", "k2"),                          // unique
      r(4, "b", "k9"), r(5, "b", "k9"), r(6, "b", "k9"), // group 2 → remove 5,6
    ]);
    expect(res.groups).toBe(2);
    expect(res.removeIds.sort((x, y) => x - y)).toEqual([2, 5, 6]);
  });
});
