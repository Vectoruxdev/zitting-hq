/**
 * Offline generator: emits the clean-reset + taxonomy seed as SQL, for pasting
 * into the Supabase SQL Editor (the integration's DB creds are "sensitive" and
 * blank locally, so `db:seed` can't reach the live DB from here).
 *
 * Run: pnpm db:export-sql > /tmp/seed.sql
 */
import { DEFAULT_GROUPS, DEFAULT_CATEGORIES, DEFAULT_MEMBERS } from "./seedCategories";

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const out: string[] = [];
out.push("-- Reset finance data + seed members and category taxonomy (no demo data).");
out.push("BEGIN;");
out.push(`TRUNCATE TABLE
  transaction_splits, transactions, import_batches,
  categorization_rules, column_mapping_templates,
  categories, category_groups,
  accounts, budgets, allocation_rules, income_streams, bills,
  savings_goals, transfers, notifications, notification_rules, receipt_items,
  family_members
  RESTART IDENTITY CASCADE;`);

out.push("\n-- family_members");
out.push(
  "INSERT INTO family_members (id, name, role) VALUES\n" +
    DEFAULT_MEMBERS.map((m) => `(${q(m.id)}, ${q(m.name)}, ${q(m.role)})`).join(",\n") +
    ";"
);

out.push("\n-- category_groups");
out.push(
  "INSERT INTO category_groups (id, name, sort_order) VALUES\n" +
    DEFAULT_GROUPS.map((g) => `(${q(g.id)}, ${q(g.name)}, ${g.sortOrder})`).join(",\n") +
    ";"
);

out.push("\n-- categories");
out.push(
  "INSERT INTO categories (id, name, group_id, color, icon, kind, exclude_from_budget, sort_order) VALUES\n" +
    DEFAULT_CATEGORIES.map(
      (c) =>
        `(${q(c.id)}, ${q(c.name)}, ${q(c.groupId)}, ${q(c.color)}, ${q(c.icon ?? null)}, ${q(c.kind)}, ${q(Boolean(c.excludeFromBudget))}, ${c.sortOrder})`
    ).join(",\n") +
    ";"
);

out.push("COMMIT;");
console.log(out.join("\n"));
