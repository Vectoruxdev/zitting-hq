import { describe, expect, it } from "vitest";
import { cached } from "./cache";
import { collectDbFailures, noteDbFailure } from "@/db/read-health";

/** Outside a Next runtime `cached()` reads live; a failure underneath still has to reach the page's tally. */
describe("cached() reports degraded reads to the page", () => {
  it("names the reader whose query failed, and stays quiet for a clean one", async () => {
    const bad = cached("test:bad", ["meals"], async () => { noteDbFailure(new Error("write CONNECTION_DESTROYED")); return [] as number[]; });
    const good = cached("test:good", ["meals"], async () => [1, 2]);
    const r = await collectDbFailures(async () => [await bad(), await good()]);
    expect(r.value).toEqual([[], [1, 2]]);
    expect(r.failures).toContain("test:bad");
    expect(r.failures).not.toContain("test:good");
  });
});
