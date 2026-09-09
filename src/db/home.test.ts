import { describe, expect, it } from "vitest";
import { daypartFor } from "./home";

describe("daypartFor", () => {
  it("splits the day the way the greeting expects", () => {
    expect(daypartFor(3)).toBe("late");
    expect(daypartFor(5)).toBe("morning");
    expect(daypartFor(11)).toBe("morning");
    expect(daypartFor(12)).toBe("afternoon");
    expect(daypartFor(16)).toBe("afternoon");
    expect(daypartFor(17)).toBe("evening");
    expect(daypartFor(23)).toBe("evening");
  });
});
