-- =============================================================
-- Zitting Finance — Auto-categorization upgrade (migration 0002)
-- Paste into Supabase → SQL Editor → Run.
-- =============================================================

CREATE TABLE "merchant_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_key" text NOT NULL,
	"category_id" text,
	"member" text,
	"count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);

ALTER TABLE "transactions" ADD COLUMN "category_source" text;
ALTER TABLE "transactions" ADD COLUMN "category_confidence" numeric(4, 3);
ALTER TABLE "transactions" ADD COLUMN "reviewed" boolean DEFAULT false NOT NULL;
ALTER TABLE "merchant_memory" ADD CONSTRAINT "merchant_memory_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_merchant_memory_key" ON "merchant_memory" USING btree ("merchant_key");