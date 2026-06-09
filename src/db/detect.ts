/**
 * Recurring-bill detection (pure). Scans transactions, groups by merchant, and
 * flags merchants that repeat on a regular cadence (weekly … yearly) as bills /
 * subscriptions — with a predicted next-due date and changed/due-soon badges.
 */
import { extractMerchant } from "./categorize";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;

export interface DetectTxn {
  merchant: string;
  amount: number; // signed
  date: string | null; // ISO YYYY-MM-DD
  categoryName?: string | null;
  color?: string | null;
  accountLabel?: string | null;
  isTransfer?: boolean;
  income?: boolean;
}

export interface DetectedBill {
  id: string;
  name: string;
  cat: string | null;
  color: string | null;
  amount: number;
  freq: string;
  next: string | null;
  account: string | null;
  badge?: string;
  delta?: string;
}

const CADENCES = [
  { freq: "Weekly", days: 7, lo: 5, hi: 10 },
  { freq: "Biweekly", days: 14, lo: 11, hi: 18 },
  { freq: "Monthly", days: 30, lo: 24, hi: 38 },
  { freq: "Quarterly", days: 91, lo: 80, hi: 100 },
  { freq: "Yearly", days: 365, lo: 330, hi: 400 },
];

const titleize = (s: string) =>
  s.split(" ").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mode<T>(arr: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of arr) {
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > bestN) { bestN = c; best = v; }
  }
  return best;
}

export function detectRecurring(txns: DetectTxn[], now: Date = new Date()): DetectedBill[] {
  // Group expenses by stable merchant key.
  const groups = new Map<string, DetectTxn[]>();
  for (const t of txns) {
    if (t.isTransfer || t.income || t.amount >= 0 || !t.date) continue;
    const key = extractMerchant(t.merchant);
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: { bill: DetectedBill; nextTime: number }[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    const times = sorted.map((t) => new Date(t.date! + "T00:00:00").getTime());
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY);

    const g = median(gaps);
    const cad = CADENCES.find((c) => g >= c.lo && g <= c.hi);
    if (!cad) continue;
    // Most gaps must be within tolerance of the cadence (regularity).
    const regular = gaps.filter((x) => Math.abs(x - cad.days) <= cad.days * 0.5).length >= Math.ceil(gaps.length * 0.6);
    if (!regular) continue;

    const lastTxn = sorted[sorted.length - 1];
    const prevTxn = sorted[sorted.length - 2];
    const amount = Math.abs(lastTxn.amount);
    const prevAmt = Math.abs(prevTxn.amount);
    const nextTime = times[times.length - 1] + cad.days * DAY;
    const nextDate = new Date(nextTime);
    const next = `${MONTHS[nextDate.getMonth()]} ${nextDate.getDate()}`;

    const catName = mode(sorted.map((t) => t.categoryName).filter(Boolean) as string[]);
    const color = sorted.find((t) => t.categoryName === catName)?.color ?? lastTxn.color ?? null;
    const account = mode(sorted.map((t) => t.accountLabel).filter(Boolean) as string[]);

    let badge: string | undefined;
    let delta: string | undefined;
    const dueInDays = (nextTime - now.getTime()) / DAY;
    if (Math.abs(amount - prevAmt) > Math.max(1, prevAmt * 0.1)) {
      badge = "changed";
      const d = amount - prevAmt;
      delta = (d > 0 ? "+" : "-") + "$" + Math.abs(Math.round(d));
    } else if (dueInDays >= 0 && dueInDays <= 7) {
      badge = "due soon";
    }

    out.push({
      bill: { id: key, name: titleize(key), cat: catName, color, amount, freq: cad.freq, next, account, ...(badge ? { badge } : {}), ...(delta ? { delta } : {}) },
      nextTime,
    });
  }

  return out.sort((a, b) => a.nextTime - b.nextTime).map((x) => x.bill);
}
