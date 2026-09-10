import { describe, expect, it } from "vitest";
import { keyboardUp, overlayFrame, visibleBox } from "./viewport";

describe("visibleBox", () => {
  it("is null when the whole layout viewport is on screen", () => {
    expect(visibleBox({ height: 852, offsetTop: 0, scale: 1 }, 852)).toBeNull();
    // sub-pixel viewport heights (iOS reports fractions) still count as whole
    expect(visibleBox({ height: 851.6, offsetTop: 0, scale: 1 }, 852)).toBeNull();
  });
  it("shrinks to the visible part while the keyboard is up", () => {
    expect(visibleBox({ height: 516, offsetTop: 0, scale: 1 }, 852)).toEqual({ top: 0, height: 516, hidden: 336 });
  });
  it("follows the visible part when the browser has panned the layout viewport", () => {
    expect(visibleBox({ height: 516, offsetTop: 120.4, scale: 1 }, 852)).toEqual({ top: 120, height: 516, hidden: 336 });
  });
  it("leaves a pinch-zoomed page alone", () => {
    expect(visibleBox({ height: 426, offsetTop: 200, scale: 2 }, 852)).toBeNull();
  });
  it("ignores nonsense sizes", () => {
    expect(visibleBox({ height: 0, offsetTop: 0, scale: 1 }, 852)).toBeNull();
    expect(visibleBox({ height: 516, offsetTop: 0, scale: 1 }, 0)).toBeNull();
  });
});

describe("keyboardUp", () => {
  it("is true only for a keyboard-sized shrink", () => {
    expect(keyboardUp(null)).toBe(false);
    // Chrome's phone emulation reports a window a few dozen px taller than the visible area
    expect(keyboardUp(visibleBox({ height: 852, offsetTop: 0, scale: 1 }, 887))).toBe(false);
    expect(keyboardUp(visibleBox({ height: 516, offsetTop: 0, scale: 1 }, 852))).toBe(true);
  });
});

describe("overlayFrame", () => {
  it("fills the container when nothing is hidden", () => {
    expect(overlayFrame("fixed", null)).toEqual({ position: "fixed", inset: 0 });
    expect(overlayFrame("absolute", null)).toEqual({ position: "absolute", inset: 0 });
  });
  it("sizes a fixed overlay to the visible box", () => {
    expect(overlayFrame("fixed", { top: 0, height: 516, hidden: 336 })).toEqual({ position: "fixed", top: 0, left: 0, right: 0, height: 516 });
  });
  it("never resizes an overlay scoped to a device frame", () => {
    expect(overlayFrame("absolute", { top: 0, height: 516, hidden: 336 })).toEqual({ position: "absolute", inset: 0 });
  });
});
