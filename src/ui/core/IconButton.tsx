"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "style" | "children"> {
  icon: string;
  label: string;
  variant?: "ghost" | "filled" | "outline" | "onPhoto";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  active?: boolean;
  badge?: number | string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}

const SIZES = { sm: 32, md: 40, lg: 48 } as const;

export function IconButton({ icon, label, variant = "ghost", size = "md", disabled = false, active = false, badge, onClick, style, ...rest }: IconButtonProps) {
  const it = useInteract(disabled);
  const d = SIZES[size] || SIZES.md;
  const onPhoto = variant === "onPhoto";
  const bg =
    variant === "filled" ? (it.press ? "var(--accent-active)" : it.hover ? "var(--accent-hover)" : "var(--accent)")
    : variant === "outline" ? (it.press ? "var(--surface-sunken)" : it.hover ? "var(--surface-hover)" : "var(--surface-card)")
    : onPhoto ? (it.press ? "rgba(20,14,6,.7)" : it.hover ? "rgba(20,14,6,.6)" : "rgba(20,14,6,.45)")
    : active ? "var(--accent-soft)" : it.press ? "var(--surface-sunken)" : it.hover ? "var(--surface-hover)" : "transparent";
  const fg = variant === "filled" ? "var(--text-on-accent)" : onPhoto ? "#fff" : active ? "var(--accent-hover)" : "var(--text-secondary)";
  return (
    <button
      type="button" aria-label={label} title={label} aria-pressed={active || undefined} disabled={disabled} onClick={onClick} {...it.bind} {...rest}
      style={{
        position: "relative", display: "inline-grid", placeItems: "center", width: d, height: d, borderRadius: "var(--radius-pill)",
        border: `1px solid ${variant === "outline" ? "var(--border-strong)" : onPhoto ? "rgba(255,255,255,.25)" : "transparent"}`, background: bg, color: fg,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, backdropFilter: onPhoto ? "blur(12px)" : undefined,
        transform: it.press ? "scale(var(--press-scale))" : "none", outline: "none", flex: "none", ...transition(), ...focusRing(it.focus, onPhoto), ...style,
      }}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 20} />
      {badge ? (
        <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--negative)", color: "#fff", font: "600 10px/16px var(--font-num)", fontVariantNumeric: "tabular-nums" }}>{badge}</span>
      ) : null}
    </button>
  );
}
