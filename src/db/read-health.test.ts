import { describe, expect, it } from "vitest";
import { isTransientDbError, noteDbFailure, watchDbRead } from "./read-health";

describe("watchDbRead", () => {
  it("reports a failure noted anywhere under the read", async () => {
    const r = await watchDbRead(async () => {
      await Promise.resolve();
      await (async () => { noteDbFailure(new Error("write CONNECTION_DESTROYED")); })();
      return [] as number[];
    });
    expect(r.value).toEqual([]);
    expect(r.failure?.message).toBe("write CONNECTION_DESTROYED");
  });
  it("keeps the first failure and the reader's value", async () => {
    const r = await watchDbRead(async () => { noteDbFailure(new Error("first")); noteDbFailure(new Error("second")); return 42; });
    expect(r).toEqual({ value: 42, failure: expect.objectContaining({ message: "first" }) });
  });
  it("is clean when nothing failed, and ignores notes outside a read", async () => {
    noteDbFailure(new Error("stray"));
    const r = await watchDbRead(async () => "ok");
    expect(r).toEqual({ value: "ok", failure: null });
  });
  it("keeps concurrent reads apart", async () => {
    const [a, b] = await Promise.all([
      watchDbRead(async () => { await new Promise((res) => setTimeout(res, 5)); noteDbFailure(new Error("a")); return "a"; }),
      watchDbRead(async () => { await new Promise((res) => setTimeout(res, 1)); return "b"; }),
    ]);
    expect(a.failure?.message).toBe("a");
    expect(b.failure).toBeNull();
  });
});

describe("isTransientDbError", () => {
  it("treats connection and watchdog errors as transient", () => {
    expect(isTransientDbError(Object.assign(new Error("write CONNECTION_DESTROYED"), { code: "CONNECTION_DESTROYED" }))).toBe(true);
    expect(isTransientDbError(Object.assign(new Error("timeout"), { code: "CONNECT_TIMEOUT" }))).toBe(true);
    expect(isTransientDbError(new Error("query stalled"))).toBe(true);
    expect(isTransientDbError(Object.assign(new Error("too many connections"), { code: "53300" }))).toBe(true);
  });
  it("treats the query's own mistakes as permanent", () => {
    expect(isTransientDbError(Object.assign(new Error('relation "x" does not exist'), { code: "42P01" }))).toBe(false);
    expect(isTransientDbError(Object.assign(new Error("bad column"), { code: "42703" }))).toBe(false);
    expect(isTransientDbError(Object.assign(new Error("wrapped"), { cause: { code: "23505" } }))).toBe(false);
  });
});
