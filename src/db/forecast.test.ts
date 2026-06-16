import { describe, it, expect } from "vitest";
import {
  forecastIncome,
  computeCoverage,
  shortfallAlert,
  incomeLandingOn,
  projectRunway,
  runwayAlert,
  type IncomeSourceInput,
  type IncomeForecast,
} from "./forecast";

// Build N points ending on `lastISO`, spaced `gap` days, each `amount`.
function series(lastISO: string, gap: number, amount: number, n: number): { dateISO: string; amount: number }[] {
  const MS = 86400000;
  const last = new Date(lastISO + "T00:00:00Z").getTime();
  const pts: { dateISO: string; amount: number }[] = [];
  for (let i = n - 1; i >= 0; i--) pts.push({ dateISO: new Date(last - i * gap * MS).toISOString().slice(0, 10), amount });
  return pts;
}

describe("forecastIncome", () => {
  it("projects biweekly paychecks within the horizon", () => {
    const src: IncomeSourceInput = { key: "acme", name: "Acme", accountId: "chk", points: series("2026-06-05", 14, 2000, 6) };
    const f = forecastIncome([src], "2026-06-08", 30);
    expect(f.length).toBeGreaterThanOrEqual(2); // ~Jun 19, Jul 3
    expect(f[0].cadence).toBe("biweekly");
    expect(f[0].amount).toBe(2000);
    expect(f[0].confidence).toBe("high");
    expect(f[0].dateISO > "2026-06-08").toBe(true);
  });

  it("monthly source → one occurrence in a 30-day window", () => {
    const src: IncomeSourceInput = { key: "rent", name: "Rent co", accountId: "chk", points: series("2026-05-31", 30, 3000, 4) };
    const f = forecastIncome([src], "2026-06-08", 30);
    expect(f.length).toBe(1);
    expect(f[0].cadence).toBe("monthly");
    expect(f[0].confidence).toBe("medium"); // 4 samples
  });

  it("skips sources with <2 points", () => {
    const src: IncomeSourceInput = { key: "x", name: "X", accountId: "chk", points: [{ dateISO: "2026-06-01", amount: 500 }] };
    expect(forecastIncome([src], "2026-06-08", 30)).toEqual([]);
  });

  it("amount = mean of last 3 deposits", () => {
    const pts = series("2026-06-05", 14, 2000, 6);
    pts[pts.length - 1].amount = 2300; // last raise
    pts[pts.length - 2].amount = 2200;
    const f = forecastIncome([{ key: "a", name: "A", accountId: "c", points: pts }], "2026-06-08", 30);
    expect(f[0].amount).toBe(Math.round(((2300 + 2200 + 2000) / 3) * 100) / 100);
  });
});

describe("computeCoverage", () => {
  const today = "2026-06-08";
  it("covered: enough cash in the source", () => {
    const r = computeCoverage({
      transfers: [{ amount: 500, fromAccountId: "chk", dueISO: "2026-06-12" }],
      cashBySource: { chk: 800 },
      income: [],
      todayISO: today,
    });
    expect(r.verdict).toBe("covered");
    expect(r.gap).toBe(0);
  });

  it("short with no income → short verdict", () => {
    const r = computeCoverage({
      transfers: [{ amount: 1000, fromAccountId: "chk", dueISO: "2026-06-12" }],
      cashBySource: { chk: 600 },
      income: [],
      todayISO: today,
    });
    expect(r.gap).toBe(400);
    expect(r.verdict).toBe("short");
    expect(r.shortAfterForecast).toBe(400);
  });

  it("short but a paycheck lands before the due date → covered_by_paycheck", () => {
    const r = computeCoverage({
      transfers: [{ amount: 1000, fromAccountId: "chk", dueISO: "2026-06-20" }],
      cashBySource: { chk: 600 },
      income: [{ dateISO: "2026-06-14", amount: 2950, accountId: "chk" }],
      todayISO: today,
    });
    expect(r.verdict).toBe("covered_by_paycheck");
    expect(r.coverDateISO).toBe("2026-06-14");
    expect(r.shortAfterForecast).toBe(0);
  });

  it("paycheck arrives AFTER the due date → still short", () => {
    const r = computeCoverage({
      transfers: [{ amount: 1000, fromAccountId: "chk", dueISO: "2026-06-12" }],
      cashBySource: { chk: 600 },
      income: [{ dateISO: "2026-06-14", amount: 2950, accountId: "chk" }],
      todayISO: today,
    });
    expect(r.verdict).toBe("short");
    expect(r.shortAfterForecast).toBe(400);
  });

  it("out-of-window transfers are excluded", () => {
    const r = computeCoverage({
      transfers: [{ amount: 1000, fromAccountId: "chk", dueISO: "2026-09-01" }],
      cashBySource: { chk: 0 },
      income: [],
      todayISO: today,
      horizonDays: 30,
    });
    expect(r.upcomingTotal).toBe(0);
    expect(r.verdict).toBe("covered");
  });

  it("per-source: surplus in one account doesn't mask a short source", () => {
    const r = computeCoverage({
      transfers: [
        { amount: 1000, fromAccountId: "bills", dueISO: "2026-06-12" },
        { amount: 200, fromAccountId: "main", dueISO: "2026-06-12" },
      ],
      cashBySource: { bills: 600, main: 5000 },
      income: [],
      todayISO: today,
    });
    expect(r.gap).toBe(400); // only the bills shortfall, not netted against main's surplus
    expect(r.bySource.find((s) => s.accountId === "bills")!.short).toBe(400);
  });
});

