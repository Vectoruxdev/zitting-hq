-- =============================================================
-- Zitting Finance — Categories + Import migration (schema + reset + taxonomy)
-- Paste into Supabase → SQL Editor → Run. Safe to run once on the existing DB.
-- =============================================================

-- 1) SCHEMA (new tables, transaction columns, FKs, indexes)
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_id" text,
	"color" text DEFAULT 'var(--gray-500)' NOT NULL,
	"icon" text,
	"kind" text DEFAULT 'expense' NOT NULL,
	"exclude_from_budget" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "categorization_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_type" text DEFAULT 'contains' NOT NULL,
	"match_value" text NOT NULL,
	"field" text DEFAULT 'merchant' NOT NULL,
	"category_id" text,
	"member" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "category_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "column_mapping_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text,
	"bank" text,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"filename" text,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	"undone_at" timestamp
);

CREATE TABLE "transaction_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"category_id" text,
	"amount" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "transactions" ALTER COLUMN "date_label" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "who" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "who" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "account_label" DROP NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "date" date;
ALTER TABLE "transactions" ADD COLUMN "account_id" text;
ALTER TABLE "transactions" ADD COLUMN "category_id" text;
ALTER TABLE "transactions" ADD COLUMN "member_id" text;
ALTER TABLE "transactions" ADD COLUMN "import_batch_id" text;
ALTER TABLE "transactions" ADD COLUMN "is_transfer" boolean DEFAULT false NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "transfer_pair_id" integer;
ALTER TABLE "transactions" ADD COLUMN "dedupe_hash" text;
ALTER TABLE "transactions" ADD COLUMN "notes" text;
ALTER TABLE "transactions" ADD COLUMN "has_split" boolean DEFAULT false NOT NULL;
ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "column_mapping_templates" ADD CONSTRAINT "column_mapping_templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_rules_enabled" ON "categorization_rules" USING btree ("enabled","priority");
CREATE INDEX "idx_splits_txn" ON "transaction_splits" USING btree ("transaction_id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_txn_account" ON "transactions" USING btree ("account_id");
CREATE INDEX "idx_txn_category" ON "transactions" USING btree ("category_id");
CREATE INDEX "idx_txn_member" ON "transactions" USING btree ("member_id");
CREATE INDEX "idx_txn_date" ON "transactions" USING btree ("date");
CREATE INDEX "idx_txn_batch" ON "transactions" USING btree ("import_batch_id");
CREATE INDEX "idx_txn_dedupe" ON "transactions" USING btree ("account_id","dedupe_hash");
-- 2) RESET + SEED (members + category taxonomy, no demo data)
-- Reset finance data + seed members and category taxonomy (no demo data).
BEGIN;
TRUNCATE TABLE
  transaction_splits, transactions, import_batches,
  categorization_rules, column_mapping_templates,
  categories, category_groups,
  accounts, budgets, allocation_rules, income_streams, bills,
  savings_goals, transfers, notifications, notification_rules, receipt_items,
  family_members
  RESTART IDENTITY CASCADE;

-- family_members
INSERT INTO family_members (id, name, role) VALUES
('jared', 'Jared', 'owner'),
('sarah', 'Sarah', 'member'),
('rebecca', 'Rebecca', 'member'),
('household', 'Household', 'member');

-- category_groups
INSERT INTO category_groups (id, name, sort_order) VALUES
('income', 'Income', 0),
('essentials', 'Essentials', 1),
('lifestyle', 'Lifestyle', 2),
('transfers', 'Transfers', 3),
('other', 'Other', 4);

-- categories
INSERT INTO categories (id, name, group_id, color, icon, kind, exclude_from_budget, sort_order) VALUES
('paycheck', 'Paycheck', 'income', 'var(--green-500)', 'trendingUp', 'income', FALSE, 0),
('other-income', 'Other income', 'income', 'var(--green-400)', 'dollar', 'income', FALSE, 1),
('housing', 'Housing', 'essentials', 'var(--green-500)', 'wallet', 'expense', FALSE, 0),
('utilities', 'Utilities', 'essentials', 'var(--gray-500)', 'repeat', 'expense', FALSE, 1),
('groceries', 'Groceries', 'essentials', 'var(--indigo-500)', 'list', 'expense', FALSE, 2),
('insurance', 'Insurance', 'essentials', 'var(--indigo-400)', 'target', 'expense', FALSE, 3),
('transportation', 'Transportation', 'essentials', 'var(--gray-500)', 'transfers', 'expense', FALSE, 4),
('dining', 'Dining', 'lifestyle', 'var(--amber-500)', 'list', 'expense', FALSE, 0),
('shopping', 'Shopping', 'lifestyle', 'var(--green-600)', 'receipt', 'expense', FALSE, 1),
('entertainment', 'Entertainment', 'lifestyle', 'var(--indigo-500)', 'sparkles', 'expense', FALSE, 2),
('subscriptions', 'Subscriptions', 'lifestyle', 'var(--amber-500)', 'repeat', 'expense', FALSE, 3),
('health', 'Health', 'lifestyle', 'var(--green-600)', 'target', 'expense', FALSE, 4),
('kids', 'Kids', 'lifestyle', 'var(--green-600)', 'sparkles', 'expense', FALSE, 5),
('transfer', 'Transfer', 'transfers', 'var(--gray-500)', 'transfers', 'transfer', TRUE, 0),
('tithing', 'Tithing', 'transfers', 'var(--green-500)', 'dollar', 'transfer', TRUE, 1),
('savings-contrib', 'Savings', 'transfers', 'var(--indigo-500)', 'target', 'transfer', TRUE, 2),
('uncategorized', 'Uncategorized', 'other', 'var(--gray-500)', 'list', 'expense', FALSE, 0);
COMMIT;
