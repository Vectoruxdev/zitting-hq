ALTER TABLE "family_members" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "auth_id" text;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "color" text;