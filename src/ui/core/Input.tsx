"use client";
import * as React from "react";
import { Icon } from "./Icon";
import { transition } from "../interact";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Shared label / hint / error chrome for every form control. */
export function Field({ label, hint, error, htmlFor, children, style }: FieldProps) {
  return (
    <label htmlFor={htmlFor} style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label ? <span style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>{label}</span> : null}
      {children}
      {error ? (
        <span role="alert" style={{ display: "flex", gap: 6, alignItems: "center", font: "var(--type-caption)", color: "var(--negative)" }}>
          <Icon name="circle-alert" size={14} />{error}
        </span>
      ) : hint ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{hint}</span> : null}
    </label>
  );
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix" | "style" | "value" | "defaultValue" | "onChange" | "type" | "placeholder" | "disabled"> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: string;
  prefix?: string;
  suffix?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  money?: boolean;
  type?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

export function Input({ label, hint, error, iconLeft, prefix, suffix, size = "md", disabled, loading, money: isMoney, type = "text", value, defaultValue, onChange, placeholder, style, inputStyle, ...rest }: InputProps) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const h = size === "sm" ? 36 : size === "lg" ? 52 : 44;
  const border = error ? "var(--negative)" : focus ? "var(--accent)" : hover ? "var(--border-strong)" : "var(--control-border)";
  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <span
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center", gap: 8, height: h, padding: "0 12px", borderRadius: "var(--radius-control)",
          background: disabled ? "var(--surface-sunken)" : "var(--control-bg)", border: `1px solid ${border}`,
          boxShadow: focus ? (error ? "var(--ring-error)" : "0 0 0 3px var(--accent-soft)") : "none", opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text", ...transition("border-color, box-shadow, background-color"),
        }}
      >
        {iconLeft ? <Icon name={iconLeft} size={18} color="var(--text-tertiary)" /> : null}
        {prefix ? <span style={{ font: "var(--type-body)", color: "var(--text-tertiary)" }}>{prefix}</span> : null}
        <input
          type={type} disabled={disabled} value={value} defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} aria-invalid={!!error || undefined}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} inputMode={isMoney ? "decimal" : undefined} {...rest}
          style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: "var(--text-primary)", font: isMoney ? "var(--type-control-money)" : "var(--type-control)", fontVariantNumeric: isMoney ? "tabular-nums" : undefined, textAlign: isMoney ? "right" : "left", padding: 0, ...inputStyle }}
        />
        {loading ? <Icon name="loader-circle" size={16} color="var(--text-tertiary)" style={{ animation: "zh-spin 800ms linear infinite" }} />
          : error ? <Icon name="circle-alert" size={16} color="var(--negative)" />
          : suffix ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)" }}>{suffix}</span> : null}
      </span>
    </Field>
  );
}
