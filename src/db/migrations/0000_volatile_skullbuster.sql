CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"institution" text NOT NULL,
	"mask" text,
	"type" text NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"who" text DEFAULT 'Household' NOT NULL,
	"synced_label" text,
	"status" text DEFAULT 'good' NOT NULL,
	"dest_label" text,
	"trend" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"method" text NOT NULL,
	"value" numeric(14, 2),
	"dest" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text,
	"amount" numeric(14, 2) NOT NULL,
	"freq" text DEFAULT 'Monthly' NOT NULL,
	"next_label" text,
	"account_label" text,
	"badge" text,
	"delta" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"who" text,
	"icon" text,
	"spent" numeric(14, 2) DEFAULT '0' NOT NULL,
	"limit_amount" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "income_streams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sub" text,
	"monthly" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cadence" text,
	"last_label" text,
	"next_label" text,
	"status" text DEFAULT 'on-track' NOT NULL,
	"spark" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"detail" text,
	"channels" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"icon" text,
	"tone" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"time_label" text,
	"unread" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item" text NOT NULL,
	"qty" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"saved" numeric(14, 2) DEFAULT '0' NOT NULL,
	"target" numeric(14, 2) NOT NULL,
	"date_label" text,
	"account_label" text,
	"contrib" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_label" text NOT NULL,
	"merchant" text NOT NULL,
	"category" text NOT NULL,
	"color" text,
	"who" text DEFAULT 'Household' NOT NULL,
	"account_label" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"income" boolean DEFAULT false NOT NULL,
	"pending" boolean DEFAULT false NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_label" text NOT NULL,
	"from_label" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"due_label" text,
	"state" text DEFAULT 'todo' NOT NULL,
	"icon" text,
	"kind" text DEFAULT 'upcoming' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
