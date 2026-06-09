import { describe, it, expect } from "vitest";
import { computeMemberProgress, type GateTxn } from "./allowance";

// now = mid-June 2026 → current month "2026-5", previous month "2026-4" (May)
const NOW = new Date("2026-06-15T00:00:00");
const t = (accountId: string | null, date: string | null, reviewed: boolean): GateTxn => ({ accountId, date, reviewed });

describe("computeMemberProgress", () => {
  it("is complete only when every managed-account txn this month is reviewed", () => {
    const r = computeMemberProgress(
      [t("a", "2026-06-03", true), t("a", "2026-06-10", false), t("a", "2026-06-12", true)],
      ["a"],
      NOW
    );
    const a = r.perAccount.get("a")!;
    expect(a.total).toBe(3);
    expect(a.reviewed).toBe(2);
    expect(a.remaining).toBe(1);
    expect(a.done).toBe(false);
    expect(r.allCaughtUp).toBe(false);
  });

  it("marks an account done when all this-month txns are reviewed", () => {
    const r = computeMemberProgress([t("a", "2026-06-03", true), t("a", "2026-06-10", true)], ["a"], NOW);
    expect(r.perAccount.get("a")!.done).toBe(true);
    expect(r.allCaughtUp).toBe(true);
  });

  it("ignores transactions on accounts the member does not manage", () => {
    const r = computeMemberProgress([t("b", "2026-06-03", false), t("a", "2026-06-04", true)], ["a"], NOW);
    expect(r.totalRemaining).toBe(0); // b's unreviewed txn is not counted
    expect(r.allCaughtUp).toBe(true);
    expect(r.perAccount.has("b")).toBe(false);
  });

  it("locks the allowance when the previous month has unreviewed txns", () => {
    const r = computeMemberProgress(
      [t("a", "2026-05-20", false), t("a", "2026-05-22", true), t("a", "2026-06-01", true)],
      ["a"],
      NOW
    );
    expect(r.prevMonthRemaining).toBe(1);
    expect(r.allowanceUnlocked).toBe(false);
  });

  it("unlocks the allowance when the previous month is fully reviewed", () => {
    const r = computeMemberProgress([t("a", "2026-05-20", true), t("a", "2026-05-22", true)], ["a"], NOW);
    expect(r.prevMonthRemaining).toBe(0);
    expect(r.allowanceUnlocked).toBe(true);
  });

  it("a member with NO managed accounts is caught up and unlocked", () => {
    const r = computeMemberProgress([t("a", "2026-05-20", false)], [], NOW);
    expect(r.allCaughtUp).toBe(true);
    expect(r.allowanceUnlocked).toBe(true);
  });

  it("a member with managed accounts but no prior-month data is vacuously unlocked", () => {
    const r = computeMemberProgress([t("a", "2026-06-02", false)], ["a"], NOW);
    expect(r.prevMonthRemaining).toBe(0);
    expect(r.allowanceUnlocked).toBe(true);
    expect(r.allCaughtUp).toBe(false); // still has this-month work
  });

  it("buckets the month boundary correctly (May 31 vs Jun 1)", () => {
    const r = computeMemberProgress([t("a", "2026-05-31", false), t("a", "2026-06-01", false)], ["a"], NOW);
    expect(r.prevMonthRemaining).toBe(1); // May 31 → previous
    expect(r.perAccount.get("a")!.remaining).toBe(1); // Jun 1 → current
  });

  it("rolls the year backwards for a January now (prev = December)", () => {
    const jan = new Date("2026-01-10T00:00:00");
    const r = computeMemberProgress([t("a", "2025-12-15", false)], ["a"], jan);
    expect(r.prevMonthKey).toBe("2025-11"); // December 2025
    expect(r.prevMonthRemaining).toBe(1);
  });
});
