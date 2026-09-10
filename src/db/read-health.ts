import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Tells a cached reader whether the database failed while it was reading.
 *
 * Readers swallow query errors on purpose (`.catch(() => [])`) so a missing
 * feature table never takes a whole screen down — but a dropped connection or
 * a stalled pooler produces the very same "no rows", and caching that shows
 * everyone an empty Home or an empty meal plan for the next ten minutes (this
 * hid tonight's dinner from the whole family on 2026-09-10). So the query
 * wrapper notes every transient failure here, and `cached()` refuses to store
 * a result that was read under one.
 */
interface Scope { failure: Error | null }
const scope = new AsyncLocalStorage<Scope>();

/** Run a reader and report whether the database failed underneath it. */
export async function watchDbRead<T>(fn: () => Promise<T>): Promise<{ value: T; failure: Error | null }> {
  const s: Scope = { failure: null };
  const value = await scope.run(s, fn);
  return { value, failure: s.failure };
}

/** Called by the query wrapper when a query fails for a reason a retry could fix. */
export function noteDbFailure(err: unknown): void {
  const s = scope.getStore();
  if (s && !s.failure) s.failure = err instanceof Error ? err : new Error(String(err));
}

/**
 * Postgres classes 42 (syntax, undefined table or column), 22 (bad data) and
 * 23 (constraints) are the query's own fault and come back the same every
 * time; everything else (dropped sockets, pooler stalls, our own watchdog) is
 * the connection's fault and will not repeat.
 */
export function isTransientDbError(err: unknown): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null | undefined;
  const code = typeof e?.code === "string" ? e.code : typeof e?.cause?.code === "string" ? e.cause.code : null;
  return !(code && /^(42|22|23)/.test(code));
}
