import { describe, expect, it } from "vitest";
import { applySwap, cookForDate, detectPlatform, nextSwapStatus, parseOpenGraph } from "./kitchen";

const rotation = [
  { weekday: 1, cookMemberId: "katelynn", dishMemberIds: ["jared"] },
  { weekday: 2, cookMemberId: "jaelynn", dishMemberIds: ["katelynn"] },
  { weekday: 3, cookMemberId: "katelynn", dishMemberIds: [] },
];

describe("cookForDate", () => {
  it("falls back to the weekday rotation", () => {
    // 2026-09-08 is a Tuesday
    expect(cookForDate("2026-09-08", rotation, [])).toMatchObject({ cook: "jaelynn", dish: ["katelynn"], overridden: false, weekday: 2 });
  });
  it("prefers a per-date override", () => {
    const a = [{ date: "2026-09-08", cookMemberId: "jared", dishMemberIds: ["jae"], note: "pizza", source: "override" }];
    expect(cookForDate("2026-09-08", rotation, a)).toMatchObject({ cook: "jared", dish: ["jae"], note: "pizza", overridden: true });
  });
  it("returns nobody when the weekday has no rotation", () => {
    expect(cookForDate("2026-09-13", rotation, []).cook).toBeNull(); // Sunday
  });
});

describe("applySwap", () => {
  it("exchanges the cooks on both dates and keeps dish duty with the date", () => {
    const out = applySwap({ fromMemberId: "jaelynn", toMemberId: "katelynn", fromDate: "2026-09-08", toDate: "2026-09-09" }, rotation, []);
    expect(out).toEqual([
      { date: "2026-09-08", cookMemberId: "katelynn", dishMemberIds: ["katelynn"], note: null, source: "swap" },
      { date: "2026-09-09", cookMemberId: "jaelynn", dishMemberIds: [], note: null, source: "swap" },
    ]);
  });
});

describe("nextSwapStatus", () => {
  const swap = { fromMemberId: "jaelynn", toMemberId: "katelynn" };
  it("only the recipient accepts or declines", () => {
    expect(nextSwapStatus("pending", "accept", "katelynn", swap)).toBe("accepted");
    expect(nextSwapStatus("pending", "decline", "katelynn", swap)).toBe("declined");
    expect(nextSwapStatus("pending", "accept", "jaelynn", swap)).toBeNull();
  });
  it("only the requester (or owner) cancels", () => {
    expect(nextSwapStatus("pending", "cancel", "jaelynn", swap)).toBe("cancelled");
    expect(nextSwapStatus("pending", "cancel", "katelynn", swap)).toBeNull();
    expect(nextSwapStatus("pending", "cancel", "jared", swap, true)).toBe("cancelled");
  });
  it("resolved swaps never move again", () => {
    expect(nextSwapStatus("accepted", "cancel", "jaelynn", swap)).toBeNull();
    expect(nextSwapStatus("declined", "accept", "katelynn", swap)).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("recognizes the platforms people paste", () => {
    expect(detectPlatform("https://www.tiktok.com/@cook/video/1")).toBe("tiktok");
    expect(detectPlatform("https://vm.tiktok.com/abc")).toBe("tiktok");
    expect(detectPlatform("https://www.instagram.com/reel/xyz/")).toBe("instagram");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://smittenkitchen.com/recipe")).toBe("web");
    expect(detectPlatform("not a url")).toBe("web");
  });
});

describe("parseOpenGraph", () => {
  it("reads og tags in either attribute order and decodes entities", () => {
    const html = `<html><head><title>Fallback &amp; Co</title><meta property="og:title" content="Sheet-pan chicken &amp; potatoes"><meta content="https://x/img.jpg" property="og:image"><meta property="og:site_name" content="Smitten Kitchen"></head></html>`;
    expect(parseOpenGraph(html)).toEqual({ title: "Sheet-pan chicken & potatoes", image: "https://x/img.jpg", author: "Smitten Kitchen" });
  });
  it("falls back to the title tag", () => {
    expect(parseOpenGraph("<title>Just a page</title>")).toEqual({ title: "Just a page", image: null, author: null });
  });
});
