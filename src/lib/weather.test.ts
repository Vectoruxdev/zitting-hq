import { describe, expect, it } from "vitest";
import { describeWmo } from "./weather";

describe("describeWmo", () => {
  it("maps the common codes", () => {
    expect(describeWmo(0, true)).toEqual({ label: "Sunny", icon: "sun" });
    expect(describeWmo(0, false)).toEqual({ label: "Clear", icon: "moon" });
    expect(describeWmo(2, false).icon).toBe("cloud-moon");
    expect(describeWmo(3).label).toBe("Overcast");
    expect(describeWmo(53).icon).toBe("cloud-drizzle");
    expect(describeWmo(63).label).toBe("Rain");
    expect(describeWmo(66).label).toBe("Freezing rain");
    expect(describeWmo(73).icon).toBe("cloud-snow");
    expect(describeWmo(81).label).toBe("Showers");
    expect(describeWmo(95).icon).toBe("cloud-lightning");
    expect(describeWmo(99).label).toBe("Storm with hail");
  });
  it("never returns an unknown glyph", () => {
    for (let c = 0; c < 100; c++) expect(describeWmo(c).icon.length).toBeGreaterThan(0);
  });
});
