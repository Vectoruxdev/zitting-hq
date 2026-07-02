/**
 * Database connection (Supabase Postgres via postgres.js + Drizzle).
 *
 * `DATABASE_URL` is injected by the Supabase integration on Vercel (or set in
 * .env.local for local dev). When it's absent the app runs entirely on the
 * mock data fallback — so the project builds and runs before you provision.
 *
 * Use the Supabase **connection pooler** URL (port 6543) here; pgbouncer in
 * transaction mode requires `prepare: false`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Accept either our own DATABASE_URL or the names the Vercel→Supabase
// integration injects (POSTGRES_URL = pooled transaction connection).
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const isDbConfigured = Boolean(connectionString);

// Reuse the client across hot reloads / serverless invocations.
const globalForDb = globalThis as unknown as {
  __zhqClient?: ReturnType<typeof postgres>;
};

const client = connectionString
  ? (globalForDb.__zhqClient ??= postgres(connectionString, {
      prepare: false,
      // Serverless: keep the per-instance pool tiny and fail fast instead of
      // hanging a request when the Supabase pooler is saturated — a hung read
      // here is what used to render the whole dashboard as $0.
      max: 4,
      idle_timeout: 20,
      connect_timeout: 10,
    }))
  : null;

export const db = client ? drizzle(client, { schema }) : null;
