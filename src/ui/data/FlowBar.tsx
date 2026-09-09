"use client";
import * as React from "react";
import { Money } from "../display/Money";
import { ChartTooltip, ChartEmpty } from "./ChartTooltip";

export interface FlowSegment { label: string; value: number; color: string }
export interface FlowBarProps {
  total: number;
  segments: FlowSegment[];
  remaining?: number;
  height?: number;
  legend?: boolean;
  animate?: boolean;
  style?: React.CSSProperties;
}

/** "Where the paycheck went": one horizontal stacked bar. Segments grow in from the left, hover highlights a segment and shows a tooltip, legend lists amounts. `remaining` shows what is still unassigned as a hatched tail. */
export function FlowBar({ total = 0, segments = [], remaining, height = 28, legend = true, animate = true, style }: FlowBarProps) {
  const [on, setOn] = React.useState(!animate);
  const [hi, setHi] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const [barW, setBarW] = React.useState(0);
  React.useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setBarW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  if (!total) return <ChartEmpty height={height + 60} message="No paycheck yet" hint="The flow appears after the first deposit is detected." />;
  const sum = segments.reduce((a, s) => a + s.value, 0), rest = remaining ?? Math.max(0, total - sum);
  const cur = hi != null ? segments[hi] : null;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;
  const tipX = cur && hi != null ? barW * ((segments.slice(0, hi).reduce((a, s) => a + s.value, 0) + cur.value / 2) / total) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, ...style }}>
      <div ref={ref} style={{ position: "relative", display: "flex", height, borderRadius: height / 2, overflow: "hidden", background: "var(--data-track)" }} onMouseLeave={() => setHi(null)}>
        {segments.map((s, i) => <div key={i} onMouseEnter={() => setHi(i)} title={s.label} style={{ width: on ? pct(s.value) : 0, background: s.color, opacity: hi == null || hi === i ? 1 : 0.35, transition: `width var(--dur-draw) var(--ease-out) ${i * 90}ms, opacity var(--dur-fast)`, boxShadow: i ? "-2px 0 0 var(--surface-card)" : "none", cursor: "default", flex: "none" }} />)}
        {rest > 0 ? <div title="Unassigned" style={{ flex: 1, background: "repeating-linear-gradient(135deg, transparent 0 5px, var(--border-strong) 5px 6px)", opacity: 0.6 }} /> : null}
        {cur && barW ? <ChartTooltip x={tipX} y={height / 2} width={barW} title={cur.label} rows={[{ label: `${Math.round((cur.value / total) * 100)}%`, value: cur.value, color: cur.color }]} /> : null}
      </div>
      {legend ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px 16px" }}>
          {segments.map((s, i) => (
            <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--type-body-sm)", color: hi == null || hi === i ? "var(--text-primary)" : "var(--text-tertiary)", transition: "color var(--dur-fast)", minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: s.color, flex: "none" }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              <Money value={s.value} size="sm" cents={false} tone="inherit" />
            </div>
          ))}
          {rest > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--type-body-sm)", color: "var(--text-tertiary)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: "repeating-linear-gradient(135deg, transparent 0 2px, var(--border-strong) 2px 3px)", flex: "none" }} />
              <span style={{ flex: 1 }}>Unassigned</span><Money value={rest} size="sm" cents={false} tone="inherit" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
