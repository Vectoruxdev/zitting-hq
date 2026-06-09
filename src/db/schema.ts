/**
 * Zitting Finance — database schema (Drizzle + Postgres/Supabase).
 *
 * Models the editable financial entities. Purely-presentational sections of the
 * UI (headline stats, the donut/trend samples, the Ask transcript, nav) are not
 * tables — they stay as defaults in mockData and are merged in getFinanceData().
 *
 * Money is stored as `numeric` (exact). Several "label" columns keep the demo's
 * human strings (e.g. "Jun 4", "2m ago") verbatim so the UI stays faithful;
 * those become real dates once bank sync is wired up.
 */
import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  serial,
  jsonb,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";

export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(), // slug or uuid
  name: text("name").notNull(),
  role: text("role").notNull().default("member"), // owner | partner | member
  email: text("email"), // links to a login (auth user), if any
  authId: text("auth_id"), // Supabase auth user id, once invited/created
  status: text("status").notNull().default("none"), // none | invited | active
  color: text("color"), // avatar tone
  createdAt: timestamp("created_at").defaultNow(),
});

// ---- Categories ---------------------------------------------------------

export const categoryGroups = pgTable("category_groups", {
  id: text("id").primaryKey(), // slug, e.g. "essentials"
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(), // slug, e.g. "groceries"
  name: text("name").notNull(),
  groupId: text("group_id").references(() => categoryGroups.id),
  color: text("color").notNull().default("var(--gray-500)"), // CSS var
  icon: text("icon"),
  kind: text("kind").notNull().default("expense"), // income | expense | transfer
  excludeFromBudget: boolean("exclude_from_budget").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(), // e.g. "main", "amex"
  name: text("name").notNull(),
  institution: text("institution").notNull(),
  mask: text("mask"),
  type: text("type").notNull(), // checking | savings | credit
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  who: text("who").notNull().default("Household"),
  syncedLabel: text("synced_label"),
  status: text("status").notNull().default("good"), // good | attention
  destLabel: text("dest_label"), // transfer-destination tag, if any
  trend: jsonb("trend").$type<number[]>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---- Import batches -----------------------------------------------------

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(), // uuid
  accountId: text("account_id").references(() => accounts.id),
  filename: text("filename"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsImported: integer("rows_imported").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"), // email
  undoneAt: timestamp("undone_at"),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    // Real, normalized fields (source of truth)
    date: date("date"), // real date; nullable for legacy/mock rows
    accountId: text("account_id").references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    memberId: text("member_id").references(() => familyMembers.id),
    importBatchId: text("import_batch_id").references(() => importBatches.id),
    isTransfer: boolean("is_transfer").notNull().default(false),
    transferPairId: integer("transfer_pair_id"),
    dedupeHash: text("dedupe_hash"),
    notes: text("notes"),
    // Auto-categorization metadata
    categorySource: text("category_source"), // rule | learned | merchant | keyword | income | transfer | manual | none
    categoryConfidence: numeric("category_confidence", { precision: 4, scale: 3 }),
    reviewed: boolean("reviewed").notNull().default(false),
    // Core fields
    merchant: text("merchant").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    income: boolean("income").notNull().default(false),
    pending: boolean("pending").notNull().default(false),
    flagged: boolean("flagged").notNull().default(false),
    hasSplit: boolean("has_split").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // Legacy/denormalized label columns (now nullable; backfilled on write
    // from the FKs so the existing label-based UI keeps rendering).
    dateLabel: text("date_label"), // e.g. "Jun 4"
    category: text("category"),
    color: text("color"), // CSS var for the category chip
    who: text("who"),
    accountLabel: text("account_label"),
  },
  (t) => [
    index("idx_txn_account").on(t.accountId),
    index("idx_txn_category").on(t.categoryId),
    index("idx_txn_member").on(t.memberId),
    index("idx_txn_date").on(t.date),
    index("idx_txn_batch").on(t.importBatchId),
    index("idx_txn_dedupe").on(t.accountId, t.dedupeHash),
  ]
);

export const transactionSplits = pgTable(
  "transaction_splits",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_splits_txn").on(t.transactionId)]
);

export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: serial("id").primaryKey(),
    matchType: text("match_type").notNull().default("contains"), // contains | exact | regex
    matchValue: text("match_value").notNull(),
    field: text("field").notNull().default("merchant"), // merchant | amount | account
    categoryId: text("category_id").references(() => categories.id),
    member: text("member"), // optional person to also assign
    priority: integer("priority").notNull().default(100),
    enabled: boolean("enabled").notNull().default(true),
    source: text("source").notNull().default("manual"), // manual | learned
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_rules_enabled").on(t.enabled, t.priority)]
);

