import * as React from "react";
import { Icon } from "../core/Icon";
import { money } from "../interact";

export interface ProgressBarProps {
  value: number;
  label?: string;
  current?: number | string;
  target?: number | string;
  tone?: "accent" | "positive" | "info" | "budget";
  size?: "sm" | "md" | "lg";
  celebrate?: boolean;
  showPercent?: boolean;
  style?: React.CSSProperties;
}

/** Progress for goals, budgets and allowance. `value` 0–1. Fills in over --dur-draw. At 100% it celebrates (accent → positive, check icon) unless `celebrate={false}`. `tone="budget"` turns warning past 0.85 and negative past 1. */
export function ProgressBar({ value = 0, label, current, target, tone = "accent", size = "md", celebrate = true, showPercent = false, style }: ProgressBarProps) {
  const v = Math.max(0, Math.min(1.2, value));
  const done = v >= 1;
  const color = tone === "budget" ? (v >= 1 ? "var(--negative)" : v >= 0.85 ? "var(--warning)" : "var(--accent)") : done && celebrate ? "var(--positive)" : tone === "positive" ? "var(--positive)" : tone === "info" ? "var(--data-2)" : "var(--accent)";
  const h = size === "sm" ? 6 : size === "lg" ? 12 : 8;
  const fmt = (x: number | string) => (typeof x === "number" ? money(x, { cents: false }) : x);
  return (
    <div role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      {label || current != null || showPercent ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, font: "var(--type-body-sm)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{done && celebrate ? <Icon name="circle-check" size={16} color="var(--positive)" /> : null}{label}</span>
          <span className="zh-money" style={{ font: "var(--type-money-sm)", color: "var(--text-secondary)", flex: "none" }}>
            {current != null ? <><span style={{ color: "var(--text-primary)" }}>{fmt(current)}</span>{target != null ? <span> / {fmt(target)}</span> : null}</> : showPercent ? `${Math.round(v * 100)}%` : null}
          </span>
        </div>
      ) : null}
      <div style={{ height: h, borderRadius: h, background: "var(--data-track)", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, v * 100)}%`, borderRadius: h, background: color, transition: "width var(--dur-draw) var(--ease-out), background-color var(--dur-base)", transformOrigin: "left" }} />
      </div>
    </div>
  );
}
