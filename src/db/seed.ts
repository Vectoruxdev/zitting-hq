/**
 * Seeds the database with the curated demo data (MOCK_FINANCE_DATA).
 * Run with: pnpm db:seed  (after pnpm db:push has created the tables).
 *
 * Idempotent: truncates the finance tables, then re-inserts.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as s from "./schema";
import { MOCK_FINANCE_DATA as D } from "@/finance/data/mockData";

const url =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
if (!url) {
  console.error("✗ No database URL set. Run `vercel env pull .env.local` or set DATABASE_URL.");
  process.exit(1);
}

const parseMoney = (v: string | number | null | undefined): string => {
  if (v == null) return "0";
  if (typeof v === "number") return String(v);
  return String(Number(v.replace(/[$,]/g, "")) || 0);
};

async function main() {
  const client = postgres(url!, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: s });

  console.log("→ Truncating finance tables…");
  await db.execute(sql`
    TRUNCATE TABLE
      ${s.accounts}, ${s.transactions}, ${s.budgets}, ${s.allocationRules},
      ${s.incomeStreams}, ${s.bills}, ${s.savingsGoals}, ${s.transfers},
      ${s.notifications}, ${s.notificationRules}, ${s.receiptItems},
      ${s.familyMembers}
    RESTART IDENTITY CASCADE
  `);

  console.log("→ Seeding family members…");
  await db.insert(s.familyMembers).values([
    { id: "jared", name: "Jared", role: "owner" },
    { id: "sarah", name: "Sarah", role: "member" },
    { id: "rebecca", name: "Rebecca", role: "member" },
  ]);

  console.log("→ Seeding accounts…");
  const acctRows: (typeof s.accounts.$inferInsert)[] = [];
  let order = 0;
  for (const [type, list] of Object.entries(D.accounts) as [string, any[]][]) {
    for (const a of list) {
      acctRows.push({
        id: a.id,
        name: a.name,
        institution: a.inst,
        mask: a.mask,
        type,
        balance: String(a.balance),
        who: a.who,
        syncedLabel: a.synced,
        status: a.status,
        destLabel: a.dest ?? null,
        trend: a.trend ?? [],
        sortOrder: order++,
      });
    }
  }
  await db.insert(s.accounts).values(acctRows);

  console.log("→ Seeding transactions…");
  await db.insert(s.transactions).values(
    D.txns.map((t: any, i: number) => ({
      dateLabel: t.date,
      merchant: t.merchant,
      category: t.cat,
      color: t.color ?? null,
      who: t.who,
      accountLabel: t.account,
      amount: String(t.amt),
      income: Boolean(t.income),
      pending: Boolean(t.pending),
      flagged: Boolean(t.flagged),
      sortOrder: i,
    }))
  );

  console.log("→ Seeding budgets…");
  await db.insert(s.budgets).values(
    D.budgets.map((b: any, i: number) => ({
      name: b.name,
      who: b.who ?? null,
      icon: b.icon ?? null,
      spent: String(b.spent),
      limitAmount: String(b.limit),
      sortOrder: i,
    }))
  );

  console.log("→ Seeding allocation rules…");
  await db.insert(s.allocationRules).values(
    D.rules.map((r: any, i: number) => ({
      id: r.id,
      name: r.name,
      method: r.method,
      value: r.value == null ? null : String(r.value),
      dest: r.dest,
      icon: r.icon ?? null,
      sortOrder: i,
    }))
  );

  console.log("→ Seeding income streams…");
  await db.insert(s.incomeStreams).values(
    D.incomeStreams.map((it: any, i: number) => ({
      id: it.id,
      name: it.name,
      sub: it.sub ?? null,
      monthly: String(it.monthly),
      cadence: it.cadence ?? null,
      lastLabel: it.last ?? null,
      nextLabel: it.next ?? null,
      status: it.status,
      spark: it.spark ?? [],
      sortOrder: i,
    }))
  );

  console.log("→ Seeding bills…");
  await db.insert(s.bills).values(
    D.bills.map((b: any, i: number) => ({
      name: b.name,
      category: b.cat,
      color: b.color ?? null,
      amount: String(b.amount),
      freq: b.freq,
      nextLabel: b.next ?? null,
      accountLabel: b.account ?? null,
      badge: b.badge ?? null,
      delta: b.delta ?? null,
      sortOrder: i,
    }))
  );

  console.log("→ Seeding savings goals…");
  await db.insert(s.savingsGoals).values(
    D.goals.map((g: any, i: number) => ({
      id: g.id,
      name: g.name,
      saved: String(g.saved),
      target: String(g.target),
      dateLabel: g.date ?? null,
      accountLabel: g.account ?? null,
      contrib: String(g.contrib),
      sortOrder: i,
    }))
  );

  console.log("→ Seeding transfers…");
  const transferRows: (typeof s.transfers.$inferInsert)[] = [];
  D.upcoming.forEach((t: any, i: number) =>
    transferRows.push({
      toLabel: t.to,
      fromLabel: t.from,
      amount: parseMoney(t.amount),
      dueLabel: t.due,
      state: t.state,
      icon: t.icon ?? null,
      kind: "upcoming",
      sortOrder: i,
    })
  );
  D.past.forEach((t: any, i: number) =>
    transferRows.push({
      toLabel: t.to,
      fromLabel: t.from,
      amount: parseMoney(t.amount),
      dueLabel: t.due,
      state: t.state,
      icon: t.icon ?? null,
      kind: "past",
      sortOrder: i,
    })
  );
  await db.insert(s.transfers).values(transferRows);

  console.log("→ Seeding notifications…");
  await db.insert(s.notifications).values(
    D.notifications.map((no: any, i: number) => ({
      type: no.type,
      icon: no.icon ?? null,
      tone: no.tone,
      title: no.title,
      body: no.body ?? null,
      timeLabel: no.time ?? null,
      unread: Boolean(no.unread),
      sortOrder: i,
    }))
  );

  console.log("→ Seeding notification rules…");
  await db.insert(s.notificationRules).values(
    D.notifRules.map((r: any, i: number) => ({
      name: r.name,
      detail: r.detail ?? null,
      channels: r.channels ?? null,
      enabled: Boolean(r.on),
      sortOrder: i,
    }))
  );

  console.log("→ Seeding receipt items…");
  await db.insert(s.receiptItems).values(
    D.receiptItems.map((r: any, i: number) => ({
      item: r.item,
      qty: String(r.qty),
      unit: String(r.unit),
      total: String(r.total),
      sortOrder: i,
    }))
  );

  console.log("✓ Seed complete.");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
