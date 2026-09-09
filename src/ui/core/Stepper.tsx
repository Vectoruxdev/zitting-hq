"use client";
import * as React from "react";
import { IconButton } from "./IconButton";

export interface StepperProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (v: number) => void;
  label?: string;
  unit?: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/** Quantity stepper for groceries and pantry counts. Big round targets for wet hands on the tablet. */
export function Stepper({ value, defaultValue = 0, min = 0, max = 99, step = 1, onChange, label, unit, size = "md", style }: StepperProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const v = value ?? inner;
  const set = (n: number) => { const c = Math.max(min, Math.min(max, n)); setInner(c); onChange?.(c); };
  return (
    <div role="group" aria-label={label} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", ...style }}>
      <IconButton icon="minus" label="Less" size={size === "sm" ? "sm" : "md"} disabled={v <= min} onClick={() => set(v - step)} style={{ background: "var(--surface-card)" }} />
      <span className="zh-num" style={{ minWidth: size === "sm" ? 28 : 36, textAlign: "center", font: "var(--type-money)", fontVariantNumeric: "tabular-nums" }}>
        {v}{unit ? <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)", marginLeft: 2 }}>{unit}</span> : null}
      </span>
      <IconButton icon="plus" label="More" size={size === "sm" ? "sm" : "md"} disabled={v >= max} onClick={() => set(v + step)} style={{ background: "var(--surface-card)" }} />
    </div>
  );
}
