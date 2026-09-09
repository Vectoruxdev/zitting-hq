"use client";
import * as React from "react";
import { useInteract, focusRing, transition } from "../interact";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export interface WeekDay { date: string | Date; dots?: string[] }
export interface WeekStripProps {
  days: WeekDay[];
  value?: string | Date;
  onChange?: (d: Date) => void;
  showMonth?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

function Day({ d, dt, isSel, isToday, onChange, size }: { d: WeekDay; dt: Date; isSel: boolean; isToday: boolean; onChange?: (d: Date) => void; size: "sm" | "md" }) {
  const it = useInteract(false);
  const h = size === "sm" ? 56 : 68;
  return (
    <button
      type="button" aria-pressed={isSel} aria-label={dt.toDateString()} onClick={() => onChange?.(dt)} {...it.bind}
      style={{ flex: 1, minWidth: 0, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: 0, borderRadius: "var(--radius-lg)", background: isSel ? "var(--accent)" : it.hover ? "var(--surface-hover)" : "transparent", color: isSel ? "var(--text-on-accent)" : "var(--text-primary)", cursor: "pointer", outline: "none", transform: it.press ? "scale(.95)" : "none", padding: 0, ...transition("background-color, color, transform, box-shadow"), ...focusRing(it.focus) }}
    >
      <span style={{ font: "var(--type-overline)", letterSpacing: "var(--ls-caps)", opacity: isSel ? 0.85 : 0.6 }}>{DOW[dt.getDay()]}</span>
      <span className="zh-num" style={{ font: `600 ${size === "sm" ? "var(--fs-md)" : "var(--fs-lg)"}/1 var(--font-num)`, fontVariantNumeric: "tabular-nums", textDecoration: isToday && !isSel ? "underline" : "none", textDecorationColor: "var(--accent)", textUnderlineOffset: 4, textDecorationThickness: 2 }}>{dt.getDate()}</span>
      <span style={{ display: "flex", gap: 3, height: 5 }}>{(d.dots || []).slice(0, 4).map((c, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 3, background: isSel ? "var(--text-on-accent)" : c }} />)}</span>
    </button>
  );
}

/** Horizontal day picker for Calendar, Meals and Appointments. Dots show events, the selected day is a coral pill, today is underlined. */
export function WeekStrip({ days = [], value, onChange, size = "md", style }: WeekStripProps) {
  const sel = value ? new Date(value).toDateString() : null;
  const today = new Date().toDateString();
  return (
    <div style={{ display: "flex", gap: 4, ...style }}>
      {days.map((d, i) => { const dt = new Date(d.date); return <Day key={i} d={d} dt={dt} isSel={dt.toDateString() === sel} isToday={dt.toDateString() === today} onChange={onChange} size={size} />; })}
    </div>
  );
}
