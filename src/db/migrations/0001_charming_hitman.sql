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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "category_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "column_mapping_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text,
	"bank" text,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "transaction_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"category_id" text,
	"amount" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "date_label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "who" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "who" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "import_batch_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transfer_pair_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "dedupe_hash" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "has_split" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "column_mapping_templates" ADD CONSTRAINT "column_mapping_templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rules_enabled" ON "categorization_rules" USING btree ("enabled","priority");--> statement-breakpoint
CREATE INDEX "idx_splits_txn" ON "transaction_splits" USING btree ("transaction_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_txn_account" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_txn_category" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_txn_member" ON "transactions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_txn_date" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_txn_batch" ON "transactions" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "idx_txn_dedupe" ON "transactions" USING btree ("account_id","dedupe_hash");