/**
 * Database connection (Supabase Postgres via postgres.js + Drizzle).
 *
 * `DATABASE_URL` is injected by the Supabase integration on Vercel (or set in
 * .env.local for local dev). When it's absent the app runs entirely on the
 * mock data fallback — so the project builds and runs before you provision.
 *
 * Use the Supabase **connection pooler** URL (port 6543) here; pgbouncer in
 * transaction mode requires `prepare: false`.
 *
 * Why the pool can be thrown away (`resetDb`): on Vercel the function instance
 * is frozen between requests, and a pooled connection that sat idle through a
 * freeze can come back dead without the socket ever saying so — the next query
 * on it simply never answers. That was the "infinite load" after coming back
 * to the app (every Home read timing out at once, /me and /people pinned for
 * 300 s). Idle connections are now closed quickly, every connection is
 * recycled on a schedule, and any read that trips its watchdog swaps the whole
 * pool for a fresh one so the rest of the request (and the next request)
 * reconnects instead of waiting on a dead socket.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Accept either our own DATABASE_URL or the names the Vercel→Supabase
// integration injects (POSTGRES_URL = pooled transaction connection).
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const isDbConfigured = Boolean(connectionString);

type Client = ReturnType<typeof postgres>;
type Db = PostgresJsDatabase<typeof schema>;

// Reuse the client across hot reloads / serverless invocations.
const g = globalThis as unknown as { __zhqClient?: Client; __zhqDb?: Db };

function makeClient(): Client {
  return postgres(connectionString!, {
    prepare: false,
    // Small per-instance pool: Fluid Compute shares one instance (and this
    // pool) across concurrent requests, and a Home render fans out a dozen
    // reads at once — the pool serialises what doesn't fit.
    max: 6,
    // Close idle connections fast and recycle every one on a schedule — an
    // idle connection is the one that goes stale (see the header comment).
    // Reconnecting in-region costs tens of milliseconds.
    idle_timeout: 10,
    max_lifetime: 60 * 5,
    // A connection attempt the pooler never answers fails fast and the read
    // renders its empty state instead of pinning the page.
    connect_timeout: 5,
    // One query in flight per connection; concurrency comes from the pool.
    // (max_pipeline is a real postgres.js option its types don't declare.)
    max_pipeline: 1,
  } as postgres.Options<Record<string, postgres.PostgresType>> & { max_pipeline: number });
}
const makeDb = (c: Client): Db => drizzle(c, { schema });

/** The Drizzle handle. A live binding — `resetDb()` swaps it for a fresh pool. */
export let db: Db | null = connectionString ? (g.__zhqDb ??= makeDb((g.__zhqClient ??= makeClient()))) : null;

/**
 * Throw the pool away and start a new one. Queries still waiting on the old
 * pool reject within a second (so their watchdogs don't have to run out), and
 * everything after this reconnects.
 */
export function resetDb(reason: string) {
  if (!connectionString) return;
  const old = g.__zhqClient;
  console.error(`[db] resetting connection pool — ${reason}`);
  g.__zhqClient = makeClient();
  g.__zhqDb = makeDb(g.__zhqClient);
  db = g.__zhqDb;
  old?.end({ timeout: 1 }).catch(() => {});
}

export class DbTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} took longer than ${ms}ms`);
    this.name = "DbTimeoutError";
  }
}

/**
 * Race a read against a watchdog. When it trips, the pool is presumed stale
 * and reset, and the caller gets a DbTimeoutError — retry once on the fresh
 * pool if the read matters, or fall back to an empty state.
 */
export function withDbTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      resetDb(`${label} > ${ms}ms`);
      reject(new DbTimeoutError(label, ms));
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}
