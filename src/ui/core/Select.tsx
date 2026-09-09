"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { Field } from "./Input";
import { transition } from "../interact";

export interface SelectOption { value: string; label: string; disabled?: boolean }
export interface SelectProps {
  label?: string;
  hint?: string;
  error?: string;
  options: (string | SelectOption)[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  style?: React.CSSProperties;
  name?: string;
  id?: string;
}

export function Select({ label, hint, error, options = [], value, defaultValue, onChange, disabled, size = "md", placeholder, style, name, id }: SelectProps) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const h = size === "sm" ? 36 : size === "lg" ? 52 : 44;
  const border = error ? "var(--negative)" : focus ? "var(--accent)" : hover ? "var(--border-strong)" : "var(--control-border)";
  const placeholderShown = value === "" || (value === undefined && !!placeholder && defaultValue === undefined);
  return (
    <Field label={label} hint={hint} error={error} style={style} htmlFor={id}>
      <span
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ position: "relative", display: "flex", alignItems: "center", height: h, borderRadius: "var(--radius-control)", background: disabled ? "var(--surface-sunken)" : "var(--control-bg)", border: `1px solid ${border}`, boxShadow: focus ? "0 0 0 3px var(--accent-soft)" : "none", opacity: disabled ? 0.6 : 1, ...transition("border-color, box-shadow") }}
      >
        <select
          id={id} name={name} disabled={disabled} value={value} defaultValue={defaultValue} onChange={onChange} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ appearance: "none", WebkitAppearance: "none", width: "100%", height: "100%", border: 0, outline: "none", background: "transparent", color: placeholderShown ? "var(--control-placeholder)" : "var(--text-primary)", font: "var(--type-body)", padding: "0 36px 0 12px", cursor: disabled ? "not-allowed" : "pointer" }}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <Icon name="chevron-down" size={18} color="var(--text-tertiary)" style={{ position: "absolute", right: 12, pointerEvents: "none" }} />
      </span>
    </Field>
  );
}
