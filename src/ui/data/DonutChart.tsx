"use client";
import * as React from "react";
import { ChartTooltip, ChartEmpty } from "./ChartTooltip";
import { money } from "../interact";

export interface DonutSegment { label: string; value: number; color: string }
export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  legend?: boolean;
  style?: React.CSSProperties;
}

/** Category donut. Segments draw in clockwise; hover grows a segment and shows a tooltip; center shows total or hovered segment. */
export function DonutChart({ segments = [], size = 180, thickness = 18, centerLabel = "Spent", legend = true, style }: DonutChartProps) {
  const [hi, setHi] = React.useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <ChartEmpty height={size} message="No categories yet" hint="Categorize a few transactions to see the split." />;
  const r = (size - thickness) / 2 - 4, C = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  const arcs: (DonutSegment & { i: number; frac: number; off: number })[] = [];
  for (let i = 0, run = 0; i < segments.length; i++) { const frac = segments[i].value / total; arcs.push({ ...segments[i], i, frac, off: run }); run += frac; }
  const cur = hi != null ? arcs[hi] : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", ...style }}>
      <div style={{ position: "relative", width: size, height: size, flex: "none" }} onMouseLeave={() => setHi(null)}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Donut chart" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--data-track)" strokeWidth={thickness} />
          {arcs.map((a) => (
            <circle key={a.i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={hi === a.i ? thickness + 6 : thickness} strokeDasharray={`${Math.max(0, a.frac * C - 3)} ${C}`} strokeDashoffset={-a.off * C} strokeLinecap="butt" onMouseEnter={() => setHi(a.i)} style={{ cursor: "pointer", opacity: hi == null || hi === a.i ? 1 : 0.35, transition: "stroke-width var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)" }}>
              <animate attributeName="stroke-dasharray" from={`0 ${C}`} to={`${Math.max(0, a.frac * C - 3)} ${C}`} dur="0.9s" begin={`${a.off * 0.9}s`} fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" />
            </circle>
          ))}
        </svg>
        <div style={{ position: "absolute", inset: thickness + 8, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none" }}>
          <span style={{ font: "var(--type-caption)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", fontSize: 10, fontWeight: 600 }}>{cur ? cur.label : centerLabel}</span>
          <span className="zh-money" style={{ font: "var(--type-money-lg)", fontSize: size < 160 ? "var(--fs-xl)" : "var(--fs-2xl)", fontVariantNumeric: "tabular-nums" }}>{money(cur ? cur.value : total, { cents: false })}</span>
          {cur ? <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>{Math.round(cur.frac * 100)}%</span> : null}
        </div>
        {cur ? <ChartTooltip x={size} y={size / 2} title={cur.label} rows={[{ value: cur.value, label: `${Math.round(cur.frac * 100)}%`, color: cur.color }]} /> : null}
      </div>
      {legend ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, minWidth: 140, flex: 1 }}>
          {arcs.map((a) => (
            <li key={a.i} onMouseEnter={() => setHi(a.i)} onMouseLeave={() => setHi(null)} style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--type-body-sm)", color: hi == null || hi === a.i ? "var(--text-primary)" : "var(--text-tertiary)", cursor: "default", transition: "color var(--dur-fast)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flex: "none" }} /><span style={{ flex: 1 }}>{a.label}</span>
              <span className="zh-money" style={{ font: "var(--type-money-sm)" }}>{money(a.value, { cents: false })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
