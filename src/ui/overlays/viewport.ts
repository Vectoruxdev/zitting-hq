"use client";
import * as React from "react";
import { createPortal } from "react-dom";

/** The slice of the layout viewport that is actually on screen, in CSS px from the top of the layout viewport. `hidden` is how much of the layout viewport is covered (the keyboard, in practice). */
export interface VisibleBox { top: number; height: number; hidden: number }

/** The parts of `window.visualViewport` the sizing depends on. */
export interface ViewportLike { height: number; offsetTop: number; scale: number }

/**
 * Where the visible part of the page is when it differs from the whole layout
 * viewport — in practice, while the on-screen keyboard is up.
 *
 * Fixed-position overlays are laid out against the *layout* viewport. iOS never
 * shrinks it for the keyboard and Android Chrome stopped doing so in 108, so a
 * sheet's footer (and its Save button) sits behind the keys and no amount of
 * scrolling brings it back. Sizing the overlay to this box keeps the buttons
 * above the keyboard and lets the body scroll in the room that is left.
 *
 * Returns null when everything is visible, and also when the page is pinch-zoomed
 * (a zoomed page is meant to be panned; reflowing the overlay to the zoomed
 * window would fight the user).
 */
export function visibleBox(vv: ViewportLike, innerHeight: number): VisibleBox | null {
  if (!(vv.height > 0) || !(innerHeight > 0) || vv.scale > 1.01) return null;
  const top = Math.max(0, Math.round(vv.offsetTop));
  const height = Math.round(vv.height);
  const hidden = Math.max(0, Math.round(innerHeight) - height);
  if (top === 0 && hidden <= 1) return null;
  return { top, height, hidden };
}

/** A shrink big enough to be the on-screen keyboard rather than browser chrome or a rounding quirk. */
export function keyboardUp(box: VisibleBox | null): boolean {
  return !!box && box.hidden > 120;
}

/**
 * Tracks `window.visualViewport` while `active`. Once the overlay has been
 * re-laid out to a new box, the focused field inside `dialog` is scrolled back
 * into view (browsers only do that on focus, before the keyboard has finished
 * resizing things). The last box is kept while inactive so a closing overlay
 * does not jump.
 */
export function useVisibleViewport(active: boolean, dialog?: React.RefObject<HTMLElement | null>): VisibleBox | null {
  const [box, setBox] = React.useState<VisibleBox | null>(null);
  React.useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = visibleBox(vv, window.innerHeight);
        setBox((prev) => (prev?.top === next?.top && prev?.height === next?.height ? prev : next));
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { cancelAnimationFrame(raf); vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [active, dialog]);
  // After the commit that applied the new box: the scroller has its final size now.
  React.useEffect(() => {
    if (!box) return;
    const el = document.activeElement as HTMLElement | null;
    const root = dialog?.current;
    if (el && root && el !== root && root.contains(el)) el.scrollIntoView({ block: "nearest" });
  }, [box, dialog]);
  return box;
}

/** Inline styles for an overlay's full-screen container: the visible box while the keyboard is up, otherwise edge to edge. */
export function overlayFrame(container: "fixed" | "absolute", box: VisibleBox | null): React.CSSProperties {
  return container === "fixed" && box ? { position: "fixed", top: box.top, left: 0, right: 0, height: box.height } : { position: container, inset: 0 };
}

const subscribeNever = () => () => {};

/**
 * Where a `container="fixed"` overlay renders: `document.body` on the client
 * (after hydration), so no animated or transformed ancestor can become its
 * containing block — a finished `translateY(0)` entrance animation is enough
 * to pin a "fixed" sheet to the page content instead of the screen. Null while
 * server-rendering or hydrating; undefined for `absolute` overlays, which
 * render in place inside their device frame.
 */
export function useOverlayHost(container: "fixed" | "absolute"): HTMLElement | null | undefined {
  const body = React.useSyncExternalStore(subscribeNever, () => document.body, () => null);
  return container === "fixed" ? body : undefined;
}

/** Renders `tree` in `host` (see useOverlayHost): in place when undefined, nowhere while null. */
export function inOverlayHost(tree: React.ReactElement, host: HTMLElement | null | undefined): React.ReactNode {
  if (host === undefined) return tree;
  return host ? createPortal(tree, host) : null;
}
