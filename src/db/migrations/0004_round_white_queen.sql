ALTER TABLE "budgets" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;