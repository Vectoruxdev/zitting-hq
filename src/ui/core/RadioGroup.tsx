"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { Field } from "./Input";
import { useInteract, focusRing, transition } from "../interact";

export interface RadioOption { value: string; label: string; description?: string; icon?: string; disabled?: boolean }
export interface RadioGroupProps {
  label?: string;
  hint?: string;
  error?: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  layout?: "list" | "cards";
  columns?: number;
  style?: React.CSSProperties;
}

function Option({ o, checked, onSelect, layout }: { o: RadioOption; checked: boolean; onSelect: (v: string) => void; layout: "list" | "cards" }) {
  const it = useInteract(o.disabled);
  const card = layout === "cards";
  return (
    <button
      type="button" role="radio" aria-checked={checked} disabled={o.disabled} onClick={() => onSelect(o.value)} {...it.bind}
      style={{
        display: "flex", alignItems: card ? "flex-start" : "center", gap: 12, width: "100%", minHeight: 44, padding: card ? 14 : "8px 0",
        border: card ? `1.5px solid ${checked ? "var(--accent)" : it.hover ? "var(--border-strong)" : "var(--border-hairline)"}` : 0,
        borderRadius: card ? "var(--radius-lg)" : "var(--radius-sm)", background: card ? (checked ? "var(--accent-soft)" : "var(--surface-card)") : "transparent",
        color: "var(--text-primary)", textAlign: "left", cursor: o.disabled ? "not-allowed" : "pointer", opacity: o.disabled ? 0.5 : 1, outline: "none", font: "inherit",
        ...transition(), ...focusRing(it.focus),
      }}
    >
      {o.icon ? (
        <span style={{ width: 36, height: 36, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", background: checked ? "var(--accent)" : "var(--surface-sunken)", color: checked ? "var(--text-on-accent)" : "var(--text-secondary)", transition: "background-color var(--dur-fast)" }}>
          <Icon name={o.icon} size={18} />
        </span>
      ) : (
        <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", border: `1.5px solid ${checked ? "var(--accent)" : it.hover ? "var(--text-secondary)" : "var(--border-strong)"}`, display: "grid", placeItems: "center", background: "var(--control-bg)", ...transition("border-color") }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", transform: checked ? "scale(1)" : "scale(0)", transition: "transform var(--dur-fast) var(--ease-spring)" }} />
        </span>
      )}
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ font: "var(--type-body)", fontWeight: 500 }}>{o.label}</span>
        {o.description ? <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{o.description}</span> : null}
      </span>
    </button>
  );
}

/** Single choice. `layout="cards"` for 2–4 big choices on a phone (who cooks, which account); `layout="list"` for settings. */
export function RadioGroup({ label, hint, error, options = [], value, defaultValue, onChange, layout = "list", columns, style }: RadioGroupProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const v = value ?? inner;
  const select = (x: string) => { setInner(x); onChange?.(x); };
  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : "1fr", gap: layout === "cards" ? 8 : 0 }}>
        {options.map((o) => <Option key={o.value} o={o} checked={o.value === v} onSelect={select} layout={layout} />)}
      </div>
    </Field>
  );
}
