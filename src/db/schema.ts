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
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(), // slug or uuid
  name: text("name").notNull(),
  role: text("role").notNull().default("member"), // owner | partner | member
  email: text("email"), // links to a login (auth user), if any
  authId: text("auth_id"), // Supabase auth user id, once invited/created
  status: text("status").notNull().default("none"), // none | invited | active
  color: text("color"), // avatar tone
  allowance: numeric("allowance", { precision: 14, scale: 2 }), // monthly spending money (owner-set); null = none
  digestOptIn: boolean("digest_opt_in").notNull().default(true), // receives the email spending digest
  lastSeenAt: timestamp("last_seen_at"), // last time they opened the app (presence = they've signed in)
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
  // Point-in-time AVAILABLE balance from the bank (spendable after pending holds),
  // captured on each Plaid sync. `balance` (above) is the OPENING balance and the
  // displayed primary number is the CURRENT balance (opening + txn net). Available
  // is shown as a secondary figure on the card. Null when the bank doesn't report it.
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
  who: text("who").notNull().default("Household"),
  // Which workspace this account belongs to. "business" accounts are hidden from
  // the personal/household dashboard + emails and skipped by Plaid sync. (Seam
  // for a future Business tab.)
  space: text("space").notNull().default("household"), // household | business
  // Declutter only: "collapsed" accounts are still fully counted everywhere, but
  // on the Accounts screen they're tucked into a single combined "Other accounts"
  // card instead of each getting its own card. (Distinct from `space=business`,
  // which excludes from counting + sync.)
  collapsed: boolean("collapsed").notNull().default(false),
  syncedLabel: text("synced_label"),
  status: text("status").notNull().default("good"), // good | attention
  destLabel: text("dest_label"), // transfer-destination tag, if any
  trend: jsonb("trend").$type<number[]>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Which members are "in charge of" an account (categorize its transactions).
// Up to 2 per account (enforced in the UI). Household-shared — not split per person.
export const accountMembers = pgTable(
  "account_members",
  {
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.memberId] }), index("idx_acctmem_member").on(t.memberId)]
);

