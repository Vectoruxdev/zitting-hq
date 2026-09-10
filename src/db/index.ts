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
import { isTransientDbError, noteDbFailure } from "./read-health";

// Accept either our own DATABASE_URL or the names the Vercel→Supabase
// integration injects (POSTGRES_URL = pooled transaction connection).
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const isDbConfigured = Boolean(connectionString);

type Client = ReturnType<typeof postgres>;
type Db = PostgresJsDatabase<typeof schema>;

// Reuse the client across hot reloads / serverless invocations.
const g = globalThis as unknown as { __zhqClient?: Client; __zhqDb?: Db };

/** How long a single query may go unanswered before it is retried on a fresh pool. */
const QUERY_STALL_MS = 4000;

function makeClient(): Client {
  const c = postgres(connectionString!, {
    prepare: false,
    // Small per-instance pool: Fluid Compute shares one instance (and this
    // pool) across concurrent requests, and a Home render fans out a dozen
    // reads at once — the pool serialises what doesn't fit.
    max: 4,
    // Close idle connections and recycle every one on a schedule — an idle
    // connection is the one that goes stale (see the header comment). 30 s
    // keeps a connection warm across a normal tap-tap-tap session; the
    // pooler is slow to accept a burst of fresh connections, so reconnecting
    // on every tap would cost more than it saves.
    idle_timeout: 30,
    max_lifetime: 60 * 5,
    // A connection attempt the pooler never answers fails fast and the read
    // renders its empty state instead of pinning the page.
    connect_timeout: 5,
    // One query in flight per connection; concurrency comes from the pool.
    // (max_pipeline is a real postgres.js option its types don't declare.)
    max_pipeline: 1,
  } as postgres.Options<Record<string, postgres.PostgresType>> & { max_pipeline: number });
  // Drizzle talks to postgres.js through `unsafe(query, params)` (and `.values()`
  // on the result). Wrapping it here gives EVERY query the stall watchdog below
  // without touching a single reader.
  const raw = c.unsafe.bind(c);
  (c as unknown as { __raw: typeof raw }).__raw = raw;
  (c as unknown as { unsafe: unknown }).unsafe = (query: string, params?: unknown[], options?: unknown) => guardedQuery(query, params, options);
  return c;
}
const makeDb = (c: Client): Db => drizzle(c, { schema });

type RawUnsafe = (query: string, params?: unknown[], options?: unknown) => { values(): Promise<unknown> } & PromiseLike<unknown>;
const rawOf = (c: Client) => (c as unknown as { __raw: RawUnsafe }).__raw;
const isRead = (q: string) => /^\s*(select|with|show|explain)\b/i.test(q);
const isDeadPool = (e: unknown) => e instanceof Error && /CONNECTION_(DESTROYED|ENDED|CLOSED)/.test(String((e as { code?: string }).code ?? e.message));

/**
 * The stall watchdog. A pooled socket that has gone quiet never errors — the
 * query just never answers (the "infinite load"). So: race every query against
 * a timer; when it trips, swap the pool and run the query again on fresh
 * connections. Only reads are re-run (a write that merely lost its reply must
 * not happen twice); a stalled write rejects with a clear error instead.
 */
function guardedQuery(query: string, params?: unknown[], options?: unknown) {
  const attempt = (mode: "rows" | "values") => {
    const pq = rawOf(g.__zhqClient!)(query, params, options);
    return mode === "values" ? pq.values() : Promise.resolve(pq);
  };
  const run = (mode: "rows" | "values") =>
    new Promise<unknown>((resolve, reject) => {
      let settled = false;
      // Whatever finally fails is noted for cached() (see read-health.ts), so an
      // empty answer produced by a dropped connection is never cached.
      const fail = (e: unknown) => { if (isTransientDbError(e)) noteDbFailure(e); reject(e); };
      const retry = (why: string) => {
        if (settled) return; settled = true;
        if (!isRead(query)) { fail(new DbTimeoutError(`write (${query.slice(0, 40)}…)`, QUERY_STALL_MS)); return; }
        resetDb(why);
        attempt(mode).then(resolve, fail);
      };
      const t = setTimeout(() => retry(`query stalled > ${QUERY_STALL_MS}ms`), QUERY_STALL_MS);
      attempt(mode).then(
        (v) => { if (settled) return; settled = true; clearTimeout(t); resolve(v); },
        (e) => { if (settled) return; clearTimeout(t); if (isDeadPool(e)) retry("query hit a dead pool"); else { settled = true; fail(e); } }
      );
    });
  // The shape Drizzle expects back: awaitable, with .values() for row arrays.
  return {
    then: (a?: (v: unknown) => unknown, b?: (e: unknown) => unknown) => run("rows").then(a, b),
    catch: (b?: (e: unknown) => unknown) => run("rows").catch(b),
    finally: (f?: () => void) => run("rows").finally(f),
    values: () => run("values"),
  };
}

/** The Drizzle handle. A live binding — `resetDb()` swaps it for a fresh pool. */
export let db: Db | null = connectionString ? (g.__zhqDb ??= makeDb((g.__zhqClient ??= makeClient()))) : null;

const RESET_COOLDOWN_MS = 10_000;
let lastReset = 0;

/**
 * Start a fresh pool for everything from here on. The old pool is left to
 * drain — in-flight queries on it finish normally (a busy pool must not have
 * its work destroyed under it), and a truly dead socket just sits there with
 * its watchdog already answered. At most one reset per 15 s: a burst of
 * timeouts means the pool is saturated, not stale, and swapping it repeatedly
 * only floods the pooler with new connections.
 */
export function resetDb(reason: string) {
  if (!connectionString) return;
  const now = Date.now();
  if (now - lastReset < RESET_COOLDOWN_MS) return;
  lastReset = now;
  const old = g.__zhqClient;
  console.error(`[db] fresh connection pool — ${reason}`);
  g.__zhqClient = makeClient();
  g.__zhqDb = makeDb(g.__zhqClient);
  db = g.__zhqDb;
  old?.end({ timeout: 15 }).catch(() => {});
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
      const err = new DbTimeoutError(label, ms); noteDbFailure(err); reject(err);
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}
