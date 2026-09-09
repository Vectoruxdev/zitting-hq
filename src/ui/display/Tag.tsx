"use client";
import * as React from "react";
import { Icon } from "../core/Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface TagProps {
  children?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: string;
  color?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** Selectable / removable chip: categories, filters, people on a goal. Different from Badge: it is interactive. */
export function Tag({ children, selected = false, onClick, onRemove, icon, color, size = "md", disabled, style }: TagProps) {
  const it = useInteract(disabled || !onClick);
  const interactive = !!onClick;
  const h = size === "sm" ? 26 : 32;
  const El: React.ElementType = interactive ? "button" : "span";
  return (
    <El
      type={interactive ? "button" : undefined} onClick={onClick} disabled={disabled} aria-pressed={interactive ? selected : undefined} {...(interactive ? it.bind : {})}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: h, padding: `0 ${onRemove ? 6 : 10}px 0 ${icon || color ? 8 : 10}px`, borderRadius: "var(--radius-pill)", border: `1px solid ${selected ? "transparent" : it.hover ? "var(--border-strong)" : "var(--border-hairline)"}`, background: selected ? "var(--text-primary)" : it.press ? "var(--surface-sunken)" : it.hover ? "var(--surface-hover)" : "var(--surface-card)", color: selected ? "var(--bg-app)" : "var(--text-primary)", font: `500 ${size === "sm" ? "var(--fs-xs)" : "var(--fs-sm)"}/1 var(--font-ui)`, cursor: interactive ? "pointer" : "default", opacity: disabled ? 0.45 : 1, outline: "none", whiteSpace: "nowrap", ...transition(), ...focusRing(it.focus), ...style }}
    >
      {color ? <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: color }} /> : icon ? <Icon name={icon} size={14} /> : null}
      {children}
      {onRemove ? (
        <span
          role="button" aria-label="Remove" tabIndex={0}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRemove(); }}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onRemove(); } }}
          style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 10, background: selected ? "rgba(255,255,255,.18)" : "var(--surface-sunken)", cursor: "pointer" }}
        >
          <Icon name="x" size={12} />
        </span>
      ) : null}
    </El>
  );
}
