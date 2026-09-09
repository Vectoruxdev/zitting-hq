"use client";
import * as React from "react";
import { drawIn } from "./ChartTooltip";

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  tone?: "auto" | "positive" | "negative" | "accent" | "neutral";
  fill?: boolean;
  style?: React.CSSProperties;
}

/** Tiny inline trend line for stat tiles and table cells. Tone auto = last vs first. Empty renders a flat dashed baseline. */
export function Sparkline({ values = [], width = 88, height = 32, tone = "auto", fill = true, style }: SparklineProps) {
  const id = React.useId();
  if (values.length < 2) return <svg width={width} height={height} aria-label="No trend yet" style={style}><line x1={2} x2={width - 2} y1={height / 2} y2={height / 2} stroke="var(--border-strong)" strokeDasharray="2 3" /></svg>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (width - 4), 3 + (1 - (v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const len = pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const color = tone === "positive" ? "var(--positive)" : tone === "negative" ? "var(--negative)" : tone === "accent" ? "var(--accent)" : tone === "neutral" ? "var(--text-tertiary)" : values[values.length - 1] >= values[0] ? "var(--positive)" : "var(--negative)";
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-label="Trend" style={{ display: "block", overflow: "visible", ...style }}>
      {fill ? (
        <>
          <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${d} L${last[0]},${height} L${pts[0][0]},${height} Z`} fill={`url(#${id})`} style={{ animation: "zh-fade-in var(--dur-draw) var(--ease-out) 300ms both" }} />
        </>
      ) : null}
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={drawIn(len)} />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} style={{ animation: "zh-fade-in var(--dur-base) var(--ease-out) var(--dur-draw) both" }} />
    </svg>
  );
}
