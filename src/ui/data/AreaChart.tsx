"use client";
import * as React from "react";
import { ChartTooltip, ChartEmpty, drawIn } from "./ChartTooltip";

export interface AreaSeries { label: string; color: string; values: number[] }
export interface AreaChartProps {
  series: AreaSeries[];
  labels?: string[];
  height?: number;
  yTicks?: number;
  formatY?: (v: number) => string;
  style?: React.CSSProperties;
}

const pathFor = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const pathLength = (pts: number[][]) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** Income-vs-spend area chart. Draws in over --dur-draw; hover shows a tooltip with every series. */
export function AreaChart({ series = [], labels = [], height = 180, yTicks = 3, formatY, style }: AreaChartProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(480);
  const [hi, setHi] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const n = Math.max(...series.map((s) => s.values.length), 0);
  if (!n) return <ChartEmpty height={height} message="No activity yet" hint="Charts appear after the first transactions sync." />;
  const padL = 44, padR = 12, padT = 12, padB = 24, iw = w - padL - padR, ih = height - padT - padB;
  const max = Math.max(...series.flatMap((s) => s.values)) * 1.1 || 1;
  const X = (i: number) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = (v: number) => padT + ih - (v / max) * ih;
  const fmt = formatY || ((v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${Math.round(v)}`));
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const i = Math.round((((e.clientX - r.left) - padL) / iw) * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  const labelEvery = Math.ceil(n / 7);
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setHi(null)} style={{ position: "relative", width: "100%", height, ...style }}>
      <svg width={w} height={height} style={{ display: "block", overflow: "visible" }} aria-label="Area chart">
        {Array.from({ length: yTicks + 1 }).map((_, i) => { const v = (max / yTicks) * i; return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={Y(v)} y2={Y(v)} stroke="var(--data-grid)" strokeDasharray="2 4" />
            <text x={padL - 8} y={Y(v) + 3} textAnchor="end" fill="var(--text-tertiary)" style={{ font: "500 10px var(--font-num)", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</text>
          </g>); })}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [X(i), Y(v)]);
          const d = pathFor(pts);
          const id = `zh-area-${si}`;
          return (
            <g key={si}>
              <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".28" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
              <path d={`${d} L${X(n - 1)},${padT + ih} L${X(0)},${padT + ih} Z`} fill={`url(#${id})`} style={{ animation: `zh-fade-in var(--dur-draw) var(--ease-out) ${si * 120 + 300}ms both` }} />
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={drawIn(pathLength(pts), si * 120)} />
            </g>
          );
        })}
        {labels.map((l, i) => (i % labelEvery === 0 || i === n - 1) ? <text key={i} x={X(i)} y={height - 6} textAnchor="middle" fill={hi === i ? "var(--text-primary)" : "var(--text-tertiary)"} style={{ font: "500 10px var(--font-ui)" }}>{l}</text> : null)}
        {hi != null ? (
          <g>
            <line x1={X(hi)} x2={X(hi)} y1={padT} y2={padT + ih} stroke="var(--border-strong)" />
            {series.map((s, si) => <circle key={si} cx={X(hi)} cy={Y(s.values[hi] ?? 0)} r={4.5} fill={s.color} stroke="var(--surface-card)" strokeWidth={2} />)}
          </g>
        ) : null}
      </svg>
      {hi != null ? <ChartTooltip x={X(hi)} y={padT + ih / 2} width={w} title={labels[hi]} rows={series.map((s) => ({ label: s.label, value: s.values[hi], color: s.color }))} /> : null}
    </div>
  );
}
