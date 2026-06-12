import { describe, it, expect } from "vitest";
import { mapAccountType, signedBankBalance } from "./accountType";

describe("mapAccountType", () => {
  it("buckets credit cards and loans as credit (debt)", () => {
    expect(mapAccountType("credit", "credit card")).toBe("credit");
    expect(mapAccountType("loan", "auto")).toBe("credit");
    expect(mapAccountType("loan", "student")).toBe("credit");
  });
  it("splits depository into checking vs savings", () => {
    expect(mapAccountType("depository", "checking")).toBe("checking");
    expect(mapAccountType("depository", "savings")).toBe("savings");
    expect(mapAccountType("depository", "money market")).toBe("savings");
    expect(mapAccountType("depository", null)).toBe("checking");
  });
  it("treats investments as savings-side assets", () => {
    expect(mapAccountType("investment", "ira")).toBe("savings");
  });
});

describe("signedBankBalance", () => {
  it("stores credit-card debt as negative (Plaid reports it positive)", () => {
    expect(signedBankBalance("credit", "credit card", 2235.41)).toBe(-2235.41);
  });
  it("stores a loan as negative (the $30k auto-loan bug)", () => {
    expect(signedBankBalance("loan", "auto", 30403.55)).toBe(-30403.55);
  });
  it("never double-negates a debt already reported negative", () => {
    expect(signedBankBalance("credit", "credit card", -500)).toBe(-500);
  });
  it("passes depository balances through unchanged", () => {
    expect(signedBankBalance("depository", "checking", 1799.46)).toBe(1799.46);
    expect(signedBankBalance("depository", "savings", 0)).toBe(0);
  });
});
