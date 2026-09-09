"use client";
import * as React from "react";
import { Field } from "./Input";
import { transition } from "../interact";

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "style" | "value" | "defaultValue" | "onChange" | "rows" | "placeholder" | "disabled"> {
  label?: string;
  hint?: string;
  error?: string;
  rows?: number;
  maxRows?: number;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  style?: React.CSSProperties;
}

/** Multi-line input for quotes, notes, prep instructions. Auto-grows to `maxRows`. */
export function Textarea({ label, hint, error, rows = 3, maxRows = 8, disabled, value, defaultValue, onChange, placeholder, style, ...rest }: TextareaProps) {
  const [focus, setFocus] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const grow = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lh = 24;
    el.style.height = Math.min(el.scrollHeight, maxRows * lh + 24) + "px";
  }, [maxRows]);
  React.useEffect(grow, [value, grow]);
  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <textarea
        ref={ref} rows={rows} disabled={disabled} value={value} defaultValue={defaultValue} placeholder={placeholder} aria-invalid={!!error || undefined}
        onChange={(e) => { grow(); onChange?.(e); }} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest}
        style={{
          resize: "none", width: "100%", padding: "12px 14px", borderRadius: "var(--radius-control)", background: disabled ? "var(--surface-sunken)" : "var(--control-bg)",
          border: `1px solid ${error ? "var(--negative)" : focus ? "var(--accent)" : "var(--control-border)"}`,
          boxShadow: focus ? (error ? "var(--ring-error)" : "0 0 0 3px var(--accent-soft)") : "none", color: "var(--text-primary)", font: "var(--type-body)",
          lineHeight: "24px", outline: "none", opacity: disabled ? 0.6 : 1, ...transition("border-color, box-shadow"),
        }}
      />
    </Field>
  );
}