describe("shortfallAlert", () => {
  const cov = (over = {}) =>
    computeCoverage({
      transfers: [{ amount: 1200, fromAccountId: "bills", dueISO: "2026-06-12" }],
      cashBySource: { bills: 400 },
      income: [],
      todayISO: "2026-06-10",
      horizonDays: 2,
      ...over,
    });

  it("warns when transfers are projected short even after expected income", () => {
    const a = shortfallAlert(cov(), { sourceNames: { bills: "Bills account" } });
    expect(a).not.toBeNull();
    expect(a!.title).toContain("$800.00");
    expect(a!.body).toContain("Bills account");
    expect(a!.body).toContain("$1,200.00");
  });

  it("stays silent when cash already covers everything", () => {
    expect(shortfallAlert(cov({ cashBySource: { bills: 1500 } }))).toBeNull();
  });

  it("stays silent when a paycheck lands before the due date (covered_by_paycheck)", () => {
    const c = cov({ income: [{ dateISO: "2026-06-11", amount: 900, accountId: "bills" }] });
    expect(c.verdict).toBe("covered_by_paycheck");
    expect(shortfallAlert(c)).toBeNull();
  });

  it("stays silent when nothing is due", () => {
    const c = computeCoverage({ transfers: [], cashBySource: {}, income: [], todayISO: "2026-06-10", horizonDays: 2 });
    expect(shortfallAlert(c)).toBeNull();
  });

  it("omits the account clause when names are unknown", () => {
    const a = shortfallAlert(cov());
    expect(a!.body).not.toContain(" in ");
  });
});

describe("incomeLandingOn", () => {
  const fc = (over: Partial<IncomeForecast> = {}): IncomeForecast => ({
    key: "acme",
    name: "Acme",
    accountId: "chk",
    dateISO: "2026-06-15",
    amount: 2000,
    cadence: "biweekly",
    confidence: "high",
    samples: 6,
    varianceDays: 0,
    source: "auto",
    ...over,
  });

  it("returns forecasts landing exactly on the target", () => {
    const r = incomeLandingOn([fc(), fc({ key: "b", dateISO: "2026-06-20" })], "2026-06-15");
    expect(r.map((f) => f.key)).toEqual(["acme"]);
  });

  it("includes a forecast within its variance grace window", () => {
    const r = incomeLandingOn([fc({ dateISO: "2026-06-16", varianceDays: 2 })], "2026-06-15");
    expect(r).toHaveLength(1);
  });

  it("excludes a forecast outside the grace window", () => {
    const r = incomeLandingOn([fc({ dateISO: "2026-06-18", varianceDays: 1 })], "2026-06-15");
    expect(r).toHaveLength(0);
  });

  it("caps per-forecast grace at 2 days even for very irregular sources", () => {
    expect(incomeLandingOn([fc({ dateISO: "2026-06-18", varianceDays: 9 })], "2026-06-15")).toHaveLength(0);
    expect(incomeLandingOn([fc({ dateISO: "2026-06-17", varianceDays: 9 })], "2026-06-15")).toHaveLength(1);
  });

  it("honors an explicit graceDays override", () => {
    expect(incomeLandingOn([fc({ dateISO: "2026-06-18", varianceDays: 0 })], "2026-06-15", { graceDays: 3 })).toHaveLength(1);
  });
});

