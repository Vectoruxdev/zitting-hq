import { describe, expect, it } from "vitest";
import { pickQuoteOfDay } from "./quotes";

describe("pickQuoteOfDay", () => {
  const qs = ["a", "b", "c", "d", "e"];
  it("is deterministic for a date", () => {
    expect(pickQuoteOfDay(qs, "2026-09-08")).toBe(pickQuoteOfDay(qs, "2026-09-08"));
  });
  it("varies across dates", () => {
    const picks = new Set(["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"].map((d) => pickQuoteOfDay(qs, d)));
    expect(picks.size).toBeGreaterThan(1);
  });
  it("handles empty lists", () => {
    expect(pickQuoteOfDay([], "2026-09-08")).toBeNull();
  });
});
