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
} from "drizzle-orm/pg-core";

export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(), // e.g. "jared", "sarah"
  name: text("name").notNull(),
  role: text("role").notNull().default("member"), // owner | member
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(), // e.g. "main", "amex"
  name: text("name").notNull(),
  institution: text("institution").notNull(),
  mask: text("mask"),
  type: text("type").notNull(), // checking | savings | credit
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  who: text("who").notNull().default("Household"),
  syncedLabel: text("synced_label"),
  status: text("status").notNull().default("good"), // good | attention
  destLabel: text("dest_label"), // transfer-destination tag, if any
  trend: jsonb("trend").$type<number[]>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  dateLabel: text("date_label").notNull(), // e.g. "Jun 4"
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  color: text("color"), // CSS var for the category chip
  who: text("who").notNull().default("Household"),
  accountLabel: text("account_label").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  income: boolean("income").notNull().default(false),
  pending: boolean("pending").notNull().default(false),
  flagged: boolean("flagged").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  who: text("who"), // null = shared/category budget
  icon: text("icon"),
  spent: numeric("spent", { precision: 14, scale: 2 }).notNull().default("0"),
  limitAmount: numeric("limit_amount", { precision: 14, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const allocationRules = pgTable("allocation_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").notNull(), // "%" | "Fixed" | "Remainder"
  value: numeric("value", { precision: 14, scale: 2 }), // null for Remainder
  dest: text("dest").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
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

export const savingsGoals = pgTable("savings_goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  saved: numeric("saved", { precision: 14, scale: 2 }).notNull().default("0"),
  target: numeric("target", { precision: 14, scale: 2 }).notNull(),
  dateLabel: text("date_label"),
  accountLabel: text("account_label"),
  contrib: numeric("contrib", { precision: 14, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});

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

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  icon: text("icon"),
  tone: text("tone").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body"),
  timeLabel: text("time_label"),
  unread: boolean("unread").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
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