describe("projectRunway", () => {
  const today = "2026-06-10";

  it("flags an account that dips below the buffer before income lands", () => {
    const r = projectRunway({
      accounts: [{ accountId: "chk", balance: 1000 }],
      outflows: [{ accountId: "chk", dateISO: "2026-06-14", amount: 900 }],
      income: [{ dateISO: "2026-06-20", amount: 2000, accountId: "chk" }],
      todayISO: today,
      buffer: 300,
    });
    const a = r.byAccount[0];
    expect(a.dipsBelowBuffer).toBe(true);
    expect(a.low).toBe(100);
    expect(a.lowISO).toBe("2026-06-14");
    expect(r.worstAccountId).toBe("chk");
  });

  it("does not flag when income arrives before the outflow", () => {
    const r = projectRunway({
      accounts: [{ accountId: "chk", balance: 1000 }],
      outflows: [{ accountId: "chk", dateISO: "2026-06-20", amount: 900 }],
      income: [{ dateISO: "2026-06-14", amount: 2000, accountId: "chk" }],
      todayISO: today,
      buffer: 300,
    });
    expect(r.byAccount[0].dipsBelowBuffer).toBe(false);
    expect(r.byAccount[0].low).toBe(1000); // minimum is the starting balance
    expect(r.worstAccountId).toBeNull();
  });

  it("respects the buffer threshold", () => {
    const base = {
      accounts: [{ accountId: "chk", balance: 500 }],
      outflows: [{ accountId: "chk", dateISO: "2026-06-14", amount: 250 }],
      income: [] as { dateISO: string; amount: number; accountId: string }[],
      todayISO: today,
    };
    expect(projectRunway({ ...base, buffer: 300 }).byAccount[0].dipsBelowBuffer).toBe(true); // 250 < 300
    expect(projectRunway({ ...base, buffer: 200 }).byAccount[0].dipsBelowBuffer).toBe(false); // 250 >= 200
  });

  it("never flags when there are no outflows", () => {
    const r = projectRunway({
      accounts: [{ accountId: "chk", balance: 250 }],
      outflows: [],
      income: [],
      todayISO: today,
      buffer: 300,
    });
    // already below buffer but nothing drains it further → not a runway risk
    expect(r.byAccount[0].dipsBelowBuffer).toBe(false);
  });

  it("clamps past-dated pending outflows to today", () => {
    const r = projectRunway({
      accounts: [{ accountId: "chk", balance: 400 }],
      outflows: [{ accountId: "chk", dateISO: "2026-06-01", amount: 200 }],
      income: [],
      todayISO: today,
      buffer: 300,
    });
    expect(r.byAccount[0].low).toBe(200);
    expect(r.byAccount[0].lowISO).toBe(today);
  });
});

describe("runwayAlert", () => {
  const today = "2026-06-10";
  const dip = () =>
    projectRunway({
      accounts: [{ accountId: "chk", balance: 1000 }],
      outflows: [{ accountId: "chk", dateISO: "2026-06-14", amount: 950 }],
      income: [{ dateISO: "2026-06-20", amount: 2000, accountId: "chk" }],
      todayISO: today,
      buffer: 300,
    });

  it("warns with the account name, projected low, and cushion", () => {
    const a = runwayAlert(dip(), { accountNames: { chk: "Main checking" } });
    expect(a).not.toBeNull();
    expect(a!.title).toContain("Main checking");
    expect(a!.title).toContain("$50.00");
    expect(a!.body).toContain("$300.00");
    expect(a!.body).toContain("Jun 14");
  });

  it("stays silent when nothing dips below the buffer", () => {
    const r = projectRunway({
      accounts: [{ accountId: "chk", balance: 1000 }],
      outflows: [{ accountId: "chk", dateISO: "2026-06-14", amount: 100 }],
      income: [],
      todayISO: today,
      buffer: 300,
    });
    expect(runwayAlert(r)).toBeNull();
  });
});