// ---- Import batches -----------------------------------------------------

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(), // uuid
  accountId: text("account_id").references(() => accounts.id),
  filename: text("filename"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsImported: integer("rows_imported").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  source: text("source").notNull().default("csv"), // csv | plaid — how the rows arrived
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
    // Who manually set/changed the category (and when). Null until a person
    // deliberately categorizes it — auto-categorization does not set these.
    categorizedBy: text("categorized_by").references(() => familyMembers.id),
    categorizedAt: timestamp("categorized_at"),
    // Core fields
    merchant: text("merchant").notNull(), // cleaned/display name (e.g. "Netflix")
    // Full raw bank text when richer than `merchant` (e.g. "NETFLIX.COM 866-579-7172 CA").
    // Helps people identify ambiguous charges when categorizing. Null = no extra detail.
    description: text("description"),
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
  // stored column is just a fallback for rows with no linked target.
  spent: numeric("spent", { precision: 14, scale: 2 }).notNull().default("0"),
  limitAmount: numeric("limit_amount", { precision: 14, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * Allocation / transfer rules — the unified engine for "where money should move".
 * The Allocations tab configures these; the Transfers tab generates `transfer_instances`
 * from them (waterfall over an income amount). `dest` is a denormalized display label
 * kept in sync from the linked accounts/member on write.
 */
export const allocationRules = pgTable("allocation_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").notNull(), // "%" | "Fixed" | "Remainder"
  value: numeric("value", { precision: 14, scale: 2 }), // null for Remainder
  dest: text("dest").notNull(), // denormalized label (derived from toAccount/member)
  fromAccountId: text("from_account_id").references(() => accounts.id), // source
  toAccountId: text("to_account_id").references(() => accounts.id), // destination (required in mutation)
  memberId: text("member_id").references(() => familyMembers.id), // optional person tag
  trigger: text("trigger").notNull().default("on_income"), // manual | on_income | scheduled
  enabled: boolean("enabled").notNull().default(true),
  incomeMatch: text("income_match"), // optional merchant/stream key; null = any income
  // Time-based scheduling (trigger = "scheduled"). The cron generates a planned
  // transfer each cycle. Scheduled rules are Fixed-amount (see mutations).
  cadence: text("cadence"), // weekly | biweekly | semimonthly | monthly | quarterly | yearly (null = not scheduled)
  anchorDate: date("anchor_date"), // reference date: weekday (weekly) or day-of-month (monthly+)
  nextRunDate: date("next_run_date"), // when the next planned transfer generates
  lastRunDate: date("last_run_date"), // audit / catch-up bookkeeping
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * A real transfer occurrence — the pending checklist AND the history. Generated
 * from a rule when income arrives, or created manually. Auto-completed when the
 * actual transfer transaction is detected on import (completedTxnId).
 */
export const transferInstances = pgTable(
  "transfer_instances",
  {
    id: serial("id").primaryKey(),
    ruleId: text("rule_id").references(() => allocationRules.id), // null = manual one-off
    fromAccountId: text("from_account_id").references(() => accounts.id),
    toAccountId: text("to_account_id").references(() => accounts.id),
    memberId: text("member_id").references(() => familyMembers.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    method: text("method"), // %|Fixed|Remainder|manual (snapshot at generation)
    plannedDate: date("planned_date"),
    status: text("status").notNull().default("pending"), // pending | done | auto | skipped
    triggeredBy: text("triggered_by"), // manual | income:<txnId> | import:<batchId>
    triggerIncomeTxnId: integer("trigger_income_txn_id"), // idempotency key
    completedTxnId: integer("completed_txn_id").references(() => transactions.id),
    completedAt: timestamp("completed_at"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("idx_ti_status").on(t.status),
    index("idx_ti_rule").on(t.ruleId),
    index("idx_ti_income").on(t.triggerIncomeTxnId),
    index("idx_ti_accounts").on(t.fromAccountId, t.toAccountId, t.status),
  ]
);

/**
 * Performance-based allowance rules. An "earner" member has an income goal and a
 * minimum allowance floor; when their tagged paychecks beat the goal a bonus is
 * computed (fixed $ or % of the overage / whole income) and split across recipient
 * members (`allowance_splits`); the earner keeps the remainder. Firing a rule emits
 * SUGGESTED transfers into `transfer_instances` (not real bank moves) that
 * auto-complete via `reconcilePendingTransfers` once Plaid sees the real transfer.
 * The displayed/derived per-period status is computed in getFinanceData.
 */
export const allowanceRules = pgTable("allowance_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  memberId: text("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }), // the earner
  enabled: boolean("enabled").notNull().default(true),
  period: text("period").notNull().default("monthly"), // monthly | per_paycheck (goal is in this unit)
  goalAmount: numeric("goal_amount", { precision: 14, scale: 2 }).notNull(),
  minAmount: numeric("min_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  bonusType: text("bonus_type").notNull().default("percent"), // percent | fixed
  bonusBasis: text("bonus_basis").notNull().default("overage"), // overage | gross (ignored when fixed)
  bonusValue: numeric("bonus_value", { precision: 14, scale: 2 }).notNull().default("0"),
  // Merchant keys that identify the earner's paychecks; null = all income tagged to the earner.
  incomeMatchKeys: jsonb("income_match_keys").$type<string[]>(),
  fromAccountId: text("from_account_id").notNull().references(() => accounts.id), // transfer source
  toAccountId: text("to_account_id").notNull().references(() => accounts.id), // earner's deposit account
  gateOnReview: boolean("gate_on_review").notNull().default(true), // monthly only: require prev month reviewed
  lastProcessedPeriod: text("last_processed_period"), // monthly idempotency/settle bookkeeping (e.g. "2026-5")
  createdAt: timestamp("created_at").defaultNow(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Bonus recipients for an allowance rule (the earner is the implicit remainder). */
export const allowanceSplits = pgTable(
  "allowance_splits",
  {
    id: serial("id").primaryKey(),
    ruleId: text("rule_id").notNull().references(() => allowanceRules.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }), // recipient
    pct: numeric("pct", { precision: 5, scale: 2 }).notNull(),
    toAccountId: text("to_account_id").notNull().references(() => accounts.id), // recipient's deposit account
  },
  (t) => [
    uniqueIndex("uq_allowance_split").on(t.ruleId, t.memberId),
    index("idx_allowance_splits_rule").on(t.ruleId),
  ]
);

/**
 * Manually-entered / adjusted expected income for the transfer-coverage forecast.
 * A row with `sourceKey` overrides that detected source's auto-forecast occurrence
 * (the "adjust this paycheck"); without it, a standalone one-off expected deposit
 * (e.g. a bonus). Feeds `data.transferReadiness`. Cleared by the user.
 */
export const expectedIncome = pgTable("expected_income", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  expectedDate: date("expected_date").notNull(),
  sourceKey: text("source_key"), // detected merchant key being overridden; null = one-off
  accountId: text("account_id").references(() => accounts.id), // deposit target (for source matching)
  status: text("status").notNull().default("pending"), // pending | received | skipped
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Curated income registry — the single source of truth for "what counts as
 * income." The user marks a payer (by merchant key) as income; ALL deposits from
 * that payer (past + future) then count, and ONLY marked sources drive the
 * transfer-coverage forecast and the allowance paycheck math. (The raw
 * `transactions.income` boolean is just amount>0 and is too broad.)
 */
export const incomeSources = pgTable("income_sources", {
  id: text("id").primaryKey(),
  matchKey: text("match_key").notNull().unique(), // extractMerchant key identifying the payer
  name: text("name").notNull(),
  memberId: text("member_id").references(() => familyMembers.id), // whose income; null = household
  accountId: text("account_id").references(() => accounts.id), // deposit account (for coverage matching)
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
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

/**
 * Savings goals — a target to save toward (emergency fund, trip, car…). `saved`
 * is DERIVED at read time from the savings_contributions ledger (the stored
 * column is just a legacy fallback), mirroring how account balances and budget
 * spend are derived. A goal is `household` (everyone sees it) or `private` (only
 * the linked savingsGoalMembers + owners can see it — filtered server-side).
 */
export const savingsGoals = pgTable("savings_goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  saved: numeric("saved", { precision: 14, scale: 2 }).notNull().default("0"), // legacy fallback; derived from contributions
  target: numeric("target", { precision: 14, scale: 2 }).notNull(),
  dateLabel: text("date_label"), // legacy free-form label; superseded by targetDate
  targetDate: date("target_date"), // real date for the projection math
  accountId: text("account_id").references(() => accounts.id), // optional linked savings account
  accountLabel: text("account_label"),
  contrib: numeric("contrib", { precision: 14, scale: 2 }).notNull().default("0"), // legacy; superseded by autoContrib
  autoContrib: numeric("auto_contrib", { precision: 14, scale: 2 }).notNull().default("0"), // planned recurring monthly contribution
  icon: text("icon"), // emoji or DS icon name
  color: text("color").notNull().default("var(--accent)"),
  goalType: text("goal_type").notNull().default("custom"), // emergency | vacation | home | car | sinking | custom
  visibility: text("visibility").notNull().default("household"), // household | private
  notes: text("notes"),
  createdBy: text("created_by"), // email
  archivedAt: timestamp("archived_at"), // set when completed/archived
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Members a private goal belongs to. Empty for household goals. */
export const savingsGoalMembers = pgTable(
  "savings_goal_members",
  {
    id: serial("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_goal_members_goal").on(t.goalId)]
);

/** Funding ledger — `saved` per goal is the sum of these (signed: + deposit, − withdrawal/reallocation). */
export const savingsContributions = pgTable(
  "savings_contributions",
  {
    id: serial("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date"),
    kind: text("kind").notNull().default("manual"), // manual | auto | initial | reallocation
    memberId: text("member_id").references(() => familyMembers.id), // who contributed (optional)
    accountId: text("account_id").references(() => accounts.id), // source account (optional)
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_contrib_goal").on(t.goalId)]
);

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

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    icon: text("icon"),
    tone: text("tone").notNull().default("info"),
    title: text("title").notNull(),
    body: text("body"),
    timeLabel: text("time_label"), // legacy fallback; superseded by createdAt
    unread: boolean("unread").notNull().default(true),
    // Recipient routing: 'owners' (owner+partner), 'member' (the linked
    // memberId only), or 'all' (everyone). Scoped server-side in getFinanceData.
    audience: text("audience").notNull().default("owners"),
    memberId: text("member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    linkTo: text("link_to"), // optional route id the alert deep-links to
    dedupeKey: text("dedupe_key"), // idempotency — skip insert if one exists
    createdAt: timestamp("created_at").defaultNow(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_notif_member").on(t.memberId), index("idx_notif_dedupe").on(t.dedupeKey)]
);

// Per-event notification preferences (owner-controlled). One row per event key;
// missing rows default to fully on (fail-open) so notifications work before the
// migration runs. Gated at createNotification.
export const notificationPrefs = pgTable("notification_prefs", {
  event: text("event").primaryKey(), // new_transactions | large_charges | member_complete | member_nudges
  enabled: boolean("enabled").notNull().default(true),
  inApp: boolean("in_app").notNull().default(true),
  push: boolean("push").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Uploaded receipt images (private 'receipts' storage bucket; the app serves
// short-lived signed URLs). Matchable to a transaction. supabase-receipts.sql
// + supabase-receipt-scan.sql (extracted merchant/total/date + line items).
export const receipts = pgTable(
  "receipts",
  {
    id: text("id").primaryKey(), // uuid (DB default gen_random_uuid())
    storagePath: text("storage_path").notNull(),
    filename: text("filename"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    status: text("status").notNull().default("inbox"), // inbox | matched
    transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    uploadedBy: text("uploaded_by").references(() => familyMembers.id),
    note: text("note"),
    // Scan results (Claude vision): what the receipt says.
    merchant: text("merchant"),
    total: numeric("total", { precision: 14, scale: 2 }),
    receiptDate: date("receipt_date"),
    scanStatus: text("scan_status").notNull().default("none"), // none | scanned | failed | manual
    // Auto-match: confident matches set transactionId; ambiguous ones land here.
    suggestedTransactionId: integer("suggested_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_receipts_status").on(t.status), index("idx_receipts_txn").on(t.transactionId)]
);

/** Line items read off a receipt (scan or hand-typed) — the per-item breakdown
 *  shown on the matched transaction. */
export const receiptLines = pgTable(
  "receipt_lines",
  {
    id: serial("id").primaryKey(),
    receiptId: text("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    qty: numeric("qty", { precision: 10, scale: 2 }),
    price: numeric("price", { precision: 14, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_receipt_lines_receipt").on(t.receiptId)]
);

// ---- Plaid (automatic bank sync) -----------------------------------------
// A connected bank login (one Plaid Item = one institution login). The
// access_token is sensitive — it lives here server-side only, never sent to
// the client.
export const plaidItems = pgTable("plaid_items", {
  id: text("id").primaryKey(), // uuid
  itemId: text("item_id").notNull().unique(), // Plaid item_id
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"), // /transactions/sync cursor (incremental)
  status: text("status").notNull().default("good"), // good | login_required | error
  error: text("error"),
  createdBy: text("created_by"), // owner email
  createdAt: timestamp("created_at").defaultNow(),
  lastSyncedAt: timestamp("last_synced_at"),
});

// ---- Web Push (device notifications) -------------------------------------
// One row per browser/device push subscription. `role`/`memberId` snapshot who
// the device belongs to so a notification's audience can fan out to the right
// devices. Keyed by the unique push endpoint (re-subscribing upserts).
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    memberId: text("member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"), // owner | partner | member
    userEmail: text("user_email"), // for debugging / dedupe by person
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_push_member").on(t.memberId)]
);

// Maps a Plaid account to one of our accounts (created on first connect).
export const plaidAccounts = pgTable(
  "plaid_accounts",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id").notNull(), // → plaid_items.item_id
    plaidAccountId: text("plaid_account_id").notNull().unique(),
    accountId: text("account_id").references(() => accounts.id), // our account
    name: text("name"),
    mask: text("mask"),
    type: text("type"),
    subtype: text("subtype"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_plaid_acct_item").on(t.itemId)]
);

// ---- Email digests ------------------------------------------------------

/** Single-row household digest config (id always "household"). */
export const digestSettings = pgTable("digest_settings", {
  id: text("id").primaryKey().default("household"),
  cadence: text("cadence").notNull().default("monthly"), // weekly | biweekly | monthly
  enabled: boolean("enabled").notNull().default(true), // master switch
  ownerEnabled: boolean("owner_enabled").notNull().default(true), // owner gets the household overview
  membersEnabled: boolean("members_enabled").notNull().default(true), // members get their summaries
  anchorDate: date("anchor_date"), // cadence reference
  nextRunDate: date("next_run_date"), // when the next digest goes out
  lastRunDate: date("last_run_date"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Idempotency + audit: one row per (recipient, period, kind) actually sent. */
export const digestLog = pgTable(
  "digest_log",
  {
    id: serial("id").primaryKey(),
    recipientEmail: text("recipient_email").notNull(),
    kind: text("kind").notNull(), // owner | member
    memberId: text("member_id"),
    periodKey: text("period_key").notNull(), // e.g. "2026-06-09:weekly"
    status: text("status").notNull().default("sent"), // sent | failed
    error: text("error"),
    sentAt: timestamp("sent_at").defaultNow(),
  },
  (t) => [index("idx_digestlog_period").on(t.recipientEmail, t.periodKey, t.kind)]
);

// ============================================================================
// Household hub modules (beyond finance): Groceries, Meals, Calendar.
// Shared family spaces — every role may read/write (unlike finance privacy).
// Migrations: supabase-groceries.sql / supabase-meals.sql / supabase-calendar.sql
// ============================================================================

/** Shared shopping list. `source` tracks where a row came from (manual entry,
 *  a planned meal's ingredients, or a low-pantry nudge). Checked rows stay
 *  until "Clear bought" archives them (archivedAt). */
export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    note: text("note"), // qty / brand, e.g. "2 gal"
    category: text("category").notNull().default("other"), // produce | dairy | meat | pantry | frozen | household | other
    addedBy: text("added_by").references(() => familyMembers.id),
    checked: boolean("checked").notNull().default(false),
    source: text("source").notNull().default("manual"), // manual | meal | pantry
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("idx_shopping_active").on(t.archivedAt, t.checked)]
);

/** What's in the pantry and how much is left. Staples that hit `out` are the
 *  "we're going to miss this" list. */
export const pantryItems = pgTable(
  "pantry_items",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"),
    level: text("level").notNull().default("ok"), // ok | low | out
    staple: boolean("staple").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_pantry_level").on(t.level)]
);

/** Recipe box. Ingredients are a simple jsonb list so "send to shopping list"
 *  can expand them. */
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  ingredients: jsonb("ingredients").$type<{ name: string; qty?: string }[]>().notNull().default([]),
  notes: text("notes"),
  lastMadeOn: date("last_made_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** The week grid: one row per date+slot, pointing at a recipe or free text. */
export const mealPlan = pgTable(
  "meal_plan",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    slot: text("slot").notNull().default("dinner"), // breakfast | lunch | dinner
    recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    title: text("title"), // free text when no recipe ("Leftovers", "Pizza night")
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("uq_meal_slot").on(t.date, t.slot)]
);

/** Read-only Google Calendar feeds (secret iCal URLs pasted in-app) merged
 *  with lightweight in-app family events. No OAuth, never writes back. */
export const calendarFeeds = pgTable("calendar_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  url: text("url").notNull(), // private "secret address in iCal format"
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const familyEvents = pgTable(
  "family_events",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    date: date("date").notNull(), // start date
    endDate: date("end_date"), // inclusive; null = single day
    time: text("time"), // "18:30" — null = all-day
    color: text("color"),
    note: text("note"),
    createdBy: text("created_by").references(() => familyMembers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_family_events_date").on(t.date)]
);
