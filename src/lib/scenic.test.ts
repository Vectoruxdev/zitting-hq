import { describe, expect, it } from "vitest";
import { SCENIC, scenicForDay } from "./scenic";

describe("scenicForDay", () => {
  it("is stable for a day and moves on the next", () => {
    expect(scenicForDay("2026-09-09")).toBe(scenicForDay("2026-09-09"));
    expect(scenicForDay("2026-09-10")).not.toBe(scenicForDay("2026-09-09"));
  });
  it("cycles through every picture", () => {
    const seen = new Set(Array.from({ length: SCENIC.length }, (_, i) => scenicForDay(`2026-09-${String(1 + i).padStart(2, "0")}`).title));
    expect(seen.size).toBe(SCENIC.length);
  });
  it("every picture is a Commons thumbnail with a credit", () => {
    for (const s of SCENIC) {
      expect(s.src).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/1920px-/);
      expect(s.credit.length).toBeGreaterThan(0);
      expect(s.license.length).toBeGreaterThan(0);
    }
  });
});
