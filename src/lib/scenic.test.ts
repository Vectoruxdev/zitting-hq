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
      expect(s.src).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/1280px-/);
      // Wikimedia's standard widths only (hotlinking any other width is a 400 since 2026), none above 1920 px (every source is ≥ 2000 px wide, so Commons never has to upscale).
      const widths = [...s.srcSet.matchAll(/ (\d+)w(?:,|$)/g)].map((m) => Number(m[1]));
      expect(widths).toEqual([500, 960, 1280, 1920]);
      expect(s.credit.length).toBeGreaterThan(0);
      expect(s.license.length).toBeGreaterThan(0);
    }
  });
});
