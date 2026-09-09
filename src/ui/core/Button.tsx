"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { useInteract, focusRing, transition, type Interact } from "../interact";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "onPhoto";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "style" | "children"> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}

const SIZES: Record<ButtonSize, { h: number; px: number; fs: string; icon: number; gap: number }> = {
  sm: { h: 32, px: 12, fs: "var(--fs-sm)", icon: 16, gap: 6 },
  md: { h: 40, px: 16, fs: "var(--fs-md)", icon: 18, gap: 8 },
  lg: { h: 48, px: 22, fs: "var(--fs-lg)", icon: 20, gap: 8 },
};

interface Palette { bg: string; fg: string; border: string; filter?: string; blur?: boolean }

function palette(variant: ButtonVariant, { hover, press }: Interact): Palette {
  const p: Record<ButtonVariant, Palette> = {
    primary: { bg: press ? "var(--accent-active)" : hover ? "var(--accent-hover)" : "var(--accent)", fg: "var(--text-on-accent)", border: "transparent" },
    secondary: { bg: press ? "var(--surface-sunken)" : hover ? "var(--surface-hover)" : "var(--surface-card)", fg: "var(--text-primary)", border: "var(--border-strong)" },
    ghost: { bg: press ? "var(--surface-sunken)" : hover ? "var(--surface-hover)" : "transparent", fg: "var(--text-primary)", border: "transparent" },
    soft: { bg: "var(--accent-soft)", fg: "var(--accent-hover)", border: "transparent", filter: press ? "brightness(.95)" : hover ? "brightness(.97)" : "none" },
    danger: { bg: "var(--negative)", fg: "#fff", border: "transparent", filter: press ? "brightness(.85)" : hover ? "brightness(.92)" : "none" },
    onPhoto: { bg: press ? "rgba(255,255,255,.35)" : hover ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.18)", fg: "#fff", border: "rgba(255,255,255,.35)", blur: true },
  };
  return p[variant] || p.primary;
}

/** Pill button for every action; one primary per view. Min hit target 44 on mobile — use `lg` there. */
export function Button({ children, variant = "primary", size = "md", iconLeft, iconRight, loading = false, disabled = false, fullWidth = false, type = "button", onClick, style, ...rest }: ButtonProps) {
  const off = disabled || loading;
  const it = useInteract(off);
  const s = SIZES[size] || SIZES.md;
  const c = palette(variant, it);
  return (
    <button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...it.bind}
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: s.gap, height: s.h, minWidth: s.h, padding: `0 ${s.px}px`,
        width: fullWidth ? "100%" : undefined, borderRadius: "var(--radius-pill)", border: `1px solid ${c.border}`, background: c.bg, color: c.fg,
        font: `600 ${s.fs}/1 var(--font-ui)`, cursor: off ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, filter: c.filter,
        backdropFilter: c.blur ? "blur(12px)" : undefined, transform: it.press ? "scale(var(--press-scale))" : "none", outline: "none",
        whiteSpace: "nowrap", userSelect: "none", ...transition(), ...focusRing(it.focus, variant === "onPhoto"), ...style,
      }}
    >
      {loading ? <Icon name="loader-circle" size={s.icon} style={{ animation: "zh-spin 800ms linear infinite" }} /> : iconLeft ? <Icon name={iconLeft} size={s.icon} /> : null}
      {children ? <span style={{ opacity: loading ? 0.7 : 1 }}>{children}</span> : null}
      {iconRight && !loading ? <Icon name={iconRight} size={s.icon} /> : null}
    </button>
  );
}
