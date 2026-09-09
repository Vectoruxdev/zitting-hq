"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { transition } from "../interact";

export interface SearchFieldProps {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  autoFocus?: boolean;
  style?: React.CSSProperties;
}

/** Pill search field for transactions, recipes, photos. Clears with ×; Escape clears too. */
export function SearchField({ value, defaultValue = "", onChange, onSubmit, placeholder = "Search", size = "md", autoFocus, style }: SearchFieldProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const v = value ?? inner;
  const [focus, setFocus] = React.useState(false);
  const set = (x: string) => { setInner(x); onChange?.(x); };
  const h = size === "sm" ? 36 : 44;
  return (
    <div role="search" style={{ display: "flex", alignItems: "center", gap: 8, height: h, padding: "0 10px 0 14px", borderRadius: "var(--radius-pill)", background: focus ? "var(--control-bg)" : "var(--surface-sunken)", boxShadow: focus ? "0 0 0 2px var(--accent)" : "none", ...transition("background-color, box-shadow"), ...style }}>
      <Icon name="search" size={18} color="var(--text-tertiary)" />
      <input
        type="search" value={v} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => set(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onKeyDown={(e) => { if (e.key === "Escape") set(""); if (e.key === "Enter" && onSubmit) onSubmit(v); }}
        style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: "var(--text-primary)", font: "var(--type-body)", padding: 0, appearance: "none", WebkitAppearance: "none" }}
      />
      {v ? (
        <button type="button" aria-label="Clear" onClick={() => set("")} style={{ width: 24, height: 24, borderRadius: 12, border: 0, background: "var(--border-strong)", color: "var(--surface-card)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </div>
  );
}
