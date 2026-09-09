"use client";
import * as React from "react";
import { Icon } from "../core/Icon";

export interface ProgressRingProps {
  value: number;
  size?: number;
  thickness?: number;
  tone?: "accent" | "positive" | "info" | string;
  label?: string;
  children?: React.ReactNode;
  celebrate?: boolean;
  style?: React.CSSProperties;
}

/** Circular progress for goals, allowance and per-kid chores. `value` 0–1, draws in over --dur-draw. Center takes children (a Money, a count, an avatar). `tone="hue-mint"` uses a family hue. */
export function ProgressRing({ value = 0, size = 96, thickness = 8, tone = "accent", label, children, celebrate = true, style }: ProgressRingProps) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  const v = Math.max(0, Math.min(1, value)), done = v >= 1;
  const r = (size - thickness) / 2, C = 2 * Math.PI * r;
  const color = done && celebrate ? "var(--positive)" : tone === "positive" ? "var(--positive)" : tone === "info" ? "var(--data-2)" : tone.startsWith("hue-") ? `var(--${tone})` : "var(--accent)";
  return (
    <div role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label} style={{ position: "relative", width: size, height: size, flex: "none", ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--data-track)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={on ? C * (1 - v) : C} style={{ transition: "stroke-dashoffset var(--dur-draw) var(--ease-out), stroke var(--dur-base)" }} />
      </svg>
      <div style={{ position: "absolute", inset: thickness, borderRadius: "50%", display: "grid", placeItems: "center", textAlign: "center" }}>
        {children ?? (done && celebrate ? <Icon name="check" size={size * 0.32} color="var(--positive)" /> : <span className="zh-num" style={{ font: `600 ${Math.round(size * 0.22)}px/1 var(--font-num)`, fontVariantNumeric: "tabular-nums" }}>{Math.round(v * 100)}%</span>)}
      </div>
    </div>
  );
}
