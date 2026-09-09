"use client";
import * as React from "react";
import { useInteract, focusRing, transition } from "../interact";

export interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

export function Toggle({ checked, defaultChecked = false, onChange, label, description, disabled, size = "md", style }: ToggleProps) {
  const [inner, setInner] = React.useState(defaultChecked);
  const on = checked ?? inner;
  const it = useInteract(disabled);
  const w = size === "sm" ? 36 : 48, h = size === "sm" ? 20 : 28, k = h - 6;
  const flip = () => { if (disabled) return; const v = !on; setInner(v); onChange?.(v); };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, minHeight: 44, ...style }}>
      <button
        type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={flip} {...it.bind}
        style={{ position: "relative", width: w, height: h, flex: "none", borderRadius: "var(--radius-pill)", border: "1px solid transparent", background: on ? (it.hover ? "var(--accent-hover)" : "var(--accent)") : (it.hover ? "var(--border-strong)" : "var(--surface-sunken)"), boxShadow: on ? "none" : "inset 0 0 0 1px var(--border-strong)", padding: 0, cursor: "inherit", outline: "none", ...transition("background-color, box-shadow"), ...focusRing(it.focus) }}
      >
        <span style={{ position: "absolute", top: 2, left: on ? w - k - 4 : 2, width: k + (it.press ? 4 : 0), height: k, borderRadius: "var(--radius-pill)", background: on ? "var(--text-on-accent)" : "var(--surface-raised)", boxShadow: "var(--shadow-1)", transition: "left var(--dur-fast) var(--ease-out), width var(--dur-fast) var(--ease-out)", transform: on && it.press ? "translateX(-4px)" : "none" }} />
      </button>
      {label ? (
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ font: "var(--type-body)", color: "var(--text-primary)" }}>{label}</span>
          {description ? <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
