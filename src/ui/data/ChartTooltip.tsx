import * as React from "react";
import { money } from "../interact";

export interface ChartTooltipRow { label: string; value: number | string; color?: string }
export interface ChartTooltipProps { x: number; y: number; title?: string; rows?: ChartTooltipRow[]; width?: number }

/** Shared hover tooltip for hand-drawn SVG charts. Positioned inside the chart wrapper. */
export function ChartTooltip({ x, y, title, rows = [], width }: ChartTooltipProps) {
  const flip = !!width && x > width * 0.65;
  return (
    <div role="tooltip" style={{ position: "absolute", left: x, top: y, transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`, pointerEvents: "none", background: "var(--text-primary)", color: "var(--bg-app)", padding: "8px 10px", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-2)", font: "var(--type-caption)", whiteSpace: "nowrap", zIndex: "var(--z-tooltip)", animation: "zh-fade-in var(--dur-fast) var(--ease-out) both" }}>
      {title ? <div style={{ opacity: 0.7, marginBottom: rows.length ? 4 : 0 }}>{title}</div> : null}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{r.color ? <span style={{ width: 8, height: 8, borderRadius: 4, background: r.color }} /> : null}{r.label}</span>
          <span className="zh-money" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{typeof r.value === "number" ? money(r.value) : r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartEmpty({ height = 160, message = "No data yet", hint }: { height?: number; message?: string; hint?: string }) {
  return (
    <div role="img" aria-label={message} style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-md)", color: "var(--text-tertiary)", font: "var(--type-body-sm)", background: "repeating-linear-gradient(0deg, transparent 0 23px, var(--data-grid) 23px 24px)" }}>
      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{message}</span>
      {hint ? <span style={{ font: "var(--type-caption)" }}>{hint}</span> : null}
    </div>
  );
}

/** Reduced-motion aware draw-in: returns dash props for a path of `length`. */
export function drawIn(length: number, delay = 0): React.CSSProperties {
  return { strokeDasharray: length, strokeDashoffset: length, animation: `zh-draw var(--dur-draw) var(--ease-out) ${delay}ms forwards` };
}
