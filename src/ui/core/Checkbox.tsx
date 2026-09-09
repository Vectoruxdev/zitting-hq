"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { useInteract, focusRing, transition } from "../interact";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "md" | "lg";
  style?: React.CSSProperties;
}

export function Checkbox({ checked, defaultChecked = false, indeterminate = false, onChange, label, description, disabled, size = "md", style }: CheckboxProps) {
  const [inner, setInner] = React.useState(defaultChecked);
  const on = checked ?? inner;
  const it = useInteract(disabled);
  const d = size === "lg" ? 28 : 22;
  const flip = () => { if (disabled) return; const v = !on; setInner(v); onChange?.(v); };
  const filled = on || indeterminate;
  return (
    <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, minHeight: 44, padding: "11px 0", ...style }}>
      <button
        type="button" role="checkbox" aria-checked={indeterminate ? "mixed" : on} aria-label={label} disabled={disabled} onClick={flip} {...it.bind}
        style={{ width: d, height: d, flex: "none", display: "grid", placeItems: "center", borderRadius: "var(--radius-sm)", border: `1.5px solid ${filled ? "transparent" : it.hover ? "var(--text-secondary)" : "var(--border-strong)"}`, background: filled ? (it.hover ? "var(--accent-hover)" : "var(--accent)") : it.hover ? "var(--surface-hover)" : "var(--control-bg)", color: "var(--text-on-accent)", padding: 0, cursor: "inherit", outline: "none", transform: it.press ? "scale(.92)" : "none", ...transition(), ...focusRing(it.focus) }}
      >
        {indeterminate ? <Icon name="minus" size={d - 6} /> : on ? <Icon name="check" size={d - 6} /> : null}
      </button>
      {label ? (
        <span style={{ display: "flex", flexDirection: "column", paddingTop: 1 }}>
          <span style={{ font: "var(--type-body)", color: "var(--text-primary)", textDecoration: on && size === "lg" ? "line-through" : "none", opacity: on && size === "lg" ? 0.6 : 1, transition: "opacity var(--dur-base)" }}>{label}</span>
          {description ? <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
