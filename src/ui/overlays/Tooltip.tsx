"use client";
import * as React from "react";

export interface TooltipProps { label: string; children?: React.ReactNode; side?: "top" | "bottom" | "left" | "right"; delay?: number; style?: React.CSSProperties }

/** Hover/focus tooltip for icon-only controls and chart legends. Ink pill, 220ms fade, positions above by default. */
export function Tooltip({ label, children, side = "top", delay = 300, style }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const t = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { t.current = setTimeout(() => setOpen(true), delay); };
  const hide = () => { if (t.current) clearTimeout(t.current); setOpen(false); };
  const pos: React.CSSProperties = side === "top" ? { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" } : side === "bottom" ? { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" } : side === "left" ? { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" } : { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" };
  return (
    <span onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} style={{ position: "relative", display: "inline-flex", ...style }}>
      {children}
      {open ? <span role="tooltip" style={{ position: "absolute", ...pos, zIndex: "var(--z-tooltip)", padding: "6px 10px", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "var(--bg-app)", font: "var(--type-caption)", fontWeight: 500, whiteSpace: "nowrap", boxShadow: "var(--shadow-2)", pointerEvents: "none", animation: "zh-fade-in var(--dur-base) var(--ease-out) both" }}>{label}</span> : null}
    </span>
  );
}
