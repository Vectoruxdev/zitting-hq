/**
 * Resets the database to a clean, empty state: truncates ALL finance tables,
 * then seeds ONLY the family members and the default category taxonomy.
 * No demo transactions/accounts/budgets/etc. — the app starts empty and is
 * filled by importing real transactions.
 *
 * Run: pnpm db:seed   (alias: pnpm db:reset)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as s from "./schema";
import { DEFAULT_GROUPS, DEFAULT_CATEGORIES, DEFAULT_MEMBERS } from "./seedCategories";

const url =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
if (!url) {
  console.error("✗ No database URL set. Run `vercel env pull .env.local` or set DATABASE_URL.");
  process.exit(1);
}

async function main() {
  const client = postgres(url!, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: s });

  console.log("→ Truncating all finance tables…");
  await db.execute(sql`
    TRUNCATE TABLE
      ${s.transactionSplits}, ${s.transactions}, ${s.importBatches},
      ${s.categorizationRules}, ${s.columnMappingTemplates},
      ${s.categories}, ${s.categoryGroups},
      ${s.accounts}, ${s.budgets}, ${s.allocationRules},
      ${s.incomeStreams}, ${s.bills}, ${s.savingsGoals}, ${s.transfers},
      ${s.notifications}, ${s.notificationRules}, ${s.receiptItems},
      ${s.familyMembers}
    RESTART IDENTITY CASCADE
  `);

  console.log("→ Seeding family members…");
  await db.insert(s.familyMembers).values(DEFAULT_MEMBERS);

  console.log("→ Seeding category groups…");
  await db.insert(s.categoryGroups).values(DEFAULT_GROUPS);

  console.log("→ Seeding categories…");
  await db.insert(s.categories).values(
    DEFAULT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      groupId: c.groupId,
      color: c.color,
      icon: c.icon ?? null,
      kind: c.kind,
      excludeFromBudget: Boolean(c.excludeFromBudget),
      sortOrder: c.sortOrder,
    }))
  );

  console.log("✓ Reset complete — members + categories seeded, no demo data.");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
