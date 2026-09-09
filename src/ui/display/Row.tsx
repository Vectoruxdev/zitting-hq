"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { Avatar, type AvatarProps } from "./Avatar";
import { useInteract, focusRing, transition, type Tint } from "../interact";

export interface RowProps {
  leading?: React.ReactNode;
  icon?: string;
  tint?: Tint;
  avatar?: Pick<AvatarProps, "src" | "name" | "person">;
  time?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: (e?: React.SyntheticEvent) => void;
  chevron?: boolean;
  tone?: "default" | "soft";
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/** One line of a list on the canvas: leading avatar / tinted icon / time, title + meta, trailing content, chevron when tappable. No dividers — rows are separated by whitespace and hover. */
export function Row({ leading, icon, tint = "coral", avatar, time, title, meta, trailing, onClick, chevron, tone = "default", size = "md", style }: RowProps) {
  const it = useInteract(!onClick);
  // A row with trailing content (an inline "Swap" button) renders as a div with
  // role=button so nested buttons stay valid HTML and don't also fire the row.
  const El: React.ElementType = onClick && !trailing ? "button" : "div";
  const clickable = !!onClick;
  const h = size === "sm" ? 44 : "var(--row-h-family)";
  const bg = tone === "soft" ? `var(--hue-${tint}-soft)` : it.hover ? "var(--surface-hover)" : "transparent";
  const rootClick = El === "div" && clickable ? {
    role: "button",
    tabIndex: 0,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const t = e.target as HTMLElement;
      const nested = t.closest ? t.closest("button,a") : null;
      if (nested && nested !== e.currentTarget) return;
      onClick?.(e);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onClick?.(e); }
    },
  } : {};
  const iconBox = size === "sm" ? 32 : 40;
  return (
    <El
      type={El === "button" ? "button" : undefined} onClick={El === "button" ? onClick : undefined} {...rootClick} {...(clickable ? it.bind : {})}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: h, padding: "6px 10px", margin: "0 -10px", boxSizing: "content-box", maxWidth: "100%", border: 0, borderRadius: "var(--radius-md)", background: bg, color: "var(--text-primary)", textAlign: "left", font: "inherit", cursor: onClick ? "pointer" : "default", outline: "none", transform: it.press ? "scale(0.99)" : "none", ...transition("background-color, transform, box-shadow"), ...focusRing(it.focus), ...style }}
    >
      {leading ? leading
        : avatar ? <Avatar {...avatar} size={size === "sm" ? "sm" : "md"} />
        : icon ? <span style={{ width: iconBox, height: iconBox, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", background: tone === "soft" ? "var(--surface-card)" : `var(--hue-${tint}-soft)`, color: `var(--hue-${tint})` }}><Icon name={icon} size={size === "sm" ? 16 : 20} /></span>
        : time ? <span className="zh-num" style={{ width: 44, flex: "none", font: "var(--type-label)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{time}</span>
        : null}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ font: "var(--type-body)", fontWeight: 500, color: "var(--text-primary)", textWrap: "pretty" }}>{title}</span>
        {meta ? <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)", textWrap: "pretty" }}>{meta}</span> : null}
      </span>
      {trailing ? <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }}>{trailing}</span> : null}
      {(chevron ?? !!onClick) ? <Icon name="chevron-right" size={18} color="var(--text-tertiary)" style={{ flex: "none", transform: it.hover ? "translateX(2px)" : "none", transition: "transform var(--dur-fast) var(--ease-out)" }} /> : null}
    </El>
  );
}
