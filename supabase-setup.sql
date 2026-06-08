-- =============================================================
-- Zitting Finance — Supabase setup (schema + seed)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- =============================================================

-- 1) SCHEMA
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

-- 2) SEED DATA
-- Zitting Finance seed data (generated offline from mockData.ts)
BEGIN;
TRUNCATE TABLE accounts, transactions, budgets, allocation_rules, income_streams, bills, savings_goals, transfers, notifications, notification_rules, receipt_items, family_members RESTART IDENTITY CASCADE;

-- family_members
INSERT INTO family_members (id, name, role) VALUES
('jared', 'Jared', 'owner'),
('sarah', 'Sarah', 'member'),
('rebecca', 'Rebecca', 'member');

-- accounts
INSERT INTO accounts (id, name, institution, mask, type, balance, who, synced_label, status, dest_label, trend, sort_order) VALUES
('main', 'Main Checking', 'Mountain America CU', '4021', 'checking', 12480.22, 'Household', '2m ago', 'good', NULL, '[11200,9800,13400,10200,14100,12480]'::jsonb, 0),
('bills', 'Bills account', 'Mountain America CU', '8847', 'checking', 2140, 'Household', '2m ago', 'good', 'Bills', '[1800,2300,900,2600,1400,2140]'::jsonb, 1),
('tithing', 'Tithing', 'Ally Bank', '6610', 'checking', 0, 'Household', '2m ago', 'good', 'Tithing', '[540,0,600,0,540,0]'::jsonb, 2),
('emergency', 'Emergency Fund', 'Ally Bank', '3390', 'savings', 48200, 'Household', '5m ago', 'good', 'Savings', '[42000,43800,44900,46100,47200,48200]'::jsonb, 3),
('sarah-wallet', 'Sarah''s wallet', 'Ally Bank', '1192', 'savings', 185.4, 'Sarah', '5m ago', 'good', 'Allowance', '[400,320,260,410,300,185]'::jsonb, 4),
('amex', 'Amex Everyday', 'American Express', '3008', 'credit', -2140.66, 'Household', '1h ago', 'good', NULL, '[-1800,-2400,-1500,-2900,-1700,-2141]'::jsonb, 5),
('visa', 'Costco Visa', 'Citi', '7725', 'credit', -612.1, 'Jared', 'Needs attention', 'attention', NULL, '[-300,-800,-450,-900,-500,-612]'::jsonb, 6);

-- transactions
INSERT INTO transactions (date_label, merchant, category, color, who, account_label, amount, income, pending, flagged, sort_order) VALUES
('Jun 4', 'Harmons Grocery', 'Groceries', 'var(--indigo-500)', 'Sarah', 'Amex ••3008', -84.21, FALSE, FALSE, FALSE, 0),
('Jun 3', 'ADP Payroll', 'Income', 'var(--green-500)', 'Jared', 'Main Checking', 4000, TRUE, FALSE, FALSE, 1),
('Jun 3', 'Chick-fil-A', 'Dining', 'var(--amber-500)', 'Rebecca', 'Amex ••3008', -18.75, FALSE, TRUE, FALSE, 2),
('Jun 2', 'Rocky Mtn Power', 'Utilities', 'var(--gray-500)', 'Household', 'Bills account', -142.66, FALSE, FALSE, FALSE, 3),
('Jun 2', 'Target', 'Shopping', 'var(--green-600)', 'Sarah', 'Amex ••3008', -36.4, FALSE, FALSE, TRUE, 4),
('Jun 1', 'From the Farm', 'Income', 'var(--green-500)', 'Jared', 'Main Checking', 1250, TRUE, FALSE, FALSE, 5);

-- budgets
INSERT INTO budgets (name, who, icon, spent, limit_amount, sort_order) VALUES
('Sarah''s allowance', 'Sarah', NULL, 215, 400, 0),
('Rebecca''s allowance', 'Rebecca', NULL, 380, 400, 1),
('Groceries', NULL, 'pie', 312, 600, 2),
('Dining', NULL, 'list', 360, 400, 3);

-- allocation_rules
INSERT INTO allocation_rules (id, name, method, value, dest, icon, sort_order) VALUES
('tithe', 'Tithe', '%', 15, 'Tithing account', 'dollar', 0),
('bills', 'Bills', 'Fixed', 1200, 'Bills account', 'repeat', 1),
('groceries', 'Groceries', 'Fixed', 600, 'Groceries budget', 'pie', 2),
('sarah', 'Sarah''s allowance', 'Fixed', 400, 'Sarah''s wallet', 'wallet', 3),
('savings', 'Savings', 'Remainder', NULL, 'Emergency Fund', 'target', 4);

-- income_streams
INSERT INTO income_streams (id, name, sub, monthly, cadence, last_label, next_label, status, spark, sort_order) VALUES
('adp', 'ADP Payroll', 'Jared · Zitting Dental', 8400, 'Twice monthly', 'Jun 1', 'Jun 15', 'on-track', '[8200,8400,8400,8400,8400,8400]'::jsonb, 0),
('farm', 'From the Farm', 'Seasonal · variable', 1250, 'Monthly', 'Jun 1', 'Jul 1', 'on-track', '[600,900,1100,1400,1250,1250]'::jsonb, 1),
('sarah-job', 'Sarah — Etsy shop', 'Side income', 420, 'Monthly', 'May 28', 'Jun 28', 'on-track', '[180,240,310,360,400,420]'::jsonb, 2),
('rental', 'Basement rental', 'Tenant · Mark P.', 1100, 'Monthly', 'May 3', 'Jun 3', 'late', '[1100,1100,1100,1100,1100,0]'::jsonb, 3);

