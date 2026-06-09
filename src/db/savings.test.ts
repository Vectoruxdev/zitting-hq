import { describe, it, expect } from "vitest";
import { projectGoal, canViewGoal, monthsUntil } from "./savings";

const NOW = new Date("2026-06-09T00:00:00");

describe("monthsUntil", () => {
  it("counts whole months ahead", () => {
    expect(monthsUntil("2026-12-09", NOW)).toBe(6);
  });
  it("rounds a partial month up", () => {
    expect(monthsUntil("2026-12-20", NOW)).toBe(7);
  });
  it("floors past dates at 0", () => {
    expect(monthsUntil("2026-01-01", NOW)).toBe(0);
  });
});

describe("projectGoal", () => {
  it("computes pct and remaining", () => {
    const p = projectGoal({ saved: 2500, target: 10000 }, NOW);
    expect(p.pct).toBe(25);
    expect(p.remaining).toBe(7500);
  });

  it("marks a fully funded goal complete", () => {
    const p = projectGoal({ saved: 10000, target: 10000, targetDate: "2026-12-09" }, NOW);
    expect(p.status).toBe("complete");
    expect(p.pct).toBe(100);
    expect(p.remaining).toBe(0);
  });

  it("returns no status when there is no target date", () => {
    const p = projectGoal({ saved: 100, target: 1000, autoContrib: 50 }, NOW);
    expect(p.status).toBe("none");
    expect(p.requiredPerMonth).toBeNull();
    expect(p.monthsLeft).toBeNull();
  });

  it("computes required $/mo from remaining and months left", () => {
    // need 6000 over 6 months → 1000/mo
    const p = projectGoal({ saved: 4000, target: 10000, targetDate: "2026-12-09", autoContrib: 1000 }, NOW);
    expect(p.monthsLeft).toBe(6);
    expect(p.requiredPerMonth).toBe(1000);
    expect(p.status).toBe("on-track");
  });

  it("is ahead when contributing well above the required amount", () => {
    const p = projectGoal({ saved: 4000, target: 10000, targetDate: "2026-12-09", autoContrib: 1500 }, NOW);
    expect(p.status).toBe("ahead");
  });

  it("is at risk when contributing below the required amount", () => {
    const p = projectGoal({ saved: 4000, target: 10000, targetDate: "2026-12-09", autoContrib: 400 }, NOW);
    expect(p.status).toBe("at-risk");
  });

  it("is at risk when a dated goal has no funding plan", () => {
    const p = projectGoal({ saved: 4000, target: 10000, targetDate: "2026-12-09", autoContrib: 0 }, NOW);
    expect(p.status).toBe("at-risk");
  });

  it("is at risk when the deadline has passed and it is not funded", () => {
    const p = projectGoal({ saved: 4000, target: 10000, targetDate: "2026-01-01", autoContrib: 1000 }, NOW);
    expect(p.monthsLeft).toBe(0);
    expect(p.status).toBe("at-risk");
  });
});

describe("canViewGoal", () => {
  const household = { visibility: "household", memberIds: [] };
  const privateToSarah = { visibility: "private", memberIds: ["sarah"] };

  it("shows everything when no viewer is given (owner-facing default)", () => {
    expect(canViewGoal(privateToSarah)).toBe(true);
  });

  it("lets owners see all goals", () => {
    expect(canViewGoal(privateToSarah, { role: "owner", memberId: "jared" })).toBe(true);
  });

  it("shows household goals to any member", () => {
    expect(canViewGoal(household, { role: "member", memberId: "kid" })).toBe(true);
  });

  it("hides a private goal from an unassigned non-owner", () => {
    expect(canViewGoal(privateToSarah, { role: "member", memberId: "kid" })).toBe(false);
    expect(canViewGoal(privateToSarah, { role: "partner", memberId: "kid" })).toBe(false);
  });

  it("shows a private goal to its assigned member", () => {
    expect(canViewGoal(privateToSarah, { role: "member", memberId: "sarah" })).toBe(true);
  });

  it("treats a missing visibility as household", () => {
    expect(canViewGoal({ memberIds: [] }, { role: "member", memberId: "kid" })).toBe(true);
  });
});
