import { describe, it, expect } from "vitest";
import { mergePrefs, prefKeyForType, channelsFor, NOTIFICATION_EVENTS } from "./notifyPrefs";

describe("mergePrefs", () => {
  it("defaults every event fully on when there are no stored rows", () => {
    const merged = mergePrefs([]);
    expect(merged).toHaveLength(NOTIFICATION_EVENTS.length);
    expect(merged.every((m) => m.enabled && m.inApp && m.push)).toBe(true);
  });
  it("applies stored overrides", () => {
    const merged = mergePrefs([{ event: "large_charges", enabled: true, inApp: true, push: false }]);
    const lc = merged.find((m) => m.event === "large_charges")!;
    expect(lc.push).toBe(false);
    expect(lc.inApp).toBe(true);
    // untouched events stay on
    expect(merged.find((m) => m.event === "new_transactions")!.push).toBe(true);
  });
});

describe("prefKeyForType", () => {
  it("maps notification types to event keys", () => {
    expect(prefKeyForType("new-transaction")).toBe("new_transactions");
    expect(prefKeyForType("new-transactions")).toBe("new_transactions");
    expect(prefKeyForType("large-charge")).toBe("large_charges");
    expect(prefKeyForType("categorize-nudge")).toBe("member_nudges");
    expect(prefKeyForType("member-complete")).toBe("member_complete");
    expect(prefKeyForType("income-expected")).toBe("income_expected");
    expect(prefKeyForType("cash-runway")).toBe("cash_runway");
  });
  it("returns null for untunable types (always allowed)", () => {
    expect(prefKeyForType("transfers")).toBeNull();
  });
});

describe("income notification events", () => {
  it("are present in the catalog, owners-audience, and default fully on", () => {
    const merged = mergePrefs([]);
    for (const ev of ["income_expected", "cash_runway"]) {
      const m = merged.find((x) => x.event === ev)!;
      expect(m).toBeTruthy();
      expect(m.audience).toBe("owners");
      expect(m.enabled && m.inApp && m.push).toBe(true);
    }
  });
  it("gate off when the owner disables them", () => {
    expect(channelsFor("income-expected", [{ event: "income_expected", enabled: false, inApp: true, push: true }]).enabled).toBe(false);
    expect(channelsFor("cash-runway", [{ event: "cash_runway", enabled: true, inApp: true, push: false }]).push).toBe(false);
  });
});

describe("channelsFor", () => {
  it("untunable types are fully allowed regardless of stored prefs", () => {
    expect(channelsFor("transfers", [{ event: "large_charges", enabled: false, inApp: false, push: false }])).toEqual({ enabled: true, inApp: true, push: true });
  });
  it("a disabled event is gated off", () => {
    const c = channelsFor("large-charge", [{ event: "large_charges", enabled: false, inApp: true, push: true }]);
    expect(c.enabled).toBe(false);
  });
  it("channel toggles pass through", () => {
    const c = channelsFor("new-transaction", [{ event: "new_transactions", enabled: true, inApp: true, push: false }]);
    expect(c).toEqual({ enabled: true, inApp: true, push: false });
  });
});