-- bills
INSERT INTO bills (name, category, color, amount, freq, next_label, account_label, badge, delta, sort_order) VALUES
('Rocky Mountain Power', 'Utilities', 'var(--gray-500)', 142.66, 'Monthly', 'Jun 18', 'Bills ••8847', 'changed', '+$22', 0),
('Xfinity Internet', 'Utilities', 'var(--gray-500)', 89.99, 'Monthly', 'Jun 12', 'Bills ••8847', 'due soon', NULL, 1),
('Mortgage — MACU', 'Housing', 'var(--green-500)', 1890, 'Monthly', 'Jul 1', 'Main ••4021', NULL, NULL, 2),
('State Farm Auto', 'Insurance', 'var(--indigo-500)', 184.5, 'Monthly', 'Jun 22', 'Main ••4021', NULL, NULL, 3),
('Netflix', 'Subscriptions', 'var(--amber-500)', 22.99, 'Monthly', 'Jun 14', 'Amex ••3008', 'new', NULL, 4),
('Spotify Family', 'Subscriptions', 'var(--amber-500)', 16.99, 'Monthly', 'Jun 20', 'Amex ••3008', NULL, NULL, 5),
('iCloud+ 2TB', 'Subscriptions', 'var(--amber-500)', 9.99, 'Monthly', 'Jun 9', 'Amex ••3008', 'due soon', NULL, 6),
('Gym — VASA', 'Health', 'var(--green-600)', 38, 'Monthly', 'Jun 25', 'Amex ••3008', NULL, NULL, 7);

-- savings_goals
INSERT INTO savings_goals (id, name, saved, target, date_label, account_label, contrib, sort_order) VALUES
('ef', 'Emergency Fund', 48200, 60000, 'Dec 2026', 'Ally ••3390', 1200, 0),
('trip', 'Family trip — Hawaii', 3400, 9000, 'Mar 2027', 'Ally ••3390', 400, 1),
('car', 'New van', 14800, 38000, 'Aug 2027', 'Ally ••3390', 600, 2),
('mission', 'Mission fund — Caleb', 6200, 12000, '2028', 'Ally ••3390', 250, 3);

-- transfers
INSERT INTO transfers (to_label, from_label, amount, due_label, state, icon, kind, sort_order) VALUES
('Tithing', 'Main Checking', 600, 'Due Jun 1', 'todo', 'dollar', 'upcoming', 0),
('Bills account', 'Main Checking', 1200, 'Auto', 'auto', 'repeat', 'upcoming', 1),
('Groceries budget', 'Main Checking', 600, 'Due Jun 1', 'todo', 'pie', 'upcoming', 2),
('Sarah''s allowance', 'Main Checking', 400, 'Due Jun 1', 'done', 'wallet', 'upcoming', 3),
('Emergency Fund', 'Main Checking', 1200, 'Due Jun 1', 'todo', 'target', 'upcoming', 4),
('Tithing', 'Main Checking', 540, 'May 1', 'auto', 'dollar', 'past', 0),
('Bills account', 'Main Checking', 1200, 'May 1', 'auto', 'repeat', 'past', 1),
('Emergency Fund', 'Main Checking', 980, 'May 1', 'done', 'target', 'past', 2);

-- notifications
INSERT INTO notifications (type, icon, tone, title, body, time_label, unread, sort_order) VALUES
('transfers', 'transfers', 'accent', 'Transfers ready', '$4,000 income arrived — 5 transfers totaling $4,000 are ready to send.', 'Just now', TRUE, 0),
('bill', 'repeat', 'warning', 'Bill amount changed', 'Rocky Mountain Power is $142.66 this month, up $22 from May.', '2h ago', TRUE, 1),
('sub', 'alert', 'info', 'New subscription detected', 'Netflix — $22.99/mo on Amex ••3008.', '5h ago', TRUE, 2),
('budget', 'pie', 'negative', 'Allowance overspent', 'Rebecca is $0 left with 22 days to go in June.', 'Yesterday', FALSE, 3),
('income', 'trendingUp', 'warning', 'Income looks late', 'Basement rental ($1,100) was expected Jun 3 and hasn’t arrived.', 'Yesterday', FALSE, 4),
('txn', 'flag', 'warning', 'Large charge flagged', 'Target — $36.40 by Sarah was auto-flagged (over your $35 alert).', '2d ago', FALSE, 5);

-- notification_rules
INSERT INTO notification_rules (name, detail, channels, enabled, sort_order) VALUES
('Any charge over $100', 'All accounts · notify Jared', 'Push · Email', TRUE, 0),
('New subscription detected', 'All accounts · notify Jared', 'Push', TRUE, 1),
('Allowance over budget', 'Each member · notify owner + member', 'Push', TRUE, 2),
('Income missing > 2 days', 'All income streams', 'Email', TRUE, 3),
('Sarah''s charges over $35', 'Amex ••3008 · notify Jared', 'Push', FALSE, 4);

-- receipt_items
INSERT INTO receipt_items (item, qty, unit, total, sort_order) VALUES
('Organic bananas', 2, 1.18, 2.36, 0),
('Whole milk, 1 gal', 1, 3.98, 3.98, 1),
('Chicken breast', 1, 11.42, 11.42, 2),
('Sourdough bread', 2, 4.49, 8.98, 3),
('Eggs, 18 ct', 1, 5.29, 5.29, 4),
('Spinach', 1, 3.18, 3.18, 5);
COMMIT;
