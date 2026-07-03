import React from 'react';

/* Catmull-Rom → cubic Bézier for a smooth, non-overshooting line. */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * AreaChart — the marquee trend chart. A single bright series with a soft
 * gradient fill on a faint dotted grid; an optional dotted comparison series
 * (indigo). Minimal labels — let the shape speak. Self-contained SVG.
 *
 * `data` / `compare` are arrays of numbers. `labels` are x-axis ticks.
 */
export function AreaChart({
  data = [],
  compare = null,
  labels = [],
  width = 640,
  height = 220,
  color = 'var(--accent)',
  compareColor = 'var(--data-2)',
  padding = { top: 16, right: 8, bottom: 22, left: 8 },
  showGrid = true,
  fill = true,
  animate = true,
  style,
}) {
  const uid = React.useMemo(() => 'ac' + Math.random().toString(36).slice(2, 8), []);
  // Draw-in via the Web Animations API: the path is fully visible at rest, so
  // a throttled/unsupported animation timeline can never leave the chart blank
  // (same principle as the .zt-enter transform-only rule).
  const lineRef = React.useRef(null);
  const dataKey = data.join(",");
  React.useEffect(() => {
    const el = lineRef.current;
    if (!animate || !el || typeof el.getTotalLength !== 'function' || typeof el.animate !== 'function') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const len = el.getTotalLength();
      el.animate(
        [
          { strokeDasharray: `${len} ${len}`, strokeDashoffset: len },
          { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
        ],
        { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    } catch { /* jsdom / old engines — chart simply appears */ }
  }, [animate, dataKey]);
  const all = compare ? data.concat(compare) : data;
  if (!all.length) return <svg width={width} height={height} style={style} />;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = padding;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const toPts = (arr) => arr.map((d, i) => [
    pad.left + (arr.length === 1 ? plotW / 2 : (i / (arr.length - 1)) * plotW),
    pad.top + (1 - (d - min) / span) * plotH,
  ]);

  const pts = toPts(data);
  const line = smoothPath(pts);
  const areaD = fill ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${pad.top + plotH} L${pts[0][0].toFixed(1)},${pad.top + plotH} Z` : '';
  const cmpLine = compare ? smoothPath(toPts(compare)) : '';

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => pad.top + t * plotH);
  const last = pts[pts.length - 1];

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" fill="none" style={{ display: 'block', overflow: 'visible', ...style }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="70%" stopColor={color} stopOpacity="0.03" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showGrid ? gridYs.map((y, i) => (
        <line key={i} x1={pad.left} y1={y} x2={width - pad.right} y2={y}
          stroke="var(--border-hairline)" strokeWidth="1" strokeDasharray="2 5" opacity="0.7" />
      )) : null}

      {fill ? <path d={areaD} fill={`url(#${uid})`} /> : null}
      <g>
        {compare ? <path d={cmpLine} stroke={compareColor} strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" opacity="0.85" /> : null}
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
        <circle cx={last[0]} cy={last[1]} r="6.5" fill={color} opacity="0.18" />
      </g>
      <path ref={lineRef} d={line} stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

      {labels.length ? labels.map((l, i) => {
        const x = pad.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
        return (
          <text key={i} x={x} y={height - 5} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
            fontFamily="var(--font-sans)" fontSize="11" fill="var(--text-tertiary)">{l}</text>
        );
      }) : null}
    </svg>
  );
}
