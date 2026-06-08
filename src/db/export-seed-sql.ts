/**
 * Offline generator: emits the seed as plain SQL INSERTs (no DB connection),
 * so the data can be loaded via the Supabase SQL Editor when the DB credentials
 * are "sensitive" on Vercel and can't be pulled locally.
 *
 * Run: pnpm tsx src/db/export-seed-sql.ts > src/db/seed.sql
 */
import { MOCK_FINANCE_DATA as D } from "@/finance/data/mockData";

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (Array.isArray(v)) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const money = (v: string | number | null | undefined): string => {
  if (v == null) return "NULL";
  if (typeof v === "number") return String(v);
  return String(Number(v.replace(/[$,]/g, "")) || 0);
};
const row = (vals: unknown[]) => `(${vals.map(q).join(", ")})`;

const out: string[] = [];
out.push("-- Zitting Finance seed data (generated offline from mockData.ts)");
out.push("BEGIN;");
out.push(
  `TRUNCATE TABLE accounts, transactions, budgets, allocation_rules, income_streams, bills, savings_goals, transfers, notifications, notification_rules, receipt_items, family_members RESTART IDENTITY CASCADE;`
);

out.push("\n-- family_members");
out.push(
  `INSERT INTO family_members (id, name, role) VALUES\n` +
    [
      ["jared", "Jared", "owner"],
      ["sarah", "Sarah", "member"],
      ["rebecca", "Rebecca", "member"],
    ]
      .map(row)
      .join(",\n") +
    ";"
);

out.push("\n-- accounts");
const acctRows: string[] = [];
let ao = 0;
for (const [type, list] of Object.entries(D.accounts) as [string, any[]][]) {
  for (const a of list) {
    acctRows.push(
      `(${[q(a.id), q(a.name), q(a.inst), q(a.mask), q(type), money(a.balance), q(a.who), q(a.synced), q(a.status), q(a.dest ?? null), q(a.trend ?? []), ao++].join(", ")})`
    );
  }
}
out.push(
  `INSERT INTO accounts (id, name, institution, mask, type, balance, who, synced_label, status, dest_label, trend, sort_order) VALUES\n` +
    acctRows.join(",\n") +
    ";"
);

out.push("\n-- transactions");
out.push(
  `INSERT INTO transactions (date_label, merchant, category, color, who, account_label, amount, income, pending, flagged, sort_order) VALUES\n` +
    D.txns
      .map((t: any, i: number) =>
        `(${[q(t.date), q(t.merchant), q(t.cat), q(t.color ?? null), q(t.who), q(t.account), money(t.amt), q(!!t.income), q(!!t.pending), q(!!t.flagged), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- budgets");
out.push(
  `INSERT INTO budgets (name, who, icon, spent, limit_amount, sort_order) VALUES\n` +
    D.budgets
      .map((b: any, i: number) =>
        `(${[q(b.name), q(b.who ?? null), q(b.icon ?? null), money(b.spent), money(b.limit), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- allocation_rules");
out.push(
  `INSERT INTO allocation_rules (id, name, method, value, dest, icon, sort_order) VALUES\n` +
    D.rules
      .map((r: any, i: number) =>
        `(${[q(r.id), q(r.name), q(r.method), r.value == null ? "NULL" : money(r.value), q(r.dest), q(r.icon ?? null), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- income_streams");
out.push(
  `INSERT INTO income_streams (id, name, sub, monthly, cadence, last_label, next_label, status, spark, sort_order) VALUES\n` +
    D.incomeStreams
      .map((it: any, i: number) =>
        `(${[q(it.id), q(it.name), q(it.sub ?? null), money(it.monthly), q(it.cadence ?? null), q(it.last ?? null), q(it.next ?? null), q(it.status), q(it.spark ?? []), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- bills");
out.push(
  `INSERT INTO bills (name, category, color, amount, freq, next_label, account_label, badge, delta, sort_order) VALUES\n` +
    D.bills
      .map((b: any, i: number) =>
        `(${[q(b.name), q(b.cat), q(b.color ?? null), money(b.amount), q(b.freq), q(b.next ?? null), q(b.account ?? null), q(b.badge ?? null), q(b.delta ?? null), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- savings_goals");
out.push(
  `INSERT INTO savings_goals (id, name, saved, target, date_label, account_label, contrib, sort_order) VALUES\n` +
    D.goals
      .map((g: any, i: number) =>
        `(${[q(g.id), q(g.name), money(g.saved), money(g.target), q(g.date ?? null), q(g.account ?? null), money(g.contrib), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- transfers");
const tRows: string[] = [];
D.upcoming.forEach((t: any, i: number) =>
  tRows.push(`(${[q(t.to), q(t.from), money(t.amount), q(t.due ?? null), q(t.state), q(t.icon ?? null), q("upcoming"), i].join(", ")})`)
);
D.past.forEach((t: any, i: number) =>
  tRows.push(`(${[q(t.to), q(t.from), money(t.amount), q(t.due ?? null), q(t.state), q(t.icon ?? null), q("past"), i].join(", ")})`)
);
out.push(
  `INSERT INTO transfers (to_label, from_label, amount, due_label, state, icon, kind, sort_order) VALUES\n` +
    tRows.join(",\n") +
    ";"
);

out.push("\n-- notifications");
out.push(
  `INSERT INTO notifications (type, icon, tone, title, body, time_label, unread, sort_order) VALUES\n` +
    D.notifications
      .map((no: any, i: number) =>
        `(${[q(no.type), q(no.icon ?? null), q(no.tone), q(no.title), q(no.body ?? null), q(no.time ?? null), q(!!no.unread), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- notification_rules");
out.push(
  `INSERT INTO notification_rules (name, detail, channels, enabled, sort_order) VALUES\n` +
    D.notifRules
      .map((r: any, i: number) =>
        `(${[q(r.name), q(r.detail ?? null), q(r.channels ?? null), q(!!r.on), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("\n-- receipt_items");
out.push(
  `INSERT INTO receipt_items (item, qty, unit, total, sort_order) VALUES\n` +
    D.receiptItems
      .map((r: any, i: number) =>
        `(${[q(r.item), money(r.qty), money(r.unit), money(r.total), i].join(", ")})`
      )
      .join(",\n") +
    ";"
);

out.push("COMMIT;");
console.log(out.join("\n"));
