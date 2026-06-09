-- Zitting Finance — People & invitations (migration 0003). Run in Supabase SQL Editor.

ALTER TABLE "family_members" ADD COLUMN "email" text;
ALTER TABLE "family_members" ADD COLUMN "auth_id" text;
ALTER TABLE "family_members" ADD COLUMN "status" text DEFAULT 'none' NOT NULL;
ALTER TABLE "family_members" ADD COLUMN "color" text;