import React from 'react';

/**
 * DonutChart — category/merchant breakdown ring. `segments` is
 * [{ label, value, color }]. Renders a thin donut with small gaps between
 * slices and an optional center label (e.g. total). Tonal-green + indigo +
 * amber palette by default — never a rainbow.
 */
const DEFAULT_COLORS = ['var(--green-500)', 'var(--indigo-500)', 'var(--amber-500)', 'var(--green-600)', 'var(--gray-500)'];

export function DonutChart({
  segments = [],
  size = 168,
  thickness = 16,
  gap = 2,                 // degrees between slices
  centerTop,
  centervalue,
  centerSub,
  animate = true,
  style,
}) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gapLen = (gap / 360) * circ;

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const frac = (seg.value || 0) / total;
    const len = Math.max(0, frac * circ - gapLen);
    const node = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={seg.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += frac * circ;
    return node;
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={thickness} />
        {arcs}
      </svg>
      {(centerTop || centervalue || centerSub) ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {centerTop ? <span className="zt-eyebrow">{centerTop}</span> : null}
          {centervalue ? <span className="zt-num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{centervalue}</span> : null}
          {centerSub ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{centerSub}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Legend — a compact list to pair with DonutChart (color dot + label + value). */
export function DonutLegend({ segments = [], total, style }) {
  const sum = total || segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, ...style }}>
      {segments.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], flex: 'none' }} />
          <span style={{ fontSize: 13.5, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
          <span className="zt-num" style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{s.display != null ? s.display : s.value}</span>
        </div>
      ))}
    </div>
  );
}
