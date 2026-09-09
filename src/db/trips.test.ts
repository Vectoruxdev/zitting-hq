import { describe, expect, it } from "vitest";
import { countdown } from "./trips";

describe("countdown", () => {
  it("counts days until the trip and returns 0 on the day", () => {
    expect(countdown("2026-09-20", "2026-09-27", "2026-09-08")).toBe(12);
    expect(countdown("2026-09-08", "2026-09-10", "2026-09-08")).toBe(0);
  });
  it("is negative during the trip and null once it's over or undated", () => {
    expect(countdown("2026-09-06", "2026-09-10", "2026-09-08")).toBe(-2);
    expect(countdown("2026-09-01", "2026-09-05", "2026-09-08")).toBeNull();
    expect(countdown(null, null, "2026-09-08")).toBeNull();
  });
});
