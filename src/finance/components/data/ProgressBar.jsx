import React from 'react';

/**
 * ProgressBar — budget/allowance progress with under / near / over states.
 * `value` and `max` drive the fill; color goes green → amber (≥ nearAt) → red
 * (≥ 1.0 over). Set `tone` to force a color. Thin by default; `height` to size.
 */
export function ProgressBar({
  value = 0,
  max = 100,
  tone,              // override: 'accent' | 'warning' | 'negative' | 'neutral'
  nearAt = 0.85,
  height = 8,
  track = 'var(--surface-sunken)',
  rounded = true,
  animate = true,
  style,
  ...rest
}) {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const over = ratio > 1;
  const near = ratio >= nearAt && ratio <= 1;

  const autoTone = over ? 'negative' : near ? 'warning' : 'accent';
  const resolved = tone || autoTone;
  const colors = {
    accent: 'var(--accent)',
    warning: 'var(--warning)',
    negative: 'var(--negative)',
    neutral: 'var(--gray-400)',
  };
  const fill = colors[resolved] || colors.accent;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: track,
        borderRadius: rounded ? 999 : 4,
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: pct + '%',
          background: fill,
          borderRadius: rounded ? 999 : 4,
        }}
      />
      {over ? (
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: 'var(--negative)', boxShadow: '0 0 8px var(--negative)' }} />
      ) : null}
    </div>
  );
}

/**
 * BudgetRow — a full budget/allowance line: name + avatar/icon, spent vs limit,
 * a big "remaining", and a progress bar. Composes ProgressBar.
 */
export function BudgetRow({ name, left, right, value, max, caption, tone, style, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, ...style }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>{left}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span></div>
        {right}
      </div>
      <ProgressBar value={value} max={max} tone={tone} />
      {caption ? <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{caption}</div> : null}
    </div>
  );
}
