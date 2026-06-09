CREATE TABLE "transfer_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text,
	"from_account_id" text,
	"to_account_id" text,
	"member_id" text,
	"amount" numeric(14, 2) NOT NULL,
	"method" text,
	"planned_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_by" text,
	"trigger_income_txn_id" integer,
	"completed_txn_id" integer,
	"completed_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD COLUMN "from_account_id" text;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD COLUMN "to_account_id" text;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD COLUMN "trigger" text DEFAULT 'on_income' NOT NULL;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD COLUMN "income_match" text;--> statement-breakpoint
ALTER TABLE "transfer_instances" ADD CONSTRAINT "transfer_instances_rule_id_allocation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."allocation_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_instances" ADD CONSTRAINT "transfer_instances_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_instances" ADD CONSTRAINT "transfer_instances_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_instances" ADD CONSTRAINT "transfer_instances_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_instances" ADD CONSTRAINT "transfer_instances_completed_txn_id_transactions_id_fk" FOREIGN KEY ("completed_txn_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ti_status" ON "transfer_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ti_rule" ON "transfer_instances" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_ti_income" ON "transfer_instances" USING btree ("trigger_income_txn_id");--> statement-breakpoint
CREATE INDEX "idx_ti_accounts" ON "transfer_instances" USING btree ("from_account_id","to_account_id","status");--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;