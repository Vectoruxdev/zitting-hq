import { describe, it, expect } from "vitest";
import { matchTransfers, type MatchTxn } from "./transfers";

let seq = 1;
const tx = (accountId: string, amount: number, date: string, extra: Partial<MatchTxn> = {}): MatchTxn => ({
  id: seq++,
  accountId,
  amount,
  date,
  isTransfer: false,
  transferPairId: null,
  ...extra,
});

const pairKeys = (pairs: { outId: number; inId: number }[]) =>
  pairs.map((p) => `${p.outId}->${p.inId}`).sort();

describe("matchTransfers", () => {
  it("pairs an exact opposite amount across two accounts on the same day", () => {
    const out = tx("checking", -500, "2026-05-10");
    const inn = tx("savings", 500, "2026-05-10");
    const pairs = matchTransfers([out, inn]);
    expect(pairs).toEqual([{ outId: out.id, inId: inn.id }]);
  });

  it("matches at the 3-day boundary but not beyond it", () => {
    const out3 = tx("checking", -200, "2026-05-10");
    const in3 = tx("savings", 200, "2026-05-13"); // +3 days → match
    expect(matchTransfers([out3, in3]).length).toBe(1);

    const out4 = tx("checking", -200, "2026-05-10");
    const in4 = tx("savings", 200, "2026-05-14"); // +4 days → no match
    expect(matchTransfers([out4, in4]).length).toBe(0);
  });

  it("does NOT pair opposite amounts in the SAME account (purchase + refund)", () => {
    const purchase = tx("checking", -20, "2026-05-10");
    const refund = tx("checking", 20, "2026-05-11");
    expect(matchTransfers([purchase, refund]).length).toBe(0);
  });

  it("does not pair when amounts differ", () => {
    const out = tx("checking", -500, "2026-05-10");
    const inn = tx("savings", 499.99, "2026-05-10");
    expect(matchTransfers([out, inn]).length).toBe(0);
  });

  it("greedily matches the nearest-dated candidate", () => {
    const out = tx("checking", -100, "2026-05-10");
    const far = tx("savings", 100, "2026-05-12"); // 2 days
    const near = tx("savings", 100, "2026-05-10"); // 0 days → should win
    const pairs = matchTransfers([out, far, near]);
    expect(pairs).toEqual([{ outId: out.id, inId: near.id }]);
  });

  it("uses each transaction at most once", () => {
    const out1 = tx("checking", -100, "2026-05-10");
    const out2 = tx("checking", -100, "2026-05-10");
    const in1 = tx("savings", 100, "2026-05-10");
    const pairs = matchTransfers([out1, out2, in1]);
    expect(pairs.length).toBe(1); // only one inflow to match
  });

  it("skips transactions already paired", () => {
    const out = tx("checking", -500, "2026-05-10", { transferPairId: 999 });
    const inn = tx("savings", 500, "2026-05-10", { transferPairId: 888 });
    expect(matchTransfers([out, inn]).length).toBe(0);
  });

  it("leaves a one-sided transfer unpaired (other account not imported)", () => {
    const out = tx("checking", -500, "2026-05-10", { isTransfer: true });
    expect(matchTransfers([out]).length).toBe(0);
  });

  it("is deterministic regardless of input order", () => {
    const a = tx("checking", -50, "2026-05-01");
    const b = tx("savings", 50, "2026-05-01");
    const c = tx("checking", -75, "2026-05-02");
    const d = tx("savings", 75, "2026-05-03");
    const forward = pairKeys(matchTransfers([a, b, c, d]));
    const shuffled = pairKeys(matchTransfers([d, c, b, a]));
    expect(forward).toEqual(shuffled);
    expect(forward.length).toBe(2);
  });

  it("honors requireHint when asked", () => {
    const out = tx("checking", -500, "2026-05-10");
    const inn = tx("savings", 500, "2026-05-10");
    expect(matchTransfers([out, inn], 3, true).length).toBe(0); // neither hinted
    const out2 = tx("checking", -500, "2026-05-10", { transferHint: true });
    const in2 = tx("savings", 500, "2026-05-10");
    expect(matchTransfers([out2, in2], 3, true).length).toBe(1); // one hinted
  });

  it("EXCLUSION CONTRACT: paired transfers drop out of spending/income but still move balances", () => {
    const out = tx("checking", -500, "2026-05-10");
    const inn = tx("savings", 500, "2026-05-10");
    const all = [out, inn];
    const pairs = matchTransfers(all);
    // simulate flagging both legs as the app would
    for (const p of pairs) {
      out.isTransfer = true;
      inn.isTransfer = true;
    }
    // spending/income exclude isTransfer rows
    const spend = all.filter((t) => !t.isTransfer && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = all.filter((t) => !t.isTransfer && t.amount > 0).reduce((s, t) => s + t.amount, 0);
    expect(spend).toBe(0);
    expect(income).toBe(0);
    // per-account net still moves (balance math uses raw amounts)
    const checkingNet = all.filter((t) => t.accountId === "checking").reduce((s, t) => s + t.amount, 0);
    const savingsNet = all.filter((t) => t.accountId === "savings").reduce((s, t) => s + t.amount, 0);
    expect(checkingNet).toBe(-500);
    expect(savingsNet).toBe(500);
  });
});