/**
 * Learned merchant→category memory. Frequency-based: each time the user
 * confirms/changes a category, the (merchantKey, categoryId) count is bumped.
 * The categorization engine reads this as its strongest learned signal.
 */
export const merchantMemory = pgTable(
  "merchant_memory",
  {
    id: serial("id").primaryKey(),
    merchantKey: text("merchant_key").notNull(), // normalized, e.g. "netflix"
    categoryId: text("category_id").references(() => categories.id),
    member: text("member"),
    count: integer("count").notNull().default(1),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("idx_merchant_memory_key").on(t.merchantKey)]
);

export const columnMappingTemplates = pgTable("column_mapping_templates", {
  id: serial("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id),
  bank: text("bank"),
  name: text("name").notNull(),
  mapping: jsonb("mapping").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  who: text("who"), // member name (allowance) — null = shared/category budget
  memberId: text("member_id").references(() => familyMembers.id), // allowance target
  categoryId: text("category_id").references(() => categories.id), // category budget target
  icon: text("icon"),
  // `spent` is derived from transactions at read time (getFinanceData); this
  // stored column is just a fallback default for rows with no linked target.
  spent: numeric("spent", { precision: 14, scale: 2 }).notNull().default("0"),
  limitAmount: numeric("limit_amount", { precision: 14, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const allocationRules = pgTable("allocation_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").notNull(), // "%" | "Fixed" | "Remainder"
  value: numeric("value", { precision: 14, scale: 2 }), // null for Remainder
  dest: text("dest").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const incomeStreams = pgTable("income_streams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sub: text("sub"),
  monthly: numeric("monthly", { precision: 14, scale: 2 }).notNull().default("0"),
  cadence: text("cadence"),
  lastLabel: text("last_label"),
  nextLabel: text("next_label"),
  status: text("status").notNull().default("on-track"), // on-track | late
  spark: jsonb("spark").$type<number[]>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  color: text("color"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  freq: text("freq").notNull().default("Monthly"),
  nextLabel: text("next_label"),
  accountLabel: text("account_label"),
  badge: text("badge"), // new | changed | due soon | null
  delta: text("delta"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const savingsGoals = pgTable("savings_goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  saved: numeric("saved", { precision: 14, scale: 2 }).notNull().default("0"),
  target: numeric("target", { precision: 14, scale: 2 }).notNull(),
  dateLabel: text("date_label"),
  accountLabel: text("account_label"),
  contrib: numeric("contrib", { precision: 14, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  toLabel: text("to_label").notNull(),
  fromLabel: text("from_label").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  dueLabel: text("due_label"),
  state: text("state").notNull().default("todo"), // todo | auto | done
  icon: text("icon"),
  kind: text("kind").notNull().default("upcoming"), // upcoming | past
  sortOrder: integer("sort_order").notNull().default(0),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  icon: text("icon"),
  tone: text("tone").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body"),
  timeLabel: text("time_label"),
  unread: boolean("unread").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const notificationRules = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  detail: text("detail"),
  channels: text("channels"),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const receiptItems = pgTable("receipt_items", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
  unit: numeric("unit", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
