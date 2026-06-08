import React from 'react';

function buildPath(data, w, h, pad = 2) {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  return data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (d - min) / span) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

/**
 * Sparkline — a tiny inline trend line (income streams, table rows). No axes.
 * Color auto-greens if the series ends up vs starts, reds if down; override
 * with `color`. `area` adds a faint fill. The line draws in via the Web
 * Animations API but is fully visible at rest (a throttled timeline can never
 * leave it blank).
 */
export function Sparkline({ data = [], width = 88, height = 26, color, area = false, strokeWidth = 1.6, animate = true, style }) {
  const gid = React.useMemo(() => 'spk' + Math.random().toString(36).slice(2, 8), []);

  if (!data || data.length < 2) return <svg width={width} height={height} style={style} />;
  const up = data[data.length - 1] >= data[0];
  const stroke = color || (up ? 'var(--accent)' : 'var(--negative)');
  const line = buildPath(data, width, height);
  const areaPath = area ? `${line} L${width - 2},${height} L2,${height} Z` : '';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ display: 'block', overflow: 'visible', ...style }}>
      {area ? (
        <React.Fragment>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gid})`} />
        </React.Fragment>
      ) : null}
      <path d={line} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
