import React from 'react';
import { Icon } from '../core/Icon.jsx';

function fmtCurrency(n, { cents = false, sign = false } = {}) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  const pfx = (sign && n > 0 ? '+' : n < 0 ? '−' : '') + '$';
  return pfx + s;
}

/**
 * Delta — a signed change line, e.g. "+$4.33 (+1.77%)". Green for up, red for
 * down, muted for flat. `value` is the absolute $ change; `percent` optional.
 * `invert` flips color meaning (e.g. when spending going down is good).
 */
export function Delta({ value = 0, percent, cents = true, invert = false, muted = false, size = 13, style }) {
  const up = value > 0;
  const flat = value === 0;
  const good = invert ? !up : up;
  const color = muted || flat ? 'var(--text-tertiary)' : good ? 'var(--positive)' : 'var(--negative)';
  return (
    <span className="zt-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontSize: size, fontWeight: 500, ...style }}>
      {!flat ? <Icon name={up ? 'arrowUpRight' : 'arrowDownRight'} size={size + 1} /> : null}
      {fmtCurrency(value, { cents, sign: false })}
      {percent != null ? <span style={{ opacity: 0.85 }}>({up ? '+' : ''}{percent}%)</span> : null}
    </span>
  );
}

/**
 * useCountUp — animate the numeric portion of a value string (e.g. "$84,920")
 * from 0 → target on mount, preserving prefix/suffix and decimals. Respects
 * prefers-reduced-motion and only animates string values with a number in them.
 */
function useCountUp(value, animate) {
  const isStr = typeof value === 'string';
  const m = isStr ? value.match(/-?\d[\d,]*(\.\d+)?/) : null;
  const target = m ? parseFloat(m[0].replace(/,/g, '')) : null;
  const decimals = m && m[0].includes('.') ? m[0].split('.')[1].length : 0;
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = React.useState(animate && target != null && !reduce ? 0 : target);
  React.useEffect(() => {
    if (!animate || target == null || reduce) { setN(target); return; }
    let raf, start;
    const dur = 750;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setN(target * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Safety net: guarantee the final value even if rAF is throttled (background tab).
    const safety = setTimeout(() => setN(target), dur + 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [value]);
  if (!isStr || target == null) return value;
  const formatted = (n == null ? target : n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return value.replace(m[0], formatted);
}

/**
 * StatTile — the workhorse summary unit: small-caps label → big mono number →
 * muted delta/sub line. `accent` tints the number green. `onClick` makes it a
 * tappable tile (e.g. "Transfers to make" → Transfers).
 */
export function StatTile({
  label,
  value,
  sub,
  delta,            // { value, percent, invert }
  unit,             // e.g. "USD"
  accent = false,
  icon,
  onClick,
  size = 'md',      // sm | md | lg
  animate = true,
  style,
  ...rest
}) {
  const valueSize = size === 'lg' ? 'var(--fs-display)' : size === 'sm' ? 'var(--fs-h1)' : 'var(--fs-title)';
  const display = useCountUp(value, animate);
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="zt-eyebrow">{label}</span>
        {icon ? <Icon name={icon} size={16} style={{ color: 'var(--text-tertiary)' }} /> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span className="zt-num" style={{
          fontSize: valueSize, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1,
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
        }}>{display}</span>
        {unit ? <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>{unit}</span> : null}
      </div>
      {delta ? <Delta value={delta.value} percent={delta.percent} invert={delta.invert} /> : null}
      {sub ? <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sub}</span> : null}
    </div>
  );
}
