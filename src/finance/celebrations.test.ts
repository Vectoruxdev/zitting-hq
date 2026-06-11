import { describe, it, expect } from "vitest";
import { CELEBRATION_POOLS, pickCelebration } from "./celebrations";

describe("pickCelebration", () => {
  it("spicy style can draw from all three pools at the 50/30/20 mix", () => {
    expect(pickCelebration("spicy", () => 0.1).tone).toBe("spicy");
    expect(pickCelebration("spicy", () => 0.6).tone).toBe("funny");
    expect(pickCelebration("spicy", () => 0.95).tone).toBe("sweet");
  });

  it("clean style NEVER returns a spicy line", () => {
    for (let i = 0; i < 500; i++) {
      const c = pickCelebration("clean");
      expect(["funny", "sweet"]).toContain(c.tone);
      expect(CELEBRATION_POOLS.spicy).not.toContain(c.text);
    }
  });

  it("off keeps the confetti but plays it straight", () => {
    expect(pickCelebration("off")).toEqual({ text: "All caught up!", tone: "plain" });
  });

  it("unknown/missing styles fall back to clean, not spicy", () => {
    for (let i = 0; i < 200; i++) {
      const c = pickCelebration(undefined as unknown as string);
      expect(["funny", "sweet"]).toContain(c.tone);
    }
  });

  it("every pool line is picked from its own pool", () => {
    const c = pickCelebration("spicy", () => 0.0);
    expect(CELEBRATION_POOLS.spicy).toContain(c.text);
  });
});
