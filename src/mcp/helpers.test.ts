import { describe, it, expect } from "vitest";
import { ok, fail, writeResult, requireConfirm, idInt, dateISO } from "./helpers";

const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

describe("ok / fail envelopes", () => {
  it("ok wraps JSON text, not an error", () => {
    const r = ok({ a: 1 });
    expect(r.isError).toBeUndefined();
    expect(parse(r)).toEqual({ a: 1 });
  });
  it("fail marks isError with the message", () => {
    const r = fail("nope");
    expect(r.isError).toBe(true);
    expect(parse(r)).toEqual({ error: "nope" });
  });
});

describe("writeResult", () => {
  it("passes a success result through as ok", () => {
    const r = writeResult({ ok: true, id: "x" });
    expect(r.isError).toBeUndefined();
    expect(parse(r)).toEqual({ ok: true, id: "x" });
  });
  it("maps { ok:false, error } to an MCP error", () => {
    const r = writeResult({ ok: false, error: "Cannot delete this category" });
    expect(r.isError).toBe(true);
    expect(parse(r)).toEqual({ error: "Cannot delete this category" });
  });
  it("falls back to a generic message when ok:false has no error", () => {
    const r = writeResult({ ok: false });
    expect(r.isError).toBe(true);
    expect(parse(r).error).toMatch(/failed/i);
  });
});

describe("requireConfirm (destructive guardrail)", () => {
  it("refuses (isError) when confirm is omitted or false", () => {
    const a = requireConfirm(undefined, "delete account X");
    expect(a?.isError).toBe(true);
    expect(parse(a!).error).toMatch(/confirm:true/);
    expect(requireConfirm(false, "x")?.isError).toBe(true);
  });
  it("returns null (proceed) only when confirm===true", () => {
    expect(requireConfirm(true, "x")).toBeNull();
  });
});

describe("shared zod shapes", () => {
  it("idInt accepts integers, rejects strings/floats", () => {
    expect(idInt.safeParse(5).success).toBe(true);
    expect(idInt.safeParse("5").success).toBe(false);
    expect(idInt.safeParse(1.5).success).toBe(false);
  });
  it("dateISO accepts YYYY-MM-DD only", () => {
    expect(dateISO.safeParse("2026-06-22").success).toBe(true);
    expect(dateISO.safeParse("06/22/2026").success).toBe(false);
    expect(dateISO.safeParse("2026-6-2").success).toBe(false);
  });
});
