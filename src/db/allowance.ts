/**
 * Member categorization-completion + allowance-gating math (pure).
 *
 * A member is "in charge of" some accounts; their job is to review (confirm)
 * every transaction on those accounts. A month is complete when nothing on
 * those accounts in that month is still unreviewed. The monthly allowance
 * UNLOCKS once the member has fully reviewed the PREVIOUS calendar month.
 *
 * Pure + deterministic (no Date.now / DB) so it's unit-testable like
 * matchTransfers / markDuplicates. `now` is injected.
 */

export interface GateTxn {
  accountId: string | null;
  date: string | null; // ISO YYYY-MM-DD
  reviewed: boolean;
}

export interface AccountProgress {
  total: number;
  reviewed: number;
  remaining: number;
  done: boolean; // has transactions this month and all are reviewed
}

export interface MemberProgress {
  monthKey: string;
  prevMonthKey: string;
  perAccount: Map<string, AccountProgress>;
  totalRemaining: number; // current-month unreviewed across managed accounts
  allCaughtUp: boolean;
  prevMonthRemaining: number; // previous-month unreviewed across managed accounts
  allowanceUnlocked: boolean; // prevMonthRemaining === 0
}

function monthKey(dt: Date): string {
  return `${dt.getFullYear()}-${dt.getMonth()}`;
}
function parse(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function computeMemberProgress(
  txns: GateTxn[],
  managedAccountIds: string[],
  now: Date
): MemberProgress {
  const managed = new Set(managedAccountIds);
  const curKey = monthKey(now);
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const perAccount = new Map<string, AccountProgress>();
  for (const id of managed) perAccount.set(id, { total: 0, reviewed: 0, remaining: 0, done: false });

  let prevMonthRemaining = 0;
  for (const t of txns) {
    if (!t.accountId || !managed.has(t.accountId)) continue;
    const dt = parse(t.date);
    if (!dt) continue;
    const mk = monthKey(dt);
    if (mk === curKey) {
      const p = perAccount.get(t.accountId)!;
      p.total += 1;
      if (t.reviewed) p.reviewed += 1;
      else p.remaining += 1;
    } else if (mk === prevKey && !t.reviewed) {
      prevMonthRemaining += 1;
    }
  }

  let totalRemaining = 0;
  for (const p of perAccount.values()) {
    p.done = p.total > 0 && p.remaining === 0;
    totalRemaining += p.remaining;
  }

  return {
    monthKey: curKey,
    prevMonthKey: prevKey,
    perAccount,
    totalRemaining,
    allCaughtUp: totalRemaining === 0,
    prevMonthRemaining,
    allowanceUnlocked: prevMonthRemaining === 0,
  };
}
