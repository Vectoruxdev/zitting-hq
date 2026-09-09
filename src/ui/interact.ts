"use client";
/**
 * Shared hover / press / focus-visible tracking for the inline-styled
 * components (ported from the design system's components/core/interact.js).
 */
import * as React from "react";

export interface InteractBind {
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
  onMouseDown?: React.MouseEventHandler<HTMLElement>;
  onMouseUp?: React.MouseEventHandler<HTMLElement>;
  onTouchStart?: React.TouchEventHandler<HTMLElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  onFocus?: React.FocusEventHandler<HTMLElement>;
  onBlur?: React.FocusEventHandler<HTMLElement>;
}

export interface Interact {
  hover: boolean;
  press: boolean;
  focus: boolean;
  bind: InteractBind;
}

export function useInteract(disabled?: boolean): Interact {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const bind: InteractBind = disabled
    ? {}
    : {
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => {
          setHover(false);
          setPress(false);
        },
        onMouseDown: () => setPress(true),
        onMouseUp: () => setPress(false),
        onTouchStart: () => setPress(true),
        onTouchEnd: () => setPress(false),
        onKeyDown: (e) => {
          if (e.key === " " || e.key === "Enter") setPress(true);
        },
        onKeyUp: () => setPress(false),
        onFocus: (e) => {
          try {
            setFocus((e.target as HTMLElement).matches(":focus-visible"));
          } catch {
            setFocus(true);
          }
        },
        onBlur: () => setFocus(false),
      };
  return { hover, press, focus, bind };
}

export const focusRing = (on: boolean, onPhoto?: boolean): React.CSSProperties =>
  on ? { boxShadow: onPhoto ? "var(--ring-focus-on-photo)" : "var(--ring-focus)" } : {};

export const transition = (
  props = "background-color, color, box-shadow, transform, border-color, opacity",
  dur = "var(--dur-fast)"
): React.CSSProperties => ({
  transition: props
    .split(",")
    .map((p) => `${p.trim()} ${dur} var(--ease-out)`)
    .join(", "),
});

/** The one way to format currency: tabular, "−" for negatives, optional "+" for positives. */
export const money = (n: number, { cents = true, sign = false }: { cents?: boolean; sign?: boolean } = {}): string => {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const pre = n < 0 ? "−" : sign && n > 0 ? "+" : "";
  return pre + "$" + s;
};

/** Stable per-person hue (1–6 wrap). */
export const personTint = (p: number): string => `var(--person-${((p - 1) % 6) + 1})`;

export const initials = (name = ""): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export type Tint = "coral" | "sky" | "mint" | "butter" | "lilac" | "rose";
