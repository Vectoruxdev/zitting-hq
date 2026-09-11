import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The query wrapper stands in for postgres.js's `unsafe()`; anything postgres.js
 * or Drizzle calls on the result must exist. `execute()` went missing in the
 * first version and every `db.transaction()` (the Plaid sync, the finance
 * mutations) failed with "S.unsafe(...).execute is not a function" for a day.
 */
describe("guarded query shape", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("answers like a postgres.js query: then/catch/finally, values() and execute()", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@127.0.0.1:1/db");
    vi.resetModules();
    const mod = await import("./index");
    expect(mod.isDbConfigured).toBe(true);
    const client = (mod.db as unknown as { $client: { unsafe: (q: string) => Record<string, unknown> } }).$client;
    const q = client.unsafe("select 1"); // not awaited: nothing connects
    for (const m of ["then", "catch", "finally", "values", "execute"]) expect(typeof q[m], m).toBe("function");
  });
});
